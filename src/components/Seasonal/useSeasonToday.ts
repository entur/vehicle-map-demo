import { useEffect, useState } from "react";
import {
  fireworksOn,
  msUntilNextOsloDay,
  seasonOn,
  type Season,
} from "../../domain/season.ts";

type Today = { season: Season | null; fireworks: boolean };

const today = (): Today => {
  const now = new Date();
  return {
    season: seasonOn(now, window.location.search),
    fireworks: fireworksOn(now, window.location.search),
  };
};

/**
 * The season and whether the fireworks are on, asked again at every midnight
 * in Oslo, so a wall screen left running for days changes season without a
 * reload. A laptop asleep over midnight wakes the timer late, and it asks then.
 */
export function useSeasonToday(): Today {
  const [current, setCurrent] = useState(today);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        const next = today();
        // Same answers keep the same object, so nothing downstream re-runs.
        setCurrent((prev) =>
          prev.season === next.season && prev.fireworks === next.fireworks
            ? prev
            : next,
        );
        schedule();
      }, msUntilNextOsloDay(new Date()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return current;
}
