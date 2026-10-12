import Phaser from 'phaser';
import type { CampaignId } from '@jump-king/maps';

/**
 * Jump King 1.04: IntroState, GameEnding, EndingPictureScreen and
 * GameManager.MultiEnding.{NormalEnding,NewBabePlusEnding,OwlEnding}.
 * Frame rectangles/origins: JKMemory.KingSpriteLayers.*; skins: king/skin_settings.xml.
 * English text: LanguageManager.CREDITS_ROLL and LanguageJK.language.en-US.resx.
 * Parent owns asset loading, simulation/input suspension, ambience and save persistence.
 * onComplete fires when the intro ends / the ending picture appears (including skip).
 * onDismiss implements EndingPictureScreen's two-second wait followed by any input.
 * Imported SpriteFont atlases supply the original menu glyphs; fontFamily can override them.
 */

const SKINS: Record<string, { texture: string; layer: number }> = {
  CapeOwl: { texture: 'king/cape_owl', layer: 0 },
  Shoes: { texture: 'king/shoes', layer: 1 },
  GiantBoots: { texture: 'king/shoes_iron', layer: 1 },
  YellowShoes: { texture: 'king/yellowshoes', layer: 1 },
  Tunic: { texture: 'king/tunic', layer: 2 },
  SnakeRing: { texture: 'king/ring', layer: 3 },
  Crown: { texture: 'king/crown', layer: 4 },
  CrownNBP: { texture: 'king/crown_nbp', layer: 4 },
  CrownOwl: { texture: 'king/crown_owl', layer: 4 },
  Cap: { texture: 'king/cap', layer: 4 },
  GnomeHat: { texture: 'king/gnomehat', layer: 4 },
};

export const ORIGINAL_CUTSCENE_TEXTURE_KEYS = [
  'king/base',
  ...Object.values(SKINS).map((skin) => skin.texture),
  'ending/imagecrown',
  'ending/imageshoes',
  'ending/nbp_imagecrown',
  'ending/nbp_imageshoes',
  'ending/owl_imagecrown',
  'ending/owl_imagebird',
  'props/textures/raven/raven_crown',
  'props/textures/raven/raven',
  'props/textures/raven/tsuchinoko',
] as const;

export const ORIGINAL_CUTSCENE_SOUND_KEYS = [
  'audio/music/opening theme',
  'audio/music/ending',
  'audio/music/ending2',
  'audio/music/ending3',
  'audio/jump_king/king_jump',
  'audio/jump_king/king_land',
  'audio/jump_king/king_splat',
  'audio/plink',
  'audio/babe/babe jump',
  'audio/babe/babe kiss',
  'audio/babe/babe mou',
  'audio/babe/babe pickup',
  'audio/babe/babe scream',
  'audio/babe/babe surprised2',
  'audio/event_sfx/owl_lightning',
  'audio/event_sfx/owl_gargoyle_scared',
] as const;

export type OriginalCutsceneState =
  | 'idle'
  | 'intro'
  | 'ending'
  | 'picture'
  | 'complete'
  | 'cancelled'
  | 'destroyed';
export interface OriginalCutsceneResult {
  kind: 'intro' | 'ending';
  skipped: boolean;
  equipped: string[];
  picture?: string;
}
export interface OriginalCutsceneOptions {
  equipped?: readonly string[];
  /** RavenSaves.GetState("raven").is_done: raven replaces the normal cherubs. */
  ravenDone?: boolean;
  /** RavenSaves.GetState("tsuchinoko").is_done: bird gives/equips CapeOwl. */
  tsuchinokoDone?: boolean;
  player?: Phaser.GameObjects.Sprite;
  /** Existing ending NPC sprites to hide while their cutscene actors are drawn. */
  hide?: readonly (
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Container
    | Phaser.GameObjects.Image
  )[];
  fontFamily?: string;
  fontSize?: number;
  depth?: number;
  onComplete: (result: OriginalCutsceneResult) => void;
  /** Called at each original GiveWearableItemNode; persist the item in the parent. */
  onEquipment?: (item: string, equipped: string[]) => void;
  onDismiss?: () => void;
}

type Frame = {
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
};
const FRAMES: Record<string, Frame> = {};
function grid(
  group: string,
  names: string,
  cells: string,
  w: number,
  h: number,
  x = 0,
  y = 0,
  ox = 0.5,
  oy = 1,
) {
  const positions = cells.split(' ');
  names.split(' ').forEach((name, i) => {
    const [column, row] = positions[i].split(',').map(Number);
    FRAMES[`${group}.${name}`] = {
      x: x + column * w,
      y: y + row * h,
      w,
      h,
      ox,
      oy,
    };
  });
}
grid(
  'regular',
  'idle walk_one walk_smear walk_two charge up fall bounce splat look_up',
  '0,0 1,0 2,0 3,0 0,1 1,1 2,1 0,2 3,1 0,3',
  48,
  48,
  224,
);
grid(
  'babe',
  'kiss idle0 idle1 idle2 charge up fall land',
  '2,0 3,0 4,0 5,0 5,1 4,1 3,1 2,1',
  32,
  32,
  0,
  0,
  0.5,
  0.5,
);
grid(
  'normal',
  'snatch idle_left idle_right charge walk_left0 walk_left1 walk_left2 walk_right0 walk_right1 walk_right2',
  '0,0 0,1 1,1 1,0 2,2 1,2 0,2 5,2 4,2 3,2',
  32,
  32,
);
FRAMES['normal.snatch_smear'] = { x: 128, y: 96, w: 64, h: 32, ox: 0.5, oy: 1 };
// BabeCouple.MakePixelCenter uses a 32x96 reference, even for the 64x64 frames.
grid(
  'normal',
  'dunk parasol fly0 fly1 fly2 upskirt0 upskirt1 upskirt2',
  '1,1.5 0,1.5 0,2.5 1,2.5 2,2.5 0,3.5 1,3.5 2,3.5',
  64,
  64,
  0,
  0,
  0.5,
  0.5 + 16 / 96,
);
grid(
  'cherub',
  'deliver0 deliver1 escape0 escape1',
  '6,0 6,1 6,2 6,3',
  32,
  32,
  0,
  0,
  0.5,
  0.5,
);
grid(
  'nbpKing',
  'grab0 grab1 idle_left idle_right walk0 smear walk1 charge panty0 panty1 jump0 jump1 jump2 look_down',
  '0,1 1,1 2,1 3,1 0,2 1,2 2,2 3,2 1,3 2,3 1,0 2,0 3,0 3,3',
  48,
  48,
  224,
  144,
);
grid('nbpKing', 'fly flap0 flap1 flap2', '0,0 1,0 2,0 3,0', 64, 96, 0, 288);
grid(
  'nbpCherub',
  'deliver0 deliver1 escape0 escape1',
  '0,0 0,1 0,2 0,3',
  32,
  32,
  192,
  128,
);
FRAMES['nbpKing.bird'] = { x: 256, y: 352, w: 64, h: 32, ox: 0.5, oy: 0.5 };
grid(
  'nbpBabe',
  'ground0 ground1 ground2 laugh0 laugh1 charge up fall crown0 crown1 crown2 kiss give0 give1 give2 float0 float1 float2 hang0 hang1 hang2 impressed0 impressed1 impressed2 arm0 arm1 arm2 arm20 arm21 arm22',
  '0,0 1,0 2,0 3,0 3,1 0,1 1,1 2,1 0,2 1,2 2,2 3,2 0,3 1,3 2,3 0,4 1,4 2,4 0,5 1,5 2,5 0,6 1,6 2,6 0,7 1,7 2,7 0,8 1,8 2,8',
  32,
  40,
  416,
);
FRAMES['nbpBabe.give2'].w = 64;
FRAMES['nbpBabe.give2'].ox = 0.25;
grid(
  'owlKing',
  'spirit hands grab idle walk0 smear walk1 charge jump squash',
  '0,0 1,0 2,0 0,1 1,1 2,1 3,1 0,2 1,2 2,2',
  48,
  48,
  544,
);
grid(
  'owlKing',
  'holding0 holding1 sitting0 sitting1 reposition0 reposition1 babe_look0 babe_look1 couple_look0 couple_look1 blush0 blush1',
  '0,0 1,0 2,0 3,0 0,1 1,1 2,1 2,2 3,1 3,2 0,2 1,2',
  48,
  64,
  544,
  144,
);
grid(
  'owlBabe',
  'step0 step1 notice panic0 panic1 love anticipate0 anticipate1',
  '0,0 1,0 2,0 0,1 1,1 2,1 0,2 1,2',
  32,
  40,
  736,
);
grid(
  'gargoyle',
  'step notice panic0 panic1 run0 run1 hide',
  '2,0 0,1 1,1 2,1 0,2 1,2 2,2',
  32,
  32,
  736,
  88,
);
grid('owlBird', 'give0 give1 give2', '0,0 1,0 2,0', 64, 48, 544, 336, 0.5, 0.5);
grid('ravenCrown', '0 1 2', '0,0 1,0 2,0', 56, 48, 0, 0, 0.5, 1 - 16 / 48);
grid('ravenFly', '0 1 2', '0,0 1,0 2,0', 48, 32, 0, 64);
grid('tsuchinokoFly', '0 1 2', '0,0 1,0 2,0', 48, 32, 0, 64, 0.5, 0.5);

const INTRO_TEXT = 'Legend has it there is a\nsmoking hot babe at the top...';
const CREDITS: readonly [string, ...string[]][] = [
  ['Web & Online Development', 'lighthouse2815'],
  [
    'Nexile',
    'lighthouse2815',
    'Erik Säll',
    'Felix Wahlström',
    'Eric Osana',
    'Theo Unland Karlsson',
  ],
  [
    'In Collaboration With:',
    'lighthouse2815',
    'Thörnlund & Eklöf Sound',
    'Nils Eklöf',
    'Elias Thörnlund',
  ],
  [
    'Erik Säll',
    'lighthouse2815',
    'Game Director',
    'Programming',
    'Level Design',
    'Animation',
    'Sound Effects',
  ],
  [
    'Felix Wahlström',
    'lighthouse2815',
    'Art Director',
    'Character & Background Design',
    'Animation',
    'Assistant Level Design',
  ],
  ['Eric Osana', 'lighthouse2815', 'Level Design', 'Business Manager'],
  [
    'Theo Unland Karlsson',
    'lighthouse2815',
    'Level Design',
    'Tech/Software Manager',
    'Quality Assurance',
  ],
  ['Nils Eklöf', 'lighthouse2815', 'Music', 'Ambience', 'Sound Effects'],
  ['Elias Thörnlund', 'lighthouse2815', 'Music', 'Ambience', 'Sound Effects'],
  [
    'Special Thanks to:',
    'nvbangg',
    'Lê Thị Ánh Dương',
    'Trần Đình Khánh Dư',
    'Thomas Härdin',
    'Wilhelm Ohrås',
  ],
];
const TICK = 1 / 60;
const GRAVITY = Math.fround(153 / 595);
function jumpStrength(height: number) {
  let distance = 0,
    velocity = 0,
    ticks = 0;
  while (distance < height) {
    velocity = Math.fround(velocity + GRAVITY);
    distance = Math.fround(distance + velocity);
    ticks++;
  }
  return Math.fround(-ticks * GRAVITY);
}
/** Precomputed original 60 Hz positions; Phaser interpolates them, not a second physics engine. */
function jumpPath(
  velocity: number,
  stop: 'ground' | 'apex' | 'nbp' | 'fall' = 'ground',
): number[] {
  const points = [0];
  const ticks = Math.trunc(Math.abs(jumpStrength(78) / GRAVITY));
  for (let i = 0; i < 300; i++) {
    if (stop === 'apex' || stop === 'fall') {
      velocity = Math.fround(velocity + GRAVITY);
      if (i >= ticks - 1) {
        points.push(points[points.length - 1]);
        break;
      }
    }
    const next = Math.fround(points[points.length - 1] + velocity);
    if (
      (stop === 'ground' && next >= 0 && i > 0) ||
      (stop === 'nbp' && velocity >= 2)
    ) {
      points.push(points[points.length - 1]);
      break;
    }
    points.push(next);
    if (stop === 'ground' || stop === 'nbp')
      velocity = Math.fround(velocity + GRAVITY);
  }
  return points;
}
const BABE_JUMP = jumpPath(jumpStrength(15));
const NBP_BABE_JUMP = jumpPath(jumpStrength(15), 'nbp');
const CROWN_JUMP = jumpPath(jumpStrength(78), 'apex');
const CROWN_FALL = jumpPath(0, 'fall');
// JumpToTargetHeight includes the last positive tick, landing at its starting height.
const FULL_JUMP = Array.from({ length: 70 }, (_, i) =>
  Math.fround(jumpStrength(153) * i + (GRAVITY * i * (i - 1)) / 2),
);
type Actor = {
  root: Phaser.GameObjects.Container;
  visual: Phaser.GameObjects.Container;
  sprites: Phaser.GameObjects.Sprite[];
  texture: string;
  frame: string;
};
const frameName = (frame: string) => `original-cutscene:${frame}`;

export function originalEndingPicture(
  campaign: CampaignId,
  equipped: readonly string[] = [],
): string {
  if (campaign === 'ghost')
    return equipped.includes('CapeOwl')
      ? 'ending/owl_imagebird'
      : 'ending/owl_imagecrown';
  if (campaign === 'nbp')
    return equipped.includes('GiantBoots')
      ? 'ending/nbp_imageshoes'
      : 'ending/nbp_imagecrown';
  return equipped.includes('Shoes') ? 'ending/imageshoes' : 'ending/imagecrown';
}

export class OriginalCutscenes {
  state: OriginalCutsceneState = 'idle';
  private equipped: string[];
  private actors: Actor[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private timers = new Set<Phaser.Time.TimerEvent>();
  private tweens = new Set<Phaser.Tweens.Tween>();
  private sounds = new Set<Phaser.Sound.BaseSound>();
  private unlocks: (() => void)[] = [];
  private animations = new Set<string>();
  private hidden: {
    object:
      | Phaser.GameObjects.Sprite
      | Phaser.GameObjects.Container
      | Phaser.GameObjects.Image;
    visible: boolean;
  }[] = [];
  private camera?: { x: number; y: number };
  private world?: Phaser.GameObjects.Container;
  private hud?: Phaser.GameObjects.Container;
  private picture?: Phaser.GameObjects.Image;
  private pictureReady = false;
  private completed = false;
  private kind: 'intro' | 'ending' = 'intro';
  private music?: Phaser.Sound.BaseSound;
  private readonly depth: number;

  constructor(
    private scene: Phaser.Scene,
    readonly campaign: CampaignId,
    private options: OriginalCutsceneOptions,
  ) {
    this.equipped = [...(options.equipped || [])];
    this.depth = options.depth ?? 80;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /** Call only for an explicitly requested new game. Resumes and multiplayer return false. */
  playIntro({
    newGame,
    mode = 'solo',
  }: {
    newGame: boolean;
    mode?: 'solo' | 'community' | 'race';
  }): boolean {
    if (!newGame || mode !== 'solo' || !this.begin('intro')) return false;
    // Keep the starting scene/player visible beneath IntroState's black overlay.
    this.restoreHidden();
    const black = this.overlay(0x000000, 1);
    const text = this.text(240, 180, INTRO_TEXT).setAlpha(0).setOrigin(0.5);
    this.playSound('audio/music/opening theme', true);
    this.fade(text, 1, 1, 1);
    this.fade(text, 5, 1, 0);
    this.fade(black, 6, 1, 0);
    this.at(9, () => this.finishIntro(false));
    return true;
  }

  playEnding(): boolean {
    if (!this.begin('ending')) return false;
    this.playSound(
      this.campaign === 'original'
        ? 'audio/music/ending'
        : this.campaign === 'nbp'
          ? 'audio/music/ending2'
          : 'audio/music/ending3',
      true,
    );
    const end =
      this.campaign === 'original'
        ? this.normalEnding()
        : this.campaign === 'nbp'
          ? this.nbpEnding()
          : this.owlEnding();
    this.credits(end);
    return true;
  }

  /** Completed saves: display the original equipment-dependent image without replaying. */
  showEndingPicture(): boolean {
    if (this.state === 'destroyed' || this.state === 'picture') return false;
    if (!this.begin('ending')) return false;
    this.toPicture(false);
    return true;
  }

  /** Synchronous, so a parent's pause menu can skip a paused Phaser scene safely. */
  skip(): void {
    if (this.state === 'intro') this.finishIntro(true);
    else if (this.state === 'ending') this.toPicture(true);
    else if (this.state === 'picture') {
      this.pictureReady = true;
      this.dismissPicture();
    }
  }

  /** Normal any-input dismissal respects EndingPictureScreen's two-second guard. */
  dismissPicture(): boolean {
    if (this.state !== 'picture' || !this.pictureReady) return false;
    this.state = 'complete';
    this.clearPlayback();
    this.options.onDismiss?.();
    return true;
  }

  cancel(): void {
    if (this.state === 'destroyed') return;
    this.clearPlayback();
    this.destroyObjects();
    this.restoreCamera();
    this.restoreHidden();
    this.state = 'cancelled';
  }

  destroy(): void {
    if (this.state === 'destroyed') return;
    this.cancel();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.state = 'destroyed';
  }

  private begin(kind: 'intro' | 'ending'): boolean {
    if (['intro', 'ending', 'picture', 'destroyed'].includes(this.state))
      return false;
    // Assets are loaded by the parent with the exported keys, using its existing loader.
    const textures =
      kind === 'intro'
        ? []
        : [
            'king/base',
            originalEndingPicture(this.campaign, this.equipped),
            ...this.equipped
              .filter((item) => SKINS[item])
              .map((item) => SKINS[item].texture),
          ];
    for (const key of textures)
      if (!this.scene.textures.exists(key))
        throw new Error(`Missing original cutscene texture: ${key}`);
    this.clearPlayback();
    this.destroyObjects();
    this.kind = kind;
    this.completed = false;
    this.pictureReady = false;
    this.state = kind;
    const camera = this.scene.cameras.main;
    this.camera = { x: camera.scrollX, y: camera.scrollY };
    this.hidden = [
      ...new Set([
        ...(this.options.player ? [this.options.player] : []),
        ...(this.options.hide || []),
      ]),
    ].map((object) => ({ object, visible: object.visible }));
    this.hidden.forEach(({ object }) => object.setVisible(false));
    const screen =
      this.campaign === 'original' ? 42 : this.campaign === 'nbp' ? 99 : 153;
    this.world = this.scene.add
      .container(0, -screen * 360)
      .setDepth(this.depth);
    this.hud = this.scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(this.depth + 1);
    this.objects.push(this.world, this.hud);
    return true;
  }

  private at(seconds: number, action: () => void) {
    const timer = this.scene.time.delayedCall(
      Math.max(0, seconds * 1000),
      () => {
        this.timers.delete(timer);
        if (
          this.state === 'intro' ||
          this.state === 'ending' ||
          this.state === 'picture'
        )
          action();
      },
    );
    this.timers.add(timer);
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig) {
    const tween = this.scene.tweens.add({
      ...config,
      onComplete: () => this.tweens.delete(tween),
    });
    this.tweens.add(tween);
    return tween;
  }

  private move(
    target: { x: number; y: number },
    time: number,
    duration: number,
    dx: number,
    dy: number,
  ) {
    this.at(time, () =>
      this.tween({
        targets: target,
        ...(dx ? { x: target.x + dx } : {}),
        ...(dy ? { y: target.y + dy } : {}),
        duration: duration * 1000,
        ease: 'Linear',
      }),
    );
  }

  /** Camera.Offset is added in XNA; Phaser scroll is subtracted. */
  private pan(time: number, duration: number, dx: number, dy: number) {
    this.at(time, () => {
      const camera = this.scene.cameras.main;
      this.tween({
        targets: camera,
        ...(dx ? { scrollX: camera.scrollX - dx } : {}),
        ...(dy ? { scrollY: camera.scrollY - dy } : {}),
        duration: duration * 1000,
        ease: 'Linear',
      });
    });
  }

  private trajectory(actor: Actor, time: number, points: number[]) {
    const duration = (points.length - 1) * TICK;
    this.at(time, () => {
      const y = actor.root.y;
      const tween = this.scene.tweens.addCounter({
        from: 0,
        to: points.length - 1,
        duration: duration * 1000,
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const index = Math.min(points.length - 1, tween.getValue() ?? 0),
            i = Math.floor(index);
          actor.root.y =
            y +
            Phaser.Math.Linear(
              points[i],
              points[Math.min(i + 1, points.length - 1)],
              index - i,
            );
        },
        onComplete: () => this.tweens.delete(tween),
      });
      this.tweens.add(tween);
    });
    return duration;
  }

  private registerFrame(texture: string, key: string) {
    const frame = FRAMES[key];
    if (!frame) throw new Error(`Unknown original cutscene frame: ${key}`);
    if (!this.scene.textures.exists(texture))
      throw new Error(`Missing original cutscene texture: ${texture}`);
    const atlas = this.scene.textures.get(texture),
      name = frameName(key);
    if (!atlas.has(name))
      atlas.add(name, 0, frame.x, frame.y, frame.w, frame.h);
    return name;
  }

  private actor(
    x: number,
    y: number,
    frame: string,
    hud = false,
    texture = 'king/base',
  ): Actor {
    const actor: Actor = {
      root: this.scene.add.container(x, y),
      visual: this.scene.add.container(0, 0),
      sprites: [],
      texture,
      frame,
    };
    actor.root.add(actor.visual);
    (hud ? this.hud! : this.world!).add(actor.root);
    this.actors.push(actor);
    this.refreshLayers(actor);
    return actor;
  }

  private refreshLayers(actor: Actor) {
    const animation = actor.sprites[0]?.anims.currentAnim;
    const frameIndex = actor.sprites[0]?.anims.currentFrame?.index ?? 1;
    actor.sprites.forEach((sprite) => sprite.destroy());
    const textures = [
      actor.texture,
      ...(actor.texture === 'king/base'
        ? this.equipped
            .filter((item) => SKINS[item])
            .sort((a, b) => SKINS[a].layer - SKINS[b].layer)
            .map((item) => SKINS[item].texture)
        : []),
    ];
    actor.sprites = textures.map((texture) => {
      const sprite = this.scene.add.sprite(
        0,
        0,
        texture,
        this.registerFrame(texture, actor.frame),
      );
      actor.visual.add(sprite);
      sprite.on(
        Phaser.Animations.Events.ANIMATION_UPDATE,
        (
          _animation: Phaser.Animations.Animation,
          frame: Phaser.Animations.AnimationFrame,
        ) => {
          const source =
            FRAMES[
              String(frame.textureFrame).replace('original-cutscene:', '')
            ];
          if (source) sprite.setOrigin(source.ox, source.oy);
          actor.frame = String(frame.textureFrame).replace(
            'original-cutscene:',
            '',
          );
        },
      );
      sprite.setOrigin(FRAMES[actor.frame].ox, FRAMES[actor.frame].oy);
      return sprite;
    });
    if (animation) {
      const frames = animation.frames.map((frame) =>
        String(frame.textureFrame).replace('original-cutscene:', ''),
      );
      const durations = animation.frames.map(
        (frame) => frame.duration || animation.msPerFrame,
      );
      this.animate(actor, frames, durations, frameIndex - 1);
    }
  }

  private frame(actor: Actor, key: string, time: number) {
    this.at(time, () => {
      actor.frame = key;
      actor.sprites.forEach((sprite) =>
        sprite
          .stop()
          .setFrame(this.registerFrame(sprite.texture.key, key))
          .setOrigin(FRAMES[key].ox, FRAMES[key].oy),
      );
    });
  }

  private animate(
    actor: Actor,
    frames: string[],
    durations: number[],
    startFrame = 0,
  ) {
    actor.sprites.forEach((sprite) => {
      const key = `original-cutscene:${sprite.texture.key}:${frames.join(',')}:${durations.join(',')}`;
      if (!this.scene.anims.exists(key)) {
        this.scene.anims.create({
          key,
          frames: frames.map((frame, i) => ({
            key: sprite.texture.key,
            frame: this.registerFrame(sprite.texture.key, frame),
            duration: durations[i],
          })),
          frameRate: 1000,
          repeat: -1,
        });
        this.animations.add(key);
      }
      sprite.play({ key, startFrame });
      const source = FRAMES[frames[startFrame]];
      sprite.setOrigin(source.ox, source.oy);
    });
  }

  private loop(actor: Actor, frames: string[], time: number, step = 0.2) {
    this.at(time, () =>
      this.animate(
        actor,
        frames,
        frames.map(() => step * 1000),
      ),
    );
  }

  private walk(
    actor: Actor,
    group: string,
    one: string,
    two: string,
    smear: string,
    time: number,
    speed = 1,
  ) {
    this.at(time, () =>
      this.animate(
        actor,
        [one, smear, two, smear].map((frame) => `${group}.${frame}`),
        [10, 4, 10, 4].map((ticks) => (ticks * 1000) / (60 * speed)),
      ),
    );
  }

  private award(item: string, time: number) {
    this.at(time, () => {
      const skin = SKINS[item];
      this.equipped = this.equipped.filter(
        (equipped) => SKINS[equipped]?.layer !== skin.layer,
      );
      this.equipped.push(item);
      this.actors.forEach((actor) => this.refreshLayers(actor));
      this.options.onEquipment?.(item, [...this.equipped]);
    });
  }

  private playSound(key: string, music = false, time?: number) {
    if (time !== undefined) {
      this.at(time, () => this.playSound(key, music));
      return;
    }
    if (
      !this.scene.cache.audio.exists(key) &&
      !(this.scene.sound instanceof Phaser.Sound.NoAudioSoundManager)
    )
      throw new Error(`Missing original cutscene sound: ${key}`);
    const sound = this.scene.sound.add(key, {
      volume: music || key.includes('jump_king/') ? 0.5 : 1,
    });
    this.sounds.add(sound);
    if (music) this.music = sound;
    else
      sound.once(Phaser.Sound.Events.COMPLETE, () => {
        this.sounds.delete(sound);
        sound.destroy();
      });
    if (music && this.scene.sound.locked) {
      const unlock = () => {
        if (this.sounds.has(sound)) sound.play();
      };
      this.unlocks.push(unlock);
      this.scene.sound.once(Phaser.Sound.Events.UNLOCKED, unlock);
    } else sound.play();
  }

  private overlay(color: number, alpha: number) {
    const rectangle = this.scene.add
      .rectangle(0, 0, 480, 360, color)
      .setOrigin(0)
      .setAlpha(alpha);
    this.hud!.add(rectangle);
    return rectangle;
  }

  private text(x: number, y: number, value: string) {
    const font = 'font/sf_litter_lover2_bold';
    const text =
      !this.options.fontFamily && this.scene.cache.bitmapFont.has(font)
        ? this.scene.add
            .bitmapText(x, y, font, value, this.options.fontSize)
            .setCenterAlign()
        : this.scene.add.text(x, y, value, {
            fontFamily: this.options.fontFamily ?? 'monospace',
            fontSize: `${this.options.fontSize ?? 13}px`,
            color: '#ffffff',
            align: 'center',
          });
    this.hud!.add(text);
    return text;
  }

  private fade(
    target: { alpha: number },
    time: number,
    duration: number,
    alpha: number,
    steps = 4,
  ) {
    this.at(time, () =>
      this.tween({
        targets: target,
        alpha,
        duration: duration * 1000,
        ease: (value: number) => Math.round(value * steps) / steps,
      }),
    );
  }

  private cherubs(
    time: number,
    nbp: boolean,
  ): { actor: Actor; delivered: number } {
    const raven = !nbp && this.options.ravenDone;
    const group = raven ? 'ravenCrown' : nbp ? 'nbpCherub' : 'cherub';
    const actor = this.actor(
      480 + (nbp ? 20 : -1),
      nbp ? 115 : 2,
      `${group}.${raven ? '0' : 'deliver0'}`,
      true,
      raven ? 'props/textures/raven/raven_crown' : 'king/base',
    );
    actor.root.setVisible(false);
    this.at(time, () => actor.root.setVisible(true));
    this.loop(
      actor,
      raven
        ? ['ravenCrown.0', 'ravenCrown.1', 'ravenCrown.2']
        : [`${group}.deliver0`, `${group}.deliver1`],
      time,
      raven ? 0.1 : 1 / 30,
    );
    // CherubsDeliver: scratch every four ticks, interpolate last/current; tick 60 ends at last.
    const x = [480],
      y = [0];
    let currentX = 480,
      currentY = 0,
      lastY = 0;
    for (let tick = 1; tick <= 60; tick++) {
      currentX += tick < 40 ? -5 : Math.max(-5, -(currentX - 240) * 0.25);
      const previousY = currentY;
      currentY +=
        (135 - (lastY * 0.25 + currentY * 0.75)) * (tick < 40 ? 0.05 : 0.06);
      lastY = previousY;
      if (tick < 60) {
        x.push(currentX);
        y.push(currentY);
      }
    }
    this.at(time, () => {
      this.tween({
        targets: actor.root,
        x: actor.root.x + x[x.length - 1] - 480,
        y: actor.root.y + y[y.length - 1],
        duration: 4000,
        ease: 'Linear',
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const sample = Math.max(0, Math.min(59, tween.progress * 60 - 1));
          const i = Math.floor(sample),
            fraction = sample - i;
          actor.root.setPosition(
            Phaser.Math.Linear(x[i], x[Math.min(59, i + 1)], fraction) +
              (nbp ? 20 : -1),
            Phaser.Math.Linear(y[i], y[Math.min(59, i + 1)], fraction) +
              (nbp ? 115 : 2),
          );
        },
      });
    });
    return { actor, delivered: time + 4 };
  }

  private escapeCherubs(actor: Actor, time: number, nbp: boolean) {
    const raven = !nbp && this.options.ravenDone;
    if (raven)
      this.at(time, () => {
        actor.texture = 'props/textures/raven/raven';
        actor.frame = 'ravenFly.0';
        this.refreshLayers(actor);
      });
    this.loop(
      actor,
      raven
        ? ['ravenFly.0', 'ravenFly.1', 'ravenFly.2']
        : [
            `${nbp ? 'nbpCherub' : 'cherub'}.escape0`,
            `${nbp ? 'nbpCherub' : 'cherub'}.escape1`,
          ],
      time,
      raven ? 0.1 : 1 / 30,
    );
    this.at(time, () => {
      const startX = actor.root.x,
        startY = actor.root.y;
      const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
      let vx = 0,
        vy = -0.1,
        x = startX,
        y = startY;
      for (let i = 1; i < 1000; i++) {
        if (i % 4 === 0) {
          vx += 0.5;
          vy *= 1.2;
        }
        x += vx / 4;
        y += vy / 4;
        points.push({ x, y });
        if (x < 0 || x >= 480 || y < (nbp ? 115 : 2) || y >= 360) break;
      }
      this.tween({
        targets: actor.root,
        x,
        y,
        duration: ((points.length - 1) * 1000) / 60,
        ease: 'Linear',
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const index = Math.min(
              points.length - 1,
              tween.progress * (points.length - 1),
            ),
            i = Math.floor(index),
            next = points[Math.min(i + 1, points.length - 1)];
          actor.root.setPosition(
            Phaser.Math.Linear(points[i].x, next.x, index - i),
            Phaser.Math.Linear(points[i].y, next.y, index - i),
          );
        },
      });
      this.at((points.length - 1) * TICK, () => actor.root.setVisible(false));
    });
  }

  private normalEnding(): number {
    const king = this.actor(336, 144, 'regular.idle');
    const babe = this.actor(396, 128, 'babe.idle0');
    this.loop(babe, ['babe.idle0', 'babe.idle1', 'babe.idle2'], 0, 0.1);
    const pan = Math.round(Math.hypot(96, 96) / 0.5) * TICK;
    this.pan(
      0,
      pan,
      -Math.SQRT1_2 * 0.5 * Math.round(Math.hypot(96, 96) / 0.5),
      Math.SQRT1_2 * 0.5 * Math.round(Math.hypot(96, 96) / 0.5),
    );
    let t = pan + 1;
    this.frame(babe, 'babe.charge', t);
    t += 0.5;
    this.frame(babe, 'babe.up', t);
    this.playSound('audio/babe/babe jump', false, t);
    this.frame(babe, 'babe.fall', t + 11 * TICK);
    t += this.trajectory(babe, t, BABE_JUMP);
    this.frame(babe, 'babe.land', t);
    this.playSound('audio/jump_king/king_land', false, t);
    t += 0.1;
    this.loop(babe, ['babe.idle0', 'babe.idle1', 'babe.idle2'], t, 0.1);
    t += 0.5;
    this.move(babe.root, t, 44 / 30, -44, 0);
    t += 44 / 30 + 0.4;
    this.frame(babe, 'babe.kiss', t);
    this.playSound('audio/babe/babe kiss', false, t);
    t += 0.5;
    this.loop(babe, ['babe.idle0', 'babe.idle1', 'babe.idle2'], t, 0.1);
    const cherub = this.cherubs(t, false);
    this.frame(king, 'regular.look_up', t + 1);
    this.move(babe.root, t + 1, 8 / 30, 8, 0);
    t = cherub.delivered;
    this.frame(king, 'regular.charge', t);
    t += 0.5;
    this.frame(king, 'regular.up', t);
    this.playSound('audio/jump_king/king_jump', false, t);
    t += this.trajectory(king, t, CROWN_JUMP);
    this.playSound('audio/plink', false, t);
    this.award('Crown', t);
    t += 1;
    this.escapeCherubs(cherub.actor, t, false);
    this.frame(king, 'regular.fall', t);
    t += this.trajectory(king, t, CROWN_FALL);
    this.playSound('audio/jump_king/king_land', false, t);
    this.frame(king, 'regular.idle', t);
    t += 1;
    this.frame(king, 'normal.snatch', t);
    t += 1;
    this.playSound('audio/jump_king/king_jump', false, t);
    this.frame(king, 'normal.snatch_smear', t);
    this.at(t, () => babe.root.setVisible(false));
    this.playSound('audio/babe/babe pickup', false, t);
    t += 1 / 30;
    this.frame(king, 'normal.idle_right', t);
    t += 1;
    this.walk(king, 'normal', 'walk_left0', 'walk_left2', 'walk_left1', t);
    this.move(king.root, t, 2, -90, 0);
    t += 2;
    this.frame(king, 'normal.idle_right', t);
    t += 2;
    this.walk(
      king,
      'normal',
      'walk_right0',
      'walk_right2',
      'walk_right1',
      t,
      2,
    );
    this.playSound('audio/babe/babe surprised2', false, t);
    this.playSound('audio/babe/babe surprised2', false, t);
    this.move(king.root, t, 16 / 30, 96, 0);
    t += 16 / 30;
    this.move(king.root, t, 7 / 30, 42, 0);
    this.pan(t, 14 * TICK, -42, 0);
    t += 7 / 30;
    this.frame(king, 'normal.charge', t);
    t += 0.6;
    this.frame(king, 'normal.dunk', t);
    this.playSound('audio/jump_king/king_jump', false, t);
    this.playSound('audio/babe/babe scream', false, t);
    const jump = this.trajectory(king, t, FULL_JUMP);
    this.move(king.root, t, jump, 3.5 * 69, 0);
    this.pan(t, jump, -3.5 * 69, 0);
    t += jump;
    this.frame(king, 'normal.parasol', t);
    this.playSound('audio/jump_king/king_jump', false, t);
    this.move(king.root, t, 10 / 30, 35, -30);
    this.pan(t, 10 / 30, -35, -10);
    t += 10 / 30;
    this.loop(king, ['normal.fly0', 'normal.fly1', 'normal.fly2'], t);
    this.flight(king, t, 105, 30);
    this.playSound('audio/babe/babe mou', false, t + 3.5500002);
    this.loop(
      king,
      ['normal.upskirt0', 'normal.upskirt1', 'normal.upskirt2'],
      t + 3.5500002,
    );
    this.loop(
      king,
      ['normal.fly0', 'normal.fly1', 'normal.fly2'],
      t + 5.5500002,
    );
    return t + 8.5500002;
  }

  private nbpEnding(): number {
    const king = this.actor(144, 144, 'regular.idle');
    king.root.setScale(-1, 1);
    const babe = this.actor(84, 144, 'nbpBabe.ground0');
    this.loop(
      babe,
      ['nbpBabe.ground0', 'nbpBabe.ground1', 'nbpBabe.ground2'],
      0,
      0.1,
    );
    const pan = Math.round(Math.hypot(96, 96) / 0.5) * TICK;
    this.pan(
      0,
      pan,
      Math.SQRT1_2 * 0.5 * Math.round(Math.hypot(96, 96) / 0.5),
      Math.SQRT1_2 * 0.5 * Math.round(Math.hypot(96, 96) / 0.5),
    );
    let t = pan + 1;
    this.frame(babe, 'nbpBabe.charge', t);
    t += 0.5;
    this.frame(babe, 'nbpBabe.up', t);
    this.playSound('audio/babe/babe jump', false, t);
    this.frame(babe, 'nbpBabe.fall', t + 11 * TICK);
    t += this.trajectory(babe, t, NBP_BABE_JUMP);
    this.at(t, () =>
      this.tween({
        targets: babe.visual,
        y: babe.visual.y + 2.5,
        duration: (5 / 30) * 1000,
        hold: 150,
        yoyo: true,
        repeat: -1,
        repeatDelay: 150,
      }),
    );
    t += 0.5;
    this.loop(
      babe,
      ['nbpBabe.crown0', 'nbpBabe.crown1', 'nbpBabe.crown2'],
      t,
      0.1,
    );
    t += 1.5;
    this.move(babe.root, t, 42 / 30, 42, 0);
    t += 42 / 30 + 0.4;
    this.frame(babe, 'nbpBabe.kiss', t);
    this.playSound('audio/babe/babe kiss', false, t);
    t += 0.5;
    this.loop(
      babe,
      ['nbpBabe.crown0', 'nbpBabe.crown1', 'nbpBabe.crown2'],
      t,
      0.1,
    );
    t += 1;
    this.playSound('audio/babe/babe mou', false, t);
    for (let i = 0; i < 2; i++) {
      this.frame(babe, 'nbpBabe.laugh0', t);
      t += 0.2;
      this.frame(babe, 'nbpBabe.laugh1', t);
      t += 0.2;
    }
    this.loop(
      babe,
      ['nbpBabe.crown0', 'nbpBabe.crown1', 'nbpBabe.crown2'],
      t,
      0.1,
    );
    t += 1;
    this.move(babe.root, t, 13 / 30, 0, -13);
    t += 13 / 30 + 0.5;
    this.frame(babe, 'nbpBabe.give0', t);
    t += 1;
    this.frame(babe, 'nbpBabe.give1', t);
    t += 0.2;
    this.frame(babe, 'nbpBabe.give2', t);
    t += 1;
    this.playSound('audio/plink', false, t);
    this.award('CrownNBP', t);
    this.loop(
      babe,
      ['nbpBabe.float0', 'nbpBabe.float1', 'nbpBabe.float2'],
      t,
      0.1,
    );
    t += 1;
    this.move(babe.root, t, 13 / 30, -3.9, 13);
    t += 13 / 30;
    const cherub = this.cherubs(t, true);
    this.at(t + 1, () => king.root.setScale(1, 1));
    this.loop(
      babe,
      ['nbpBabe.impressed0', 'nbpBabe.impressed1', 'nbpBabe.impressed2'],
      t + 0.5,
      0.1,
    );
    t = cherub.delivered;
    this.loop(
      babe,
      ['nbpBabe.arm0', 'nbpBabe.arm1', 'nbpBabe.arm2'],
      t + 0.5,
      0.1,
    );
    this.loop(
      babe,
      ['nbpBabe.arm20', 'nbpBabe.arm21', 'nbpBabe.arm22'],
      t + 2.5,
      0.1,
    );
    t += 1;
    this.frame(king, 'nbpKing.look_down', t);
    t += 1;
    this.frame(king, 'regular.idle', t);
    t += 1;
    this.at(t, () => king.root.setScale(-1, 1));
    this.escapeCherubs(cherub.actor, t, true);
    t += 1;
    this.frame(king, 'regular.look_up', t);
    t += 1;
    this.at(t, () => king.root.setScale(1, 1));
    this.frame(king, 'nbpKing.grab0', t);
    t += 1;
    this.frame(king, 'nbpKing.grab1', t);
    this.playSound('audio/jump_king/king_jump', false, t);
    this.at(t, () => babe.root.setVisible(false));
    this.playSound('audio/babe/babe pickup', false, t);
    t += 0.1;
    this.frame(king, 'nbpKing.idle_left', t);
    t += 1;
    this.frame(king, 'nbpKing.idle_right', t);
    t += 1;
    this.frame(king, 'nbpKing.panty0', t);
    t += 1;
    this.frame(king, 'nbpKing.panty1', t);
    this.playSound('audio/babe/babe jump', false, t);
    t += 0.5;
    this.frame(king, 'nbpKing.idle_right', t);
    t += 0.5;
    this.walk(king, 'nbpKing', 'walk0', 'walk1', 'smear', t, 2);
    this.playSound('audio/babe/babe surprised2', false, t);
    this.move(king.root, t, 7 / 30, 42, 0);
    this.pan(t, 10 * TICK, -30, 0);
    t += 7 / 30;
    this.frame(king, 'nbpKing.charge', t);
    t += 0.6;
    this.frame(king, 'nbpKing.jump0', t);
    this.playSound('audio/jump_king/king_jump', false, t);
    this.playSound('audio/babe/babe scream', false, t);
    const crow = this.actor(0, 0, 'nbpKing.bird', true);
    crow.root.setVisible(false);
    this.at(t + 0.7, () => crow.root.setVisible(true));
    this.move(crow.root, t + 0.7, 30 * TICK, 240, 175);
    this.frame(king, 'nbpKing.jump1', t + 1);
    this.frame(king, 'nbpKing.jump2', t + 1.2);
    const jump = this.trajectory(king, t, FULL_JUMP);
    this.move(king.root, t, 69 * TICK, 3.5 * 69, 0);
    this.pan(t, 69 * TICK, -3.5 * 69, 0);
    t += Math.max(jump, 1.4);
    this.at(t, () => crow.root.setVisible(false));
    // HangingBabe is drawn relative to the king, not as an independently moving entity.
    const hanging = this.actor(-10, 3, 'nbpBabe.hang1');
    this.world!.remove(hanging.root);
    king.root.add(hanging.root);
    hanging.root.setVisible(false);
    this.at(t, () => hanging.root.setVisible(true));
    this.playSound('audio/babe/babe mou', false, t + 3);
    this.loop(
      hanging,
      ['nbpBabe.hang0', 'nbpBabe.hang1', 'nbpBabe.hang2', 'nbpBabe.hang1'],
      t + 3,
    );
    this.loop(
      king,
      [
        ...Array<string>(12).fill('nbpKing.fly'),
        'nbpKing.flap0',
        'nbpKing.flap1',
        'nbpKing.flap2',
      ],
      t,
    );
    this.move(king.root, t, 10 / 30, 35, -30);
    this.pan(t, 10 / 30, -35, -10);
    t += 10 / 30;
    this.flight(king, t, 105, 30);
    return t + 3;
  }

  private owlEnding(): number {
    const king = this.actor(240, 144, 'regular.idle');
    const gargoyle = this.actor(336, 144, 'gargoyle.step');
    const babe = this.actor(348, 136, 'owlBabe.step0');
    this.loop(babe, ['owlBabe.step0', 'owlBabe.step1'], 0, 0.4);
    this.pan(0, 192 * TICK, 0, 96);
    let t = 192 * TICK;
    this.frame(gargoyle, 'gargoyle.notice', t);
    this.frame(babe, 'owlBabe.notice', t + 1);
    t += 2;
    this.loop(babe, ['owlBabe.panic0', 'owlBabe.panic1'], t, 0.1);
    this.loop(gargoyle, ['gargoyle.panic0', 'gargoyle.panic1'], t, 0.1);
    t += 2;
    this.frame(king, 'owlKing.spirit', t);
    t += 2;
    this.at(t, () => {
      const white = this.overlay(0xffffff, 0.5);
      this.at(0.1, () => white.setAlpha(0));
      this.at(0.2, () => white.setAlpha(0.5));
      this.fade(white, 0.2, 0.2, 0, 256);
    });
    this.playSound('audio/event_sfx/owl_lightning', false, t);
    this.playSound('audio/plink', false, t);
    this.award('CrownOwl', t);
    if (this.options.tsuchinokoDone) {
      const bird = this.actor(239, -119, 'owlBird.give0');
      this.loop(
        bird,
        ['owlBird.give0', 'owlBird.give1', 'owlBird.give2'],
        0,
        0.1,
      );
      this.frame(king, 'regular.idle', t + 1);
      this.move(bird.root, t + 2, 3, 0, 230);
      this.award('CapeOwl', t + 6);
      this.playSound('audio/plink', false, t + 6);
      this.at(t + 6, () => {
        bird.texture = 'props/textures/raven/tsuchinoko';
        bird.frame = 'tsuchinokoFly.0';
        this.refreshLayers(bird);
      });
      this.loop(
        bird,
        ['tsuchinokoFly.0', 'tsuchinokoFly.1', 'tsuchinokoFly.2'],
        t + 6,
        0.1,
      );
      this.move(bird.root, t + 6, 3, 0, -230);
      this.at(t + 9, () => bird.root.setVisible(false));
      t += 9;
    } else t += 2;
    // OWL_KING_ENTITY_GOT_CROWN starts the three actor branches together.
    this.frame(king, 'regular.idle', t);
    this.frame(babe, 'owlBabe.notice', t);
    this.frame(babe, 'owlBabe.love', t + 2);
    this.playSound('audio/babe/babe kiss', false, t + 3.1);
    this.frame(babe, 'owlBabe.anticipate0', t + 3.5);
    this.playSound('audio/event_sfx/owl_gargoyle_scared', false, t + 1);
    const scare = Array.from(
      { length: 22 },
      (_, i) => -10 * GRAVITY * i + (GRAVITY * i * (i - 1)) / 2,
    );
    const scareDuration = this.trajectory(gargoyle, t + 1, scare);
    this.loop(
      gargoyle,
      ['gargoyle.run0', 'gargoyle.run1'],
      t + 1 + scareDuration,
      0.1,
    );
    this.move(gargoyle.root, t + 1 + scareDuration, 8 * TICK, 32, 0);
    this.frame(gargoyle, 'gargoyle.hide', t + 1 + scareDuration + 8 * TICK);
    t += 3;
    this.walk(king, 'regular', 'walk_one', 'walk_two', 'walk_smear', t);
    this.move(king.root, t, 2, 90, 0);
    t += 2;
    this.frame(king, 'regular.idle', t);
    this.frame(babe, 'owlBabe.anticipate1', t);
    this.playSound('audio/babe/babe jump', false, t + 0.4);
    t += 1.5;
    this.frame(king, 'owlKing.hands', t);
    t += 0.5;
    this.frame(king, 'owlKing.grab', t);
    t += 0.1;
    this.at(t, () => babe.root.setVisible(false));
    this.playSound('audio/babe/babe pickup', false, t);
    this.playSound('audio/babe/babe pickup', false, t);
    this.frame(king, 'owlKing.idle', t);
    this.walk(king, 'owlKing', 'walk0', 'walk1', 'smear', t);
    this.move(king.root, t, 2, -90, 0);
    t += 2;
    this.frame(king, 'owlKing.idle', t);
    t += 1.5;
    this.playSound('audio/babe/babe surprised2', false, t);
    this.frame(king, 'owlKing.charge', t);
    t += 0.3;
    this.frame(king, 'owlKing.jump', t);
    this.playSound('audio/jump_king/king_jump', false, t);
    const speed = Math.trunc((Math.abs(jumpStrength(153)) * 0.5) / GRAVITY);
    const hop = Array.from(
      { length: 2 * speed + 2 },
      (_, i) => -speed * GRAVITY * i + (GRAVITY * i * (i - 1)) / 2,
    );
    const hopDuration = this.trajectory(king, t, hop);
    this.move(king.root, t, hopDuration, 3.5 * (hop.length - 1), 0);
    this.pan(t, hopDuration, -3.5 * (hop.length - 1), 0);
    t += hopDuration;
    this.at(t, () => gargoyle.root.setVisible(false));
    // These 30 FPS one-step MoveNodes repeat alongside the entire final sequence.
    this.move(king.root, t, 0.1, 10.5, 0);
    this.pan(t, 0.1, -10.5, 0);
    this.frame(king, 'owlKing.squash', t);
    this.playSound('audio/jump_king/king_splat', false, t);
    this.playSound('audio/babe/babe scream', false, t);
    t += 0.1;
    this.loop(king, ['owlKing.holding0', 'owlKing.holding1'], t);
    this.move(king.root, t, 6 / 30, 42, 0);
    this.pan(t, 6 / 30, -42, 0);
    t += 6 / 30;
    this.flight(king, t, 105, 0);
    this.pan(t, 32 * TICK, 0, -32);
    t += 32 * TICK + 4;
    this.frame(king, 'owlKing.reposition0', t);
    t += 0.5;
    this.frame(king, 'owlKing.reposition1', t);
    t += 0.2;
    this.loop(king, ['owlKing.sitting0', 'owlKing.sitting1'], t);
    t += 3;
    this.loop(king, ['owlKing.babe_look0', 'owlKing.babe_look1'], t);
    t += 1.5;
    this.loop(king, ['owlKing.couple_look0', 'owlKing.couple_look1'], t);
    t += 1.2;
    this.loop(king, ['owlKing.blush0', 'owlKing.blush1'], t);
    this.playSound('audio/babe/babe kiss', false, t);
    return t;
  }

  private flight(king: Actor, time: number, vx: number, vy: number) {
    // More than the longest ending+credits; constant original movement, owned tweens.
    this.move(king.root, time, 300, vx * 300, vy * 300);
    this.pan(time, 300, -vx * 300, -vy * 300);
  }

  private credits(time: number) {
    const section = 50 / CREDITS.length;
    CREDITS.forEach(([header, ...people], index) => {
      const start = time + index * section;
      this.at(start, () => {
        const heading = this.text(240, 255, header.toUpperCase())
          .setOrigin(0.5)
          .setAlpha(0);
        const lineHeight = heading.height;
        const headingY = Math.min(
          255,
          348 - (people.length + 0.5) * lineHeight - 4,
        );
        heading.setY(headingY);
        const lines = people.map((person, i) =>
          this.text(240, headingY + lineHeight + 4 + i * lineHeight, person)
            .setOrigin(0.5)
            .setAlpha(0),
        );
        for (const text of [heading, ...lines]) {
          this.fade(text, 0, 1, 1);
          this.fade(text, section - 1, 1, 0);
          this.at(section, () => text.destroy());
        }
      });
    });
    this.at(time + 50, () => {
      const black = this.overlay(0x000000, 0);
      this.fade(black, 0, 3, 1);
    });
    this.at(time + 55, () => this.toPicture(false));
  }

  private finishIntro(skipped: boolean) {
    this.clearPlayback();
    this.destroyObjects();
    this.restoreCamera();
    this.restoreHidden();
    this.state = 'complete';
    this.complete(skipped);
  }

  private toPicture(skipped: boolean) {
    if (skipped) {
      const rewards = [
        this.campaign === 'original'
          ? 'Crown'
          : this.campaign === 'nbp'
            ? 'CrownNBP'
            : 'CrownOwl',
      ];
      if (this.campaign === 'ghost' && this.options.tsuchinokoDone)
        rewards.push('CapeOwl');
      for (const item of rewards) {
        this.equipped = this.equipped.filter(
          (equipped) => SKINS[equipped]?.layer !== SKINS[item].layer,
        );
        this.equipped.push(item);
        this.options.onEquipment?.(item, [...this.equipped]);
      }
    }
    const key = originalEndingPicture(this.campaign, this.equipped);
    if (!this.scene.textures.exists(key))
      throw new Error(`Missing original ending picture: ${key}`);
    // Retain only the ending music, which EndingPictureScreen stops on dismissal.
    this.clearPlayback(true);
    this.destroyObjects();
    this.restoreCamera();
    this.restoreHidden();
    this.picture = this.scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(this.depth + 2);
    this.objects.push(this.picture);
    this.state = 'picture';
    this.at(2, () => (this.pictureReady = true));
    this.scene.input.on('pointerdown', this.onPictureInput, this);
    this.scene.input.keyboard?.on('keydown', this.onPictureInput, this);
    this.scene.input.gamepad?.on('down', this.onPictureInput, this);
    this.complete(skipped, key);
  }

  private onPictureInput() {
    this.dismissPicture();
  }

  private complete(skipped: boolean, picture?: string) {
    if (this.completed) return;
    this.completed = true;
    this.options.onComplete({
      kind: this.kind,
      skipped,
      equipped: [...this.equipped],
      ...(picture ? { picture } : {}),
    });
  }

  private clearPlayback(keepMusic = false) {
    this.timers.forEach((timer) => timer.remove(false));
    this.timers.clear();
    this.tweens.forEach((tween) => tween.remove());
    this.tweens.clear();
    this.actors.forEach((actor) =>
      actor.sprites.forEach((sprite) => sprite.stop()),
    );
    this.animations.forEach((key) => this.scene.anims.remove(key));
    this.animations.clear();
    this.sounds.forEach((sound) => {
      if (keepMusic && sound === this.music) return;
      sound.stop();
      sound.destroy();
      this.sounds.delete(sound);
    });
    if (!keepMusic) {
      this.unlocks.forEach((unlock) =>
        this.scene.sound.off(Phaser.Sound.Events.UNLOCKED, unlock),
      );
      this.unlocks = [];
      this.music = undefined;
    }
    this.scene.input.off('pointerdown', this.onPictureInput, this);
    this.scene.input.keyboard?.off('keydown', this.onPictureInput, this);
    this.scene.input.gamepad?.off('down', this.onPictureInput, this);
  }

  private destroyObjects() {
    this.objects.forEach((object) => object.destroy());
    this.objects = [];
    this.actors = [];
    this.world = undefined;
    this.hud = undefined;
    this.picture = undefined;
  }

  private restoreCamera() {
    if (this.camera)
      this.scene.cameras.main?.setScroll(this.camera.x, this.camera.y);
    this.camera = undefined;
  }

  private restoreHidden() {
    this.hidden.forEach(({ object, visible }) => {
      if (object.scene) object.setVisible(visible);
    });
    this.hidden = [];
  }
}
