export type DateParts = { year: number; month: number; day: number };

/** Parses a YYYY-MM-DD value without applying a timezone. */
export function parseDateOnlyParts(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function lastDayOfMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Monthly/yearly occurrences use the anchor's day-of-month. When that day
 * does not exist in a month (31, 30, 29 Feb) we clamp to the last day, so a
 * Jan 31 rule still fires on Feb 28/29 and a Feb 29 birthday fires on Feb 28
 * in non-leap years.
 */
export function matchesCalendarRecurrence(
  type: "monthly" | "yearly",
  anchor: string | null,
  today: Date,
): boolean {
  const parts = parseDateOnlyParts(anchor);
  if (!parts) return false;
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const day = today.getUTCDate();

  if (type === "monthly") {
    // A future start date must not produce earlier occurrences.
    if (Date.UTC(year, month, 1) < Date.UTC(parts.year, parts.month, 1)) return false;
    const expected = Math.min(parts.day, lastDayOfMonthUtc(year, month));
    return day === expected;
  }

  if (year < parts.year || month !== parts.month) return false;
  const expected = Math.min(parts.day, lastDayOfMonthUtc(year, month));
  return day === expected;
}
