// Single source of truth for day semantics. Trajectory's daily surfaces
// ("today") follow the user's LOCAL calendar day; stored timestamps remain
// UTC ISO-8601. Date-only strings ("YYYY-MM-DD") are treated as calendar
// days and computed with UTC-safe arithmetic (no DST traps).

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The user's local calendar day, "YYYY-MM-DD". */
export function todayLocal(): string {
  return toLocalDateString(new Date());
}

/** Date-only arithmetic on "YYYY-MM-DD" strings; unaffected by timezones/DST. */
export function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().split("T")[0];
}

/** Local calendar day shifted by whole days (e.g. yesterday = -1). */
export function dayFromTodayLocal(offset: number): string {
  return addDays(todayLocal(), offset);
}

/** UTC ISO-8601 timestamp for "now". */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * UTC instant bounds covering a local calendar day: [startIso, endIso).
 * `new Date("YYYY-MM-DDT00:00:00")` parses as LOCAL midnight, so these
 * bounds let date-bounded SQL queries (which compare UTC instants) select
 * exactly the events/rows belonging to the given local day.
 */
export function localDayBounds(date: string): { startIso: string; endIso: string } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${addDays(date, 1)}T00:00:00`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** The Monday that starts the local week containing `date` ("YYYY-MM-DD"). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  const backToMonday = dow === 0 ? 6 : dow - 1;
  return addDays(date, -backToMonday);
}
