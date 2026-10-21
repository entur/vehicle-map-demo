import {
  burstDurationS,
  burstSparks,
  type Spark,
} from "../../domain/fireworks.ts";
import {
  BARRAGE_INTERVAL_MS,
  groundFor,
  launchPoint,
  scatteredDelayMs,
  scatteredLaunch,
  slotAt,
  slotLaunches,
  type Launch,
} from "../../domain/fireworkSchedule.ts";
import type { ViewBounds } from "../../domain/vehiclesInView.ts";

/** A due launch older than this is skipped, not fired late. */
export const LAUNCH_GRACE_MS = 500;
export const BURST_SPARKS = 60;
const PRUNE_INTERVAL_MS = 1_000;

export type Burst = {
  key: string;
  launchMs: number;
  /** Longitude, latitude, burst altitude in metres. */
  position: [number, number, number];
  heightM: number;
  sparks: Spark[];
};

export type LaunchView = {
  bounds: ViewBounds;
  groundAt: (lngLat: [number, number]) => number | null;
  centreGroundM: number | null;
};

/** Which rockets are launched and which bursts are still in the air. */
export class FireworkShow {
  private current: Burst[] = [];
  private slotStartMs = Number.NaN;
  private launches: Launch[] = [];
  private next = 0;
  private nextScatteredMs: number | null = null;
  private scatteredCount = 0;
  private lastPruneMs = Number.NEGATIVE_INFINITY;

  constructor(private readonly random: () => number = Math.random) {}

  update(nowMs: number, view: LaunchView, scattering: boolean): boolean {
    const added: Burst[] = [];
    this.loadSlot(nowMs);
    while (
      this.next < this.launches.length &&
      this.launches[this.next].atMs <= nowMs
    ) {
      const index = this.next++;
      const launch = this.launches[index];
      if (nowMs - launch.atMs > LAUNCH_GRACE_MS) continue;
      added.push(
        this.burstFor(`slot:${this.slotStartMs}:${index}`, launch, view),
      );
    }

    if (!scattering) {
      this.nextScatteredMs = null;
    } else if (this.nextScatteredMs === null) {
      this.nextScatteredMs = nowMs + scatteredDelayMs(this.random);
    } else if (nowMs >= this.nextScatteredMs) {
      const launch = scatteredLaunch(nowMs, this.random);
      added.push(
        this.burstFor(
          `scattered:${nowMs}:${this.scatteredCount++}`,
          launch,
          view,
        ),
      );
      this.nextScatteredMs = nowMs + scatteredDelayMs(this.random);
    }

    let kept = this.current;
    if (nowMs - this.lastPruneMs >= PRUNE_INTERVAL_MS) {
      this.lastPruneMs = nowMs;
      const alive = kept.filter((b) => this.isInAir(b, nowMs));
      if (alive.length !== kept.length) kept = alive;
    }
    if (added.length === 0 && kept === this.current) return false;
    this.current = [...kept, ...added];
    return true;
  }

  bursts(): readonly Burst[] {
    return this.current;
  }

  busy(nowMs: number): boolean {
    if (this.current.some((b) => this.isInAir(b, nowMs))) return true;
    this.loadSlot(nowMs);
    for (let i = this.next; i < this.launches.length; i++) {
      if (this.launches[i].atMs + LAUNCH_GRACE_MS >= nowMs) return true;
    }
    return false;
  }

  private isInAir(burst: Burst, nowMs: number): boolean {
    return burst.launchMs + burstDurationS() * 1000 > nowMs;
  }

  private loadSlot(nowMs: number): void {
    // The slot only changes every few minutes; `slotAt` formats a date, which
    // is too much to do on every frame.
    const startMs =
      Math.floor(nowMs / BARRAGE_INTERVAL_MS) * BARRAGE_INTERVAL_MS;
    if (startMs === this.slotStartMs) return;
    const slot = slotAt(nowMs);
    this.slotStartMs = slot.startMs;
    this.launches = slotLaunches(slot);
    this.next = 0;
  }

  private burstFor(key: string, launch: Launch, view: LaunchView): Burst {
    const point = launchPoint(view.bounds, launch.fx, launch.fy);
    const ground = groundFor(view.groundAt(point), view.centreGroundM);
    return {
      key,
      launchMs: launch.atMs,
      position: [point[0], point[1], ground + launch.heightM],
      heightM: launch.heightM,
      sparks: burstSparks(launch.seed, BURST_SPARKS, launch.colours),
    };
  }
}
