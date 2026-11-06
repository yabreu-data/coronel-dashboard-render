function parseBirthday(value: string): Date | null {
  const text = String(value ?? "").trim();
  // dd/mm, dd/mm/yy y dd/mm/yyyy. El año de 2 dígitos se interpreta como
  // 2000+ si es <= 26; si no, 1900+. Evita que "08/11/83" se lea como agosto.
  const local = text.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (local) {
    const day = Number(local[1]);
    const month = Number(local[2]);
    let year = local[3] ? Number(local[3]) : new Date().getFullYear();
    if (local[3] && year < 100) year += year <= 26 ? 2000 : 1900;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isBirthdayInNextDays(value: string, reference = new Date(), days = 7): boolean {
  const birthday = parseBirthday(value);
  if (!birthday) return false;
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + days);
  let occurrence = new Date(reference.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (occurrence < start) occurrence = new Date(reference.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
  return occurrence >= start && occurrence <= end;
}
