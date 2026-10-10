import { describe, it, expect } from 'vitest';
import { PhysicsWorld, Body, PlayerController, GAME_CONFIG } from '../src';

describe('PhysicsWorld & PlayerController', () => {
  it('should apply gravity and fall', () => {
    const world = new PhysicsWorld();
    const player = new Body(0, 0, 20, 20);
    world.addBody(player);
    
    // tick() is fixed 1/60 dt
    for(let i=0; i<60; i++) world.tick();
    
    // V = gt
    expect(player.velocity.y).toBeCloseTo(world.gravity, 0);
  });

  it('should collide with static ground', () => {
    const world = new PhysicsWorld();
    const player = new Body(0, 50, 20, 20);
    const ground = new Body(0, 100, 100, 20, true);
    
    world.addBody(player);
    world.addBody(ground);
    
    player.velocity.y = 100;
    
    // Step at 60Hz
    for(let i = 0; i < 30; i++) {
        world.tick();
    }
    
    // Should hit ground at y = 100 - player height (20) = 80
    expect(player.position.y).toBe(80);
    expect(player.velocity.y).toBe(0);
    expect(player.isGrounded).toBe(true);
  });

  it('player should charge and jump', () => {
    const player = new Body(0, 80, 20, 20);
    player.isGrounded = true;
    const controller = new PlayerController(player);

    // Charge for 30 ticks (0.5s)
    for (let i = 0; i < 30; i++) {
      controller.tick({ left: false, right: false, jump: true, seq: i });
    }
    expect(controller.chargeTicks).toBe(30);
    expect(player.velocity.y).toBe(0);

    // Release jump
    controller.tick({ left: false, right: false, jump: false, seq: 30 });
    expect(controller.chargeTicks).toBe(0);
    expect(player.velocity.y).toBeLessThan(0); // jumping up
    expect(player.isGrounded).toBe(false);
  });

  it('player should move left and right on ground', () => {
    const player = new Body(0, 80, 20, 20);
    player.isGrounded = true;
    const controller = new PlayerController(player);

    controller.tick({ left: true, right: false, jump: false, seq: 1 });
    expect(player.velocity.x).toBe(-GAME_CONFIG.moveSpeed);

    controller.tick({ left: false, right: true, jump: false, seq: 2 });
    expect(player.velocity.x).toBe(GAME_CONFIG.moveSpeed);
  });

  it('player has no air control', () => {
    const player = new Body(0, 80, 20, 20);
    player.isGrounded = false;
    player.velocity.x = 50; // Already moving in air
    const controller = new PlayerController(player);

    controller.tick({ left: true, right: false, jump: false, seq: 1 });
    // Velocity shouldn't change to moveSpeed left
    expect(player.velocity.x).toBe(50);
  });
});
