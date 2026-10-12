import { describe, it, expect } from 'vitest';
import { OriginalSimulation, ORIGINAL_PHYSICS } from '../src';
import { ORIGINAL_SCREENS, isOriginalFinish } from '../../maps/src';
import route from './fixtures/original-route.json';

const idle = { left: false, right: false, jump: false };
function grounded() {
  const simulation = new OriginalSimulation(ORIGINAL_SCREENS);
  for (let i = 0; i < 30; i++) simulation.tick(idle);
  return simulation;
}

describe('Jump King 1.04 physics', () => {
  it('loads every original 60 × 45 tile screen and lands at the original camp', () => {
    expect(ORIGINAL_SCREENS).toHaveLength(169);
    for (const screen of ORIGINAL_SCREENS) {
      expect(screen.tiles).toHaveLength(45);
      expect(screen.tiles.every((row) => row.length === 60)).toBe(true);
    }
    const simulation = grounded();
    expect(simulation.body.isGrounded).toBe(true);
    expect(simulation.body.position.y).toBe(302);
    expect(simulation.body.size.x).toBe(18);
    expect(simulation.body.size.y).toBe(26);
  });

  it('automatically jumps at 0.6 seconds and keeps airborne direction locked', () => {
    const simulation = grounded();
    for (let i = 0; i < 36; i++)
      simulation.tick({ ...idle, right: true, jump: true });
    expect(simulation.jumps).toBe(1);
    expect(simulation.chargeTicks).toBe(0);
    expect(simulation.body.velocity.y).toBe(ORIGINAL_PHYSICS.jumpVelocity);
    expect(simulation.body.velocity.x).toBe(3.5);
    simulation.tick({ ...idle, left: true, jump: true });
    expect(simulation.body.velocity.x).toBe(3.5);
    expect(simulation.body.isGrounded).toBe(false);
  });

  it('uses proportional short jumps and the four-frame directional buffer', () => {
    const simulation = grounded();
    for (let i = 0; i < 17; i++)
      simulation.tick({ ...idle, right: true, jump: true });
    simulation.tick(idle);
    expect(simulation.body.velocity.y).toBeCloseTo(
      ORIGINAL_PHYSICS.jumpVelocity / 2,
      5
    );
    expect(simulation.body.velocity.x).toBe(3.5);
  });

  it('bounces off a wall instead of losing all horizontal speed', () => {
    const simulation = grounded();
    simulation.body.position.set(452, 120);
    simulation.body.velocity.set(3.5, -4);
    simulation.body.isGrounded = false;
    expect(simulation.tick(idle).effects).toContain('bump');
    expect(simulation.body.velocity.x).toBe(-1.75);
    expect(simulation.knocked).toBe(true);
    expect(simulation.body.position.x + 18).toBeLessThanOrEqual(472);
  });

  it('emits one jump and landing effect, without replaying sounds on idle ticks', () => {
    const simulation = grounded();
    for (let i = 0; i < 17; i++)
      expect(simulation.tick({ ...idle, jump: true }).effects).toEqual([]);
    const effects = [...simulation.tick(idle).effects];
    for (let i = 0; i < 90; i++) effects.push(...simulation.tick(idle).effects);
    expect(effects).toEqual(['jump', 'land']);
  });

  it('caps fall speed and applies a half-second splat after a long fall', () => {
    const simulation = new OriginalSimulation(ORIGINAL_SCREENS, 240, 100);
    simulation.body.isGrounded = false;
    simulation.body.velocity.y = 10;
    const effects: string[] = [];
    for (let i = 0; i < 40 && simulation.falls === 0; i++)
      effects.push(...simulation.tick(idle).effects);
    expect(effects).toEqual(['splat']);
    expect(simulation.falls).toBe(1);
    expect(simulation.splatTicks).toBeGreaterThan(0);
    simulation.tick({ ...idle, right: true });
    expect(simulation.body.velocity.x).toBe(0);
  });

  it('restores a snapshot and deterministically replays buffered input', () => {
    const first = grounded();
    for (let i = 0; i < 15; i++)
      first.tick({ ...idle, right: true, jump: true });
    const second = new OriginalSimulation(ORIGINAL_SCREENS);
    second.restore(first.getState());
    for (let i = 0; i < 80; i++) {
      const input = { left: i > 50, right: i < 50, jump: i < 10 };
      first.tick(input);
      second.tick(input);
      expect(second.getState()).toEqual(first.getState());
    }
  });

  it('requires landing on the correct side of the final screen to win', () => {
    expect(isOriginalFinish('original', 327, -15000, true, 42)).toBe(true);
    expect(isOriginalFinish('original', 327, -15000, false, 42)).toBe(false);
    expect(isOriginalFinish('original', 200, -15000, true, 42)).toBe(false);
    expect(isOriginalFinish('nbp', 100, 144 - 13 - 99 * 360, true, 99)).toBe(
      true
    );
  });

  it('starts charging on landing when jump was pressed in the air', () => {
    const simulation = new OriginalSimulation(ORIGINAL_SCREENS, 240, 270);
    simulation.body.isGrounded = false;
    for (let i = 0; i < 20 && !simulation.body.isGrounded; i++)
      simulation.tick({ ...idle, jump: true });
    expect(simulation.body.isGrounded).toBe(true);
    expect(simulation.chargeTicks).toBe(1);
  });

  it('can complete all 43 original screens using walking and charged jumps', () => {
    const simulation = grounded();
    const visited = new Set([0]);
    const step = (input = idle) => {
      simulation.tick(input);
      visited.add(simulation.screen);
    };
    for (const action of route) {
      if (action.walk !== undefined) {
        for (let i = 0; i < action.ticks!; i++)
          step({ left: action.walk < 0, right: action.walk > 0, jump: false });
        continue;
      }
      step();
      const direction = action.direction!;
      for (let i = 0; i < action.charge!; i++)
        step({
          left: action.charge === 36 && direction < 0,
          right: action.charge === 36 && direction > 0,
          jump: true,
        });
      if (action.charge !== 36)
        step({ left: direction < 0, right: direction > 0, jump: false });
      for (let i = 0; i < 180; i++) {
        step();
        if (simulation.body.isGrounded && i > 0) {
          if (simulation.splatTicks)
            for (let recovery = 0; recovery < 32; recovery++)
              step({ left: direction < 0, right: direction > 0, jump: false });
          break;
        }
      }
    }
    expect(visited.size).toBe(43);
    expect(simulation.jumps).toBe(228);
    expect(simulation.falls).toBe(0);
    expect(
      isOriginalFinish(
        'original',
        simulation.body.position.x,
        simulation.body.position.y,
        simulation.body.isGrounded,
        simulation.screen
      )
    ).toBe(true);
  });
});
