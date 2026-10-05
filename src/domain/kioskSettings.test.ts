import { describe, expect, it } from "vitest";
import { DEFAULT_DWELL_MS, IDLE_MS } from "./kioskSchedule.ts";
import {
  KIOSK_DWELL_CHOICES_MS,
  KIOSK_IDLE_CHOICES_MS,
  choiceOr,
  formatKioskDuration,
  kioskFilterSummary,
} from "./kioskSettings.ts";

describe("kiosk choices", () => {
  it("offer the defaults", () => {
    expect(KIOSK_DWELL_CHOICES_MS).toContain(DEFAULT_DWELL_MS);
    expect(KIOSK_IDLE_CHOICES_MS).toContain(IDLE_MS);
  });

  it("keep a value that is a choice, else fall back", () => {
    expect(choiceOr(KIOSK_DWELL_CHOICES_MS, 60_000, DEFAULT_DWELL_MS)).toBe(
      60_000,
    );
    expect(choiceOr(KIOSK_DWELL_CHOICES_MS, 20_000, DEFAULT_DWELL_MS)).toBe(
      DEFAULT_DWELL_MS,
    );
    expect(choiceOr(KIOSK_IDLE_CHOICES_MS, undefined, IDLE_MS)).toBe(IDLE_MS);
  });
});

describe("formatKioskDuration", () => {
  it("names whole minutes in minutes and the rest in seconds", () => {
    expect(formatKioskDuration(30_000)).toBe("30 s");
    expect(formatKioskDuration(60_000)).toBe("1 min");
    expect(formatKioskDuration(180_000)).toBe("3 min");
    expect(formatKioskDuration(90_000)).toBe("1 min 30 s");
  });
});

describe("kioskFilterSummary", () => {
  it("is all vehicles without a filter", () => {
    expect(kioskFilterSummary(null)).toEqual([
      { label: "Vehicles", value: "All vehicles" },
    ]);
    expect(kioskFilterSummary({ boundingBox: [] })).toEqual([
      { label: "Vehicles", value: "All vehicles" },
    ]);
  });

  it("lists what is set, in filter panel order", () => {
    expect(
      kioskFilterSummary({
        maxDataAge: 60,
        operatorRef: "ATB:Operator:1",
        codespaceId: "ATB",
      }),
    ).toEqual([
      { label: "Codespace", value: "ATB" },
      { label: "Operator", value: "ATB:Operator:1" },
      { label: "Max data age", value: "60 s" },
    ]);
  });

  it("treats empty values as unset", () => {
    expect(kioskFilterSummary({ codespaceId: "", operatorRef: "" })).toEqual([
      { label: "Vehicles", value: "All vehicles" },
    ]);
  });
});
