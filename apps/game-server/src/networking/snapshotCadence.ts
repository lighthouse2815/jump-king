export const SNAPSHOT_INTERVAL_TICKS = 3;

export function isSnapshotTick(tick: number) {
  return tick === 1 || tick % SNAPSHOT_INTERVAL_TICKS === 0;
}
