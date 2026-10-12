import { Body } from './Body';
import { PlayerInput } from './PlayerController';
import {
  OriginalAdventure,
  OriginalAdventureData,
  OriginalAdventureState,
} from './OriginalAdventure';

/** Values from the supplied Jump King 1.04 executable, in pixels per 60 Hz tick. */
const gravity = Math.fround(153 / 595);
export const ORIGINAL_PHYSICS = {
  width: 18,
  height: 26,
  walkSpeed: 1.5,
  jumpSpeed: 3.5,
  gravity,
  jumpVelocity: -Math.fround(34 * gravity),
  maxFall: 10,
  chargeTicks: 36,
  bounce: 0.5,
  iceFriction: 0.1,
  splatTicks: 30,
};

export interface OriginalScreen {
  tiles: string[];
  wind: boolean;
  teleport: number;
}

export type OriginalMovementEffect = 'jump' | 'land' | 'splat' | 'bump';

export interface OriginalState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  charge: number;
  direction: number;
  prevJump: boolean;
  jumpConsumed: boolean;
  directions: number[];
  splat: number;
  knocked: boolean;
  ice: boolean;
  snow: boolean;
  water: boolean;
  sand: boolean;
  wind: boolean;
  screen: number;
  ticks: number;
  jumps: number;
  falls: number;
  airChargeTicks?: number;
  freeFlight?: boolean;
  adventure?: OriginalAdventureState;
}

interface Contact {
  solid: boolean;
  slope: string;
  ice: boolean;
  snow: boolean;
  water: boolean;
  sand: boolean;
  quark: boolean;
  wind: boolean;
}

const f = Math.fround;
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const towards = (n: number, target: number, step: number) =>
  n + clamp(target - n, -step, step);

/** Original game movement, shared by browser and authoritative server. */
export class OriginalSimulation {
  readonly body: Body;
  chargeTicks = 0;
  direction = 1;
  prevJump = false;
  jumpConsumed = false;
  directions: number[] = [];
  splatTicks = 0;
  knocked = false;
  onIce = false;
  onSnow = false;
  inWater = false;
  onSand = false;
  windEnabled = false;
  screen = 0;
  elapsedTicks = 0;
  jumps = 0;
  falls = 0;
  freeFlight = false;
  private airChargeTicks = 0;
  readonly adventure?: OriginalAdventure;

  constructor(
    readonly screens: OriginalScreen[],
    x = 231,
    y = 302,
    adventureData?: OriginalAdventureData,
    initialAdventure?: OriginalAdventureState,
  ) {
    this.body = new Body(x, y, ORIGINAL_PHYSICS.width, ORIGINAL_PHYSICS.height);
    this.body.velocity.y = 1;
    this.body.isGrounded = true;
    this.screen = this.screenAt(y + ORIGINAL_PHYSICS.height / 2);
    if (adventureData)
      this.adventure = new OriginalAdventure(adventureData, initialAdventure);
  }

  private screenAt(y: number) {
    return clamp(-Math.floor(y / 360), 0, this.screens.length - 1);
  }

  private contact(): Contact {
    const x = Math.trunc(this.body.position.x),
      y = Math.trunc(this.body.position.y);
    const right = x + this.body.size.x,
      bottom = y + this.body.size.y;
    const info: Contact = {
      solid: false,
      slope: '',
      ice: false,
      snow: false,
      water: false,
      sand: false,
      quark: false,
      wind: this.screens[this.screen]?.wind || false,
    };
    let nearest = Infinity,
      solidTop = Infinity,
      slopeTop = Infinity;
    for (let ty = Math.floor(y / 8); ty <= Math.floor((bottom - 1) / 8); ty++) {
      const screen = -Math.floor(ty / 45);
      if (screen < 0 || screen >= this.screens.length) continue;
      const row = this.screens[screen].tiles[ty + screen * 45];
      for (
        let tx = Math.max(0, Math.floor(x / 8));
        tx <= Math.min(59, Math.floor((right - 1) / 8));
        tx++
      ) {
        const code = row[tx],
          px = tx * 8,
          py = ty * 8;
        if (code === 'X') {
          info.wind = false;
          continue;
        }
        if (code === 'W') {
          info.water = true;
          continue;
        }
        if (code === 'S') {
          info.sand = true;
          continue;
        }
        if (code === 'Q') {
          if (bottom <= py + 8) info.quark = true;
          continue;
        }
        if (code === ' ') continue;
        // Exact triangular half-tile tests using the original integer hitbox.
        const left = Math.max(x, px) - px,
          top = Math.max(y, py) - py;
        const r = Math.min(right, px + 8) - px,
          b = Math.min(bottom, py + 8) - py;
        if (
          (code === 'a' && r + b < 8) ||
          (code === 'b' && b < left) ||
          (code === 'c' && top > r) ||
          (code === 'd' && left + top > 8)
        )
          continue;
        info.solid = true;
        info.ice ||= code === 'I';
        info.snow ||= code === 'N';
        if ('abcd'.includes(code)) {
          slopeTop = Math.min(slopeTop, py);
          const distance = Math.abs(px + 4 - (x + this.body.size.x / 2));
          if (distance <= nearest) {
            nearest = distance;
            info.slope = code;
          }
        } else solidTop = Math.min(solidTop, py);
      }
    }
    if (solidTop <= slopeTop && (info.slope === 'a' || info.slope === 'b'))
      info.slope = '';
    return info;
  }

  private projectSlope(code: string, vx: number, vy: number) {
    const nx = code === 'a' || code === 'c' ? -Math.SQRT1_2 : Math.SQRT1_2;
    const ny = code === 'a' || code === 'b' ? -Math.SQRT1_2 : Math.SQRT1_2;
    const dot = vx * nx + vy * ny;
    if (dot < 0) this.body.velocity.set(f(vx - dot * nx), f(vy - dot * ny));
    return dot < 0;
  }

  private move() {
    const body = this.body;
    let info = this.contact();
    this.inWater = info.water;
    this.onSand = info.sand;
    if (!this.screens[this.screen].wind) this.windEnabled = false;
    else if (body.isGrounded) this.windEnabled = true;
    if (info.wind && this.windEnabled && !this.onSnow) {
      const phase = (this.elapsedTicks / 60) * 0.48124886;
      const wind =
        clamp(Math.sin(phase) * 2 + (Math.cos(phase) > 0 ? 1 : -1), -1, 1) *
        0.1;
      body.velocity.x = f(body.velocity.x + wind);
    }
    const vx = body.velocity.x,
      vy = body.velocity.y;
    const water = this.inWater ? 0.5 : 1;
    const wasGrounded = body.isGrounded;
    let sideSlope = false,
      bumped = false;
    if (info.solid) {
      // Original behavior also allows movement out of an existing overlap.
      body.position.set(f(body.position.x + vx), f(body.position.y + vy));
      return;
    }
    body.position.x = f(
      body.position.x + vx * water * (this.onSand ? 0.25 : 1),
    );
    const teleport = this.screens[this.screen].teleport;
    if (
      teleport >= 0 &&
      (body.position.x + 9 < 0 || body.position.x + 9 > 480)
    ) {
      body.position.x += body.position.x + 9 < 0 ? 480 : -480;
      const current = Math.trunc(-(body.position.y - 360) / 360);
      body.position.y -= 360 * (teleport - current);
      this.screen = this.screenAt(body.position.y + 13);
    } else if (teleport < 0) body.position.x = clamp(body.position.x, -9, 471);
    info = this.contact();
    if (info.solid || (info.sand && !this.onSand)) {
      body.position.x = Math.trunc(body.position.x);
      const sign = vx > 0 ? 1 : -1;
      for (let attempts = 0; attempts < 500; attempts++) {
        const next = this.contact();
        if (!next.solid && !(next.sand && !this.onSand)) break;
        info = next;
        body.position.x -= sign;
      }
      if (!info.slope) {
        body.velocity.x = f(-body.velocity.x * ORIGINAL_PHYSICS.bounce);
        this.knocked = true;
        bumped = true;
      } else {
        sideSlope = true;
        if (wasGrounded && Math.abs(vx) <= 1.5 && vy > 0) body.velocity.x = 0;
        else this.projectSlope(info.slope, body.velocity.x, body.velocity.y);
      }
    }
    const signY = body.velocity.y > 0 ? 1 : -1;
    body.position.y = f(
      body.position.y +
        body.velocity.y *
          water *
          (this.onSand && body.velocity.y < 0 ? 0.5 : 1),
    );
    if (!this.onSand && wasGrounded && body.velocity.y > 0) body.position.y++;
    info = this.contact();
    this.onSnow = false;
    if (info.solid || (info.sand && !this.onSand && body.velocity.y < 0)) {
      body.position.y = Math.trunc(body.position.y);
      for (let attempts = 0; attempts < 500; attempts++) {
        const next = this.contact();
        if (!next.solid && !(next.sand && !this.onSand && body.velocity.y < 0))
          break;
        info = next;
        body.position.y -= signY;
      }
      this.onIce = info.ice;
      if (signY > 0) {
        body.isGrounded = !info.slope;
        if (info.slope)
          this.knocked = this.projectSlope(
            info.slope,
            body.velocity.x,
            body.velocity.y,
          );
        else {
          this.knocked = false;
          this.onSnow = info.snow;
          if (vy === ORIGINAL_PHYSICS.maxFall && this.splatTicks === 0) {
            this.splatTicks = ORIGINAL_PHYSICS.splatTicks;
            this.falls++;
          }
        }
      } else {
        bumped = true;
        if (info.slope)
          this.projectSlope(info.slope, body.velocity.x, body.velocity.y);
        body.velocity.x = f(body.velocity.x * ORIGINAL_PHYSICS.bounce);
      }
      if (!info.slope || body.velocity.y <= 0 || body.isGrounded)
        body.velocity.y = 0;
    } else {
      body.isGrounded = false;
      this.onIce = false;
      if (sideSlope && signY > 0 && !this.knocked) {
        body.velocity.x = f(-body.velocity.x * ORIGINAL_PHYSICS.bounce);
        this.knocked = true;
        bumped = true;
      }
      if (info.quark && body.velocity.y === ORIGINAL_PHYSICS.maxFall)
        body.position.y = Math.ceil(body.position.y / 8) * 8;
    }
    body.velocity.y = Math.min(
      f(body.velocity.y + gravity * water),
      ORIGINAL_PHYSICS.maxFall,
    );
    this.onSand = info.sand;
    if (this.onSand) {
      body.velocity.y = Math.min(0.75, body.velocity.y);
      this.knocked = false;
    }
    if (this.adventure?.equipped.includes('SnakeRing')) {
      this.onSnow = false;
      this.onIce = body.isGrounded;
    }
    if (this.onIce)
      body.velocity.x = f(
        towards(body.velocity.x, 0, ORIGINAL_PHYSICS.iceFriction),
      );
    return bumped;
  }

  setFreeFlight(enabled: boolean) {
    // Normal collision movement cannot resume from inside solid terrain.
    if (!enabled && this.freeFlight && this.contact().solid) return false;
    this.freeFlight = enabled;
    this.body.velocity.set(0, 0);
    this.body.isGrounded = false;
    this.chargeTicks = 0;
    this.airChargeTicks = 0;
    this.prevJump = false;
    this.jumpConsumed = false;
    this.directions = [];
    this.splatTicks = 0;
    this.knocked = false;
    this.onIce = this.onSnow = this.inWater = this.onSand = false;
    this.windEnabled = false;
    return true;
  }

  tick(input: PlayerInput) {
    if (this.freeFlight) {
      const body = this.body;
      const dx = Number(input.right) - Number(input.left);
      const dy = Number(!!input.down) - Number(!!input.up);
      body.velocity.set(
        dx * ORIGINAL_PHYSICS.jumpSpeed,
        dy * ORIGINAL_PHYSICS.jumpSpeed,
      );
      body.position.set(
        clamp(f(body.position.x + body.velocity.x), 0, 480 - body.size.x),
        clamp(
          f(body.position.y + body.velocity.y),
          -(this.screens.length - 1) * 360,
          360 - body.size.y,
        ),
      );
      body.isGrounded = false;
      if (dx) this.direction = dx;
      this.screen = this.screenAt(body.position.y + body.size.y / 2);
      this.elapsedTicks++;
      return {
        bumped: false,
        adventure: [],
        effects: [] as OriginalMovementEffect[],
      };
    }
    const jumps = this.jumps,
      falls = this.falls,
      grounded = this.body.isGrounded;
    const bumped = this.move();
    this.elapsedTicks++;
    const body = this.body;
    const intent = Number(input.right) - Number(input.left);
    if (!input.jump) this.jumpConsumed = false;
    this.prevJump = input.jump;
    if (this.splatTicks > 0) {
      if (!this.onIce) body.velocity.x = 0;
      if (body.isGrounded) this.splatTicks--;
      if (this.splatTicks === 0 && !intent && !input.jump) this.splatTicks = 1;
      this.chargeTicks = 0;
    } else if (
      body.isGrounded ||
      this.onSand ||
      (this.chargeTicks > 0 && this.airChargeTicks < 2)
    ) {
      this.airChargeTicks =
        body.isGrounded || this.onSand ? 0 : this.airChargeTicks + 1;
      if (this.chargeTicks > 0 || (input.jump && !this.jumpConsumed)) {
        this.directions.unshift(intent);
        this.directions.length = Math.min(this.directions.length, 4);
        if (!this.onIce && body.isGrounded) body.velocity.x = 0;
        this.chargeTicks += this.inWater ? 0.5 : 1;
        if (this.chargeTicks >= ORIGINAL_PHYSICS.chargeTicks || !input.jump) {
          let intensity = Math.min(
            1,
            this.chargeTicks / ORIGINAL_PHYSICS.chargeTicks,
          );
          const jumpDirection =
            intent || this.directions.find((value) => value !== 0) || 0;
          if (!this.onSnow || intensity > 0.2) {
            if (this.onSnow && intensity < 0.3) intensity = 0.3;
            body.velocity.y = f(ORIGINAL_PHYSICS.jumpVelocity * intensity);
            body.velocity.x = f(
              clamp(
                body.velocity.x + jumpDirection * ORIGINAL_PHYSICS.jumpSpeed,
                -3.5,
                3.5,
              ),
            );
            if (jumpDirection) this.direction = jumpDirection;
            this.jumps++;
          }
          this.chargeTicks = 0;
          this.directions = [];
          this.jumpConsumed = true;
        }
      } else {
        const walkIntent = this.adventure?.equipped.includes('GiantBoots')
          ? 0
          : intent;
        if (this.onSnow) body.velocity.x = 0;
        else if (this.onIce) {
          const target = walkIntent * ORIGINAL_PHYSICS.walkSpeed;
          if (
            walkIntent &&
            (Math.sign(target) !== Math.sign(body.velocity.x) ||
              Math.abs(target) > Math.abs(body.velocity.x))
          )
            body.velocity.x = f(towards(body.velocity.x, target, 0.2));
        } else body.velocity.x = walkIntent * ORIGINAL_PHYSICS.walkSpeed;
        if (intent) this.direction = intent;
      }
    } else {
      this.chargeTicks = 0;
      this.directions = [];
      this.airChargeTicks = 0;
    }
    const nextScreen = this.screenAt(body.position.y + 13);
    if (
      this.screen !== nextScreen &&
      body.velocity.y !== 0 &&
      Math.sign(nextScreen - this.screen) === Math.sign(-body.velocity.y) &&
      !(body.velocity.y < 0 && Math.abs(body.velocity.y) < 3)
    ) {
      if (nextScreen < this.screen && this.screens[nextScreen].wind)
        this.windEnabled = true;
      this.screen = nextScreen;
    }
    const adventure = this.adventure?.tick(this.getState(), input) || [];
    const effects: OriginalMovementEffect[] = [];
    if (this.jumps > jumps) effects.push('jump');
    if (this.falls > falls) effects.push('splat');
    else if (!grounded && body.isGrounded) effects.push('land');
    if (bumped) effects.push('bump');
    return { bumped: !!bumped, adventure, effects };
  }

  getState(): OriginalState {
    return {
      x: this.body.position.x,
      y: this.body.position.y,
      vx: this.body.velocity.x,
      vy: this.body.velocity.y,
      grounded: this.body.isGrounded,
      charge: this.chargeTicks,
      direction: this.direction,
      prevJump: this.prevJump,
      jumpConsumed: this.jumpConsumed,
      directions: [...this.directions],
      splat: this.splatTicks,
      knocked: this.knocked,
      ice: this.onIce,
      snow: this.onSnow,
      water: this.inWater,
      sand: this.onSand,
      wind: this.windEnabled,
      screen: this.screen,
      ticks: this.elapsedTicks,
      jumps: this.jumps,
      falls: this.falls,
      airChargeTicks: this.airChargeTicks,
      freeFlight: this.freeFlight,
      ...(this.adventure ? { adventure: this.adventure.getState() } : {}),
    };
  }

  restore(state: OriginalState) {
    this.body.position.set(state.x, state.y);
    this.body.velocity.set(state.vx, state.vy);
    this.body.isGrounded = state.grounded;
    this.chargeTicks = state.charge;
    this.direction = state.direction;
    this.prevJump = state.prevJump;
    this.jumpConsumed = state.jumpConsumed;
    this.directions = [...state.directions];
    this.splatTicks = state.splat;
    this.knocked = state.knocked;
    this.onIce = state.ice;
    this.onSnow = state.snow;
    this.inWater = state.water;
    this.onSand = state.sand;
    this.windEnabled = state.wind;
    this.screen = state.screen;
    this.elapsedTicks = state.ticks;
    this.jumps = state.jumps;
    this.falls = state.falls;
    this.airChargeTicks = state.airChargeTicks || 0;
    this.freeFlight = state.freeFlight === true;
    if (state.adventure && this.adventure)
      this.adventure.restore(state.adventure);
  }
}
