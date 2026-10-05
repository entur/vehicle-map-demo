import { describe, expect, test } from "vitest";
import { Call } from "../../types.ts";
import { resolveCallTimes } from "./callTimes.ts";

function call(overrides: Partial<Call>): Call {
  return {
    stopPoint: {
      id: "NSR:StopPlace:1",
      name: "Lillestrøm stasjon",
      location: { latitude: 59.96, longitude: 11.05 },
    },
    order: 2,
    aimedArrivalTime: null,
    aimedDepartureTime: null,
    expectedArrivalTime: null,
    expectedDepartureTime: null,
    actualArrivalTime: null,
    actualDepartureTime: null,
    callType: "ESTIMATED",
    cancellation: false,
    forBoarding: true,
    occupancyStatus: null,
    situations: null,
    ...overrides,
  };
}

describe("resolveCallTimes", () => {
  // Flytoget reports RECORDED calls with expected* null and only actual* set.
  // Reading expected* alone loses the delay and displays the scheduled time.
  test("uses actual time when a recorded call has no expected times", () => {
    const resolved = resolveCallTimes(
      call({
        callType: "RECORDED",
        aimedArrivalTime: "2026-08-06T10:02:00+02:00",
        aimedDepartureTime: "2026-08-06T10:02:00+02:00",
        actualArrivalTime: "2026-08-06T10:04:00+02:00",
        actualDepartureTime: "2026-08-06T10:06:00+02:00",
      }),
    );

    expect(resolved.aimed).toBe("2026-08-06T10:02:00+02:00");
    expect(resolved.realtime).toBe("2026-08-06T10:06:00+02:00");
    expect(resolved.delaySeconds).toBe(240);
  });

  test("uses expected time for an estimated call", () => {
    const resolved = resolveCallTimes(
      call({
        aimedArrivalTime: "2026-08-06T10:10:00+02:00",
        aimedDepartureTime: "2026-08-06T10:11:00+02:00",
        expectedArrivalTime: "2026-08-06T10:19:00+02:00",
        expectedDepartureTime: "2026-08-06T10:20:00+02:00",
      }),
    );

    expect(resolved.aimed).toBe("2026-08-06T10:11:00+02:00");
    expect(resolved.realtime).toBe("2026-08-06T10:20:00+02:00");
    expect(resolved.delaySeconds).toBe(540);
  });

  // The other half of the contract: a RecordedCall carries either expected or
  // actual times, so one omitting actual must still resolve from expected.
  test("uses expected time when a recorded call has no actual times", () => {
    const resolved = resolveCallTimes(
      call({
        callType: "RECORDED",
        aimedArrivalTime: "2026-08-06T09:44:00+02:00",
        aimedDepartureTime: "2026-08-06T09:45:00+02:00",
        expectedArrivalTime: "2026-08-06T09:53:00+02:00",
        expectedDepartureTime: "2026-08-06T09:55:00+02:00",
      }),
    );

    expect(resolved.aimed).toBe("2026-08-06T09:45:00+02:00");
    expect(resolved.realtime).toBe("2026-08-06T09:55:00+02:00");
    expect(resolved.delaySeconds).toBe(600);
  });

  test("ignores expected entirely when an actual time is present", () => {
    const resolved = resolveCallTimes(
      call({
        callType: "RECORDED",
        aimedDepartureTime: "2026-08-06T09:45:00+02:00",
        expectedDepartureTime: "2026-08-06T09:55:00+02:00",
        actualDepartureTime: "2026-08-06T09:59:00+02:00",
      }),
    );

    expect(resolved.realtime).toBe("2026-08-06T09:59:00+02:00");
    expect(resolved.delaySeconds).toBe(840);
  });

  // The final stop has no departure at all, so the arrival pair is all there is.
  test("falls back to arrival times at the final stop", () => {
    const resolved = resolveCallTimes(
      call({
        order: 17,
        aimedArrivalTime: "2026-08-06T11:42:00+02:00",
        expectedArrivalTime: "2026-08-06T11:49:00+02:00",
      }),
    );

    expect(resolved.aimed).toBe("2026-08-06T11:42:00+02:00");
    expect(resolved.realtime).toBe("2026-08-06T11:49:00+02:00");
    expect(resolved.delaySeconds).toBe(420);
  });

  // aimed and realtime must describe the same event. Pairing an aimed departure
  // against an expected arrival yields a delay that measures nothing real.
  test("does not pair an aimed departure against an arrival realtime", () => {
    const resolved = resolveCallTimes(
      call({
        aimedArrivalTime: "2026-08-06T10:06:00+02:00",
        aimedDepartureTime: "2026-08-06T10:09:00+02:00",
        expectedArrivalTime: "2026-08-06T10:15:00+02:00",
        expectedDepartureTime: null,
      }),
    );

    expect(resolved.aimed).toBe("2026-08-06T10:06:00+02:00");
    expect(resolved.realtime).toBe("2026-08-06T10:15:00+02:00");
    expect(resolved.delaySeconds).toBe(540);
  });

  test("reports no delay when a call has no realtime data at all", () => {
    const resolved = resolveCallTimes(
      call({
        aimedArrivalTime: "2026-08-06T10:06:00+02:00",
        aimedDepartureTime: "2026-08-06T10:09:00+02:00",
      }),
    );

    expect(resolved.aimed).toBe("2026-08-06T10:09:00+02:00");
    expect(resolved.realtime).toBeNull();
    expect(resolved.delaySeconds).toBe(0);
  });
});
