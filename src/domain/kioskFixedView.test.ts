import { describe, expect, it } from "vitest";
import { INPUT_COALESCE_MS } from "./kioskSchedule.ts";
import {
  FIXED_VIEW_RUNNING,
  FixedViewState,
  fixedViewResumesInMs,
  fixedViewStep,
} from "./kioskFixedView.ts";

const T0 = Date.parse("2026-10-08T12:00:00Z");
const IDLE = 120_000;

describe("fixedViewStep", () => {
  it("pauses on input", () => {
    expect(
      fixedViewStep(FIXED_VIEW_RUNNING, { type: "input", now: T0 }, IDLE),
    ).toEqual({ lastInputAt: T0 });
  });

  it("does not record input again within the coalescing window", () => {
    const paused: FixedViewState = { lastInputAt: T0 };
    expect(
      fixedViewStep(
        paused,
        { type: "input", now: T0 + INPUT_COALESCE_MS - 1 },
        IDLE,
      ),
    ).toBe(paused);
    expect(
      fixedViewStep(
        paused,
        { type: "input", now: T0 + INPUT_COALESCE_MS },
        IDLE,
      ),
    ).toEqual({ lastInputAt: T0 + INPUT_COALESCE_MS });
  });

  it("resumes once the idle time has passed without input", () => {
    const paused: FixedViewState = { lastInputAt: T0 };
    expect(
      fixedViewStep(paused, { type: "tick", now: T0 + IDLE - 1 }, IDLE),
    ).toBe(paused);
    expect(fixedViewStep(paused, { type: "tick", now: T0 + IDLE }, IDLE)).toBe(
      FIXED_VIEW_RUNNING,
    );
  });

  it("resumes at once on the pill's button", () => {
    expect(
      fixedViewStep({ lastInputAt: T0 }, { type: "resume", now: T0 }, IDLE),
    ).toBe(FIXED_VIEW_RUNNING);
  });

  it("returns the state itself when nothing changes", () => {
    expect(
      fixedViewStep(FIXED_VIEW_RUNNING, { type: "tick", now: T0 }, IDLE),
    ).toBe(FIXED_VIEW_RUNNING);
    expect(
      fixedViewStep(FIXED_VIEW_RUNNING, { type: "resume", now: T0 }, IDLE),
    ).toBe(FIXED_VIEW_RUNNING);
  });
});

describe("fixedViewResumesInMs", () => {
  it("counts down from the last input, never below zero", () => {
    expect(fixedViewResumesInMs({ lastInputAt: T0 }, T0 + 30_000, IDLE)).toBe(
      90_000,
    );
    expect(fixedViewResumesInMs({ lastInputAt: T0 }, T0 + IDLE * 2, IDLE)).toBe(
      0,
    );
  });

  it("is null while running", () => {
    expect(fixedViewResumesInMs(FIXED_VIEW_RUNNING, T0, IDLE)).toBeNull();
  });
});
