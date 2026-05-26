export type DelayBucket = "ontime" | "late" | "early";

const ON_TIME_TOLERANCE_SECONDS = 60;

export function delayBucket(delaySeconds: number): DelayBucket {
  if (delaySeconds >= ON_TIME_TOLERANCE_SECONDS) return "late";
  if (delaySeconds <= -ON_TIME_TOLERANCE_SECONDS) return "early";
  return "ontime";
}

export function delayColour(bucket: DelayBucket): string {
  switch (bucket) {
    case "late":
      return "#c0392b";
    case "early":
      return "#2980b9";
    case "ontime":
      return "#1f8a3a";
  }
}

export function formatDelay(delaySeconds: number): string {
  const bucket = delayBucket(delaySeconds);
  if (bucket === "ontime") return "On time";
  const minutes = Math.round(Math.abs(delaySeconds) / 60);
  return bucket === "late" ? `+${minutes} min late` : `-${minutes} min early`;
}
