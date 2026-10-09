import { describe, it, expect } from 'vitest';
import { PhysicsWorld, Body, PlayerController, GAME_CONFIG } from '../src';

describe('PhysicsWorld & PlayerController', () => {
  it('should apply gravity and fall', () => {
    const world = new PhysicsWorld();
    const player = new Body(0, 0, 20, 20);
    world.addBody(player);
    
    world.step(1.0); // 1 second
    
    expect(player.velocity.y).toBe(world.gravity);
    expect(player.position.y).toBe(world.gravity);
  });

  it('should collide with static ground', () => {
    const world = new PhysicsWorld();
    const player = new Body(0, 50, 20, 20);
    const ground = new Body(0, 100, 100, 20, true);
    
    world.addBody(player);
    world.addBody(ground);
    
    player.velocity.y = 100;
    
    // Step at 60Hz
    const dt = 1/60;
    for(let i = 0; i < 30; i++) {
        world.step(dt);
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

    // Charge for 0.5s
    controller.update({ left: false, right: false, jump: true }, 0.5);
    expect(controller.chargeTime).toBe(0.5);
    expect(player.velocity.y).toBe(0);

    // Release jump
    controller.update({ left: false, right: false, jump: false }, 0.1);
    expect(controller.chargeTime).toBe(0);
    expect(player.velocity.y).toBeLessThan(0); // jumping up
    expect(player.isGrounded).toBe(false);
  });

  it('player should move left and right on ground', () => {
    const player = new Body(0, 80, 20, 20);
    player.isGrounded = true;
    const controller = new PlayerController(player);

    controller.update({ left: true, right: false, jump: false }, 0.1);
    expect(player.velocity.x).toBe(-GAME_CONFIG.moveSpeed);

    controller.update({ left: false, right: true, jump: false }, 0.1);
    expect(player.velocity.x).toBe(GAME_CONFIG.moveSpeed);
  });

  it('player has no air control', () => {
    const player = new Body(0, 80, 20, 20);
    player.isGrounded = false;
    player.velocity.x = 50; // Already moving in air
    const controller = new PlayerController(player);

    controller.update({ left: true, right: false, jump: false }, 0.1);
    // Velocity shouldn't change to moveSpeed left
    expect(player.velocity.x).toBe(50);
  });
});
