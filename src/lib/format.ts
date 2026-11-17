import { format } from "date-fns";

// Display formatting (dates, money) lives in next-intl's formatter:
//   server: (await getFormatter()).dateTime(d, "short") / .number(cents / 100, "money")
//   client: useFormatter()
// The helpers below are locale-independent form conversions.

/** "1234.5" or "1234,5" -> 123450. Returns undefined for empty input. */
export function toCents(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

/** Parse an <input type="date"> value at local noon so it never shifts a day across timezones. */
export function parseDateInput(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

/** Format a Date for an <input type="date"> default value. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  return format(new Date(date), "yyyy-MM-dd");
}
