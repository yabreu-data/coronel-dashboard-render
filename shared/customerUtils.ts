function parseBirthday(value: string): Date | null {
  const local = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
  const parsed = new Date(value);
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
