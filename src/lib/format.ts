/** The app has exactly two locales; anything else reads as English. */
export function localeTag(locale: string): "ar-EG" | "en-US" {
  return locale === "ar" ? "ar-EG" : "en-US";
}

/**
 * Format a value that may arrive as a decimal string (Drizzle returns every
 * `decimal` column as a string) or as a number. Non-numeric input renders an
 * em dash rather than "NaN".
 */
export function formatDecimal(value: string | number, locale: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (value === "" || value === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(localeTag(locale));
}

/**
 * Local calendar date as `YYYY-MM-DD`, for `<input type="date">` defaults.
 *
 * Deliberately not `toISOString().split("T")[0]`, which is UTC: east of
 * Greenwich that reports yesterday's date during the early hours of the
 * morning, so the form would silently default to the wrong day.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
