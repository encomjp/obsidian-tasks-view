// ISO date (yyyy-MM-dd) helpers on UTC arithmetic, so results never depend on the time zone or DST.

export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parse(value: string): Date {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** null when the result would leave the year range 1..9999. */
function checked(date: Date): string | null {
  const year = date.getUTCFullYear();
  return year < 1 || year > 9999 ? null : format(date);
}

export function addDays(value: string, days: number): string | null {
  const date = parse(value);
  date.setUTCDate(date.getUTCDate() + days);
  return checked(date);
}

/** Like C#'s AddMonths: the day is clamped to the end of a shorter month. */
export function addMonths(value: string, months: number): string | null {
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12 + 12) % 12 + 1;
  if (year < 1 || year > 9999) return null;
  return format(new Date(Date.UTC(year, month - 1, Math.min(d, daysInMonth(year, month)))));
}

export function addYears(value: string, years: number): string | null {
  return addMonths(value, years * 12);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(value: string): number {
  return parse(value).getUTCDay();
}

/** Monday of the week containing `value`. */
export function mondayOf(value: string): string {
  const back = (weekday(value) + 6) % 7;
  return addDays(value, -back) ?? value;
}

export function localToday(now: Date = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Whole days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

/** "H:mm" or "HH:mm" → "HH:mm", or null when it is not a valid time of day. */
export function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  return h < 24 && m < 60 ? `${String(h).padStart(2, "0")}:${match[2]}` : null;
}

/** Local Date for a date and an optional time. */
export function toLocal(date: string, time: string | null): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time ? (time.split(":").map(Number) as [number, number]) : [0, 0];
  return new Date(y, m - 1, d, h, mi);
}
