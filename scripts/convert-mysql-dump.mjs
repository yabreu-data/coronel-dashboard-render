#!/usr/bin/env node
/**
 * convert-mysql-dump.mjs
 * ---------------------------------------------------------------------------
 * Convierte un volcado lógico de MySQL/TiDB (DROP TABLE + CREATE TABLE +
 * INSERT INTO) en un JSON intermedio pensado para cargarse luego a
 * PostgreSQL/Supabase.
 *
 * Uso:
 *   node scripts/convert-mysql-dump.mjs database/coronel-database.sql database/coronel-data.json
 *
 * Características:
 *   - Solo usa la librería estándar de Node (sin dependencias).
 *   - Ignora la tabla `__drizzle_migrations`.
 *   - Ignora SET FOREIGN_KEY_CHECKS, DROP TABLE, LOCK/UNLOCK TABLES, etc.
 *   - Respeta el orden de columnas de CREATE TABLE y mapea los INSERT por nombre.
 *   - NULL -> null, números sin comillas -> number, cadenas -> string.
 *   - Deshace los escapes de MySQL de las cadenas.
 *   - Mantiene timestamps/fechas como string literal ("YYYY-MM-DD HH:MM:SS").
 *   - Repara mojibake cp1252->UTF-8 únicamente cuando la decodificación UTF-8
 *     inversa es válida (así no toca texto que ya está bien).
 *   - Salida determinista e idempotente (reutiliza generatedAt si el contenido
 *     generado no cambió).
 *
 * Forma de la salida:
 *   {
 *     "generatedAt": "<ISO>",
 *     "source": "database/coronel-database.sql",
 *     "tables": {
 *       "<tabla>": { "columns": ["id", ...], "rows": [[...], ...] }
 *     }
 *   }
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SOURCE = 'database/coronel-database.sql';
const DEFAULT_OUTPUT = 'database/coronel-data.json';

/** Tablas que no forman parte de los datos de negocio. */
const IGNORED_TABLES = new Set(['__drizzle_migrations']);

/**
 * Mapa cp1252 -> code point para los bytes 0x80-0x9F. Los cinco bytes no
 * definidos por Windows-1252 (0x81, 0x8D, 0x8F, 0x90, 0x9D) se tratan como
 * caracteres de control C1, que es lo que hacen los decodificadores tolerantes.
 */
const CP1252_SPECIALS = new Map([
  [0x80, 0x20ac], // €
  [0x82, 0x201a], // ‚
  [0x83, 0x0192], // ƒ
  [0x84, 0x201e], // „
  [0x85, 0x2026], // …
  [0x86, 0x2020], // †
  [0x87, 0x2021], // ‡
  [0x88, 0x02c6], // ˆ
  [0x89, 0x2030], // ‰
  [0x8a, 0x0160], // Š
  [0x8b, 0x2039], // ‹
  [0x8c, 0x0152], // Œ
  [0x8e, 0x017d], // Ž
  [0x91, 0x2018], // ‘
  [0x92, 0x2019], // ’
  [0x93, 0x201c], // “
  [0x94, 0x201d], // ”
  [0x95, 0x2022], // •
  [0x96, 0x2013], // –
  [0x97, 0x2014], // —
  [0x98, 0x02dc], // ˜
  [0x99, 0x2122], // ™
  [0x9a, 0x0161], // š
  [0x9b, 0x203a], // ›
  [0x9c, 0x0153], // œ
  [0x9e, 0x017e], // ž
  [0x9f, 0x0178], // Ÿ
]);

/** code point (un carácter) -> byte cp1252, para revertir el mojibake. */
const CP1252_CHAR_TO_BYTE = new Map();
for (const [byte, codePoint] of CP1252_SPECIALS) {
  CP1252_CHAR_TO_BYTE.set(String.fromCodePoint(codePoint), byte);
}
for (let byte = 0x80; byte <= 0x9f; byte += 1) {
  if (!CP1252_SPECIALS.has(byte)) {
    CP1252_CHAR_TO_BYTE.set(String.fromCharCode(byte), byte);
  }
}

/** Decodificador UTF-8 estricto: lanza si los bytes no son UTF-8 válido. */
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Intenta revertir un mojibake cp1252 -> UTF-8.
 *
 * El volcado pudo generarse así: bytes UTF-8 originales -> se decodificaron
 * como cp1252 -> se volvieron a codificar como UTF-8. Para revertirlo hay que
 * hacer el camino inverso: cada carácter -> su byte cp1252 -> decodificar esos
 * bytes como UTF-8 estricto.
 *
 * Solo se acepta la reparación si TODO el buffer es UTF-8 válido. De esta
 * forma un texto correcto como "Postre gratis en próxima visita" (la ó no forma
 * una secuencia UTF-8 válida al revertirla) se deja intacto.
 *
 * @param {string} value
 * @returns {string} el texto reparado, o el original si no aplica.
 */
export function repairMojibake(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  // Sin caracteres no ASCII no hay nada que reparar.
  if (!/[^\x00-\x7f]/.test(value)) return value;

  const bytes = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    const mapped = CP1252_CHAR_TO_BYTE.get(char);
    if (mapped !== undefined) {
      bytes.push(mapped);
    } else if (codePoint <= 0xff) {
      bytes.push(codePoint);
    } else {
      // Carácter que no existe en cp1252 (→, —, 中文, emoji...): no es mojibake
      // reversible con este método; se deja el original.
      return value;
    }
  }

  let decoded;
  try {
    decoded = UTF8_STRICT.decode(Uint8Array.from(bytes));
  } catch {
    return value; // no era UTF-8 válido al revertir: texto correcto.
  }

  if (decoded.includes('\ufffd') || decoded === value) return value;
  return decoded;
}

/** Deshace un escape de cadena de MySQL (la barra ya fue consumida). */
function unescapeMysqlChar(char) {
  switch (char) {
    case '0':
      return '\0';
    case 'b':
      return '\b';
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case 'Z':
      return '\x1a';
    case "'":
      return "'";
    case '"':
      return '"';
    case '\\':
      return '\\';
    case '%':
      return '%';
    case '_':
      return '_';
    default:
      // MySQL ignora la barra para el resto de caracteres.
      return char;
  }
}

/**
 * Devuelve el índice de la comilla de cierre de una cadena/identificador que
 * empieza en `start`. Soporta escapes con barra y comillas dobladas.
 */
function findClosingQuote(text, start) {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    const char = text[i];
    if (quote !== '`' && char === '\\') {
      i += 2;
      continue;
    }
    if (char === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return -1;
}

/** Devuelve el índice del paréntesis de cierre que corresponde a `openIndex`. */
export function findMatchingParen(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'" || char === '"' || char === '`') {
      const close = findClosingQuote(text, i);
      if (close === -1) return -1;
      i = close;
      continue;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Divide un texto por un separador de nivel superior, sin cortar dentro de
 * cadenas, identificadores entre backticks ni paréntesis anidados.
 */
export function splitTopLevel(text, separator = ',') {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'" || char === '"' || char === '`') {
      const close = findClosingQuote(text, i);
      if (close === -1) return [...parts, text.slice(start)];
      i = close;
      continue;
    }
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * Lee un identificador SQL (entre backticks, entre comillas dobles o desnudo)
 * desde `start`. Devuelve `{ name, next }` o `null`.
 */
function readIdentifier(text, start = 0) {
  let i = start;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (i >= text.length) return null;

  const quote = text[i];
  if (quote === '`' || quote === '"') {
    const close = findClosingQuote(text, i);
    if (close === -1) return null;
    let name = '';
    for (let j = i + 1; j < close; j += 1) {
      if (text[j] === quote && text[j + 1] === quote) {
        name += quote;
        j += 1;
      } else {
        name += text[j];
      }
    }
    return { name, next: close + 1 };
  }

  const match = text.slice(i).match(/^[A-Za-z0-9_$]+/);
  if (!match) return null;
  return { name: match[0], next: i + match[0].length };
}

/** Convierte una lista de bytes UTF-8 en un índice de búsqueda de líneas. */
function createLineIndex(sql) {
  const newlines = [];
  for (let i = 0; i < sql.length; i += 1) {
    if (sql[i] === '\n') newlines.push(i);
  }
  return (offset) => {
    let low = 0;
    let high = newlines.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (newlines[mid] < offset) low = mid + 1;
      else high = mid;
    }
    return low + 1;
  };
}

/**
 * Divide el volcado en sentencias SQL, quitando comentarios de línea y de bloque
 * y respetando cadenas, identificadores y escapes.
 *
 * @returns {{ text: string, offset: number }[]}
 */
export function splitStatements(sql) {
  const statements = [];
  let current = '';
  let startOffset = -1;
  let i = 0;
  const length = sql.length;

  const push = () => {
    const text = current.trim();
    if (text) statements.push({ text, offset: startOffset === -1 ? 0 : startOffset });
    current = '';
    startOffset = -1;
  };

  while (i < length) {
    const char = sql[i];

    if (char === "'" || char === '"' || char === '`') {
      if (startOffset === -1) startOffset = i;
      const quote = char;
      current += char;
      i += 1;
      while (i < length) {
        const inside = sql[i];
        if (quote !== '`' && inside === '\\') {
          current += inside;
          i += 1;
          if (i < length) {
            current += sql[i];
            i += 1;
          }
          continue;
        }
        if (inside === quote) {
          if (sql[i + 1] === quote) {
            current += inside + inside;
            i += 2;
            continue;
          }
          current += inside;
          i += 1;
          break;
        }
        current += inside;
        i += 1;
      }
      continue;
    }

    // Comentario de línea estilo MySQL: "-- " (se exige espacio/control detrás).
    if (char === '-' && sql[i + 1] === '-' && (i + 2 >= length || /\s/.test(sql[i + 2]))) {
      while (i < length && sql[i] !== '\n') i += 1;
      current += ' ';
      continue;
    }

    // Comentario de línea con #.
    if (char === '#') {
      while (i < length && sql[i] !== '\n') i += 1;
      current += ' ';
      continue;
    }

    // Comentario de bloque, incluidos los versionados de MySQL.
    if (char === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1;
      i = Math.min(i + 2, length);
      current += ' ';
      continue;
    }

    if (char === ';') {
      push();
      i += 1;
      continue;
    }

    if (startOffset === -1 && !/\s/.test(char)) startOffset = i;
    current += char;
    i += 1;
  }

  push();
  return statements;
}

/**
 * Parsea una sentencia CREATE TABLE y devuelve su nombre y sus columnas
 * (en el orden en que aparecen), ignorando PRIMARY KEY, UNIQUE KEY, etc.
 */
export function parseCreateTable(statement) {
  const match = statement.match(
    /^CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(`[^`]+`|"[^"]+"|[A-Za-z0-9_$]+)\s*\(/i,
  );
  if (!match) throw new Error('no parece una sentencia CREATE TABLE');

  const tableName = match[1].startsWith('`') || match[1].startsWith('"')
    ? match[1].slice(1, -1).replace(/``/g, '`').replace(/""/g, '"')
    : match[1];

  const openIndex = match[0].length - 1;
  const closeIndex = findMatchingParen(statement, openIndex);
  if (closeIndex === -1) throw new Error(`CREATE TABLE \`${tableName}\` sin paréntesis de cierre`);

  const body = statement.slice(openIndex + 1, closeIndex);
  const columns = [];
  const seen = new Set();

  for (const rawPart of splitTopLevel(body)) {
    const part = rawPart.trim();
    if (part === '') continue;
    // Restricciones y claves: no son columnas.
    if (
      /^(?:PRIMARY\s+KEY|UNIQUE(?:\s+(?:KEY|INDEX))?|KEY|INDEX|CONSTRAINT|FULLTEXT(?:\s+(?:KEY|INDEX))?|SPATIAL(?:\s+(?:KEY|INDEX))?|CHECK|FOREIGN\s+KEY)\b/i.test(
        part,
      )
    ) {
      continue;
    }

    const identifier = readIdentifier(part);
    if (!identifier) continue;
    if (seen.has(identifier.name)) continue;
    seen.add(identifier.name);

    const remainder = part.slice(identifier.next).trim();
    const typeMatch = remainder.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\s*\([^)]*\))?/);
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'desconocido';
    columns.push({ name: identifier.name, type });
  }

  return { name: tableName, columns };
}

/**
 * Parsea una sentencia INSERT INTO. Devuelve:
 *   { table, columns: string[] | null, rows: ValorParseado[][], error?, trailing? }
 *
 * Cada fila es un array de `{ value, kind, warning? }` (ver parseSqlValue).
 *
 * Soporta varias tuplas VALUES (...), (...), ...
 */
export function parseInsert(statement) {
  const match = statement.match(
    /^INSERT\s+(?:(?:LOW_PRIORITY|DELAYED|HIGH_PRIORITY|IGNORE)\s+)*INTO\s+/i,
  );
  if (!match) throw new Error('no parece una sentencia INSERT INTO');

  let rest = statement.slice(match[0].length);
  const identifier = readIdentifier(rest);
  if (!identifier) {
    return { table: null, columns: null, rows: [], error: 'no se pudo leer el nombre de la tabla' };
  }
  const table = identifier.name;
  let position = identifier.next;
  while (position < rest.length && /\s/.test(rest[position])) position += 1;

  let columns = null;
  if (rest[position] === '(') {
    const close = findMatchingParen(rest, position);
    if (close === -1) {
      return { table, columns: null, rows: [], error: 'lista de columnas sin paréntesis de cierre' };
    }
    const inner = rest.slice(position + 1, close);
    columns = inner.trim() === ''
      ? []
      : splitTopLevel(inner)
          .map((part) => readIdentifier(part)?.name)
          .filter((name) => typeof name === 'string');
    position = close + 1;
  }

  const valuesMatch = rest.slice(position).match(/^\s*VALUES\s*/i);
  if (!valuesMatch) {
    return {
      table,
      columns,
      rows: [],
      error: 'INSERT sin cláusula VALUES (¿INSERT ... SET?) no soportado',
    };
  }
  position += valuesMatch[0].length;

  const rows = [];
  while (position < rest.length) {
    while (position < rest.length && /[\s,]/.test(rest[position])) position += 1;
    if (position >= rest.length) break;

    if (rest[position] !== '(') {
      return {
        table,
        columns,
        rows,
        trailing: rest.slice(position).trim(),
      };
    }

    const close = findMatchingParen(rest, position);
    if (close === -1) {
      return { table, columns, rows, error: 'tupla VALUES sin paréntesis de cierre' };
    }
    const inner = rest.slice(position + 1, close);
    const values = inner.trim() === '' ? [] : splitTopLevel(inner).map(parseSqlValue);
    rows.push(values);
    position = close + 1;
  }

  return { table, columns, rows };
}

/**
 * Convierte un token de VALUES a un valor JavaScript.
 * @returns {{ value: *, kind: 'null'|'number'|'string'|'expression', warning?: string }}
 */
export function parseSqlValue(raw) {
  const token = raw.trim();

  if (token === '') {
    return { value: null, kind: 'null', warning: 'valor vacío en la tupla; se usa null' };
  }
  if (/^NULL$/i.test(token)) {
    return { value: null, kind: 'null' };
  }
  if (/^TRUE$/i.test(token)) {
    return { value: 1, kind: 'number' };
  }
  if (/^FALSE$/i.test(token)) {
    return { value: 0, kind: 'number' };
  }

  // Prefijos de juego de caracteres: _utf8mb4'...', N'...', _binary'...'.
  const introducer = token.match(/^(?:_[A-Za-z0-9]+|[Nn])\s*(?=['"])/);
  const literal = introducer ? token.slice(introducer[0].length) : token;

  if (literal[0] === "'" || literal[0] === '"') {
    const quote = literal[0];
    let value = '';
    let i = 1;
    let closed = false;
    while (i < literal.length) {
      const char = literal[i];
      if (char === '\\') {
        if (i + 1 >= literal.length) {
          value += '\\';
          i += 1;
          break;
        }
        value += unescapeMysqlChar(literal[i + 1]);
        i += 2;
        continue;
      }
      if (char === quote) {
        if (literal[i + 1] === quote) {
          value += quote;
          i += 2;
          continue;
        }
        i += 1;
        closed = true;
        break;
      }
      value += char;
      i += 1;
    }
    const trailing = literal.slice(i).trim();
    if (!closed) {
      return { value, kind: 'string', warning: 'cadena sin comilla de cierre' };
    }
    if (trailing !== '') {
      return { value, kind: 'string', warning: `texto inesperado después de la cadena: ${trailing}` };
    }
    return { value, kind: 'string' };
  }

  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)) {
    const value = Number(token);
    if (Number.isFinite(value)) {
      if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
        return {
          value,
          kind: 'number',
          warning: 'entero fuera del rango seguro de JavaScript; se pierde precisión',
        };
      }
      return { value, kind: 'number' };
    }
  }

  // Literales binarios/hex: se conservan como texto para no corromperlos.
  if (/^0x[0-9a-f]+$/i.test(token) || /^[xX]'[0-9a-f]*'$/.test(token) || /^[bB]'[01]*'$/.test(token)) {
    return {
      value: token,
      kind: 'expression',
      warning: 'literal binario/hex conservado como texto',
    };
  }

  return {
    value: token,
    kind: 'expression',
    warning: `valor no reconocido; se conserva como texto: ${token}`,
  };
}

/** Registra una reparación de mojibake, agrupando repeticiones idénticas. */
function recordRepair(repairs, table, column, before, after, line) {
  const key = `${table}\u0000${column}\u0000${before}\u0000${after}`;
  let entry = repairs.get(key);
  if (!entry) {
    entry = { table, column, before, after, count: 0, lines: [] };
    repairs.set(key, entry);
  }
  entry.count += 1;
  if (entry.lines.length < 5) entry.lines.push(line);
}

/**
 * Convierte el texto completo del volcado.
 *
 * @param {string} sqlText
 * @returns {{
 *   tables: Map<string, {name: string, columns: string[], columnTypes: string[], rows: any[][]}>,
 *   repairs: object[],
 *   anomalies: string[],
 *   stats: object,
 * }}
 */
export function convertDump(sqlText) {
  const sql = sqlText.replace(/^\ufeff/, '');
  const lineAt = createLineIndex(sql);
  const statements = splitStatements(sql);

  /** @type {Map<string, {name:string, columns:string[], columnTypes:string[], rows:any[][], insertStatements:number}>} */
  const tables = new Map();
  const repairs = new Map();
  const anomalies = [];
  const stats = {
    statements: statements.length,
    ignoredStatements: 0,
    createStatements: 0,
    insertStatements: 0,
    ignoredTableStatements: 0,
    ignoredTableNames: new Set(),
  };

  const reportedWarnings = new Set();
  const reportedUnknownColumns = new Set();

  const warnOnce = (message) => {
    if (reportedWarnings.has(message)) return;
    reportedWarnings.add(message);
    anomalies.push(message);
  };

  for (const { text: statement, offset } of statements) {
    const line = lineAt(offset);

    // Sentencias de sesión / transacción / DDL que no aportan datos.
    if (/^SET\s+/i.test(statement)) {
      stats.ignoredStatements += 1;
      continue;
    }
    if (/^DROP\s+TABLE\b/i.test(statement)) {
      stats.ignoredStatements += 1;
      continue;
    }
    if (
      /^(?:LOCK|UNLOCK)\s+TABLES\b/i.test(statement) ||
      /^(?:START\s+TRANSACTION|BEGIN|COMMIT|ROLLBACK)\b/i.test(statement)
    ) {
      stats.ignoredStatements += 1;
      continue;
    }

    if (/^CREATE\s+(?:TEMPORARY\s+)?TABLE\b/i.test(statement)) {
      stats.createStatements += 1;
      let definition;
      try {
        definition = parseCreateTable(statement);
      } catch (error) {
        anomalies.push(`Línea ${line}: CREATE TABLE no parseable: ${error.message}`);
        continue;
      }

      if (IGNORED_TABLES.has(definition.name)) {
        stats.ignoredTableNames.add(definition.name);
        stats.ignoredTableStatements += 1;
        continue;
      }

      if (tables.has(definition.name)) {
        anomalies.push(
          `Línea ${line}: CREATE TABLE repetido para \`${definition.name}\`; se reemplaza la definición anterior.`,
        );
      }
      tables.set(definition.name, {
        name: definition.name,
        columns: definition.columns.map((column) => column.name),
        columnTypes: definition.columns.map((column) => column.type),
        rows: [],
        insertStatements: 0,
      });
      continue;
    }

    if (/^INSERT\s+/i.test(statement)) {
      stats.insertStatements += 1;
      const insert = parseInsert(statement);

      if (!insert.table) {
        anomalies.push(`Línea ${line}: INSERT sin tabla reconocible.`);
        continue;
      }
      if (IGNORED_TABLES.has(insert.table)) {
        stats.ignoredTableNames.add(insert.table);
        stats.ignoredTableStatements += 1;
        continue;
      }

      let table = tables.get(insert.table);
      if (!table) {
        const implicitColumns =
          insert.columns && insert.columns.length > 0 ? [...insert.columns] : [];
        anomalies.push(
          `Línea ${line}: INSERT INTO \`${insert.table}\` sin CREATE TABLE previo; se creó una definición implícita` +
            (implicitColumns.length ? ` con las columnas del INSERT.` : ' sin columnas.'),
        );
        table = {
          name: insert.table,
          columns: implicitColumns,
          columnTypes: implicitColumns.map(() => 'implícito'),
          rows: [],
          insertStatements: 0,
        };
        tables.set(insert.table, table);
      }

      table.insertStatements += 1;

      if (insert.error) {
        anomalies.push(`Línea ${line}: INSERT INTO \`${insert.table}\`: ${insert.error}`);
        continue;
      }
      if (insert.trailing) {
        warnOnce(
          `Línea ${line}: INSERT INTO \`${insert.table}\` tiene contenido no soportado después de VALUES ` +
            `(se ignoró): ${preview(insert.trailing)}`,
        );
      }

      const insertColumns = insert.columns;
      const hasColumnList = Array.isArray(insertColumns) && insertColumns.length > 0;
      let mapping = null;
      if (hasColumnList) {
        mapping = insertColumns.map((column) => {
          const index = table.columns.indexOf(column);
          if (index === -1) {
            const key = `${table.name}.${column}`;
            if (!reportedUnknownColumns.has(key)) {
              reportedUnknownColumns.add(key);
              anomalies.push(
                `Línea ${line}: la columna \`${column}\` del INSERT INTO \`${table.name}\` no existe en el CREATE TABLE; se ignora.`,
              );
            }
          }
          return index;
        });
      }

      const expectedValues = hasColumnList ? insertColumns.length : table.columns.length;

      for (const values of insert.rows) {
        const rowNumber = table.rows.length + 1;

        if (values.length !== expectedValues) {
          anomalies.push(
            `Línea ${line}: \`${table.name}\` fila ${rowNumber} tiene ${values.length} valores pero ` +
              `se esperaban ${expectedValues} (${hasColumnList ? 'columnas del INSERT' : 'columnas de la tabla'}); ` +
              'se ajusta con NULL.',
          );
        }

        if (table.columns.length === 0 && values.length > 0) {
          // Sin CREATE TABLE ni lista de columnas: no hay nombres reales.
          anomalies.push(
            `Línea ${line}: \`${table.name}\` no tiene columnas definidas; se omiten ${values.length} valores.`,
          );
          continue;
        }

        const row = new Array(table.columns.length).fill(null);

        for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
          let targetIndex;
          if (hasColumnList) {
            targetIndex = mapping[valueIndex];
          } else {
            targetIndex = valueIndex;
          }
          if (targetIndex === undefined || targetIndex === null || targetIndex < 0) continue;
          if (targetIndex >= row.length) {
            anomalies.push(
              `Línea ${line}: \`${table.name}\` fila ${rowNumber} tiene un valor para una columna fuera de rango; se ignora.`,
            );
            continue;
          }

          const cell = values[valueIndex];
          if (cell.warning) {
            anomalies.push(
              `Línea ${line}: \`${table.name}\` fila ${rowNumber}, columna \`${table.columns[targetIndex]}\`: ${cell.warning}`,
            );
          }

          let value = cell.value;
          if (typeof value === 'string') {
            const repaired = repairMojibake(value);
            if (repaired !== value) {
              recordRepair(repairs, table.name, table.columns[targetIndex], value, repaired, line);
              value = repaired;
            }
          }
          row[targetIndex] = value;
        }

        if (row.includes(undefined)) {
          throw new Error(
            `Error interno: \`${table.name}\` fila ${rowNumber} contiene celdas undefined.`,
          );
        }
        table.rows.push(row);
      }
      continue;
    }

    anomalies.push(`Línea ${line}: sentencia no reconocida (se ignora): ${preview(statement)}`);
  }

  // Tablas creadas pero sin filas: se reportan, igual que pide el contrato.
  for (const table of tables.values()) {
    if (table.rows.length === 0) {
      anomalies.push(`\`${table.name}\`: CREATE TABLE sin INSERT (0 filas).`);
    }
  }

  return {
    tables,
    repairs: [...repairs.values()].sort(
      (a, b) =>
        a.table.localeCompare(b.table) ||
        a.column.localeCompare(b.column) ||
        a.before.localeCompare(b.before),
    ),
    anomalies,
    stats,
  };
}

/** Recorta una sentencia para mostrarla en un aviso. */
function preview(text, maxLength = 90) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

/** Convierte una ruta a formato POSIX para que el JSON sea igual en Windows/Linux. */
function toPosixPath(path) {
  return path.split(sep).join('/');
}

/** Calcula la etiqueta `source` de la salida. */
function sourceLabelFor(sourceAbsolute, sourceArgument) {
  const relativePath = relative(process.cwd(), sourceAbsolute);
  if (relativePath && !relativePath.startsWith('..')) return toPosixPath(relativePath);
  return toPosixPath(sourceArgument);
}

/**
 * Reutiliza generatedAt si la salida previa tiene exactamente los mismos datos.
 * Así el script es idempotente: dos ejecuciones seguidas producen el mismo archivo.
 */
function resolveGeneratedAt(outputAbsolute, source, tablesObject) {
  if (!existsSync(outputAbsolute)) return new Date().toISOString();
  try {
    const previous = JSON.parse(readFileSync(outputAbsolute, 'utf8'));
    if (
      previous &&
      typeof previous.generatedAt === 'string' &&
      previous.source === source &&
      JSON.stringify(previous.tables) === JSON.stringify(tablesObject)
    ) {
      return previous.generatedAt;
    }
  } catch {
    // Salida previa ilegible: se genera una marca nueva.
  }
  return new Date().toISOString();
}

/** Imprime el resumen legible en stdout. */
function printSummary({ sourceLabel, sourceBytes, outputLabel, result, generatedAt, reusedTimestamp }) {
  const lines = [];
  const tableNames = [...result.tables.keys()];
  const nameWidth = Math.max(5, ...tableNames.map((name) => name.length));
  const totalRows = [...result.tables.values()].reduce((sum, table) => sum + table.rows.length, 0);

  lines.push('=== Conversor MySQL/TiDB → JSON intermedio ===');
  lines.push(`Origen   : ${sourceLabel} (${sourceBytes} bytes, ${result.stats.statements} sentencias)`);
  lines.push(`Destino  : ${outputLabel}`);
  lines.push(
    `Tablas   : ${result.tables.size} exportadas, ${result.stats.ignoredTableNames.size} ignorada(s)` +
      (result.stats.ignoredTableNames.size
        ? ` (${[...result.stats.ignoredTableNames].join(', ')})`
        : ''),
  );
  lines.push(`generatedAt: ${generatedAt}${reusedTimestamp ? ' (reutilizado: salida idéntica)' : ''}`);
  lines.push('');
  lines.push(`${'Tabla'.padEnd(nameWidth)}  ${'Filas'.padStart(7)}  ${'Columnas'.padStart(8)}`);
  lines.push(`${'-'.repeat(nameWidth)}  ${'-'.repeat(7)}  ${'-'.repeat(8)}`);
  for (const table of result.tables.values()) {
    lines.push(
      `${table.name.padEnd(nameWidth)}  ${String(table.rows.length).padStart(7)}  ${String(table.columns.length).padStart(8)}`,
    );
  }
  lines.push(`${'-'.repeat(nameWidth)}  ${'-'.repeat(7)}  ${'-'.repeat(8)}`);
  lines.push(`${'TOTAL'.padEnd(nameWidth)}  ${String(totalRows).padStart(7)}`);
  lines.push('');

  lines.push(`Cadenas reparadas (mojibake): ${result.repairs.length}`);
  if (result.repairs.length === 0) {
    lines.push('  (ninguna: todos los strings ya eran UTF-8 válido)');
  } else {
    for (const repair of result.repairs) {
      const linesText = repair.lines.length ? `; líneas ${repair.lines.join(', ')}` : '';
      lines.push(
        `  - ${repair.table}.${repair.column}: ${JSON.stringify(repair.before)} → ` +
          `${JSON.stringify(repair.after)} (${repair.count} fila(s)${linesText})`,
      );
    }
  }
  lines.push('');

  lines.push(`Anomalías / avisos: ${result.anomalies.length}`);
  for (const anomaly of result.anomalies.slice(0, 100)) {
    lines.push(`  - ${anomaly}`);
  }
  if (result.anomalies.length > 100) {
    lines.push(`  … y ${result.anomalies.length - 100} más`);
  }
  lines.push('');
  lines.push('JSON escrito correctamente.');

  console.log(lines.join('\n'));
}

function printUsage() {
  console.log('Uso: node scripts/convert-mysql-dump.mjs [volcado.sql] [salida.json]');
  console.log(`Por defecto: ${DEFAULT_SOURCE} ${DEFAULT_OUTPUT}`);
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return;
  }

  const sourceArgument = argv[0] ?? DEFAULT_SOURCE;
  const outputArgument = argv[1] ?? DEFAULT_OUTPUT;
  const sourceAbsolute = resolve(process.cwd(), sourceArgument);
  const outputAbsolute = resolve(process.cwd(), outputArgument);

  if (!existsSync(sourceAbsolute)) {
    console.error(`Error: no existe el archivo de entrada: ${sourceArgument}`);
    process.exitCode = 1;
    return;
  }

  const rawSql = readFileSync(sourceAbsolute, 'utf8');
  const result = convertDump(rawSql);

  if (result.tables.size === 0) {
    console.error('Error: el volcado no contiene ninguna tabla exportable.');
    process.exitCode = 1;
    return;
  }

  const tablesObject = {};
  for (const table of result.tables.values()) {
    tablesObject[table.name] = {
      columns: table.columns,
      rows: table.rows,
    };
  }

  const sourceLabel = sourceLabelFor(sourceAbsolute, sourceArgument);
  const outputLabel = toPosixPath(relative(process.cwd(), outputAbsolute)) || outputArgument;
  const generatedAt = resolveGeneratedAt(outputAbsolute, sourceLabel, tablesObject);
  const reusedTimestamp =
    existsSync(outputAbsolute) &&
    (() => {
      try {
        return JSON.parse(readFileSync(outputAbsolute, 'utf8')).generatedAt === generatedAt;
      } catch {
        return false;
      }
    })();

  const payload = {
    generatedAt,
    source: sourceLabel,
    tables: tablesObject,
  };

  writeFileSync(outputAbsolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  printSummary({
    sourceLabel,
    sourceBytes: Buffer.byteLength(rawSql, 'utf8'),
    outputLabel,
    result,
    generatedAt,
    reusedTimestamp,
  });
}

const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Error fatal: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  }
}
