import { Body } from './Body';
import { TICK_DT, PHYSICS_TICK_RATE } from './PhysicsWorld';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean; // true when held
  seq?: number;
}

export const GAME_CONFIG = {
  maxChargeTicks: Math.floor(1.0 * 60), // 1 second charge at 60Hz
  minJumpVel: 250,
  maxJumpVel: 650,
  moveSpeed: 130,
  gravity: 1300,
};

export class PlayerController {
  public chargeTicks: number = 0;
  public direction: 1 | -1 = 1;
  public prevJump: boolean = false;

  constructor(public body: Body) {}

  // tick() is called exactly once per physics tick (1/60s)
  tick(input: PlayerInput) {
    // Resolve left/right simultaneous press (cancel each other out)
    let moveIntent = 0;
    if (input.left && !input.right) moveIntent = -1;
    if (input.right && !input.left) moveIntent = 1;

    const jumpJustReleased = this.prevJump && !input.jump;
    this.prevJump = input.jump;

    if (this.body.isGrounded) {
      if (input.jump) {
        // Charging jump
        this.body.velocity.x = 0;
        this.chargeTicks++;
        if (this.chargeTicks > GAME_CONFIG.maxChargeTicks) {
          this.chargeTicks = GAME_CONFIG.maxChargeTicks;
        }
      } else {
        if (jumpJustReleased && this.chargeTicks > 0) {
          // Release jump
          const chargeRatio = this.chargeTicks / GAME_CONFIG.maxChargeTicks;
          const jumpPower = GAME_CONFIG.minJumpVel + (GAME_CONFIG.maxJumpVel - GAME_CONFIG.minJumpVel) * chargeRatio;
          
          this.body.velocity.y = -jumpPower;
          
          if (moveIntent === -1) {
            this.body.velocity.x = -GAME_CONFIG.moveSpeed;
            this.direction = -1;
          } else if (moveIntent === 1) {
            this.body.velocity.x = GAME_CONFIG.moveSpeed;
            this.direction = 1;
          } else {
            this.body.velocity.x = 0;
          }
          
          this.chargeTicks = 0;
          this.body.isGrounded = false;
        } else {
          // Normal movement
          if (moveIntent === -1) {
            this.body.velocity.x = -GAME_CONFIG.moveSpeed;
            this.direction = -1;
          } else if (moveIntent === 1) {
            this.body.velocity.x = GAME_CONFIG.moveSpeed;
            this.direction = 1;
          } else {
            this.body.velocity.x = 0;
          }
          this.chargeTicks = 0;
        }
      }
    } else {
      // In air
      this.chargeTicks = 0;
      // No air control: we keep our velocity.x until we hit a wall
    }
  }
}
