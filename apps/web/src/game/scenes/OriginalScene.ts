import Phaser from 'phaser';
import {
  CAMPAIGNS,
  CampaignId,
  ORIGINAL_SCREENS,
  isOriginalFinish,
} from '@jump-king/maps';
import {
  OriginalSimulation,
  ORIGINAL_PHYSICS,
  OriginalState,
  PlayerInput,
} from '@jump-king/physics';
import { Room } from 'colyseus.js';
import { OriginalTowerState } from '@jump-king/protocol';
import { networkManager } from '../networking/NetworkManager';
import {
  OriginalManifest,
  OriginalDetails,
  OriginalNpc,
  OriginalWall,
  originalUrl,
  asArray,
} from '../originalAssets';
import { readSave, saveKey } from '../soloSave';

export interface OriginalUi {
  status: 'LOADING' | 'PLAYING' | 'COMPLETE' | 'ERROR';
  location: string;
  screen: number;
  best: number;
  seconds: number;
  jumps: number;
  falls: number;
  charge: number;
  x: number;
  y: number;
  paused: boolean;
  progress: number;
  error?: string;
  saveError?: string;
  players: number;
  raceStatus?: string;
  countdown?: number;
  ready?: boolean;
  standings?: { nickname: string; finished: boolean; seconds: number }[];
}
export interface OriginalSceneOptions {
  campaign: CampaignId;
  fresh: boolean;
  muted: boolean;
  onUi: (state: OriginalUi) => void;
  mode?: 'solo' | 'community' | 'race';
  roomId?: string;
}

const frameNames = [
  'idle',
  'walk_one',
  'walk_smear',
  'walk_two',
  'charge',
  'up',
  'fall',
  'splat',
  'bounce',
  'stretch_one',
  'stretch_smear',
  'stretch_two',
  'look_up',
];

export class OriginalScene extends Phaser.Scene {
  simulation!: OriginalSimulation;
  private manifest!: OriginalManifest;
  private details!: OriginalDetails;
  private player!: Phaser.GameObjects.Sprite;
  private visuals: Phaser.GameObjects.GameObject[] = [];
  private scrolling: {
    sprite: Phaser.GameObjects.TileSprite;
    speed: number;
  }[] = [];
  private ambience: HTMLAudioElement[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch = { left: false, right: false, jump: false };
  private ready = false;
  private disposed = false;
  private paused = false;
  private completed = false;
  private changingScreen = false;
  private accumulator = 0;
  private best = 0;
  private renderedScreen = -1;
  private queue: Promise<void> = Promise.resolve();
  private uiAt = 0;
  private savedAt = 0;
  private saveError = '';
  private audioError = '';
  private gamepadPause = false;
  private progress = 0;
  private room: Room<OriginalTowerState> | null = null;
  private peers = new Map<string, Phaser.GameObjects.Sprite>();
  private sequence = 0;
  private pending: (PlayerInput & { seq: number })[] = [];
  private canMove = true;
  private npcProgress: Record<string, number> = {};
  private npcs: {
    info: OriginalNpc;
    sprite: Phaser.GameObjects.Sprite;
    text: Phaser.GameObjects.Text;
    bubble: Phaser.GameObjects.Graphics;
    wait: number;
    elapsed: number;
    busy: number;
    talking: boolean;
  }[] = [];
  private walls: {
    info: OriginalWall;
    image: Phaser.GameObjects.Image;
    touched: boolean;
    played: boolean;
  }[] = [];

  constructor(private options: OriginalSceneOptions) {
    super({ key: 'OriginalScene' });
  }

  preload() {
    this.add
      .text(240, 166, 'JUMP KING', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#e8d5a0',
      })
      .setOrigin(0.5);
    this.add
      .text(240, 200, 'Đang tải màn chơi…', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#aba78d',
      })
      .setOrigin(0.5);
    this.load.json('originalManifest', originalUrl('manifest.json'));
    this.load.json('originalDetails', originalUrl('details.json'));
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      this.fail(`Không tải được ${file.key}.`)
    );
  }

  async create() {
    this.events.once('shutdown', this.disposeScene);
    this.events.once('destroy', this.disposeScene);
    this.manifest = this.cache.json.get('originalManifest');
    this.details = this.cache.json.get('originalDetails');
    if (!this.manifest?.screens) {
      this.fail('Không đọc được dữ liệu game gốc.');
      return;
    }
    const campaign = CAMPAIGNS[this.options.campaign];
    this.simulation = new OriginalSimulation(
      ORIGINAL_SCREENS,
      campaign.spawnX,
      campaign.spawnY - campaign.startScreen * 360
    );
    const save =
      this.options.fresh ||
      this.options.mode === 'community' ||
      this.options.mode === 'race'
        ? null
        : readSave(this.options.campaign);
    if (save) {
      this.simulation.restore(save.state);
      this.completed = save.completed;
      this.best = save.bestScreen;
      this.npcProgress = save.npcProgress || {};
    } else this.best = this.simulation.screen;
    this.sound.setMute(this.options.muted);
    this.emitUi();
    try {
      const audio = Object.keys(this.manifest.sounds).filter(
        (key) =>
          key.startsWith('audio/jump_king/') ||
          ['audio/new_location', 'audio/talking', 'audio/illusion'].includes(
            key
          )
      );
      await this.loadKeys(['king/base', campaign.ending], audio);
      await this.loadScreen(this.simulation.screen);
      if (this.disposed) return;
      this.children.removeAll(true);
      const texture = this.textures.get('king/base');
      frameNames.forEach((name, i) =>
        texture.add(name, 0, 224 + (i % 4) * 48, Math.floor(i / 4) * 48, 48, 48)
      );
      texture.add('babe', 0, 96, 0, 32, 32);
      texture.add('nbp_babe', 0, 416, 80, 32, 40);
      texture.add('ghost_babe', 0, 736, 0, 32, 40);
      this.player = this.add
        .sprite(0, 0, 'king/base', 'idle')
        .setOrigin(0.5, 1)
        .setDepth(10);
      this.keys = this.input.keyboard!.addKeys(
        'LEFT,RIGHT,A,D,SPACE,UP,W,ESC'
      ) as Record<string, Phaser.Input.Keyboard.Key>;
      this.keys.ESC.on('down', () => this.setPaused(!this.paused));
      if (this.options.mode === 'community' || this.options.mode === 'race') {
        await this.connect();
        if (this.disposed) return;
        await this.loadScreen(this.simulation.screen);
      }
      window.addEventListener('pagehide', this.persist);
      window.addEventListener('blur', this.blur);
      document.addEventListener('visibilitychange', this.visibility);
      this.ready = true;
      this.renderScreen(this.simulation.screen);
      this.renderPlayer();
      this.emitUi();
      if (this.completed) this.showEnding();
      this.prefetch();
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  private disposeScene = () => {
    if (this.disposed) return;
    this.persist();
    this.disposed = true;
    window.removeEventListener('pagehide', this.persist);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.stopAmbience();
    if (this.room) void this.room.leave();
  };

  private async connect() {
    const manager = networkManager;
    const race = this.options.mode === 'race';
    const handedOff = manager.originalRoom;
    let room: Room<OriginalTowerState>;
    if (race && handedOff && handedOff.roomId === this.options.roomId) {
      room = handedOff;
      manager.originalRoom = null;
    } else if (race)
      room = await manager.client.joinById<OriginalTowerState>(
        this.options.roomId!,
        { nickname: 'Challenger' }
      );
    else
      room = await manager.client.joinOrCreate<OriginalTowerState>(
        'original_tower',
        { campaign: this.options.campaign, nickname: 'Player' }
      );
    if (this.disposed) {
      await room.leave();
      return;
    }
    this.room = room;
    room.onLeave(() => {
      if (!this.disposed) this.fail('Đã mất kết nối tới phòng chơi.');
    });
    room.onError((_code, message) =>
      this.fail(message || 'Lỗi kết nối tới server.')
    );
    const reconcile = () => {
      if (this.disposed) return;
      this.canMove = !race || room.state.status === 'RUNNING';
      const player = room.state.players.get(room.sessionId);
      if (player?.snapshot) {
        const snapshot: OriginalState = JSON.parse(player.snapshot);
        this.pending = this.pending.filter(
          (input) => input.seq > player.lastProcessedInputSeq
        );
        this.simulation.restore(snapshot);
        for (const input of this.pending)
          this.simulation.tick(
            this.canMove
              ? input
              : { ...input, left: false, right: false, jump: false }
          );
        if (player.finished && !this.completed) {
          this.completed = true;
          this.showEnding();
        }
      }
      for (const [id, peer] of room.state.players.entries()) {
        if (id === room.sessionId || !peer.snapshot) continue;
        let sprite = this.peers.get(id);
        if (!sprite) {
          sprite = this.add
            .sprite(0, 0, 'king/base', 'idle')
            .setOrigin(0.5, 1)
            .setTint(0xb5bfa0)
            .setAlpha(0.7)
            .setDepth(9);
          this.peers.set(id, sprite);
        }
        const state: OriginalState = JSON.parse(peer.snapshot);
        sprite
          .setPosition(Math.trunc(state.x) + 9, Math.trunc(state.y) + 26)
          .setFlipX(state.direction < 0);
        sprite.setFrame(
          state.splat
            ? 'splat'
            : state.charge
              ? 'charge'
              : state.grounded
                ? 'idle'
                : state.knocked
                  ? 'bounce'
                  : state.vy < 0
                    ? 'up'
                    : 'fall'
        );
      }
      for (const [id, sprite] of this.peers)
        if (!room.state.players.has(id)) {
          sprite.destroy();
          this.peers.delete(id);
        }
      this.emitUi();
    };
    room.onStateChange(reconcile);
    if (!room.state.players.has(room.sessionId))
      await new Promise<void>((resolve) =>
        room.onStateChange.once(() => resolve())
      );
    if (!this.disposed) reconcile();
  }

  toggleReady() {
    if (!this.room || this.room.state.status !== 'WAITING') return;
    this.room.send(
      'ready',
      !this.room.state.players.get(this.room.sessionId)?.ready
    );
  }

  private loadKeys(textures: string[], sounds: string[] = []) {
    const operation = this.queue.then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (this.disposed) {
            resolve();
            return;
          }
          let count = 0;
          for (const key of new Set(textures)) {
            if (this.textures.exists(key)) continue;
            const texture = this.manifest.textures[key];
            if (!texture) {
              reject(new Error(`Thiếu texture ${key}.`));
              return;
            }
            this.load.image(key, originalUrl(texture.file));
            count++;
          }
          for (const key of new Set(sounds)) {
            if (this.cache.audio.exists(key)) continue;
            const sound = this.manifest.sounds[key];
            if (!sound) continue;
            this.load.audio(key, originalUrl(sound.file));
            count++;
          }
          if (!count) {
            resolve();
            return;
          }
          let failed = '';
          const error = (file: Phaser.Loader.File) => {
            failed = file.key;
          };
          const progress = (value: number) => {
            this.progress = value;
            if (!this.ready) this.emitUi();
          };
          this.load.on('loaderror', error);
          this.load.on('progress', progress);
          this.load.once('complete', () => {
            this.load.off('loaderror', error);
            this.load.off('progress', progress);
            if (failed) reject(new Error(`Không tải được asset ${failed}.`));
            else resolve();
          });
          this.load.start();
        })
    );
    this.queue = operation.catch(() => {});
    return operation;
  }

  private screenKeys(screen: number) {
    const data = this.manifest.screens[screen];
    const textures = [
      ...data.layers,
      ...data.props
        .map((prop) => prop.texture)
        .filter((key): key is string => !!key),
    ];
    for (const layer of asArray(data.scrolling?.ScrollingBGdata?.layers?.Layer))
      textures.push(`screens/scrolling/textures/${layer.texture}`);
    for (const weather of data.weather)
      textures.push(
        ...Object.keys(this.manifest.textures).filter((key) =>
          key.startsWith(`particles/${weather.name}/`)
        )
      );
    const mask = `screens/masks/${screen + 1}`;
    if (this.manifest.textures[mask]) textures.push(mask);
    const sounds = data.ambience
      .map((sound) => this.ambienceKey(sound.name))
      .filter((key): key is string => !!key);
    textures.push(
      ...this.details.npcs
        .filter((npc) => npc.screen === screen)
        .map((npc) => npc.texture)
    );
    textures.push(
      ...(this.details.walls[screen] || []).map((wall) => wall.texture)
    );
    return {
      textures: textures.filter((key) => !!this.manifest.textures[key]),
      sounds,
    };
  }

  private ambienceKey(name: string) {
    return Object.keys(this.manifest.sounds).find(
      (key) => key.toLowerCase() === `audio/background/${name}`.toLowerCase()
    );
  }

  private loadScreen(screen: number) {
    const keys = this.screenKeys(screen);
    return this.loadKeys(keys.textures);
  }
  private prefetch() {
    for (const screen of [
      this.simulation.screen - 1,
      this.simulation.screen + 1,
    ]) {
      if (screen >= 0 && screen < 169) {
        // Only images are prefetched; ambience is decoded when entering the screen.
        void this.loadKeys(this.screenKeys(screen).textures).catch((error) =>
          this.fail(error.message)
        );
      }
    }
  }

  private renderScreen(screen: number) {
    this.renderedScreen = screen;
    for (const visual of this.visuals) visual.destroy();
    this.visuals = [];
    this.scrolling = [];
    this.npcs = [];
    this.walls = [];
    this.stopAmbience();
    const data = this.manifest.screens[screen];
    const top = -screen * 360;
    this.cameras.main.setScroll(0, top);
    for (const key of data.layers) {
      const depth = key.includes('/foreground/')
        ? 20
        : key.includes('/midground/')
          ? 3
          : 0;
      this.visuals.push(
        this.add.image(0, top, key).setOrigin(0).setDepth(depth)
      );
    }
    for (const prop of data.props) {
      if (!prop.texture) continue;
      const info = this.manifest.textures[prop.texture];
      const texture = this.textures.get(prop.texture);
      const w = info.width / prop.cells.X,
        h = info.height / prop.cells.Y;
      for (let i = 0; i < prop.cells.X * prop.cells.Y; i++)
        if (!texture.has(String(i)))
          texture.add(
            String(i),
            0,
            (i % prop.cells.X) * w,
            Math.floor(i / prop.cells.X) * h,
            w,
            h
          );
      const animation = `prop:${prop.texture}`;
      if (!this.anims.exists(animation))
        this.anims.create({
          key: animation,
          frames: Array.from(
            { length: prop.cells.X * prop.cells.Y },
            (_, i) => ({
              key: prop.texture!,
              frame: String(i),
              ...(prop.durations[i]
                ? { duration: prop.durations[i] * 1000 }
                : {}),
            })
          ),
          frameRate: prop.fps,
          repeat: -1,
        });
      this.visuals.push(
        this.add
          .sprite(prop.Position.X, prop.Position.Y + top, prop.texture, '0')
          .setOrigin(0)
          .setDepth(4)
          .play(animation)
      );
    }
    const scrolling = data.scrolling?.ScrollingBGdata;
    for (const layer of asArray(scrolling?.layers?.Layer)) {
      const key = `screens/scrolling/textures/${layer.texture}`;
      const info = this.manifest.textures[key];
      if (!info) continue;
      const sprite = this.add
        .tileSprite(0, top + (layer.position || 0), 480, info.height, key)
        .setOrigin(0)
        .setDepth(layer.foreground ? 21 : 1);
      this.scrolling.push({
        sprite,
        speed: (scrolling?.scroll_speed || 0) * (layer.scroll_multiplier ?? 1),
      });
      this.visuals.push(sprite);
    }
    for (const weather of data.weather) {
      const keys = Object.keys(this.manifest.textures).filter((key) =>
        key.startsWith(`particles/${weather.name}/`)
      );
      if (!keys.length) continue;
      const weatherSprite = this.add
        .tileSprite(0, top, 480, 360, keys[0])
        .setOrigin(0)
        .setDepth(weather.foreground ? 22 : 7);
      const maskKey = `screens/masks/${screen + 1}`;
      if (this.textures.exists(maskKey)) {
        const maskImage = this.make
          .image({ x: 0, y: top, key: maskKey, add: false })
          .setOrigin(0);
        weatherSprite.setMask(maskImage.createBitmapMask());
        this.visuals.push(maskImage);
      }
      const timer = this.time.addEvent({
        delay: 1000 / weather.fps,
        loop: true,
        callback: () => {
          if (weatherSprite.active)
            weatherSprite.setTexture(
              keys[
                Math.floor(this.time.now / (1000 / weather.fps)) % keys.length
              ]
            );
        },
      });
      weatherSprite.once('destroy', () => timer.remove());
      this.visuals.push(weatherSprite);
    }
    for (const npc of this.details.npcs.filter(
      (npc) => npc.screen === screen
    )) {
      const info = this.manifest.textures[npc.texture],
        texture = this.textures.get(npc.texture);
      const width = info.width / npc.cells.X,
        height = info.height / npc.cells.Y;
      for (let i = 0; i < npc.cells.X * npc.cells.Y; i++)
        if (!texture.has(String(i)))
          texture.add(
            String(i),
            0,
            (i % npc.cells.X) * width,
            Math.floor(i / npc.cells.X) * height,
            width,
            height
          );
      const sprite = this.add
        .sprite(npc.position.X, top + npc.position.Y, npc.texture, '0')
        .setOrigin(0.5, 1)
        .setDepth(9)
        .setFlipX(npc.bubble.direction === 'Left');
      const bubble = this.add.graphics().setDepth(30).setVisible(false);
      const text = this.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#e4dfcd',
          wordWrap: { width: (npc.bubble.width || 160) - 14 },
        })
        .setDepth(31)
        .setVisible(false);
      this.npcs.push({
        info: npc,
        sprite,
        text,
        bubble,
        wait: 0,
        elapsed: 0,
        busy: 0,
        talking: false,
      });
      this.visuals.push(sprite, bubble, text);
    }
    for (const wall of this.details.walls[screen] || []) {
      const image = this.add
        .image(wall.position.X, wall.position.Y + top, wall.texture)
        .setOrigin(0)
        .setDepth(25);
      this.walls.push({ info: wall, image, touched: false, played: false });
      this.visuals.push(image);
    }
    const campaign = CAMPAIGNS[this.options.campaign];
    if (screen === campaign.endScreen) {
      const frame =
        this.options.campaign === 'original'
          ? 'babe'
          : this.options.campaign === 'nbp'
            ? 'nbp_babe'
            : 'ghost_babe';
      this.visuals.push(
        this.add
          .sprite(
            this.options.campaign === 'nbp' ? 84 : 348,
            top + (this.options.campaign === 'original' ? 138 : 144),
            'king/base',
            frame
          )
          .setDepth(9)
      );
    }
    const startAmbience = () => {
      if (this.disposed || this.renderedScreen !== screen || this.completed)
        return;
      for (const sound of data.ambience) {
        const key = this.ambienceKey(sound.name);
        if (key && sound.volume > 0)
          this.streamAudio(key, true, sound.volume * 0.6);
      }
    };
    if (this.sound.locked) this.sound.once('unlocked', startAmbience);
    else startAmbience();
  }

  private renderPlayer() {
    const sim = this.simulation,
      body = sim.body;
    let frame = 'idle';
    if (sim.splatTicks > 0) frame = 'splat';
    else if (sim.chargeTicks > 0) frame = 'charge';
    else if (!body.isGrounded)
      frame = sim.knocked ? 'bounce' : body.velocity.y > 0 ? 'fall' : 'up';
    else if (Math.abs(body.velocity.x) > 0.1 && !sim.onSnow) {
      const step = sim.elapsedTicks % 28;
      frame =
        step < 10
          ? 'walk_one'
          : step < 14
            ? 'walk_smear'
            : step < 24
              ? 'walk_two'
              : 'walk_smear';
    }
    this.player
      .setPosition(
        Math.trunc(body.position.x) + 9,
        Math.trunc(body.position.y) + 26
      )
      .setFrame(frame)
      .setFlipX(sim.direction === -1);
  }

  update(_time: number, delta: number) {
    if (!this.ready || this.disposed || this.completed) return;
    const pad = navigator.getGamepads?.().find((pad) => pad?.connected);
    const padPause = !!pad?.buttons[9]?.pressed;
    if (padPause && !this.gamepadPause) {
      this.setPaused(!this.paused);
      this.gamepadPause = true;
      return;
    }
    this.gamepadPause = padPause;
    if (this.paused || this.changingScreen) return;
    this.accumulator += Math.min(delta, 100) / 1000;
    while (this.accumulator >= 1 / 60) {
      this.accumulator -= 1 / 60;
      const sim = this.simulation;
      const jumps = sim.jumps,
        falls = sim.falls,
        grounded = sim.body.isGrounded;
      const rawInput = {
        left:
          this.keys.LEFT.isDown ||
          this.keys.A.isDown ||
          this.touch.left ||
          !!pad?.buttons[14]?.pressed ||
          (pad?.axes[0] ?? 0) < -0.35,
        right:
          this.keys.RIGHT.isDown ||
          this.keys.D.isDown ||
          this.touch.right ||
          !!pad?.buttons[15]?.pressed ||
          (pad?.axes[0] ?? 0) > 0.35,
        jump:
          this.keys.SPACE.isDown ||
          this.keys.UP.isDown ||
          this.keys.W.isDown ||
          this.touch.jump ||
          !!pad?.buttons[0]?.pressed,
      };
      const input = this.canMove
        ? rawInput
        : { left: false, right: false, jump: false };
      if (this.room) {
        const sequenced = { ...input, seq: this.sequence++ };
        this.pending.push(sequenced);
        this.room.send('input', sequenced);
        if (this.pending.length > 180) {
          this.fail('Kết nối quá chậm. Hãy vào lại phòng chơi.');
          break;
        }
      }
      const event = sim.tick(input);
      if (sim.jumps > jumps) this.playEffect('jump');
      if (sim.falls > falls) this.playEffect('splat');
      else if (!grounded && sim.body.isGrounded) this.playEffect('land');
      if (event.bumped) this.playEffect('bump');
      this.best = Math.max(this.best, sim.screen);
      if (
        !this.room &&
        isOriginalFinish(
          this.options.campaign,
          sim.body.position.x,
          sim.body.position.y,
          sim.body.isGrounded,
          sim.screen
        )
      ) {
        this.completed = true;
        this.persist();
        this.showEnding();
        this.emitUi();
        break;
      }
      if (sim.screen !== this.renderedScreen) {
        this.changingScreen = true;
        this.accumulator = 0;
        void this.loadScreen(sim.screen)
          .then(() => {
            if (this.disposed) return;
            this.renderScreen(sim.screen);
            this.changingScreen = false;
            this.emitUi();
            this.persist();
            this.prefetch();
          })
          .catch((error) => this.fail(error.message));
        break;
      }
    }
    for (const layer of this.scrolling)
      layer.sprite.tilePositionX += (layer.speed * delta) / 1000;
    this.updateDetails(delta);
    this.renderPlayer();
    if (this.time.now - this.uiAt >= 100) {
      this.emitUi();
      this.uiAt = this.time.now;
    }
    if (this.time.now - this.savedAt >= 1000) {
      this.persist();
      this.savedAt = this.time.now;
    }
  }

  private updateDetails(delta: number) {
    const body = this.simulation.body;
    const player = new Phaser.Geom.Rectangle(
      Math.trunc(body.position.x),
      Math.trunc(body.position.y),
      18,
      26
    );
    for (const wall of this.walls) {
      const touching = wall.info.hitboxes.some((box) => {
        const offsetX = wall.info.screenCoordinates ? 0 : wall.info.position.X;
        const offsetY = wall.info.screenCoordinates ? 0 : wall.info.position.Y;
        return Phaser.Geom.Intersects.RectangleToRectangle(
          player,
          new Phaser.Geom.Rectangle(
            box.X + offsetX,
            box.Y + offsetY - this.renderedScreen * 360,
            box.Width,
            box.Height
          )
        );
      });
      wall.image.setAlpha(
        Phaser.Math.Clamp(
          wall.image.alpha + ((touching ? -1 : 1) * delta) / 200,
          0,
          1
        )
      );
      if (touching && !wall.touched && !wall.played && !this.sound.locked) {
        this.sound.play('audio/illusion', { volume: 0.4 });
        wall.played = true;
      }
      wall.touched = touching;
    }
    for (const npc of this.npcs) {
      const info = npc.info;
      const box = new Phaser.Geom.Rectangle(
        info.position.X - info.trigger.center_x * info.trigger.width,
        info.position.Y -
          this.renderedScreen * 360 -
          info.trigger.center_y * info.trigger.height,
        info.trigger.width,
        info.trigger.height
      );
      const touching = Phaser.Geom.Intersects.RectangleToRectangle(player, box);
      const lines = info.quotes
        .filter((quote) => quote.screen <= this.best + 1)
        .flatMap((quote) => quote.lines);
      const index = this.npcProgress[info.name] || 0;
      const line = lines[index];
      if (npc.busy > 0) {
        npc.busy -= delta / 1000;
        continue;
      }
      if (!npc.talking) {
        npc.wait = touching && line ? npc.wait + delta / 1000 : 0;
        if (npc.wait < info.delay) continue;
        npc.talking = true;
        npc.elapsed = 0;
        npc.wait = 0;
      }
      if (!line) {
        npc.talking = false;
        continue;
      }
      npc.elapsed += delta / 1000;
      const characters = Math.min(
        line.length,
        Math.floor(npc.elapsed / info.speed)
      );
      const width = info.bubble.width || 160;
      npc.text.setText(line.substring(0, characters)).setVisible(true);
      const x = Phaser.Math.Clamp(info.position.X - width, 5, 475 - width);
      const y =
        info.position.Y - this.renderedScreen * 360 - 32 - npc.text.height;
      npc.text.setPosition(x + 7, y + 6);
      npc.bubble
        .clear()
        .fillStyle(0x0b100b, 0.92)
        .fillRoundedRect(x, y, width, npc.text.height + 12, 3)
        .lineStyle(1, 0x87906b)
        .strokeRoundedRect(x, y, width, npc.text.height + 12, 3)
        .setVisible(true);
      const animation =
        info.talking[Math.floor(npc.elapsed / 0.2) % info.talking.length];
      if (animation) npc.sprite.setFrame(String(animation.sprite_index));
      if (npc.elapsed >= line.length * info.speed + 2.2) {
        this.npcProgress[info.name] = index + 1;
        npc.elapsed = 0;
        if (index + 1 >= lines.length) {
          npc.talking = false;
          npc.busy = 30;
          npc.text.setVisible(false);
          npc.bubble.setVisible(false);
          npc.sprite.setFrame('0');
        }
      }
    }
  }

  private playEffect(effect: 'jump' | 'land' | 'splat' | 'bump') {
    const sim = this.simulation;
    const variant = sim.inWater
      ? `water/water_${effect}`
      : sim.onSnow && effect !== 'bump'
        ? `snow/king_${effect}`
        : sim.onIce && (effect === 'jump' || effect === 'land')
          ? `ice/king_${effect}`
          : `king_${effect}`;
    const key = `audio/jump_king/${variant}`;
    if (this.cache.audio.exists(key) && !this.sound.locked)
      this.sound.play(key, { volume: 0.65 });
  }

  private showEnding() {
    this.stopAmbience();
    const key =
      this.options.campaign === 'original'
        ? 'audio/music/ending'
        : this.options.campaign === 'nbp'
          ? 'audio/music/ending2'
          : 'audio/music/ending3';
    if (!this.sound.locked) this.streamAudio(key, false, 0.5);
    const texture = CAMPAIGNS[this.options.campaign].ending;
    this.add
      .image(240, 180 - this.simulation.screen * 360, texture)
      .setDisplaySize(480, 360)
      .setDepth(50);
  }

  private streamAudio(key: string, loop: boolean, volume: number) {
    const asset = this.manifest.sounds[key];
    if (!asset) return;
    const audio = new Audio(originalUrl(asset.file));
    audio.loop = loop;
    audio.volume = Math.min(1, volume);
    audio.muted = this.options.muted;
    this.ambience.push(audio);
    const play = () => {
      if (this.disposed || !this.ambience.includes(audio)) return;
      void audio.play().catch((error) => {
        if (error.name === 'NotAllowedError') {
          this.input.once('pointerdown', play);
          this.input.keyboard?.once('keydown', play);
        } else if (error.name !== 'AbortError') {
          this.audioError = 'Không phát được nhạc nền.';
          this.emitUi();
        }
      });
    };
    audio.addEventListener('error', () => {
      if (!this.disposed && this.ambience.includes(audio)) {
        this.audioError = 'Không tải được nhạc nền.';
        this.emitUi();
      }
    });
    play();
  }

  private stopAmbience() {
    const previous = this.ambience;
    this.ambience = [];
    for (const audio of previous) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }

  setControl(control: 'left' | 'right' | 'jump', down: boolean) {
    this.touch[control] = down;
  }
  setMuted(muted: boolean) {
    this.options.muted = muted;
    this.sound?.setMute(muted);
    for (const audio of this.ambience) audio.muted = muted;
  }
  setPaused(paused: boolean) {
    if (!this.ready || this.completed) return;
    this.paused = paused;
    this.accumulator = 0;
    this.touch = { left: false, right: false, jump: false };
    this.input.keyboard?.resetKeys();
    if (paused && this.room)
      this.room.send('input', {
        left: false,
        right: false,
        jump: false,
        seq: this.sequence++,
      });
    if (paused) this.persist();
    this.emitUi();
  }
  private blur = () => this.setPaused(true);
  private visibility = () => {
    if (document.hidden) this.setPaused(true);
  };
  persist = () => {
    if (
      !this.simulation ||
      this.options.mode === 'community' ||
      this.options.mode === 'race'
    )
      return;
    try {
      localStorage.setItem(
        saveKey(this.options.campaign),
        JSON.stringify({
          version: 1,
          campaign: this.options.campaign,
          state: this.simulation.getState(),
          bestScreen: this.best,
          completed: this.completed,
          npcProgress: this.npcProgress,
        })
      );
      this.saveError = '';
    } catch {
      this.saveError = 'Trình duyệt không cho phép lưu tiến trình.';
    }
  };
  private fail(error: string) {
    if (this.disposed) return;
    this.ready = false;
    this.options.onUi({ ...this.ui(), status: 'ERROR', error });
  }
  private ui(): OriginalUi {
    const sim = this.simulation;
    const location = this.manifest?.screens[sim?.screen ?? 0]?.location || '';
    return {
      status: this.completed ? 'COMPLETE' : this.ready ? 'PLAYING' : 'LOADING',
      location:
        this.details?.locations[`LOCATION_${location.split(' ').join('_')}`] ||
        location,
      screen: (sim?.screen ?? 0) + 1,
      best: this.best + 1,
      seconds: (sim?.elapsedTicks ?? 0) / 60,
      jumps: sim?.jumps ?? 0,
      falls: sim?.falls ?? 0,
      charge: (sim?.chargeTicks ?? 0) / ORIGINAL_PHYSICS.chargeTicks,
      x: sim?.body.position.x ?? 231,
      y: sim?.body.position.y ?? 302,
      paused: this.paused,
      progress: this.progress,
      saveError: this.saveError || this.audioError,
      players: this.room?.state.players.size ?? 1,
      raceStatus: this.room?.state.status,
      countdown: this.room?.state.countdown,
      ready: this.room
        ? this.room.state.players.get(this.room.sessionId)?.ready
        : false,
      standings: this.room
        ? [...this.room.state.players.values()]
            .map((player) => ({
              nickname: player.nickname,
              finished: player.finished,
              seconds: player.finishTime / 1000,
            }))
            .sort(
              (a, b) =>
                Number(b.finished) - Number(a.finished) || a.seconds - b.seconds
            )
        : [],
    };
  }
  private emitUi() {
    if (!this.disposed) this.options.onUi(this.ui());
  }
}
