"""Análisis exploratorio ampliado de calidad de datos de Coronel."""

from __future__ import annotations

import io
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date, datetime

import pandas as pd

SHEET_ID = "1q9WMz_O_J15B0QKv8QF4zYp7uvwGwm-5aTGfTdz6vHU"
BASE = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv"


def fetch(sheet: str, cell_range: str) -> pd.DataFrame:
    url = f"{BASE}&sheet={urllib.parse.quote(sheet)}&range={urllib.parse.quote(cell_range)}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        text = response.read().decode("utf-8", errors="replace")
    df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)
    df.columns = [str(c).strip() for c in df.columns]
    return df


def norm(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", text).strip().lower()


def parse_birthday(value: str):
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?", str(value).strip())
    if not m:
        return None
    day, month = int(m.group(1)), int(m.group(2))
    year = int(m.group(3)) if m.group(3) else None
    if year is not None and year < 100:
        year += 2000 if year <= 26 else 1900
    try:
        datetime(year or 2000, month, day)
    except ValueError:
        return None
    return day, month, year


def parse_date(value: str):
    text = str(value).strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?", text)
    if not m:
        return None
    day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if year < 100:
        year += 2000 if year <= 26 else 1900
    hour = int(m.group(4) or 0)
    minute = int(m.group(5) or 0)
    try:
        return datetime(year, month, day, hour, minute)
    except ValueError:
        return None


def age_at(birthday, survey_date):
    if not birthday or birthday[2] is None or not survey_date:
        return None
    day, month, year = birthday
    age = survey_date.year - year
    if (survey_date.month, survey_date.day) < (month, day):
        age -= 1
    return age if 0 <= age <= 120 else None


def main() -> int:
    raw = fetch("Encuestas", "A1:M2000")
    clean = fetch("Encuestas_Limpias", "A1:AU2000")
    # OJO: la tabla limpia tiene "Timestamp" (humano) y "timestamp" (contrato).
    # Se usa coincidencia exacta para no confundirlos (pandas es case-sensitive).
    def c(name: str) -> str:
        return name

    print("=" * 80)
    print("PERFIL DE DATOS")
    print("=" * 80)
    print(f"Encuestas (cruda): {len(raw)} filas")
    print(f"Encuestas_Limpias: {len(clean)} filas")
    print(f"Columnas limpias: {len(clean.columns)}")

    # Fechas de encuesta (raw: col A ID, B Timestamp)
    raw_ts = raw[raw.columns[1]].astype(str)
    raw_dates = raw_ts.map(parse_date).dropna()
    print(f"\nFechas de encuesta válidas: {len(raw_dates)} · rango {raw_dates.min():%Y-%m-%d} → {raw_dates.max():%Y-%m-%d}")
    print(f"Timestamps con hora: {int(raw_ts.str.contains(':').sum())} · solo fecha: {int(raw_ts.str.fullmatch(r'\d{1,2}/\d{1,2}/\d{2,4}').sum())}")
    print("Hora de registro (si existe): " + ", ".join(
        f"{k}: {v}" for k, v in Counter(raw_ts[raw_ts.str.contains(':')].str.extract(r"(\d{1,2}):\d{2}")[0]).most_common(6)
    ))

    # Nulos clave en raw
    print("\nNulos en campos clave (Encuestas cruda):")
    for index, label in [(2, "ID Cliente"), (3, "Nombre"), (4, "Contacto"), (5, "Cumpleaños"), (8, "Plato"), (9, "Opinión"), (10, "Calidad")]:
        values = raw[raw.columns[index]].astype(str).str.strip()
        print(f"  - {label}: vacíos {int((values == '').sum())} ({((values == '') .mean() * 100):.1f}%)")

    # Calidad raw
    print("\nCalidad original: " + ", ".join(f"{k!r}: {v}" for k, v in Counter(raw[raw.columns[10]].str.strip()).most_common()))

    # Cumpleaños
    birthdays = clean[c("Cumpleaños Original")].str.strip()
    parsed = birthdays.map(parse_birthday)
    print(f"\nCumpleaños parseables: {parsed.notna().sum()}/{len(clean)} · sin año: {sum(1 for b in parsed if b and b[2] is None)} · inválidos: {int(parsed.isna().sum())}")
    print(f"Sin año (columna Tiene Año): {int((clean[c('Tiene Año Cumpleaños')] != 'Sí').sum())}")

    # Edad real calculada desde la fecha de nacimiento
    ages = [
        age_at(parsed.iloc[i], parse_date(clean[c("Timestamp")].iloc[i]))
        for i in range(len(clean))
    ]
    valid_ages = [a for a in ages if a is not None]
    print(f"Edad calculable: {len(valid_ages)}/{len(clean)}")
    if valid_ages:
        s = pd.Series(valid_ages)
        print(f"Edad: media {s.mean():.1f}, mediana {s.median():.0f}, min {s.min()}, max {s.max()}")
        print("Rangos: " + ", ".join(f"{k}: {v}" for k, v in pd.cut(s, [0, 17, 24, 34, 44, 54, 64, 120], labels=["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]).value_counts().items()))

    # Teléfonos / clientes
    phones = clean[c("Número Contacto")].astype(str).str.strip()
    client_ids = clean[c("ID Cliente")].astype(str).str.strip()
    phone_norm = phones.map(lambda v: re.sub(r"\D", "", v))
    print(f"\nTeléfonos: únicos {phone_norm.nunique()} · vacíos {int((phone_norm == '').sum())}")
    repeated = phone_norm[phone_norm.duplicated(keep=False) & (phone_norm != "")]
    print(f"Teléfonos en más de una encuesta: {repeated.nunique()} · encuestas afectadas: {len(repeated)}")
    print(f"Clientes (ID) únicos: {client_ids.nunique()} · con más de una encuesta: {int((client_ids.value_counts() > 1).sum())}")
    # Mismo teléfono con nombres distintos
    same_phone_diff_name = clean.groupby(phone_norm)[c("Nombre Cliente")].nunique()
    print(f"Teléfonos con nombres distintos: {int((same_phone_diff_name > 1).sum())}")

    # Duplicados
    duplicates = clean.duplicated(subset=[c("Timestamp"), c("Nombre Cliente"), c("Número Contacto")], keep=False)
    print(f"Filas duplicadas por (timestamp, nombre, teléfono): {int(duplicates.sum())}")
    print("Grupos duplicados (ejemplos):")
    for _, group in clean[duplicates].groupby([c("Timestamp"), c("Nombre Cliente"), c("Número Contacto")], dropna=False):
        print(f"  - {group[c('Timestamp')].iloc[0]} · {group[c('Nombre Cliente')].iloc[0]} · {group[c('Número Contacto')].iloc[0]} → {len(group)} filas")

    # Comentarios
    comments = clean[c("Opinión Limpia")].astype(str).str.strip()
    non_empty = comments[comments != ""]
    print(f"\nComentarios: vacíos {int((comments == '').sum())} ({(comments == '').mean()*100:.1f}%) · únicos {comments.nunique()}")
    print(f"Error de lectura: {int((comments == 'Error de lectura').sum())}")
    print("Comentarios repetidos:")
    for value, count in Counter(non_empty).most_common(8):
        if count > 1:
            print(f"  - {value!r}: {count}")

    # Sentimiento básico vs calidad
    negative_words = r"malo|fr[ií]o|seco|dura|sin sabor|p[ée]simo|regular|feo|demora|tarde|caro|small|poca"
    positive_words = r"rico|excelente|buen[oa]|delicioso|fresco|agradable|amable|limpio|recomend"
    quality = clean[c("Calidad Limpia")].str.strip()
    neg_comment = non_empty.str.lower().str.contains(negative_words, regex=True)
    pos_comment = non_empty.str.lower().str.contains(positive_words, regex=True)
    mismatch = clean.loc[non_empty.index[(quality.loc[non_empty.index] == "Bueno") & neg_comment]]
    print(f"Posible contradicción: calidad Bueno pero comentario negativo: {len(mismatch)}")
    for _, row in mismatch.head(6).iterrows():
        print(f"  - {row[c('Nombre Cliente')]}: {row[c('Opinión Limpia')]!r}")

    # Productos
    dishes = clean[c("Productos Normalizados")].astype(str).str.strip()
    categories = Counter()
    for value in dishes:
        for part in re.split(r";", value):
            part = part.strip()
            if part:
                categories[part] += 1
    print(f"\nProductos normalizados únicos: {dishes.nunique()}")
    print("Categorías/productos: " + ", ".join(f"{k}: {v}" for k, v in categories.most_common(15)))

    # Meseros / fuente
    waiters = clean[c("Mesero")].astype(str).str.strip()
    sources = clean[c("Fuente")].astype(str).str.strip()
    print(f"\nMeseros: únicos {waiters.nunique()}")
    print("Valores mesero: " + ", ".join(f"{k!r}: {v}" for k, v in Counter(waiters).most_common()))
    print("Fuente: " + ", ".join(f"{k!r}: {v}" for k, v in Counter(sources).most_common()))

    # Nombres
    names = clean[c("Nombre Cliente")].str.strip()
    title_issues = names[~names.str.match(r"^[A-ZÁÉÍÓÚÑ][a-záéíóúüñ]*(?: [A-ZÁÉÍÓÚÑ][a-záéíóúüñ]*)*$")]
    print(f"\nNombres fuera del formato título: {len(title_issues)}")
    print("Ejemplos: " + "; ".join(title_issues.drop_duplicates().head(10)))

    # Posibles pruebas
    test_mask = names.str.lower().str.contains(r"prueba|test|demo", regex=True) | phone_norm.isin(["", "000000000", "999999999"])
    print(f"\nPosibles registros de prueba: {int(test_mask.sum())}")
    print(" - " + "; ".join(names[test_mask].drop_duplicates().head(10)))

    # Estado y contrato
    status = clean[c("Estado Registro")].astype(str)
    print(f"\nEstado Registro: {dict(status.map(lambda v: 'Advertencia' if v.startswith('Advertencia') else 'Válido').value_counts())}")
    print(f"Estado Edad: {dict(clean[c('Estado Edad')].value_counts().head(5))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
