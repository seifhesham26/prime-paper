import { describe, expect, it } from "vitest";
import { buildListParams, nextSortDir, parseListParams } from "./list-params";

const ALLOWED = ["name", "createdAt"] as const;

describe("parseListParams", () => {
  it("defaults to page 1 with no search and no sort", () => {
    expect(parseListParams(new URLSearchParams(), ALLOWED)).toEqual({
      page: 1,
      search: "",
      sortBy: null,
      sortDir: "desc",
    });
  });

  it("reads a valid sort key", () => {
    const p = new URLSearchParams("sortBy=name&sortDir=asc");
    expect(parseListParams(p, ALLOWED)).toMatchObject({
      sortBy: "name",
      sortDir: "asc",
    });
  });

  it("drops a sort key that is not whitelisted", () => {
    const p = new URLSearchParams("sortBy=password&sortDir=asc");
    expect(parseListParams(p, ALLOWED).sortBy).toBeNull();
  });

  it("falls back to desc for a bogus direction", () => {
    const p = new URLSearchParams("sortBy=name&sortDir=sideways");
    expect(parseListParams(p, ALLOWED).sortDir).toBe("desc");
  });

  it("clamps a zero or negative page to 1", () => {
    expect(parseListParams(new URLSearchParams("page=0"), ALLOWED).page).toBe(1);
    expect(parseListParams(new URLSearchParams("page=-3"), ALLOWED).page).toBe(1);
  });

  it("clamps a non-numeric page to 1", () => {
    expect(parseListParams(new URLSearchParams("page=abc"), ALLOWED).page).toBe(1);
  });

  it("trims the search term", () => {
    const p = new URLSearchParams("search=  acme  ");
    expect(parseListParams(p, ALLOWED).search).toBe("acme");
  });
});

describe("nextSortDir", () => {
  const base = { page: 1, search: "", sortBy: null, sortDir: "desc" } as const;

  it("sorts ascending when a new column is chosen", () => {
    expect(nextSortDir({ ...base }, "name")).toEqual({
      sortBy: "name",
      sortDir: "asc",
    });
  });

  it("flips ascending to descending on the active column", () => {
    expect(nextSortDir({ ...base, sortBy: "name", sortDir: "asc" }, "name")).toEqual({
      sortBy: "name",
      sortDir: "desc",
    });
  });

  it("clears the sort on the third click", () => {
    expect(nextSortDir({ ...base, sortBy: "name", sortDir: "desc" }, "name")).toEqual({
      sortBy: null,
      sortDir: "desc",
    });
  });

  it("starts a different column fresh at ascending", () => {
    expect(
      nextSortDir({ ...base, sortBy: "name", sortDir: "desc" }, "createdAt"),
    ).toEqual({ sortBy: "createdAt", sortDir: "asc" });
  });
});

describe("buildListParams", () => {
  it("resets to page 1 when the search term changes", () => {
    const current = new URLSearchParams("page=5&search=old");
    const next = buildListParams(current, { search: "new" });
    expect(next.get("page")).toBeNull();
    expect(next.get("search")).toBe("new");
  });

  it("resets to page 1 when the sort changes", () => {
    const current = new URLSearchParams("page=5");
    const next = buildListParams(current, { sortBy: "name", sortDir: "asc" });
    expect(next.get("page")).toBeNull();
  });

  it("keeps the page when only the page changes", () => {
    const next = buildListParams(new URLSearchParams("search=acme"), { page: 3 });
    expect(next.get("page")).toBe("3");
    expect(next.get("search")).toBe("acme");
  });

  it("omits page=1 rather than writing a redundant param", () => {
    expect(buildListParams(new URLSearchParams(), { page: 1 }).get("page")).toBeNull();
  });

  it("drops an emptied search instead of leaving search= behind", () => {
    const next = buildListParams(new URLSearchParams("search=acme"), { search: "" });
    expect(next.get("search")).toBeNull();
  });

  it("drops both sort params when the sort is cleared", () => {
    const current = new URLSearchParams("sortBy=name&sortDir=asc");
    const next = buildListParams(current, { sortBy: null });
    expect(next.get("sortBy")).toBeNull();
    expect(next.get("sortDir")).toBeNull();
  });

  it("preserves unrelated params, such as the settings tab", () => {
    const next = buildListParams(new URLSearchParams("tab=cards"), { page: 2 });
    expect(next.get("tab")).toBe("cards");
  });
});
