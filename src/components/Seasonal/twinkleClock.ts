import type { Map as MapLibreMap } from "maplibre-gl";
import {
  TWINKLE_IDLE_MS,
  twinkleAmount,
  twinkleWake,
} from "../../domain/twinkle.ts";

export type TwinkleState = { timeS: number; amount: number };

/** Roughly twelve updates a second: slow fades need no more. */
export const TWINKLE_TICK_MS = 80;

type Options = {
  reducedMotion: boolean;
  onTick: (state: TwinkleState) => void;
  now?: () => number;
  isVisible?: () => boolean;
};

const pageVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

/**
 * Decides when the twinkle ticks. It runs while someone is there (input or
 * camera movement), ends with one tick at amount 0, then stops its timer so a
 * still map is not repainted.
 */
export class TwinkleClock {
  private readonly now: () => number;
  private readonly isVisible: () => boolean;
  private readonly startMs: number;
  private lastActivityMs: number;
  /** When activity last woke a settling or settled clock, and from what. */
  private wakeMs = 0;
  private wakeFrom = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(
    private readonly map: Pick<MapLibreMap, "on" | "off" | "triggerRepaint">,
    private readonly options: Options,
  ) {
    this.now = options.now ?? Date.now;
    this.isVisible = options.isVisible ?? pageVisible;
    this.startMs = this.now();
    this.lastActivityMs = this.startMs;
    this.map.on("move", this.onMove);
    this.start();
  }

  /** Input or camera movement: ease back to full twinkle. */
  activity(): void {
    if (this.disposed) return;
    this.noteActivity();
    this.start();
  }

  current(): TwinkleState {
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
    return Math.min(
      twinkleAmount(now, this.lastActivityMs, false),
      twinkleWake(now, this.wakeMs, this.wakeFrom),
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
    if (now - this.lastActivityMs > TWINKLE_IDLE_MS) {
      this.wakeFrom = this.amountAt(now);
      this.wakeMs = now;
    }
    this.lastActivityMs = now;
  }

  private start(): void {
    if (this.timer !== null || this.disposed || this.options.reducedMotion)
      return;
    this.timer = setInterval(this.tick, TWINKLE_TICK_MS);
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
