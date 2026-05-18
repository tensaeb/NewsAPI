/**
 * All aggregation boundaries use UTC, which matches GMT for calendar-day bucketing.
 */
export function parseUtcCalendarDay(dayISO: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!match) {
    throw new Error(`Invalid calendar day: ${dayISO}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function utcRangeForCalendarDay(day: Date): { start: Date; end: Date } {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
  return { start, end };
}

export function formatUtcCalendarDay(day: Date): string {
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(day.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function previousUtcCalendarDayISO(now: Date = new Date()): string {
  const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const yesterday = new Date(todayMidnight - 24 * 60 * 60 * 1000);
  return formatUtcCalendarDay(yesterday);
}
