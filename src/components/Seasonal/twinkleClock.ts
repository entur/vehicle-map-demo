import type { Map as MapLibreMap } from "maplibre-gl";
import { twinkleAmount } from "../../domain/twinkle.ts";

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

  /** Input or camera movement: twinkle again from full. */
  activity(): void {
    if (this.disposed) return;
    this.lastActivityMs = this.now();
    this.start();
  }

  current(): TwinkleState {
    if (this.options.reducedMotion) return { timeS: 0, amount: 0 };
    const now = this.now();
    return {
      timeS: (now - this.startMs) / 1000,
      amount: twinkleAmount(now, this.lastActivityMs, false),
    };
  }

  dispose(): void {
    this.disposed = true;
    this.map.off("move", this.onMove);
    this.stop();
  }

  /** A chase fires this every frame: one assignment, and a no-op restart. */
  private onMove = (): void => {
    this.lastActivityMs = this.now();
    if (this.timer === null) this.start();
  };

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
    if (this.disposed || !this.isVisible()) return;
    const state = this.current();
    this.options.onTick(state);
    this.map.triggerRepaint();
    if (state.amount === 0) this.stop();
  };
}
