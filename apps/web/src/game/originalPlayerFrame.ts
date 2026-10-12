import type { OriginalState } from '@jump-king/physics';

export function originalPlayerFrame(
  state: Pick<
    OriginalState,
    'splat' | 'charge' | 'grounded' | 'knocked' | 'vy' | 'vx' | 'snow' | 'ticks'
  >,
) {
  if (state.splat > 0) return 'splat';
  if (state.charge > 0) return 'charge';
  if (!state.grounded)
    return state.knocked ? 'bounce' : state.vy > 0 ? 'fall' : 'up';
  if (Math.abs(state.vx) > 0.1 && !state.snow) {
    const step = state.ticks % 28;
    return step < 10
      ? 'walk_one'
      : step < 14
        ? 'walk_smear'
        : step < 24
          ? 'walk_two'
          : 'walk_smear';
  }
  return 'idle';
}
