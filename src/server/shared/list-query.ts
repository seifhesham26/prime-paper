import { z } from "zod";

/**
 * Escape the wildcards Postgres `LIKE`/`ILIKE` treats as special, so a user
 * typing "100%" searches for the literal text rather than matching every row.
 *
 * The backslash must be replaced first — doing it later would also escape the
 * backslashes this function just introduced.
 */
export function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** A contains-match pattern for `ilike`. */
export function likePattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

/**
 * Resolve a requested sort key against a whitelist.
 *
 * Zod already constrains `sortBy` to an enum at the router boundary; this is
 * the second gate, at the point where a column is actually chosen. A sort key
 * must never reach `orderBy` as an arbitrary string.
 */
export function pickSortKey<K extends string>(
  sortBy: string | undefined,
  allowed: readonly K[],
): K | null {
  if (!sortBy) return null;
  return (allowed as readonly string[]).includes(sortBy) ? (sortBy as K) : null;
}

/**
 * The list-query fields every paged `GetXSchema` shares. Spread into the
 * domain's own `z.object({ ... })` rather than extended, so each domain keeps
 * one flat schema.
 */
export function listQueryFields<T extends readonly [string, ...string[]]>(
  sortKeys: T,
) {
  return {
    page: z.number().int().min(1).default(1),
    /** Fetching to fill a picker rather than to page a table. */
    forDropdown: z.boolean().default(false),
    search: z.string().trim().max(200).optional(),
    sortBy: z.enum(sortKeys).optional(),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  };
}

export type ListQueryInput = {
  page: number;
  forDropdown: boolean;
  search?: string;
  sortBy?: string;
  sortDir: "asc" | "desc";
};
