import { Body } from './Body';

export class PhysicsWorld {
  public gravity: number = 1300;
  public bodies: Body[] = [];

  addBody(body: Body) {
    this.bodies.push(body);
  }

  step(dt: number) {
    const dynamicBodies = this.bodies.filter(b => !b.isStatic);
    const staticBodies = this.bodies.filter(b => b.isStatic);

    for (const body of dynamicBodies) {
      // Apply gravity
      body.velocity.y += this.gravity * dt;

      // Integrate X
      body.position.x += body.velocity.x * dt;
      this.resolveCollisions(body, staticBodies, 'x');

      // Integrate Y
      body.position.y += body.velocity.y * dt;
      body.isGrounded = false;
      this.resolveCollisions(body, staticBodies, 'y');
    }
  }

  private resolveCollisions(body: Body, staticBodies: Body[], axis: 'x' | 'y') {
    const bodyAABB = body.getAABB();

    for (const staticBody of staticBodies) {
      const staticAABB = staticBody.getAABB();

      if (bodyAABB.intersects(staticAABB)) {
        if (axis === 'x') {
          if (body.velocity.x > 0) {
            body.position.x = staticAABB.left - body.size.x;
          } else if (body.velocity.x < 0) {
            body.position.x = staticAABB.right;
          }
          body.velocity.x = 0;
        } else if (axis === 'y') {
          if (body.velocity.y > 0) {
            body.position.y = staticAABB.top - body.size.y;
            body.isGrounded = true;
          } else if (body.velocity.y < 0) {
            body.position.y = staticAABB.bottom;
          }
          body.velocity.y = 0;
        }
        
        // Update AABB after resolution
        Object.assign(bodyAABB, body.getAABB());
      }
    }
  }
}
