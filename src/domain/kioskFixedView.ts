import { INPUT_COALESCE_MS } from "./kioskSchedule.ts";

/**
 * A fixed-view kiosk is running (`lastInputAt` null) or paused by a visitor
 * since their last input. Nothing else: it has no vehicle to pick or chase,
 * so none of the chasing kiosk's phases apply.
 */
export type FixedViewState = { lastInputAt: number | null };

export const FIXED_VIEW_RUNNING: FixedViewState = { lastInputAt: null };

export type FixedViewEvent =
  | { type: "tick"; now: number }
  /** A person touched the screen, the mouse or the keyboard. */
  | { type: "input"; now: number }
  /** A person asked it to resume now rather than after the idle period. */
  | { type: "resume"; now: number };

/**
 * The next state. Returns `state` itself when nothing changes, so a caller
 * can skip the render — and can tell a resume by the move from paused to
 * running.
 */
export function fixedViewStep(
  state: FixedViewState,
  event: FixedViewEvent,
  idleMs: number,
): FixedViewState {
  const { lastInputAt } = state;
  switch (event.type) {
    case "input":
      return lastInputAt !== null && event.now - lastInputAt < INPUT_COALESCE_MS
        ? state
        : { lastInputAt: event.now };
    case "tick":
      return lastInputAt !== null && event.now - lastInputAt >= idleMs
        ? FIXED_VIEW_RUNNING
        : state;
    case "resume":
      return lastInputAt === null ? state : FIXED_VIEW_RUNNING;
  }
}

/** Time left before a paused run resumes, or null while it runs. */
export function fixedViewResumesInMs(
  state: FixedViewState,
  now: number,
  idleMs: number,
): number | null {
  if (state.lastInputAt === null) return null;
  return Math.max(0, idleMs - (now - state.lastInputAt));
}
