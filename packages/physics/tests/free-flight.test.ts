import { describe, expect, it } from 'vitest';
import { OriginalSimulation, ORIGINAL_PHYSICS } from '../src';
import { ORIGINAL_SCREENS } from '../../maps/src';

const idle = { left: false, right: false, jump: false };

describe('online free flight', () => {
  it('clears jump/fall momentum and hovers without gravity or movement effects', () => {
    const sim = new OriginalSimulation(ORIGINAL_SCREENS, 200, 100);
    sim.body.velocity.set(3, 10);
    sim.chargeTicks = 20;
    sim.splatTicks = 30;
    sim.knocked = true;
    sim.setFreeFlight(true);
    for (let tick = 0; tick < 120; tick++)
      expect(sim.tick({ ...idle, jump: true }).effects).toEqual([]);
    expect(sim.getState()).toMatchObject({
      x: 200,
      y: 100,
      vx: 0,
      vy: 0,
      grounded: false,
      charge: 0,
      splat: 0,
      knocked: false,
      jumps: 0,
      falls: 0,
    });
  });

  it('moves immediately on both axes, cancels opposing inputs and stops on release', () => {
    const sim = new OriginalSimulation(ORIGINAL_SCREENS, 200, 100);
    sim.setFreeFlight(true);
    sim.tick({ ...idle, right: true, up: true });
    expect(sim.body.position.x).toBe(200 + ORIGINAL_PHYSICS.jumpSpeed);
    expect(sim.body.position.y).toBe(100 - ORIGINAL_PHYSICS.jumpSpeed);
    sim.tick({ ...idle, left: true, down: true });
    expect(sim.body.position.x).toBe(200);
    expect(sim.body.position.y).toBe(100);
    sim.tick({ ...idle, left: true, right: true, up: true, down: true });
    sim.tick(idle);
    expect(sim.getState()).toMatchObject({ x: 200, y: 100, vx: 0, vy: 0 });
  });

  it('flies through platforms, updates the screen and stays within the map', () => {
    const sim = new OriginalSimulation(ORIGINAL_SCREENS);
    sim.setFreeFlight(true);
    for (let tick = 0; tick < 6; tick++) sim.tick({ ...idle, down: true });
    expect(sim.body.position.y).toBe(323); // Through the camp floor at y = 328.
    for (let tick = 0; tick < 110; tick++) sim.tick({ ...idle, up: true });
    expect(sim.screen).toBe(1);
    sim.body.position.set(0, 334);
    sim.tick({ ...idle, left: true, down: true });
    expect(sim.getState()).toMatchObject({ x: 0, y: 334 });
    sim.body.position.set(462, -(ORIGINAL_SCREENS.length - 1) * 360);
    sim.tick({ ...idle, right: true, up: true });
    expect(sim.body.position.x).toBe(462);
    expect(sim.screen).toBe(ORIGINAL_SCREENS.length - 1);
  });

  it('restores the mode for prediction and resumes gravity when disabled', () => {
    const server = new OriginalSimulation(ORIGINAL_SCREENS, 200, 100);
    const client = new OriginalSimulation(ORIGINAL_SCREENS);
    server.setFreeFlight(true);
    client.restore(server.getState());
    const input = { ...idle, right: true, up: true };
    server.tick(input);
    client.tick(input);
    expect(client.getState()).toEqual(server.getState());
    client.setFreeFlight(false);
    for (let tick = 0; tick < 10; tick++) client.tick(idle);
    expect(client.body.position.y).toBeGreaterThan(100);
    expect(client.body.velocity.y).toBeGreaterThan(0);
    const legacy = server.getState();
    delete legacy.freeFlight;
    client.restore(legacy);
    expect(client.freeFlight).toBe(false);
  });

  it('keeps flight enabled when disabling inside terrain would trap the player', () => {
    const sim = new OriginalSimulation(ORIGINAL_SCREENS);
    sim.setFreeFlight(true);
    for (let tick = 0; tick < 6; tick++) sim.tick({ ...idle, down: true });
    expect(sim.setFreeFlight(false)).toBe(false);
    expect(sim.freeFlight).toBe(true);
    for (let tick = 0; tick < 6; tick++) sim.tick({ ...idle, up: true });
    expect(sim.setFreeFlight(false)).toBe(true);
    expect(sim.freeFlight).toBe(false);
  });
});
