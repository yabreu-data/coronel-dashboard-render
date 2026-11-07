import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import * as supabaseAdmin from "./_core/supabaseAdmin";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Google Sheets (fuente de encuestas y catálogo de meseros)                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_SHEET_ID = "1q9WMz_O_J15B0QKv8QF4zYp7uvwGwm-5aTGfTdz6vHU";
const FALLBACK_SURVEY_SHEET = "Encuestas";
const DEFAULT_SURVEY_SHEET = "Encuestas_Limpias";
const SERVERS_SHEET = "Meseros";
const SURVEY_CACHE_TTL_MS = 60_000;
/* La capa limpia es la fuente de análisis. Si no está disponible, por defecto
   se muestra `Encuestas` con un aviso explícito; con ALLOW_SHEET_FALLBACK=false
   el dashboard se detiene en lugar de mostrar datos sin depurar. */
const ALLOW_SHEET_FALLBACK = (process.env.ALLOW_SHEET_FALLBACK ?? "true") !== "false";
/* Descarta filas marcadas como inválidas por la capa limpia. */
const CLEAN_SHEET_FILTER = (process.env.SURVEY_CLEAN_FILTER ?? "true") !== "false";

const SURVEY_ID_HEADERS = ["ID Único", "id", "ID de Envío"];
const SURVEY_TIMESTAMP_HEADERS = ["Timestamp", "timestamp"];

type SurveyRecord = { id: string; timestamp: string; clientName: string; phone: string; birthday: string; dish: string; comment: string; registeredBy: string; quality: string };
type ServerCatalogItem = { id: string; name: string; active: boolean };

const IGNORED_SURVEY_IDS = new Set(["ENC-000116"]);
const surveyCache = new Map<string, { at: number; sheet: string; value: { records: SurveyRecord[]; serverCatalog: ServerCatalogItem[] } }>();

function getSheetId() {
  return (process.env.GOOGLE_SHEET_ID || "").trim() || DEFAULT_SHEET_ID;
}

/** Pestaña productiva configurada por `GOOGLE_SHEET_TAB`. */
function getConfiguredSurveySheet() {
  return (process.env.GOOGLE_SHEET_TAB || "").trim() || DEFAULT_SURVEY_SHEET;
}

function hasSurveyHeaders(headers: string[]) {
  const normalized = headers.map(value => value.trim());
  return (
    normalized.some(value => SURVEY_ID_HEADERS.includes(value)) &&
    normalized.some(value => SURVEY_TIMESTAMP_HEADERS.includes(value))
  );
}

function normalizeCell(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const NAME_PARTICLES = new Set([
  "de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos",
  "van", "von", "di", "du", "le", "les", "des",
]);

/** Mayúsculas tipo título: "HUMBERTO julon LARA" → "Humberto Julon Lara". */
function titleCaseName(value: string) {
  const base = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!base) return "";
  if (base === "cliente (formulario web)") return "Cliente (Formulario Web)";
  if (base === "registro por mesero") return "Registro por Mesero";
  return base
    .split(" ")
    .map((word, index) => {
      if (index > 0 && NAME_PARTICLES.has(word)) return word;
      return word.replace(/(^|[-'’])([a-záéíóúüñ])/g, (_match, separator: string, char: string) =>
        separator + char.toUpperCase()
      );
    })
    .join(" ");
}

function titleCaseDish(value: string) {
  return String(value || "")
    .split(";")
    .map(part => titleCaseName(part))
    .join("; ");
}

function titleCasePersonOrCode(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^[A-Z]{2,}-\d+$/i.test(text)) return text.toUpperCase();
  return titleCaseName(text);
}

/** Sondea solo la fila de encabezados: evita escanear toda la hoja cuando la pestaña no sirve. */
async function sheetHasSurveyStructure(sheet: string) {
  try {
    const matrix = await fetchSheetMatrix(getSheetId(), sheet, "A1:Z1");
    return hasSurveyHeaders(matrix[0] ?? []);
  } catch {
    return false;
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"') {
      if (quoted && next === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

function getCell(row: string[], headers: string[], name: string) {
  const index = headers.findIndex(value => value.trim() === name);
  return index >= 0 ? row[index] ?? "" : "";
}

function getFirstCell(row: string[], headers: string[], names: string[]) {
  for (const name of names) {
    const value = getCell(row, headers, name);
    if (value.trim()) return value;
  }
  return "";
}

async function fetchSheetMatrix(sheetId: string, sheet: string, range: string) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&range=${encodeURIComponent(range)}`;
  const response = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}`);
  return parseCsv(await response.text());
}

async function fetchSurveyMatrix(sheetId: string, sheet: string) {
  const columnRange = sheet === "Encuestas_Limpias" ? "A:Z" : "A:M";
  const firstRow = sheet === "Encuestas_Limpias" ? "A1:Z1" : "A1:M1";
  const header = await fetchSheetMatrix(sheetId, sheet, firstRow);
  const rows: string[][] = [...header];

  const appendRange = async (start: number, end: number): Promise<void> => {
    let matrix = await fetchSheetMatrix(sheetId, sheet, `A${start}:${columnRange.split(":")[1]}${end}`);
    if (!matrix.length) return;
    if (start > 1 && matrix[0]?.some(value => ["ID Único", "ID de Envío", "Timestamp"].includes(value.trim()))) matrix = matrix.slice(1);
    if (!matrix.length) return;
    const first = matrix[0]?.[0] ?? "";
    const looksMalformed = start > 1 && first.includes("ENC-") && (first.match(/ENC-/g)?.length ?? 0) > 1;
    if (looksMalformed && end > start) {
      const middle = Math.floor((start + end) / 2);
      await appendRange(start, middle);
      await appendRange(middle + 1, end);
      return;
    }
    rows.push(...matrix);
    if (matrix.length < end - start + 1) return;
  };

  for (let start = 2; start <= 1000; start += 40) {
    const before = rows.length;
    await appendRange(start, Math.min(start + 39, 1000));
    if (rows.length === before) break;
  }
  return rows.filter((row, index) => index === 0 || row.some(Boolean));
}

/* Frases que la capa de OCR suele devolver cuando la foto no se pudo leer.
   Se marcan como "Error de lectura" y no entran al análisis. */
const OCR_GARBAGE_COMMENTS = [
  "peabacio muchos ericias hasta la provins",
  "inos encantarla celebrario juntos!",
];

function cleanSurveyComment(value: string) {
  const text = String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  const key = normalizeCell(text);
  if (!key) return "";
  if (OCR_GARBAGE_COMMENTS.some(item => normalizeCell(item) === key)) return "Error de lectura";
  return text;
}

function normalizeQualityLabel(value: string) {
  const key = normalizeCell(value);
  if (key === "bueno") return "Bueno";
  if (key === "regular") return "Regular";
  if (key === "malo") return "Malo";
  // Se conserva explícitamente para no confundirlo con un dato perdido.
  return "Sin calificar";
}

async function getSurveyRecords(sheet: string): Promise<SurveyRecord[]> {
  const matrix = await fetchSurveyMatrix(getSheetId(), sheet);
  const headers = matrix.shift() ?? [];

  if (!hasSurveyHeaders(headers)) {
    if (sheet === DEFAULT_SURVEY_SHEET) return [];
    throw new Error(`La pestaña ${sheet} todavía no tiene el formato esperado: se requieren un identificador y Timestamp.`);
  }

  const mapped = matrix
    .filter(row => row.some(Boolean))
    .map((row, index) => {
      const status = getCell(row, headers, "Estado Registro");
      const rawComment = getFirstCell(row, headers, ["Opinión Limpia", "comment", "Opinión del Producto y Mejoras"]);
      const cleanedComment = cleanSurveyComment(rawComment);
      const commentInvalid = normalizeCell(cleanedComment).includes("error de lectura");
      const comment = commentInvalid ? "" : cleanedComment;
      const quality = normalizeQualityLabel(
        getFirstCell(row, headers, ["Calidad Limpia", "quality", "Calidad del Producto", "Calidad Original"])
      );
      // Una encuesta con comentario ilegible sigue siendo válida para calidad/
      // volumen; solo se descarta el comentario, no el registro completo.
      const dirty = CLEAN_SHEET_FILTER && normalizeCell(status).includes("advertencia");
      if (dirty) return null;
      return {
        id: getFirstCell(row, headers, ["ID Único", "id", "ID de Envío"]) || `fila-${index + 1}`,
        timestamp: getFirstCell(row, headers, ["Timestamp", "timestamp"]),
        clientName: titleCaseName(getFirstCell(row, headers, ["Nombre Cliente", "clientName", "Nombre del Cliente"])),
        phone: getFirstCell(row, headers, ["Número Contacto", "phone", "Número de Contacto"]),
        birthday: getFirstCell(row, headers, ["Cumpleaños Original", "birthday", "Fecha de Cumpleaños"]),
        dish: titleCaseDish(getFirstCell(row, headers, ["Productos Normalizados", "dish", "Plato(s ) Original(es)", "Plato(s) Original(es)"])),
        comment,
        registeredBy: titleCasePersonOrCode(getFirstCell(row, headers, ["Mesero", "registeredBy", "Registrado Por", "Registrado Por Original", "ID Mesero"])),
        quality,
      };
    })
    .filter((record): record is SurveyRecord => record !== null);

  const seen = new Set<string>();
  return mapped.filter(record => {
    if (!record.id || seen.has(record.id)) return false;
    // Registro de prueba retirado del sistema; la fila original del Sheet
    // debe borrarse aparte para que no vuelva a entrar.
    if (IGNORED_SURVEY_IDS.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

async function getServerCatalog(): Promise<ServerCatalogItem[]> {
  const matrix = await fetchSheetMatrix(getSheetId(), SERVERS_SHEET, "A1:D100");
  const headers = matrix.shift() ?? [];
  return matrix
    .filter(row => row.some(Boolean))
    .map(row => ({
      id: getCell(row, headers, "ID Mesero"),
      name: getCell(row, headers, "Nombre"),
      active: getCell(row, headers, "Activo").toLowerCase() !== "no",
    }))
    .filter(item => item.id && item.name);
}

/**
 * Devuelve encuestas + catálogo. Si la pestaña productiva configurada no tiene
 * el formato esperado (o no existe), cae automáticamente a `Encuestas` para que
 * el dashboard nunca quede vacío por un cambio de nombre en el Sheet.
 */
async function getSurveyPayload(sheet: string) {
  const cacheKey = `${getSheetId()}::${sheet}`;
  const cached = surveyCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SURVEY_CACHE_TTL_MS) {
    return { ...cached.value, sheet: cached.sheet, cached: true };
  }

  const load = async (target: string) => {
    const [records, serverCatalog] = await Promise.all([getSurveyRecords(target), getServerCatalog()]);
    return { records, serverCatalog };
  };

  try {
    let resolvedSheet = sheet;
    // Si la pestaña configurada no existe o no tiene encabezados de encuestas,
    // se usa la pestaña de respaldo (con aviso) o se detiene si el fallback está deshabilitado.
    if (sheet !== FALLBACK_SURVEY_SHEET && !(await sheetHasSurveyStructure(sheet))) {
      if (!ALLOW_SHEET_FALLBACK) {
        throw new Error(
          `La fuente limpia "${sheet}" no está disponible (pestaña inexistente o sin encabezados). ` +
            `Ejecuta "Datos → Actualizar Encuestas_Limpias" en el Google Sheet o define ALLOW_SHEET_FALLBACK=true para mostrar datos sin depurar.`
        );
      }
      resolvedSheet = FALLBACK_SURVEY_SHEET;
    }

    const value = await load(resolvedSheet);
    surveyCache.set(cacheKey, { at: Date.now(), sheet: resolvedSheet, value });
    return { ...value, sheet: resolvedSheet, cached: false };
  } catch (error) {
    if (cached) return { ...cached.value, sheet: cached.sheet, cached: true };
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*  Validación de entrada                                                     */
/* -------------------------------------------------------------------------- */

const callInput = z.object({ clientKey: z.string().min(1), clientName: z.string().min(1), phone: z.string().optional(), callDate: z.string().optional(), outcome: z.string().min(1), promotion: z.string().optional(), promotionRedeemed: z.boolean().default(false), nextCallDate: z.string().optional(), recoveryResult: z.string().optional(), notes: z.string().optional(), assignedTo: z.string().max(160).optional(), campaignStage: z.enum(["week", "soon", "tomorrow", "today", "past"]).optional(), campaignChannel: z.enum(["llamada", "whatsapp", "correo", "sms"]).optional(), resolvePriorityKey: z.string().max(220).optional() });
const birthdayCampaignInput = z.object({
  clientKey: z.string().min(1),
  clientName: z.string().min(1),
  phone: z.string().optional(),
  stage: z.enum(["week", "soon", "tomorrow", "today", "past"]),
  channel: z.enum(["llamada", "whatsapp", "correo", "sms"]),
  progressStatus: z.enum(["pending", "contacted", "accepted", "redeemed", "rejected", "noanswer"]).optional(),
  promotion: z.string().max(180).optional(),
  responsible: z.string().max(160).optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  nextActionLabel: z.string().max(120).optional(),
  familyName: z.string().max(160).optional(),
  familyBirthday: z.string().max(20).optional(),
  noRedeemReason: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});
const teamTargetsInput = z.object({ surveysPerServer: z.number().int().min(1).max(10000), surveysPerDelivery: z.number().int().min(1).max(10000), positiveQualityPercent: z.number().int().min(1).max(100) });
const priorityInput = z.object({ priorityKey: z.string().min(1).max(220), status: z.enum(["pending", "in_progress", "done"]), responsible: z.string().max(160).optional(), dueDate: z.string().datetime().nullable().optional() });

const requirePin = (pin?: string) => {
  const adminPin = process.env.ADMIN_PIN || "5956";
  if (pin !== adminPin) throw new TRPCError({ code: "FORBIDDEN", message: "PIN de administrador incorrecto" });
};

const currentActor = (ctx: { user?: { name?: string | null; email?: string | null } | null }, fallback = "Dashboard") =>
  ctx.user?.name ?? ctx.user?.email ?? fallback;

/* -------------------------------------------------------------------------- */
/*  Router                                                                   */
/* -------------------------------------------------------------------------- */

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    sessions: publicProcedure.query(({ ctx }) => (ctx.user ? db.listSessionHistory(ctx.user.openId) : [])),
    adminSessions: publicProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional(), userQuery: z.string().max(160).optional(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(100).default(20) }))
      .query(({ input, ctx }) => {
        if (ctx.user?.role !== "admin") return { rows: [], total: 0 };
        return db.listAdminSessionHistory({
          from: input.from ? new Date(`${input.from}T00:00:00`) : undefined,
          to: input.to ? new Date(`${input.to}T23:59:59.999`) : undefined,
          userQuery: input.userQuery,
          limit: input.pageSize,
          offset: (input.page - 1) * input.pageSize,
        });
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) await db.recordSessionEvent({ openId: ctx.user.openId, action: "logout", ipAddress: ctx.req.ip, userAgent: ctx.req.headers["user-agent"] });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  profile: router({
    updateAvatar: protectedProcedure
      .input(z.object({ avatarPreset: z.enum(["coronel", "chef", "flame", "leaf", "star", "shield"]) }))
      .mutation(({ input, ctx }) => db.updateUserAvatar(ctx.user.openId, input.avatarPreset)),
  }),
  survey: router({
    latest: publicProcedure
      .input(z.object({ tab: z.enum(["original", "limpia"]).default("limpia") }).optional())
      .query(async ({ input }) => {
        const requested = input?.tab === "original" ? FALLBACK_SURVEY_SHEET : getConfiguredSurveySheet();
        const payload = await getSurveyPayload(requested);
        const fallbackUsed = requested !== FALLBACK_SURVEY_SHEET && payload.sheet === FALLBACK_SURVEY_SHEET;
        return {
          records: payload.records,
          serverCatalog: payload.serverCatalog,
          fetchedAt: new Date().toISOString(),
          source: `Google Sheets · ${payload.sheet}`,
          fallbackUsed,
          warning: fallbackUsed
            ? `La pestaña "${requested}" no está disponible: se muestran datos SIN DEPURAR de "${FALLBACK_SURVEY_SHEET}". Ejecuta "Datos → Actualizar Encuestas_Limpias" en el Google Sheet para activar la fuente limpia.`
            : null,
        };
      }),
  }),
  calls: router({
    list: publicProcedure.query(() => db.listCallLogs()),
    create: publicProcedure
      .input(callInput)
      .mutation(async ({ input, ctx }) => {
        const { resolvePriorityKey, ...callData } = input;
        const created = await db.createCallLog({
          ...callData,
          callDate: callData.callDate ? new Date(callData.callDate) : new Date(),
          nextCallDate: callData.nextCallDate ? new Date(callData.nextCallDate) : null,
          promotionRedeemed: callData.promotionRedeemed ? 1 : 0,
          createdBy: currentActor(ctx),
        });
        await db.syncBirthdayProgressFromHistory(created.clientKey);
        const shouldResolve =
          resolvePriorityKey &&
          !/no contest|inválid|invald/i.test(callData.outcome || "");
        if (shouldResolve) {
          await db.savePriorityItem({
            priorityKey: resolvePriorityKey,
            status: "done",
            responsible: null,
            dueDate: null,
            updatedBy: currentActor(ctx),
          });
        }
        return created;
      }),
    update: publicProcedure
      .input(
        z.object({
          id: z.number().int(),
          outcome: z.string().min(1).max(80),
          promotion: z.string().max(180).optional(),
          promotionRedeemed: z.number().int().min(0).max(1),
          recoveryResult: z.string().max(120).optional(),
          notes: z.string().max(2000).optional(),
          callDate: z.string().datetime().optional(),
          nextCallDate: z.string().datetime().nullable().optional(),
          assignedTo: z.string().max(160).optional(),
          adminPin: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requirePin(input.adminPin);
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede editar el historial de llamadas" });
        }
        const { adminPin: _pin, ...values } = input;
        const updated = await db.updateCallLog({
          id: values.id,
          outcome: values.outcome,
          promotion: values.promotion ?? null,
          promotionRedeemed: values.promotionRedeemed,
          recoveryResult: values.recoveryResult ?? null,
          notes: values.notes ?? null,
          callDate: values.callDate ? new Date(values.callDate) : new Date(),
          nextCallDate: values.nextCallDate ? new Date(values.nextCallDate) : null,
          assignedTo: values.assignedTo ?? null,
        });
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Registro de llamada no encontrado" });
        await db.syncBirthdayProgressFromHistory(updated.clientKey);
        await db.recordAdminAudit({
          entity: "llamada",
          action: "editada",
          entityId: String(values.id),
          details: `${values.outcome} · ${values.promotion || "sin promoción"}`,
          changedBy: currentActor(ctx, "Administrador"),
        });
        return updated;
      }),
    remove: publicProcedure
      .input(z.object({ id: z.number().int(), adminPin: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        requirePin(input.adminPin);
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede eliminar registros de llamadas" });
        }
        const result = await db.deleteCallLog(input.id);
        if (result.clientKey) await db.syncBirthdayProgressFromHistory(result.clientKey);
        await db.recordAdminAudit({
          entity: "llamada",
          action: "eliminada",
          entityId: String(input.id),
          details: "Registro eliminado del historial",
          changedBy: currentActor(ctx, "Administrador"),
        });
        return result;
      }),
  }),
  birthdayCampaigns: router({
    list: protectedProcedure.query(() => db.listBirthdayCampaigns()),
    save: protectedProcedure
      .input(birthdayCampaignInput)
      .mutation(({ input, ctx }) =>
        db.saveBirthdayCampaign({
          ...input,
          nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : null,
          updatedBy: currentActor(ctx),
        })
      ),
  }),
  messageTemplates: router({
    list: protectedProcedure.query(() => db.listMessageTemplates()),
    save: protectedProcedure
      .input(z.object({ key: z.enum(["mes", "semana", "dia", "seguimiento"]), body: z.string().min(10).max(2000) }))
      .mutation(({ input, ctx }) => db.saveMessageTemplate(input.key, input.body, currentActor(ctx))),
  }),
  targets: router({
    get: publicProcedure.query(() => db.getTeamTargets()),
    save: publicProcedure
      .input(teamTargetsInput.extend({ periodLabel: z.string().max(120).default("Sin período") }))
      .mutation(({ input, ctx }) => {
        const changedBy = currentActor(ctx);
        const targetValues = { surveysPerServer: input.surveysPerServer, surveysPerDelivery: input.surveysPerDelivery, positiveQualityPercent: input.positiveQualityPercent };
        return db.saveTeamTargets(targetValues).then(result =>
          db.saveTeamTargetHistory({ ...targetValues, periodLabel: input.periodLabel, changedBy }).then(() =>
            db.recordAdminAudit({ entity: "metas", action: "actualizadas", details: `${input.surveysPerServer} encuestas/mesero · ${input.surveysPerDelivery} encuestas/delivery-web · ${input.positiveQualityPercent}% calidad · ${input.periodLabel}`, changedBy }).then(() => result)
          )
        );
      }),
    history: publicProcedure.query(() => db.listTeamTargetHistory()),
  }),
  priorities: router({
    list: publicProcedure.query(() => db.listPriorityItems()),
    history: publicProcedure.input(z.object({ priorityKey: z.string().min(1) })).query(({ input }) => db.listPriorityHistory(input.priorityKey)),
    save: publicProcedure
      .input(priorityInput.extend({ adminPin: z.string().optional() }))
      .mutation(({ input, ctx }) => {
        requirePin(input.adminPin);
        const changedBy = currentActor(ctx);
        return db.savePriorityItem({ ...input, dueDate: input.dueDate ? new Date(input.dueDate) : null, updatedBy: changedBy }).then(result =>
          db.recordAdminAudit({ entity: "prioridad", action: input.status === "done" ? "marcada atendida" : "actualizada", entityId: input.priorityKey, details: `${input.responsible || "Sin responsable"} · ${input.dueDate || "Sin fecha límite"}`, changedBy }).then(() => result)
        );
      }),
  }),
  systemUsers: router({ list: publicProcedure.query(() => db.listSystemUsers()) }),
  accessUsers: router({
    list: publicProcedure.query(({ ctx }) => (ctx.user?.role === "admin" ? db.listAccessUsers() : [])),
    update: publicProcedure
      .input(z.object({ id: z.number().int(), role: z.enum(["user", "admin"]), canViewCustomers: z.number().int().min(0).max(1), canManageCalls: z.number().int().min(0).max(1), canManageTargets: z.number().int().min(0).max(1), canManageUsers: z.number().int().min(0).max(1), canViewAudit: z.number().int().min(0).max(1), active: z.number().int().min(0).max(1), adminPin: z.string().min(1) }))
      .mutation(({ input, ctx }) => {
        requirePin(input.adminPin);
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede cambiar permisos" });
        const { adminPin: _pin, ...values } = input;
        const changedBy = currentActor(ctx, "Administrador");
        return db.updateAccessUser(values).then(result =>
          db.recordAdminAudit({ entity: "acceso", action: input.active ? "cuenta/reactivada" : "cuenta/desactivada", entityId: String(input.id), details: `${input.role} · estado:${input.active ? "activa" : "desactivada"}`, changedBy }).then(() => result)
        );
      }),
  }),
  promotions: router({
    list: publicProcedure.query(() => db.listPromotions()),
    adminList: publicProcedure.query(() => db.listAllPromotions()),
    save: publicProcedure
      .input(z.object({ name: z.string().min(2).max(180), category: z.enum(["recuperacion", "cumpleanos", "fidelidad", "general"]), adminPin: z.string().min(1) }))
      .mutation(({ input, ctx }) => {
        requirePin(input.adminPin);
        const changedBy = currentActor(ctx);
        return db.savePromotion({ name: input.name, category: input.category, active: 1 }).then(result =>
          db.recordAdminAudit({ entity: "promoción", action: "creada", details: `${input.name} · ${input.category}`, changedBy }).then(() => result)
        );
      }),
    update: publicProcedure
      .input(z.object({ id: z.number().int(), name: z.string().min(2).max(180), category: z.enum(["recuperacion", "cumpleanos", "fidelidad", "general"]), active: z.number().int().min(0).max(1), adminPin: z.string().min(1) }))
      .mutation(({ input, ctx }) => {
        requirePin(input.adminPin);
        const changedBy = currentActor(ctx);
        return db.updatePromotion(input).then(result =>
          db.recordAdminAudit({ entity: "promoción", action: input.active ? "activada/editada" : "pausada", entityId: String(input.id), details: `${input.name} · ${input.category}`, changedBy }).then(() => result)
        );
      }),
  }),
  responsibleUsers: router({
    list: publicProcedure.query(() => db.listResponsibleUsers()),
    adminList: publicProcedure.query(() => db.listAllResponsibleUsers()),
    save: publicProcedure
      .input(z.object({ name: z.string().min(2).max(160), email: z.string().email().optional(), active: z.number().int().min(0).max(1).default(1), adminPin: z.string().min(1) }))
      .mutation(({ input, ctx }) => {
        requirePin(input.adminPin);
        const changedBy = currentActor(ctx);
        return db.saveResponsibleUser({ name: input.name, email: input.email, active: input.active }).then(result =>
          db.recordAdminAudit({ entity: "responsable", action: "creado", details: `${input.name}${input.email ? ` · ${input.email}` : ""}`, changedBy }).then(() => result)
        );
      }),
    update: publicProcedure
      .input(z.object({ id: z.number().int(), name: z.string().min(2).max(160), email: z.string().email().nullable().optional(), active: z.number().int().min(0).max(1), adminPin: z.string().min(1) }))
      .mutation(({ input, ctx }) => {
        requirePin(input.adminPin);
        const changedBy = currentActor(ctx);
        return db.updateResponsibleUser(input).then(result =>
          db.recordAdminAudit({ entity: "responsable", action: input.active ? "activado/editado" : "pausado", entityId: String(input.id), details: `${input.name}${input.email ? ` · ${input.email}` : ""}`, changedBy }).then(() => result)
        );
      }),
  }),
  accessRequests: router({
    create: publicProcedure
      .input(z.object({ name: z.string().min(2).max(160), email: z.string().email().max(320), message: z.string().max(500).optional() }))
      .mutation(async ({ input }) => {
        const email = input.email.trim().toLowerCase();
        const existingUser = await db.findUserByEmail(email);
        if (existingUser) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta con ese correo. Si olvidaste tu contraseña, usa la opción de recuperación." });
        }
        const pending = await db.findPendingAccessRequest(email);
        if (pending) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya tienes una solicitud pendiente de aprobación." });
        }
        await db.createAccessRequest({ name: input.name.trim(), email, message: input.message?.trim() || null });
        return { ok: true } as const;
      }),
    list: publicProcedure.query(async ({ ctx }) => (ctx.user?.role === "admin" ? db.listAccessRequests() : [])),
    approve: publicProcedure
      .input(z.object({ id: z.number().int(), adminPin: z.string().min(1), tempPassword: z.string().min(8).max(64).optional() }))
      .mutation(async ({ input, ctx }) => {
        requirePin(input.adminPin);
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede aprobar solicitudes" });
        const request = await db.getAccessRequest(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitud no encontrada" });
        if (request.status === "approved") throw new TRPCError({ code: "CONFLICT", message: "La solicitud ya fue aprobada" });

        const tempPassword = input.tempPassword || supabaseAdmin.generateTemporaryPassword();
        const authUser = await supabaseAdmin.ensureAuthUser({ email: request.email, password: tempPassword, name: request.name });
        await db.activateUserFromAuth({ email: request.email, openId: authUser.id, name: request.name });

        const changedBy = currentActor(ctx, "Administrador");
        await db.markAccessRequest(request.id, "approved", changedBy);
        await db.recordAdminAudit({ entity: "acceso", action: "solicitud aprobada", entityId: String(request.id), details: `${request.name} · ${request.email}`, changedBy });
        return { ok: true, email: request.email, name: request.name, tempPassword } as const;
      }),
    reject: publicProcedure
      .input(z.object({ id: z.number().int(), adminPin: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        requirePin(input.adminPin);
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede rechazar solicitudes" });
        const request = await db.getAccessRequest(input.id);
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitud no encontrada" });
        const changedBy = currentActor(ctx, "Administrador");
        await db.markAccessRequest(request.id, "rejected", changedBy);
        await db.recordAdminAudit({ entity: "acceso", action: "solicitud rechazada", entityId: String(request.id), details: `${request.name} · ${request.email}`, changedBy });
        return { ok: true } as const;
      }),
  }),
  adminAuth: router({
    resetPassword: publicProcedure
      .input(z.object({ openId: z.string().min(1), adminPin: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        requirePin(input.adminPin);
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo un administrador puede restablecer contraseñas" });
        const target = await db.getUserByOpenId(input.openId);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
        const tempPassword = supabaseAdmin.generateTemporaryPassword();
        await supabaseAdmin.setAuthPasswordByUserId(input.openId, tempPassword);
        const changedBy = currentActor(ctx, "Administrador");
        await db.recordAdminAudit({ entity: "acceso", action: "contraseña restablecida", entityId: String(target.id), details: `${target.name ?? target.email ?? target.openId}`, changedBy });
        return { ok: true, tempPassword, name: target.name, email: target.email } as const;
      }),
  }),
  adminAudit: router({ list: publicProcedure.query(() => db.listAdminAuditLog()) }),
});

export type AppRouter = typeof appRouter;
