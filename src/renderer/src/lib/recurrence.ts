export type RecurrenceType = "weekly" | "interval" | "monthly" | "yearly";

export type DateParts = { year: number; month: number; day: number };

/** Parses a YYYY-MM-DD value without applying a timezone. */
export function parseDateOnly(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function normalizeRecurrenceType(
  value: string | null | undefined,
  days: number[] = [],
  intervalDays = 0,
): RecurrenceType | null {
  if (value === "weekly" || value === "interval" || value === "monthly" || value === "yearly") {
    return value;
  }
  if (intervalDays > 0) return "interval";
  if (days.length > 0) return "weekly";
  return null;
}

export function isCalendarRecurrence(type: string | null | undefined): type is "monthly" | "yearly" {
  return type === "monthly" || type === "yearly";
}

/** The day a monthly/yearly rule falls on in a given month (clamped to the last day). */
export function calendarOccurrenceDay(
  type: "monthly" | "yearly",
  anchor: string | null | undefined,
  year: number,
  month: number,
): number | null {
  const parts = parseDateOnly(anchor);
  if (!parts) return null;
  if (type === "yearly" && parts.month !== month) return null;
  return Math.min(parts.day, lastDayOfMonth(year, month));
}

export function nextMonthlyOccurrence(anchor: string, from = new Date()): Date | null {
  const parts = parseDateOnly(anchor);
  if (!parts) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const anchorMonth = new Date(parts.year, parts.month, 1);
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (anchorMonth > cursor) cursor = anchorMonth;
  for (let offset = 0; offset < 13; offset += 1) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    const day = calendarOccurrenceDay("monthly", anchor, monthStart.getFullYear(), monthStart.getMonth());
    if (day === null) return null;
    const candidate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    if (candidate >= start) return candidate;
  }
  return null;
}

export function nextYearlyOccurrence(anchor: string, from = new Date()): Date | null {
  const parts = parseDateOnly(anchor);
  if (!parts) return null;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const firstYear = Math.max(start.getFullYear(), parts.year);
  for (let year = firstYear; year <= firstYear + 1; year += 1) {
    const day = calendarOccurrenceDay("yearly", anchor, year, parts.month);
    if (day === null) return null;
    const candidate = new Date(year, parts.month, day);
    if (candidate >= start) return candidate;
  }
  return null;
}

export function nextCalendarOccurrence(
  type: "monthly" | "yearly",
  anchor: string | null | undefined,
  from = new Date(),
): Date | null {
  if (!anchor) return null;
  return type === "monthly" ? nextMonthlyOccurrence(anchor, from) : nextYearlyOccurrence(anchor, from);
}
