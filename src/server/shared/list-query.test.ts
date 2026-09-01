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
