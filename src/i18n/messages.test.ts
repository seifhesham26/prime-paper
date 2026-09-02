import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

/** Flatten to dotted paths so a nested namespace mismatch is visible. */
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? keyPaths(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("message files", () => {
  const arKeys = keyPaths(ar).sort();
  const enKeys = keyPaths(en).sort();

  it("has no key present only in Arabic", () => {
    expect(arKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it("has no key present only in English", () => {
    expect(enKeys.filter((k) => !arKeys.includes(k))).toEqual([]);
  });

  it("has no empty translation in either file", () => {
    const empties = [
      ...keyPaths(ar).filter((k) => resolve(ar, k) === ""),
      ...keyPaths(en).filter((k) => resolve(en, k) === ""),
    ];
    expect(empties).toEqual([]);
  });
});

function resolve(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], obj);
}
