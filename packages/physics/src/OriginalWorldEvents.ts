import { AABB } from './math';
import {
  ORIGINAL_PHYSICS,
  type OriginalScreen,
  type OriginalState,
} from './OriginalSimulation';

/** All screen indices are zero-based; all rectangles/positions are world pixels. */
export interface OriginalEventRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OriginalWallEventDefinition {
  id: string;
  screen: number;
  texture: string;
  position: { x: number; y: number };
  /** Touch triggers only. RaymanWallEntity does not create/remove colliders. */
  hitboxes: OriginalEventRectangle[];
  appearSound?: string | null;
  disappearSound?: string | null;
  playMode?: 'once' | 'every-time';
}

export interface OriginalJingleDefinition {
  screen: number;
  key: string;
  channel: 'music' | 'sfx';
}

export interface OriginalEventCollisionRegion {
  screen: number;
  kind: 'fake' | 'quark';
  /** Quark regions must be individual 8x8 tiles: each has its own bottom test. */
  rect: OriginalEventRectangle;
}

export interface OriginalWorldEventData {
  walls?: OriginalWallEventDefinition[];
  /** Omit to use Content/audio/music/event_music/events.xml from version 1.04. */
  jingles?: OriginalJingleDefinition[];
  collisionRegions?: OriginalEventCollisionRegion[];
}

/** Accept a full OriginalState or these five fields without allocating a snapshot. */
export type OriginalWorldEventPlayer = Pick<
  OriginalState,
  'x' | 'y' | 'screen' | 'grounded' | 'ticks'
>;

/** Shape produced by the existing fast-xml-parser; no XML dependency at runtime. */
export interface OriginalRaymanData {
  texture_name: string;
  Position: { X: number; Y: number };
  use_screen_coords?: boolean;
  hitboxes?: {
    Rectangle?: OriginalXmlRectangle | OriginalXmlRectangle[];
  };
  sfx_info?: {
    sfx_name_enable?: string;
    sfx_name_disable?: string;
    play_mode?: 'PlayOnce' | 'PlayEveryTime';
  };
}

interface OriginalXmlRectangle {
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

/** RaymanData.CorrectPosition + RaymanWallEntity's sound defaults. */
export function createOriginalWallDefinition(
  screen: number,
  data: OriginalRaymanData,
  textureSize: { width: number; height: number },
  id = `${screen}:${data.texture_name}`,
): OriginalWallEventDefinition {
  const position = { x: data.Position.X, y: data.Position.Y - screen * 360 };
  const rectangles = data.hitboxes?.Rectangle;
  const hitboxes =
    rectangles == null
      ? data.hitboxes == null
        ? [{ X: 0, Y: 0, Width: textureSize.width, Height: textureSize.height }]
        : []
      : Array.isArray(rectangles)
        ? rectangles
        : [rectangles];
  return {
    id,
    screen,
    texture: `props/hidden_walls/textures/${data.texture_name}`,
    position,
    hitboxes: hitboxes.map((rect) => ({
      x: rect.X + (data.use_screen_coords ? 0 : position.x),
      y: rect.Y + (data.use_screen_coords ? -screen * 360 : position.y),
      width: rect.Width,
      height: rect.Height,
    })),
    appearSound: data.sfx_info?.sfx_name_enable
      ? `audio/event_sfx/${data.sfx_info.sfx_name_enable}`
      : 'audio/illusion',
    disappearSound: data.sfx_info?.sfx_name_disable
      ? `audio/event_sfx/${data.sfx_info.sfx_name_disable}`
      : null,
    playMode:
      data.sfx_info?.play_mode === 'PlayEveryTime' ? 'every-time' : 'once',
  };
}

/** Q tiles are imported already; gray 128/128/128 fake tiles are omitted by the importer. */
export function originalQuarkRegions(
  screens: readonly Pick<OriginalScreen, 'tiles'>[],
): OriginalEventCollisionRegion[] {
  const regions: OriginalEventCollisionRegion[] = [];
  screens.forEach((screen, index) => {
    screen.tiles.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 'Q')
          regions.push({
            screen: index,
            kind: 'quark',
            rect: { x: x * 8, y: y * 8 - index * 360, width: 8, height: 8 },
          });
      }
    });
  });
  return regions;
}

export const ORIGINAL_WORLD_JINGLES: readonly OriginalJingleDefinition[] = [
  {
    screen: 42,
    key: 'audio/music/event_music/ending_jingle',
    channel: 'music',
  },
  { screen: 99, key: 'audio/music/event_music/Moon', channel: 'music' },
  { screen: 137, key: 'audio/music/event_music/Elude1', channel: 'music' },
  { screen: 153, key: 'audio/music/event_music/Elude2', channel: 'music' },
  { screen: 147, key: 'audio/event_sfx/gargoyls', channel: 'sfx' },
];

export interface OriginalWallEventState {
  touching: boolean;
  canPlaySound: boolean;
  alpha: number;
}

export interface OriginalLightningState {
  screen: number;
  triggerTick: number;
  sounded: boolean;
  phase: 'waiting' | 'flash' | 'gap' | 'fade';
  alpha: number;
}

export interface OriginalWorldEventsState {
  version: 1;
  lastTick: number | null;
  registeredScreens: number[];
  walls: Record<string, OriginalWallEventState>;
  lightning: OriginalLightningState | null;
  randomState: number;
}

export interface OriginalGargoyleSpawn {
  x: number;
  y: number;
  flipped: boolean;
  delaySeconds: number;
}

export type OriginalWorldEvent =
  | { type: 'sound'; key: string; channel: 'music' | 'sfx' }
  | {
      type: 'wall';
      id: string;
      screen: number;
      touching: boolean;
      alpha: number;
    }
  | {
      type: 'lightning';
      screen: number;
      phase: 'flash' | 'gap' | 'fade' | 'end';
      alpha: number;
    }
  | {
      type: 'gargoyles';
      screen: number;
      texture: string;
      cells: { x: number; y: number };
      frameSeconds: number;
      /** FlyingGargoyle: speed += seconds * acceleration; y -= speed + baseSpeed per tick. */
      baseSpeed: number;
      acceleration: number;
      spawns: OriginalGargoyleSpawn[];
    };

export interface OriginalCollisionOverrides {
  /** Skip existing tile collision AND metadata in these world-space regions. */
  disabledTileRegions: OriginalEventRectangle[];
  /** QuarkBlock is metadata, never a solid rectangle (LevelScreen.TryCollision). */
  quark: boolean;
}

const WALL_FADE_TICKS = 12; // RaymanWallEntity.FADE_DURATION = 0.2s.
const LIGHTNING_SCREEN = 94; // NBPTowerLightning.OnNewScreen(95).
const LIGHTNING_DELAY = 360; // Lightning(6f).
const LIGHTNING_FLASH = 6; // PauseNode(0.1f).
const LIGHTNING_GAP = 6; // PauseNode(0.1f).
const LIGHTNING_FADE = 12; // FadeNode(0.2f, FadeOut, 256).
const GARGOYLE_SCREEN = 147; // OwlFlyingGargoyle.FIRST_TOWER_SCREEN1 = 148.

function integerHitbox(rect: OriginalEventRectangle): AABB {
  return new AABB(
    Math.trunc(rect.x),
    Math.trunc(rect.y),
    rect.width,
    rect.height,
  );
}

function copyState(state: OriginalWorldEventsState): OriginalWorldEventsState {
  return {
    ...state,
    registeredScreens: [...state.registeredScreens],
    walls: Object.fromEntries(
      Object.entries(state.walls).map(([id, wall]) => [id, { ...wall }]),
    ),
    lightning: state.lightning ? { ...state.lightning } : null,
  };
}

/**
 * Deterministic 60Hz prop/screen events, without item, merchant, or bird logic.
 *
 * Call tick after each simulation tick; duplicate ticks are ignored. Restore this
 * snapshot together with OriginalState. The renderer uses wall alpha/lightning
 * state when rebuilding a scene; gargoyles are a one-shot cosmetic spawn payload.
 *
 * Original source references:
 * JumpKing.Props/PropManager.cs, JumpKing.Props.RaymanWall/{RaymanData,RaymanWallEntity}.cs,
 * JumpKing.Level/{LevelManager,LevelScreen,QuarkBlock}.cs,
 * JumpKing.MiscSystems/ScreenEventManager.cs, JumpKing.MiscSystems.ScreenEvents/*.
 *
 * Hidden/fake/phantom wall alpha never toggles solidity in the original source.
 * No inventory/flag-controlled collision gate exists in these classes. Q edge
 * tiles instead expose position-dependent quark metadata for BodyComp's fall snap.
 */
export class OriginalWorldEvents {
  private readonly walls: OriginalWallEventDefinition[];
  private readonly jingles: OriginalJingleDefinition[];
  private readonly collisionRegions: OriginalEventCollisionRegion[];
  private state: OriginalWorldEventsState;

  constructor(data: OriginalWorldEventData = {}, seed = 1) {
    this.walls = (data.walls || []).map((wall) => ({
      ...wall,
      position: { ...wall.position },
      hitboxes: wall.hitboxes.map((rect) => ({ ...rect })),
    }));
    this.jingles = (data.jingles ?? ORIGINAL_WORLD_JINGLES).map((jingle) => ({
      ...jingle,
    }));
    this.collisionRegions = (data.collisionRegions || []).map((region) => ({
      ...region,
      rect: { ...region.rect },
    }));
    if (new Set(this.walls.map((wall) => wall.id)).size !== this.walls.length)
      throw new Error('Original world wall IDs must be unique');
    this.state = {
      version: 1,
      lastTick: null,
      registeredScreens: [],
      walls: Object.fromEntries(
        this.walls.map((wall) => [
          wall.id,
          {
            touching: false,
            canPlaySound: true,
            alpha: 0,
          },
        ]),
      ),
      lightning: null,
      randomState: seed >>> 0 || 1,
    };
  }

  getState(): OriginalWorldEventsState {
    return copyState(this.state);
  }

  restore(state: OriginalWorldEventsState): void {
    if (
      state.version !== 1 ||
      !state.walls ||
      this.walls.some((wall) => !state.walls[wall.id]) ||
      (state.lastTick !== null &&
        (!Number.isSafeInteger(state.lastTick) || state.lastTick < 0)) ||
      !Array.isArray(state.registeredScreens) ||
      !state.registeredScreens.every(
        (screen) => Number.isSafeInteger(screen) && screen >= 0 && screen < 169,
      ) ||
      !Number.isSafeInteger(state.randomState) ||
      !Object.values(state.walls).every(
        (wall) =>
          Number.isFinite(wall.alpha) && wall.alpha >= 0 && wall.alpha <= 1,
      ) ||
      (state.lightning &&
        ![
          state.lightning.screen,
          state.lightning.triggerTick,
          state.lightning.alpha,
        ].every(Number.isFinite))
    )
      throw new Error('Incompatible original world events snapshot');
    this.state = copyState(state);
  }

  tick(player: OriginalWorldEventPlayer): OriginalWorldEvent[] {
    if (!Number.isSafeInteger(player.ticks) || player.ticks < 0)
      throw new Error(
        'Original world events require a nonnegative integer tick',
      );
    if (player.ticks === this.state.lastTick) return [];
    if (this.state.lastTick !== null && player.ticks < this.state.lastTick)
      throw new Error('Restore original world events before rewinding ticks');
    const elapsed =
      this.state.lastTick === null ? 1 : player.ticks - this.state.lastTick;
    this.state.lastTick = player.ticks;
    const events: OriginalWorldEvent[] = [];
    const hitbox = integerHitbox({
      x: player.x,
      y: player.y,
      width: ORIGINAL_PHYSICS.width,
      height: ORIGINAL_PHYSICS.height,
    });
    for (const wall of this.walls) {
      const state = this.state.walls[wall.id];
      const touching = wall.hitboxes.some((rect) =>
        hitbox.intersects(new AABB(rect.x, rect.y, rect.width, rect.height)),
      );
      if (touching !== state.touching) {
        const key = touching
          ? wall.appearSound === undefined
            ? 'audio/illusion'
            : wall.appearSound
          : wall.disappearSound;
        if (key && state.canPlaySound)
          events.push({ type: 'sound', key, channel: 'sfx' });
        if (!touching) state.canPlaySound = wall.playMode === 'every-time';
      }
      const alpha =
        Math.max(
          0,
          Math.min(
            WALL_FADE_TICKS,
            Math.round(state.alpha * WALL_FADE_TICKS) +
              (touching ? -elapsed : elapsed),
          ),
        ) / WALL_FADE_TICKS;
      if (touching !== state.touching || alpha !== state.alpha)
        events.push({
          type: 'wall',
          id: wall.id,
          screen: wall.screen,
          touching,
          alpha,
        });
      state.touching = touching;
      state.alpha = alpha;
    }

    // ScreenEventManager records ALL screens on landing, including those with no effect.
    if (
      player.grounded &&
      !this.state.registeredScreens.includes(player.screen)
    ) {
      this.state.registeredScreens.push(player.screen);
      for (const jingle of this.jingles) {
        if (jingle.screen === player.screen)
          events.push({
            type: 'sound',
            key: jingle.key,
            channel: jingle.channel,
          });
      }
      if (player.screen === LIGHTNING_SCREEN)
        this.state.lightning = {
          screen: player.screen,
          triggerTick: player.ticks + LIGHTNING_DELAY,
          sounded: false,
          phase: 'waiting',
          alpha: 0,
        };
      if (player.screen === GARGOYLE_SCREEN) events.push(this.spawnGargoyles());
    }
    this.updateLightning(player, events);
    return events;
  }

  /**
   * Call at EVERY contact probe with the tentative integer body rectangle, not
   * just the last tick's player position. Mirrors LevelManager's current +/-1
   * screen search and QuarkBlock.Intersects's hitbox.Bottom <= tile.Bottom.
   * Never add these quark/fake regions to the solid collision rectangles.
   */
  getCollisionOverrides(
    hitbox: OriginalEventRectangle,
    screen: number,
  ): OriginalCollisionOverrides {
    const body = integerHitbox(hitbox);
    const result: OriginalCollisionOverrides = {
      disabledTileRegions: [],
      quark: false,
    };
    for (const region of this.collisionRegions) {
      if (Math.abs(region.screen - screen) > 1) continue;
      const rect = new AABB(
        region.rect.x,
        region.rect.y,
        region.rect.width,
        region.rect.height,
      );
      if (!body.intersects(rect)) continue;
      if (region.kind === 'fake' || body.bottom > rect.bottom)
        result.disabledTileRegions.push({ ...region.rect });
      else result.quark = true;
    }
    return result;
  }

  private updateLightning(
    player: OriginalWorldEventPlayer,
    events: OriginalWorldEvent[],
  ): void {
    const lightning = this.state.lightning;
    if (!lightning) return;
    const age = player.ticks - lightning.triggerTick;
    if (
      player.screen !== lightning.screen ||
      age >= LIGHTNING_FLASH + LIGHTNING_GAP + LIGHTNING_FADE
    ) {
      events.push({
        type: 'lightning',
        screen: lightning.screen,
        phase: 'end',
        alpha: 0,
      });
      this.state.lightning = null;
      return;
    }
    if (age < 0) return;
    if (!lightning.sounded) {
      events.push({
        type: 'sound',
        key: 'audio/event_sfx/lightning',
        channel: 'sfx',
      });
      lightning.sounded = true;
    }
    const phase =
      age < LIGHTNING_FLASH
        ? 'flash'
        : age < LIGHTNING_FLASH + LIGHTNING_GAP
          ? 'gap'
          : 'fade';
    const alpha =
      phase === 'flash'
        ? 0.5
        : phase === 'gap'
          ? 0
          : Math.round(
              (1 -
                (age - LIGHTNING_FLASH - LIGHTNING_GAP + 1) / LIGHTNING_FADE) *
                256,
            ) / 512;
    if (phase !== lightning.phase || alpha !== lightning.alpha)
      events.push({
        type: 'lightning',
        screen: lightning.screen,
        phase,
        alpha,
      });
    lightning.phase = phase;
    lightning.alpha = alpha;
  }

  // Replace the original global Game1.random with a saved xorshift32 stream.
  private random(): number {
    let value = this.state.randomState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state.randomState = value >>> 0;
    return this.state.randomState / 0x100000000;
  }

  private spawnGargoyles(): Extract<OriginalWorldEvent, { type: 'gargoyles' }> {
    const f = Math.fround;
    // OwlFlyingGargoyle.SPAWN_INFO uses indices 0,2,5,8,10,12 of its source arrays.
    const info = [
      { x: 0, delay: 0.05, flip: false },
      { x: 0.1, delay: 0.45, flip: true },
      { x: 0.45, delay: 0.95, flip: false },
      { x: 0.75, delay: 0.75, flip: true },
      { x: 0.9, delay: 0.3, flip: false },
      { x: 1, delay: 0, flip: true },
    ];
    const top = -GARGOYLE_SCREEN * 360;
    const spawns = info.map((spawn) => ({
      x: f(f(spawn.x) * 480),
      y: top + 360,
      flipped: spawn.flip,
      delaySeconds: f(f(spawn.delay) * f(this.random())),
    }));
    for (const spawn of [...info, { x: 0.5, delay: 1, flip: true }]) {
      // Source deliberately makes TWO SpawnGargoyle2 calls per SPAWN_INFO entry.
      const count = spawn.x === 0.5 ? 1 : 2;
      for (let i = 0; i < count; i++)
        spawns.push({
          x: f(f(f(f(f(spawn.x) - 0.5) * f(0.8)) + 0.5) * 480),
          y: top + 396,
          flipped: !spawn.flip,
          delaySeconds: f(f(f(spawn.delay) * 0.5) * f(this.random())),
        });
    }
    return {
      type: 'gargoyles',
      screen: GARGOYLE_SCREEN,
      texture: 'ending/flying_gargoyle',
      cells: { x: 1, y: 3 },
      frameSeconds: 0.1,
      baseSpeed: 2,
      acceleration: 3,
      spawns,
    };
  }
}
