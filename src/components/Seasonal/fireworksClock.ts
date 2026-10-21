import type { Map as MapLibreMap } from "maplibre-gl";
import { ANIMATION_IDLE_MS } from "../../domain/animationAmount.ts";
import { burstDurationS } from "../../domain/fireworks.ts";
import {
  BARRAGE_INTERVAL_MS,
  nextSlotStartMs,
  slotAt,
  slotEndMs,
  type Slot,
} from "../../domain/fireworkSchedule.ts";
import type { FireworkShow, LaunchView } from "./fireworkShow.ts";

type Options = {
  reducedMotion: boolean;
  show: Pick<FireworkShow, "update" | "busy">;
  /** Handed to the show uncalled: it reads the map only to place a launch. */
  view: () => LaunchView;
  onFrame: (nowMs: number, changed: boolean) => void;
  /** A barrage has begun: the time its last spark fades. */
  onBarrage: (untilMs: number) => void;
  lastActivityMs?: number;
  now?: () => number;
  isVisible?: () => boolean;
  requestFrame?: (cb: () => void) => number;
  cancelFrame?: (id: number) => void;
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
};

const pageVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

/**
 * Decides when the fireworks are drawn. Frames run while someone is there,
 * while sparks are in the air and during a barrage; between barrages on an
 * idle screen nothing runs but one timer for the next slot's start.
 */
export class FireworksClock {
  private readonly now: () => number;
  private readonly isVisible: () => boolean;
  private readonly requestFrame: (cb: () => void) => number;
  private readonly cancelFrame: (id: number) => void;
  private readonly setTimer: (cb: () => void, ms: number) => unknown;
  private readonly clearTimer: (t: unknown) => void;
  private lastActivityMs: number;
  private frame: number | null = null;
  private timer: unknown = null;
  private slot: Slot | null = null;
  private announcedMs = Number.NaN;
  private disposed = false;
  private logged = false;

  constructor(
    private readonly map: Pick<MapLibreMap, "on" | "off" | "triggerRepaint">,
    private readonly options: Options,
  ) {
    this.now = options.now ?? Date.now;
    this.isVisible = options.isVisible ?? pageVisible;
    this.requestFrame =
      options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame =
      options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
    this.setTimer = options.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimer =
      options.clearTimer ?? ((t) => clearTimeout(t as number | undefined));
    this.lastActivityMs = options.lastActivityMs ?? this.now();
    if (options.reducedMotion) return;
    this.map.on("move", this.onMove);
    if (this.isVisible()) this.continueOrSleep(this.now());
  }

  /** Input, or the page becoming visible. */
  activity(): void {
    if (this.disposed || this.options.reducedMotion) return;
    this.lastActivityMs = this.now();
    this.start();
  }

  dispose(): void {
    this.disposed = true;
    this.map.off("move", this.onMove);
    this.cancelPending();
  }

  private onMove = (): void => {
    this.lastActivityMs = this.now();
    this.start();
  };

  /** Run frames, unless they already run. */
  private start(): void {
    if (this.frame !== null || this.disposed) return;
    this.clearSleep();
    this.frame = this.requestFrame(this.onFrame);
  }

  private onFrame = (): void => {
    this.frame = null;
    if (this.disposed) return;
    // A hidden page is not drawn; coming back is activity.
    if (!this.isVisible()) return;
    const now = this.now();
    this.announce(now);
    const active = now - this.lastActivityMs < ANIMATION_IDLE_MS;
    const changed = this.options.show.update(now, this.options.view, active);
    this.options.onFrame(now, changed);
    this.map.triggerRepaint();
    this.continueOrSleep(now, active);
  };

  private continueOrSleep(
    now: number,
    active = now - this.lastActivityMs < ANIMATION_IDLE_MS,
  ): void {
    if (active || this.options.show.busy(now) || this.inSlot(now)) {
      this.frame = this.requestFrame(this.onFrame);
      return;
    }
    this.clearSleep();
    this.timer = this.setTimer(this.onTimer, nextSlotStartMs(now) - now);
  }

  private onTimer = (): void => {
    this.timer = null;
    if (this.disposed || !this.isVisible()) return;
    this.announce(this.now());
    this.start();
  };

  private slotFor(now: number): Slot {
    const startMs = Math.floor(now / BARRAGE_INTERVAL_MS) * BARRAGE_INTERVAL_MS;
    if (this.slot === null || this.slot.startMs !== startMs) {
      try {
        this.slot = slotAt(now);
      } catch (error) {
        // Not knowing whether it is the finale must not stop the frames.
        this.fail(error);
        this.slot = { startMs, finale: false };
      }
    }
    return this.slot;
  }

  private inSlot(now: number): boolean {
    return now < slotEndMs(this.slotFor(now));
  }

  /** Once per slot, and not for one whose rockets have all gone. */
  private announce(now: number): void {
    const slot = this.slotFor(now);
    if (slot.startMs === this.announcedMs) return;
    this.announcedMs = slot.startMs;
    const endMs = slotEndMs(slot);
    if (now >= endMs) return;
    try {
      this.options.onBarrage(endMs + burstDurationS() * 1000);
    } catch (error) {
      this.fail(error);
    }
  }

  /**
   * Logged once. Nothing the clock calls out to may end its frames or its
   * timer: an idle wall screen would have no fireworks until it reloads.
   */
  private fail(error: unknown): void {
    if (this.logged) return;
    this.logged = true;
    console.error("Fireworks clock failed; carrying on", error);
  }

  private clearSleep(): void {
    if (this.timer === null) return;
    this.clearTimer(this.timer);
    this.timer = null;
  }

  private cancelPending(): void {
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
    this.clearSleep();
  }
}
