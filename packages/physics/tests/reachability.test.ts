import { expect, test } from 'vitest';
import { PhysicsWorld, Body, PlayerController, GAME_CONFIG } from '../src';
import { MAP_1 } from '../../maps/src';

// Simulate a perfect jump from a given platform to another
// We will test if the center of the player can land on top of the target platform
test('Map 1 is fully reachable', () => {
  const platforms = MAP_1.filter(p => p.w > 20 && p.h === 20 && p.y >= -250).sort((a, b) => b.y - a.y);
  
  // The platforms in order from bottom to top:
  // 0: { x: 0, y: 580, w: 800, h: 20 }
  // 1: { x: 300, y: 460, w: 200, h: 20 }
  // 2: { x: 100, y: 340, w: 150, h: 20 }
  // 3: { x: 320, y: 220, w: 200, h: 20 }
  // 4: { x: 550, y: 100, w: 150, h: 20 }
  // 5: { x: 350, y: -20, w: 150, h: 20 }
  // 6: { x: 150, y: -140, w: 150, h: 20 }
  // 7: { x: 350, y: -250, w: 150, h: 20 }

  const canReach = (p1: any, p2: any) => {
    const world = new PhysicsWorld();
    world.addBody(new Body(p1.x, p1.y, p1.w, p1.h, true));
    world.addBody(new Body(p2.x, p2.y, p2.w, p2.h, true));

    const playerSize = { w: 20, h: 30 };
    
    // We try jumping from all horizontal positions on p1
    const startXs = [];
    for (let x = p1.x + 10; x <= p1.x + p1.w - 10; x += 10) {
      startXs.push(x);
    }

    const charges = [20, 40, 60];

    for (const chargeTicks of charges) {
      for (const startX of startXs) {
        // Left and right jumps
        for (const moveRight of [true, false]) {
          const body = new Body(startX, p1.y - playerSize.h - 1, playerSize.w, playerSize.h);
          world.bodies.push(body);
          const controller = new PlayerController(body);

          // Fall to ground
          for (let i = 0; i < 5; i++) {
            controller.tick({ left: false, right: false, jump: false });
            world.tickBody(body);
          }

          // Charge
          for (let i = 0; i < chargeTicks; i++) {
            controller.tick({ left: false, right: false, jump: true });
            world.tickBody(body);
          }

          // Release and move
          controller.tick({ left: !moveRight, right: moveRight, jump: false });
          world.tickBody(body);

          // Wait until we land or fall below start platform
          let landed = false;
          for (let i = 0; i < 150; i++) {
            controller.tick({ left: !moveRight, right: moveRight, jump: false });
            world.tickBody(body);
            if (body.isGrounded && body.position.y <= p2.y - playerSize.h + 1 && body.position.x >= p2.x - playerSize.w && body.position.x <= p2.x + p2.w) {
              landed = true;
              break;
            }
          }
          
          world.bodies.pop(); // remove player for next trial
          
          if (landed) return true;
        }
      }
    }
    return false;
  };

  for (let i = 0; i < platforms.length - 1; i++) {
    const p1 = platforms[i];
    const p2 = platforms[i+1];
    const reachable = canReach(p1, p2);
    if (!reachable) {
      console.log('Unreachable from', p1, 'to', p2);
    }
    expect(reachable).toBe(true);
  }
});
