import { format } from "date-fns";

/** "1234.5" -> 123450. Returns undefined for empty input. */
export function toCents(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
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

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}
