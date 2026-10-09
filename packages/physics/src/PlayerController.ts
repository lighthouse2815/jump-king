import { Body } from './Body';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean; // true when held
}

export const GAME_CONFIG = {
  maxChargeTime: 1.0,
  minJumpVel: 250,
  maxJumpVel: 570,
  moveSpeed: 130,
  gravity: 1300,
};

export class PlayerController {
  public chargeTime: number = 0;
  public direction: 1 | -1 = 1;

  constructor(public body: Body) {}

  update(input: PlayerInput, dt: number) {
    if (this.body.isGrounded) {
      if (input.jump) {
        // Charging jump
        this.body.velocity.x = 0; // Stop moving while charging
        this.chargeTime += dt;
        if (this.chargeTime > GAME_CONFIG.maxChargeTime) {
          this.chargeTime = GAME_CONFIG.maxChargeTime;
        }
      } else {
        if (this.chargeTime > 0) {
          // Release jump
          const chargeRatio = this.chargeTime / GAME_CONFIG.maxChargeTime;
          const jumpPower = GAME_CONFIG.minJumpVel + (GAME_CONFIG.maxJumpVel - GAME_CONFIG.minJumpVel) * chargeRatio;
          
          this.body.velocity.y = -jumpPower;
          
          // Apply horizontal jump velocity based on current intent, or direction?
          // Usually in Jump King, if you hold left/right while releasing jump, you jump in that direction.
          if (input.left) {
            this.body.velocity.x = -GAME_CONFIG.moveSpeed;
            this.direction = -1;
          } else if (input.right) {
            this.body.velocity.x = GAME_CONFIG.moveSpeed;
            this.direction = 1;
          } else {
            this.body.velocity.x = 0;
          }
          
          this.chargeTime = 0;
          this.body.isGrounded = false;
        } else {
          // Normal movement
          if (input.left) {
            this.body.velocity.x = -GAME_CONFIG.moveSpeed;
            this.direction = -1;
          } else if (input.right) {
            this.body.velocity.x = GAME_CONFIG.moveSpeed;
            this.direction = 1;
          } else {
            this.body.velocity.x = 0;
          }
        }
      }
    } else {
      // In air: no air control. Velocity X remains constant unless colliding.
      this.chargeTime = 0; // Reset charge if we fall off an edge
    }
  }
}
