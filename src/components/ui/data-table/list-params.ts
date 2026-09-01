export type SortDir = "asc" | "desc";

export type ListParams = {
  page: number;
  search: string;
  sortBy: string | null;
  sortDir: SortDir;
};

/**
 * Read list state out of the URL.
 *
 * `sortBy` is checked against a whitelist here as well as on the server. The
 * server's check is the one that matters for safety; this one keeps a stale or
 * hand-edited URL from rendering a sort indicator on a column that does not
 * exist.
 */
export function parseListParams(
  params: URLSearchParams,
  allowedSortKeys: readonly string[],
): ListParams {
  const rawPage = Number(params.get("page"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawSortBy = params.get("sortBy");
  const sortBy = rawSortBy && allowedSortKeys.includes(rawSortBy) ? rawSortBy : null;

  const rawDir = params.get("sortDir");
  const sortDir: SortDir = rawDir === "asc" ? "asc" : "desc";

  return {
    page,
    search: (params.get("search") ?? "").trim(),
    sortBy,
    sortDir,
  };
}

/**
 * Cycle a column header through ascending, descending, then unsorted.
 * Clicking a different column starts that column fresh at ascending.
 */
export function nextSortDir(
  current: Pick<ListParams, "sortBy" | "sortDir">,
  key: string,
): { sortBy: string | null; sortDir: SortDir } {
  if (current.sortBy !== key) return { sortBy: key, sortDir: "asc" };
  if (current.sortDir === "asc") return { sortBy: key, sortDir: "desc" };
  return { sortBy: null, sortDir: "desc" };
}

/**
 * Merge a patch into the current query string.
 *
 * Changing the search term or the sort resets to the first page — page 4 of
 * the old result set is meaningless against the new one. Defaults are omitted
 * rather than written, so the common case stays a clean URL.
 */
export function buildListParams(
  current: URLSearchParams,
  patch: Partial<ListParams>,
): URLSearchParams {
  const next = new URLSearchParams(current);

  const resetsPage =
    patch.search !== undefined ||
    patch.sortBy !== undefined ||
    patch.sortDir !== undefined;

  if (patch.search !== undefined) {
    const term = patch.search.trim();
    if (term) next.set("search", term);
    else next.delete("search");
  }

  if (patch.sortBy !== undefined) {
    if (patch.sortBy) {
      next.set("sortBy", patch.sortBy);
      next.set("sortDir", patch.sortDir ?? "asc");
    } else {
      next.delete("sortBy");
      next.delete("sortDir");
    }
  }

  const page = resetsPage ? 1 : patch.page;
  if (page !== undefined) {
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
  }

  return next;
}
