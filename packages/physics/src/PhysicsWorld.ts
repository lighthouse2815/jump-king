import { Body } from './Body';

export const PHYSICS_TICK_RATE = 60;
export const TICK_DT = 1 / PHYSICS_TICK_RATE;
const SUB_STEPS = 4;
const SUB_DT = TICK_DT / SUB_STEPS;

export class PhysicsWorld {
  public gravity: number = 1300;
  public bodies: Body[] = [];

  addBody(body: Body) {
    this.bodies.push(body);
  }

  // tick() is called exactly once per 1/60s
  tick() {
    const dynamicBodies = this.bodies.filter(b => !b.isStatic);
    const staticBodies = this.bodies.filter(b => b.isStatic);

    for (const body of dynamicBodies) {
      // Apply gravity once per tick
      body.velocity.y += this.gravity * TICK_DT;

      // We do sub-stepping to prevent tunneling
      body.isGrounded = false;
      
      let collidedX = false;
      let collidedY = false;

      for (let i = 0; i < SUB_STEPS; i++) {
        // Integrate X
        body.position.x += body.velocity.x * SUB_DT;
        if (this.resolveCollisions(body, staticBodies, 'x')) {
          collidedX = true;
        }

        // Integrate Y
        body.position.y += body.velocity.y * SUB_DT;
        if (this.resolveCollisions(body, staticBodies, 'y')) {
          collidedY = true;
        }
      }

      if (collidedX) body.velocity.x = 0;
      if (collidedY) body.velocity.y = 0;
    }
  }

  private resolveCollisions(body: Body, staticBodies: Body[], axis: 'x' | 'y'): boolean {
    const bodyAABB = body.getAABB();
    let collisionOccurred = false;

    for (const staticBody of staticBodies) {
      const staticAABB = staticBody.getAABB();

      if (bodyAABB.intersects(staticAABB)) {
        collisionOccurred = true;
        if (axis === 'x') {
          // If we hit left wall
          if (body.velocity.x < 0) {
            body.position.x = staticAABB.right;
          } 
          // If we hit right wall
          else if (body.velocity.x > 0) {
            body.position.x = staticAABB.left - body.size.x;
          }
          // Note: we don't zero velocity here so sub-steps don't break logic,
          // we zero it at the end of the tick. But wait, if we don't zero it, 
          // the next sub-step will move into the wall again. So we must zero it.
          body.velocity.x = 0;
        } else if (axis === 'y') {
          // If we hit ceiling
          if (body.velocity.y < 0) {
            body.position.y = staticAABB.bottom;
          } 
          // If we hit floor
          else if (body.velocity.y > 0) {
            body.position.y = staticAABB.top - body.size.y;
            body.isGrounded = true;
          }
          body.velocity.y = 0;
        }
        Object.assign(bodyAABB, body.getAABB());
      }
    }
    return collisionOccurred;
  }
}
