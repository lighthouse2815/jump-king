import { Vector2, AABB } from './math';

export class Body {
  public position: Vector2;
  public velocity: Vector2;
  public size: Vector2;
  public isStatic: boolean;
  public isGrounded: boolean = false;
  
  constructor(x: number, y: number, width: number, height: number, isStatic: boolean = false) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.size = new Vector2(width, height);
    this.isStatic = isStatic;
  }

  getAABB(): AABB {
    return new AABB(this.position.x, this.position.y, this.size.x, this.size.y);
  }
}
