export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const PST_OFFSET = 8 * HOUR;
export function pst(value: number | string | Date = Date.now()): string {
  const ms =
    value instanceof Date
      ? value.getTime()
      : typeof value === "string"
        ? Date.parse(value)
        : value;
  if (!Number.isFinite(ms)) throw new Error("Invalid timestamp");
  return new Date(ms - PST_OFFSET).toISOString().slice(0, 19) + "-08:00";
}
export const pstDate = (value: number | string | Date = Date.now()) =>
  pst(value).slice(0, 10);
export const pstHour = (value: number | string = Date.now()) =>
  pst(
    Math.floor((typeof value === "string" ? Date.parse(value) : value) / HOUR) *
      HOUR,
  );
export const midnight = (date: string) => `${date}T00:00:00-08:00`;
export const shiftDate = (date: string, days: number) =>
  pstDate(Date.parse(midnight(date)) + days * DAY);
export function validPst(s: string): boolean {
  return (
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d-08:00$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    pst(s) === s
  );
}
export function validDate(s: string): boolean {
  return /^\d{4}-\d\d-\d\d$/.test(s) && validPst(midnight(s));
}
export function hoursBetween(from: string, to: string): string[] {
  const result: string[] = [];
  for (let ms = Date.parse(from); ms < Date.parse(to); ms += HOUR)
    result.push(pst(ms));
  return result;
}
export function displayTime(s: string | null | undefined): string {
  if (!s) return "—";
  const h = Number(s.slice(11, 13));
  return `${h % 12 || 12}:${s.slice(14, 16)}${h >= 12 ? "p" : "a"}`;
}
export const displayHour = (s: string) =>
  `${Number(s.slice(11, 13)) % 12 || 12}${Number(s.slice(11, 13)) >= 12 ? "p" : "a"}`;
