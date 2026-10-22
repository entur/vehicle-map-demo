import type { Map as MapLibreMap } from "maplibre-gl";
import {
  ANIMATION_IDLE_MS,
  animationAmount,
  animationHold,
  animationWake,
} from "../../domain/animationAmount.ts";

export type AnimationState = { timeS: number; amount: number };

/** Roughly twelve updates a second: slow fades need no more. */
export const ANIMATION_TICK_MS = 80;

type Options = {
  reducedMotion: boolean;
  onTick: (state: AnimationState) => void;
  now?: () => number;
  isVisible?: () => boolean;
  /**
   * Carried over from an earlier clock for the same animation: when its time
   * began, and the last activity seen. A clock created on a map left alone
   * for longer than the idle time then starts settled, and one created while
   * someone is there carries on rather than starting again. Both default to
   * the clock's creation, which counts as activity.
   */
  startMs?: number;
  lastActivityMs?: number;
};

const pageVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

/**
 * Decides when a seasonal animation ticks. It runs while someone is there
 * (input or camera movement), ends with one tick at amount 0, then stops its
 * timer so a still map is not repainted.
 */
export class AnimationClock {
  private readonly now: () => number;
  private readonly isVisible: () => boolean;
  private readonly startMs: number;
  private lastActivityMs: number;
  /** When activity last woke a settling or settled clock, and from what. */
  private wakeMs = 0;
  private wakeFrom = 1;
  /** A hold awake: from when, until when, and the amount showing at its start. */
  private holdFromMs = 0;
  private holdUntilMs = 0;
  private holdFromAmount = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    private readonly map: Pick<MapLibreMap, "on" | "off" | "triggerRepaint">,
    private readonly options: Options,
  ) {
    this.now = options.now ?? Date.now;
    this.isVisible = options.isVisible ?? pageVisible;
    const now = this.now();
    this.startMs = options.startMs ?? now;
    this.lastActivityMs = options.lastActivityMs ?? now;
    this.map.on("move", this.onMove);
    // Already settled: no timer until someone is there.
    if (this.amountAt(now) > 0) this.start();
  }

  /** Input or camera movement: ease back to full animation. */
  activity(): void {
    if (this.disposed) return;
    this.noteActivity();
    this.start();
  }

  /**
   * Animate until `untilMs` (then ease out) without counting as activity, so
   * an idle screen is idle again as soon as the hold has faded. A hold still
   * running is extended, not restarted.
   */
  holdAwake(untilMs: number): void {
    if (this.disposed || this.options.reducedMotion) return;
    const now = this.now();
    if (now < this.holdUntilMs) {
      this.holdUntilMs = Math.max(this.holdUntilMs, untilMs);
    } else {
      this.holdFromAmount = this.amountAt(now);
      this.holdFromMs = now;
      this.holdUntilMs = untilMs;
    }
    this.start();
  }

  current(): AnimationState {
    if (this.options.reducedMotion) return { timeS: 0, amount: 0 };
    const now = this.now();
    return {
      timeS: (now - this.startMs) / 1000,
      amount: this.amountAt(now),
    };
  }

  dispose(): void {
    this.disposed = true;
    this.map.off("move", this.onMove);
    this.stop();
  }

  /** A chase fires this every frame: a comparison, and a no-op restart. */
  private onMove = (): void => {
    this.noteActivity();
    if (this.timer === null) this.start();
  };

  private amountAt(now: number): number {
    const idle = Math.min(
      animationAmount(now, this.lastActivityMs, false),
      animationWake(now, this.wakeMs, this.wakeFrom),
    );
    if (this.holdUntilMs === 0) return idle;
    return Math.max(
      idle,
      animationHold(
        now,
        this.holdFromMs,
        this.holdUntilMs,
        this.holdFromAmount,
      ),
    );
  }

  /**
   * Activity once the settle has begun eases back up from the amount showing
   * rather than jumping to full, which dropped a dim bulb group in one frame.
   * Activity while still active, or while easing back up, only pushes the
   * idle time out, so a chase's per-frame moves do not restart the ease.
   */
  private noteActivity(): void {
    const now = this.now();
    if (now - this.lastActivityMs > ANIMATION_IDLE_MS) {
      this.wakeFrom = this.amountAt(now);
      this.wakeMs = now;
    }
    this.lastActivityMs = now;
  }

  private start(): void {
    if (this.timer !== null || this.disposed || this.options.reducedMotion)
      return;
    this.timer = setInterval(this.tick, ANIMATION_TICK_MS);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private tick = (): void => {
    if (this.disposed) return;
    // A hidden page is not drawn: stop rather than tick for nothing. Coming
    // back is activity (`useSeasonalDecorations`), which starts it again.
    if (!this.isVisible()) {
      this.stop();
      return;
    }
    const state = this.current();
    this.options.onTick(state);
    this.map.triggerRepaint();
    if (state.amount === 0) this.stop();
  };
}
