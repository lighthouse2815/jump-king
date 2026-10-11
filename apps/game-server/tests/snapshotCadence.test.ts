import { describe, expect, it } from 'vitest';
import { isSnapshotTick } from '../src/networking/snapshotCadence';

describe('snapshot cadence', () => {
  it('publishes the first tick and then every third simulation tick', () => {
    expect([1, 2, 3, 4, 5, 6].filter(isSnapshotTick)).toEqual([1, 3, 6]);
  });
});
