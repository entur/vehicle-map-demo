import { describe, expect, test } from "vitest";
import { TranslatedString } from "../../types.ts";
import { isRedundant, pickTranslation } from "./situationText.ts";

function t(value: string | null, language: string | null): TranslatedString {
  return { value, language };
}

describe("pickTranslation", () => {
  test("prefers Norwegian over English", () => {
    expect(
      pickTranslation([
        t("Take the next train", "EN"),
        t("Ta neste tog", "NO"),
      ]),
    ).toBe("Ta neste tog");
  });

  test("falls back to English when there is no Norwegian", () => {
    expect(pickTranslation([t("Take the next train", "EN")])).toBe(
      "Take the next train",
    );
  });

  // Roughly a quarter of live records publish text with no language tag.
  test("falls back to an untagged entry when no tagged one is usable", () => {
    expect(pickTranslation([t("Endra trasé pga. vegarbeid", null)])).toBe(
      "Endra trasé pga. vegarbeid",
    );
  });

  test("matches the language tag case-insensitively", () => {
    expect(pickTranslation([t("engelsk", "en"), t("norsk", "no")])).toBe(
      "norsk",
    );
  });

  test("skips entries whose value is null or blank", () => {
    expect(
      pickTranslation([t(null, "NO"), t("   ", "EN"), t("brukbar", null)]),
    ).toBe("brukbar");
  });

  test("trims surrounding whitespace", () => {
    expect(pickTranslation([t("  Ta neste tog  ", "NO")])).toBe("Ta neste tog");
  });

  test("returns null for an empty, null or all-blank list", () => {
    expect(pickTranslation([])).toBeNull();
    expect(pickTranslation(null)).toBeNull();
    expect(pickTranslation([t(null, "NO"), t("", "EN")])).toBeNull();
  });
});

describe("isRedundant", () => {
  test("is true when the text repeats the summary", () => {
    expect(isRedundant("Ta neste tog", "Ta neste tog")).toBe(true);
  });

  test("ignores whitespace differences", () => {
    expect(isRedundant("  Ta neste tog ", "Ta neste tog")).toBe(true);
  });

  test("is false when the text adds something", () => {
    expect(
      isRedundant("Ta neste tog mellom Skøyen og Høn.", "Ta neste tog"),
    ).toBe(false);
  });

  test("is true when there is no text at all", () => {
    expect(isRedundant(null, "Ta neste tog")).toBe(true);
  });

  test("is false when there is text but no summary to repeat", () => {
    expect(isRedundant("Ta neste tog", null)).toBe(false);
  });
});
