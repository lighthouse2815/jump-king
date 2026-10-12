import { describe, expect, it } from 'vitest';
import { OriginalSimulation } from '../src';
import { ORIGINAL_SCREENS } from '../../maps/src';

describe('wind shared by physics and weather', () => {
  it('exposes original periodic wind on windy screens and zero elsewhere', () => {
    const simulation = new OriginalSimulation(
      ORIGINAL_SCREENS,
      240,
      250 - 26 * 360,
    );
    expect(simulation.windVelocity).toBeCloseTo(0.1);
    simulation.elapsedTicks = Math.round((Math.PI / 0.48124886) * 60);
    expect(simulation.windVelocity).toBeLessThan(-0.095);
    simulation.screen = 0;
    expect(simulation.windVelocity).toBe(0);
  });
});
