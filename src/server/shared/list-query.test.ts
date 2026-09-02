import { describe, expect, it } from "vitest";
import { escapeLike, likePattern, pickSortKey } from "./list-query";

describe("escapeLike", () => {
  it("escapes the percent wildcard so a bare % is a literal", () => {
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("escapes the single-character wildcard", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes the backslash first so escapes are not double-applied", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("escapes a backslash and a wildcard in the same term", () => {
    // Input is a real backslash followed by a wildcard: a \ % b (4 chars).
    // Written in source as "a\\%b" — "a\%b" would silently parse to "a%b"
    // with no backslash at all, since `\%` is not a recognized JS escape,
    // and would not actually discriminate replacement order.
    //
    // Backslash-first (correct): \ -> \\, then % -> \%, giving a + three
    // backslashes + % + b (6 chars): a\\\%b.
    // Percent-first (wrong): % -> \%, then the backslash pass doubles both
    // the original backslash and the one just introduced before %, giving
    // four backslashes instead of three: a\\\\%b (7 chars).
    expect(escapeLike("a\\%b")).toBe("a\\\\\\%b");
  });

  it("leaves ordinary text untouched, Arabic included", () => {
    expect(escapeLike("ورق")).toBe("ورق");
  });
});

describe("likePattern", () => {
  it("wraps the escaped term for a contains match", () => {
    expect(likePattern("acme")).toBe("%acme%");
  });

  it("keeps a wildcard in the term literal", () => {
    expect(likePattern("50%")).toBe("%50\\%%");
  });
});

describe("pickSortKey", () => {
  const allowed = ["name", "createdAt"] as const;

  it("returns a whitelisted key", () => {
    expect(pickSortKey("name", allowed)).toBe("name");
  });

  it("rejects a key that is not whitelisted", () => {
    expect(pickSortKey("password", allowed)).toBeNull();
  });

  it("returns null when nothing was requested", () => {
    expect(pickSortKey(undefined, allowed)).toBeNull();
  });

  it("is case sensitive — no fuzzy matching into the whitelist", () => {
    expect(pickSortKey("NAME", allowed)).toBeNull();
  });
});
