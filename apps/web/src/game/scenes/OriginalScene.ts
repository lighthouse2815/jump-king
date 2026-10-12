import Phaser from 'phaser';
import {
  CAMPAIGNS,
  CampaignId,
  ORIGINAL_SCREENS,
  ORIGINAL_ADVENTURE,
  isOriginalFinish,
} from '@jump-king/maps';
import {
  OriginalSimulation,
  OriginalAutoplayTour,
  ORIGINAL_PHYSICS,
  OriginalState,
  OriginalMovementEffect,
  PlayerInput,
  OriginalWorldEvents,
  OriginalWorldEvent,
  ORIGINAL_ACHIEVEMENTS,
  evaluateOriginalAchievements,
} from '@jump-king/physics';
import { ErrorCode, Room } from 'colyseus.js';
import {
  OriginalTowerState,
  ChatMessage,
  CHAT_HISTORY_LIMIT,
} from '@jump-king/protocol';
import { networkManager } from '../networking/NetworkManager';
import { readGamepads } from '../utils/gamepads';
import { originalPlayerFrame } from '../originalPlayerFrame';
import {
  OriginalManifest,
  OriginalDetails,
  OriginalNpc,
  OriginalWall,
  originalUrl,
  asArray,
} from '../originalAssets';
import { readSave, saveKey } from '../soloSave';
import {
  readProgress,
  createProgress,
  profileAdventure,
  progressKey,
  itemLabels,
} from '../originalProgress';
import { OriginalAdventureVisuals } from '../OriginalAdventureVisuals';
import {
  OriginalCutscenes,
  ORIGINAL_CUTSCENE_TEXTURE_KEYS,
  ORIGINAL_CUTSCENE_SOUND_KEYS,
} from '../OriginalCutscenes';

export interface OriginalUi {
  status: 'LOADING' | 'PLAYING' | 'CUTSCENE' | 'COMPLETE' | 'ERROR';
  cutscene?: 'intro' | 'ending';
  cutsceneReady?: boolean;
  inventory?: {
    item: string;
    label: string;
    count: number;
    wearable: boolean;
    equipped: boolean;
  }[];
  achievements?: { id: string; name: string; description: string }[];
  achievementNotice?: string;
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
  freeFlight?: boolean;
  progress: number;
  autoplay?: {
    progress: number;
    visited: number;
    totalScreens: number;
    label: string;
  };
  error?: string;
  saveError?: string;
  players: number;
  roomId?: string;
  raceStatus?: string;
  countdown?: number;
  ready?: boolean;
  standings?: { nickname: string; finished: boolean; seconds: number }[];
}
export interface AutoplayResult {
  campaign: CampaignId;
  screens: number[];
  jumps: number;
  falls: number;
  seconds: number;
  items: string[];
  pickups: number;
  npcs: number;
  sales: number;
  birds: number;
  endings: number;
}
export interface OriginalSceneOptions {
  campaign: CampaignId;
  fresh: boolean;
  muted: boolean;
  onUi: (state: OriginalUi) => void;
  onChat?: (messages: ChatMessage[]) => void;
  onChatError?: (message: string) => void;
  onCheatError?: (message: string) => void;
  mode?: 'solo' | 'community' | 'race';
  roomId?: string;
  intro?: boolean;
  autoplay?: boolean;
  autoplaySpeed?: number;
  onAutoplayComplete?: (result: AutoplayResult) => void;
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
  private touch = { left: false, right: false, jump: false, up: false, down: false };
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
  private gameError = '';
  private gamepadPause = false;
  private progress = 0;
  private room: Room<OriginalTowerState> | null = null;
  private chatMessages: ChatMessage[] = [];
  private chatFocused = false;
  private profile = readProgress();
  private tour?: OriginalAutoplayTour;
  private alternateTourEnding = false;
  private tourEndingTimer?: number;
  private autoplaySpeed = 1;
  private runId: string = crypto.randomUUID();
  private achievementNotice = '';
  private achievementNoticeAt = 0;
  private worldEvents!: OriginalWorldEvents;
  private worldClock = 0;
  private effects?: OriginalAdventureVisuals;
  private cutscenes?: OriginalCutscenes;
  private activeCutscene?: 'intro' | 'ending';
  private peers = new Map<string, Phaser.GameObjects.Sprite>();
  private appliedSnapshots = new Map<string, string>();
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
    id: string;
    info: OriginalWall;
    image: Phaser.GameObjects.Image;
    touched: boolean;
    played: boolean;
  }[] = [];

  constructor(private options: OriginalSceneOptions) {
    super({ key: 'OriginalScene' });
    if (options.autoplay) {
      if (options.mode && options.mode !== 'solo')
        throw new Error('Autoplay is solo only');
      this.profile = createProgress();
      const c = CAMPAIGNS[options.campaign];
      const [first, last] =
        options.campaign === 'original'
          ? [0, 45]
          : options.campaign === 'nbp'
            ? [46, 100]
            : [101, 168];
      const screens = Array.from(
        { length: last - first + 1 },
        (_, index) => first + index,
      );
      this.tour = new OriginalAutoplayTour(ORIGINAL_ADVENTURE, screens, {
        screen: c.endScreen,
        x: c.finishX + (options.campaign === 'nbp' ? -27 : 9),
        y: c.finishY - 26,
      });
      this.autoplaySpeed = options.autoplaySpeed || 8;
    }
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
      this.fail(`Không tải được ${file.key}.`),
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
      campaign.spawnY - campaign.startScreen * 360,
      ORIGINAL_ADVENTURE,
      !this.options.autoplay &&
        (!this.options.mode || this.options.mode === 'solo')
        ? profileAdventure(this.profile)
        : undefined,
    );
    const save =
      this.options.fresh ||
      this.options.autoplay ||
      this.options.mode === 'community' ||
      this.options.mode === 'race'
        ? null
        : readSave(this.options.campaign);
    if (save) {
      this.simulation.restore(save.state);
      if (
        save.state.adventure &&
        (this.profile.achievements.run ||
          Object.keys(this.profile.inventory).length ||
          this.profile.flags.length)
      )
        this.simulation.adventure!.restore({
          ...save.state.adventure,
          inventory: this.profile.inventory,
          equipped: this.profile.equipped,
          flags: [
            ...new Set([...save.state.adventure.flags, ...this.profile.flags]),
          ],
        });
      this.runId = save.runId || this.runId;
      this.completed = save.completed;
      this.best = save.bestScreen;
      this.npcProgress = save.npcProgress || {};
    } else this.best = this.simulation.screen;
    if (this.options.campaign === 'nbp')
      this.simulation.adventure!.flag('StartedNBP');
    if (this.options.campaign === 'ghost')
      this.simulation.adventure!.flag('StartedGhost');
    this.worldEvents = new OriginalWorldEvents({
      walls: Object.entries(this.details.walls).flatMap(([screen, walls]) =>
        walls.map((wall, index) => ({
          id: `${screen}:${index}`,
          screen: Number(screen),
          texture: wall.texture,
          position: {
            x: wall.position.X,
            y: wall.position.Y - Number(screen) * 360,
          },
          hitboxes: wall.hitboxes.map((box) => ({
            x: box.X + (wall.screenCoordinates ? 0 : wall.position.X),
            y:
              box.Y +
              (wall.screenCoordinates ? 0 : wall.position.Y) -
              Number(screen) * 360,
            width: box.Width,
            height: box.Height,
          })),
          appearSound: wall.appearSound,
          disappearSound: wall.disappearSound,
          playMode: wall.playMode,
        })),
      ),
    });
    if (save?.worldEvents) {
      try {
        this.worldEvents.restore(save.worldEvents);
        this.worldClock = save.worldEvents.lastTick || 0;
      } catch {
        this.saveError =
          'Sự kiện màn chơi đã được khởi tạo lại vì save không hợp lệ.';
      }
    }
    this.sound.setMute(this.options.muted);
    this.emitUi();
    try {
      const audio = Object.keys(this.manifest.sounds).filter(
        (key) =>
          key.startsWith('audio/jump_king/') ||
          key.startsWith('audio/gui_sfx/') ||
          ['audio/new_location', 'audio/talking', 'audio/illusion'].includes(
            key,
          ),
      );
      const worldSounds = Object.keys(this.manifest.sounds).filter(
        (key) =>
          key.startsWith('audio/event_sfx/') ||
          key.startsWith('audio/music/event_music/'),
      );
      await this.loadKeys(
        [
          ...ORIGINAL_CUTSCENE_TEXTURE_KEYS,
          ...Object.values(ORIGINAL_ADVENTURE.itemTextures),
          ...ORIGINAL_ADVENTURE.birds.map((bird) => bird.texture),
          'ending/flying_gargoyle',
        ],
        [...audio, ...worldSounds, 'audio/plink'],
      );
      await this.loadScreen(this.simulation.screen);
      if (this.disposed) return;
      this.children.removeAll(true);
      const texture = this.textures.get('king/base');
      frameNames.forEach((name, i) =>
        texture.add(
          name,
          0,
          224 + (i % 4) * 48,
          Math.floor(i / 4) * 48,
          48,
          48,
        ),
      );
      texture.add('babe', 0, 96, 0, 32, 32);
      texture.add('nbp_babe', 0, 416, 80, 32, 40);
      texture.add('ghost_babe', 0, 736, 0, 32, 40);
      this.player = this.add
        .sprite(0, 0, 'king/base', 'idle')
        .setOrigin(0.5, 1)
        .setDepth(10);
      this.effects = new OriginalAdventureVisuals(this, this.manifest);
      this.keys = this.input.keyboard!.addKeys(
        'LEFT,RIGHT,A,D,SPACE,UP,DOWN,W,S,ESC',
      ) as Record<string, Phaser.Input.Keyboard.Key>;
      this.keys.ESC.on('down', () => this.setPaused(true));
      if (this.options.mode === 'community' || this.options.mode === 'race') {
        await this.connect();
        if (this.disposed) return;
        await this.loadScreen(this.simulation.screen);
      }
      window.addEventListener('pagehide', this.persist);
      window.addEventListener('blur', this.blur);
      document.addEventListener('visibilitychange', this.visibility);
      this.ready = true;
      this.setAutoplaySpeed(this.autoplaySpeed);
      this.renderScreen(this.simulation.screen);
      this.renderPlayer();
      this.recordAchievements(this.completed);
      this.emitUi();
      if (this.completed) void this.showEnding(true);
      else if (
        (this.options.intro || this.options.fresh) &&
        !save &&
        (!this.options.mode || this.options.mode === 'solo')
      ) {
        this.activeCutscene = 'intro';
        this.ready = false;
        this.emitUi();
        await this.loadKeys([], ['audio/music/opening theme']);
        if (this.disposed) return;
        this.cutscenes = new OriginalCutscenes(this, this.options.campaign, {
          onComplete: () => {
            this.activeCutscene = undefined;
            this.ready = true;
            this.accumulator = 0;
            this.input.keyboard?.resetKeys();
            this.persist();
            this.emitUi();
          },
        });
        this.cutscenes.playIntro({ newGame: true });
        this.emitUi();
      }
      this.prefetch();
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  disposeScene = () => {
    if (this.disposed) return;
    this.persist();
    this.disposed = true;
    window.clearTimeout(this.tourEndingTimer);
    window.removeEventListener('pagehide', this.persist);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    this.stopAmbience();
    this.cutscenes?.destroy();
    this.effects?.destroy();
    if (this.room) void this.room.leave();
  };

  private async connect() {
    const manager = networkManager;
    const race = this.options.mode === 'race';
    const handedOff = manager.originalRoom;
    let room: Room<OriginalTowerState> | undefined;
    if (race && handedOff && handedOff.roomId === this.options.roomId) {
      room = handedOff;
      manager.originalRoom = null;
    } else if (race)
      room = await manager.client.joinById<OriginalTowerState>(
        this.options.roomId!,
        { nickname: 'Challenger' },
      );
    else if (this.options.roomId) {
      try {
        room = await manager.client.joinById<OriginalTowerState>(
          this.options.roomId,
          { nickname: 'Player' },
        );
      } catch (error) {
        if (
          (error as { code?: number })?.code !==
          ErrorCode.MATCHMAKE_INVALID_ROOM_ID
        )
          throw error;
      }
    }
    if (!room)
      room = await manager.client.joinOrCreate<OriginalTowerState>(
        'original_tower',
        { campaign: this.options.campaign, nickname: 'Player' },
      );
    if (this.disposed) {
      await room.leave();
      return;
    }
    this.room = room;
    this.appliedSnapshots.clear();
    room.onMessage('chatHistory', (messages: ChatMessage[]) => {
      if (this.disposed) return;
      this.chatMessages = messages.slice(-CHAT_HISTORY_LIMIT);
      this.options.onChat?.(this.chatMessages);
    });
    room.onMessage('chat', (message: ChatMessage) => {
      if (this.disposed) return;
      this.chatMessages = [...this.chatMessages, message].slice(
        -CHAT_HISTORY_LIMIT,
      );
      this.options.onChat?.(this.chatMessages);
    });
    room.onMessage('chatError', (message: string) => {
      if (!this.disposed) this.options.onChatError?.(message);
    });
    room.onMessage('cheatError', (message: string) => {
      if (!this.disposed) this.options.onCheatError?.(message);
    });
    room.send('chatHistory');
    room.onMessage(
      'playerEffects',
      (message: {
        sessionId: string;
        effects: OriginalMovementEffect[];
        screen: number;
        water: boolean;
        snow: boolean;
        ice: boolean;
      }) => {
        if (
          this.disposed ||
          !this.ready ||
          this.options.muted ||
          message.sessionId === room.sessionId ||
          message.screen !== this.simulation.screen
        )
          return;
        for (const effect of message.effects)
          this.playEffect(effect, message, 0.45);
      },
    );
    room.onLeave(() => {
      if (!this.disposed) this.fail('Đã mất kết nối tới phòng chơi.');
    });
    room.onError((_code, message) =>
      this.fail(message || 'Lỗi kết nối tới server.'),
    );
    const reconcile = () => {
      if (this.disposed) return;
      this.canMove = !race || room.state.status === 'RUNNING';
      const player = room.state.players.get(room.sessionId);
      if (player?.snapshot) {
        this.pending = this.pending.filter(
          (input) => input.seq > player.lastProcessedInputSeq,
        );
        if (this.appliedSnapshots.get(room.sessionId) !== player.snapshot) {
          this.appliedSnapshots.set(room.sessionId, player.snapshot);
          const snapshot: OriginalState = JSON.parse(player.snapshot);
          this.simulation.restore(snapshot);
          for (const input of this.pending)
            this.simulation.tick(
              this.canMove || this.simulation.freeFlight
                ? input
                : { ...input, left: false, right: false, jump: false, up: false, down: false },
            );
        }
        if (player.finished && !this.completed) {
          this.recordAchievements(true, JSON.parse(player.finishEquipment));
          this.completed = true;
          void this.showEnding(false, JSON.parse(player.finishEquipment));
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
        if (this.appliedSnapshots.get(id) === peer.snapshot) continue;
        this.appliedSnapshots.set(id, peer.snapshot);
        const state: OriginalState = JSON.parse(peer.snapshot);
        sprite
          .setPosition(Math.trunc(state.x) + 9, Math.trunc(state.y) + 26)
          .setFlipX(state.direction < 0);
        sprite.setFrame(originalPlayerFrame(state));
        this.effects?.dress(id, sprite, state.adventure?.equipped || []);
      }
      for (const [id, sprite] of this.peers)
        if (!room.state.players.has(id)) {
          sprite.destroy();
          this.peers.delete(id);
          this.appliedSnapshots.delete(id);
          this.effects?.removePlayer(id);
        }
      this.emitUi();
    };
    room.onStateChange(reconcile);
    if (!room.state.players.has(room.sessionId))
      await new Promise<void>((resolve) =>
        room.onStateChange.once(() => resolve()),
      );
    if (!this.disposed) reconcile();
  }

  toggleReady() {
    if (!this.room || this.room.state.status !== 'WAITING') return;
    this.room.send(
      'ready',
      !this.room.state.players.get(this.room.sessionId)?.ready,
    );
  }

  sendChat(text: string) {
    this.room?.send('chat', text);
  }

  sendCheat(code: string) {
    this.room?.send('cheat', code);
  }

  setChatFocused(focused: boolean) {
    this.chatFocused = focused;
    this.touch = { left: false, right: false, jump: false, up: false, down: false };
    this.input.keyboard?.resetKeys();
    if (this.input.keyboard) {
      this.input.keyboard.enabled = !this.paused && !focused;
      this.input.keyboard.manager.enabled = !this.paused && !focused;
    }
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
            // HTML Audio caches range responses; Phaser's XHR loader requires HTTP 200.
            this.load.audio(key, `${originalUrl(sound.file)}?decode=1`);
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
        }),
    );
    this.queue = operation.catch(() => {});
    return operation;
  }

  private screenKeys(screen: number) {
    const data = this.manifest.screens[screen];
    const textures = [
      ...data.layers,
      ...this.screenProps(screen)
        .map((prop) => prop.texture)
        .filter((key): key is string => !!key),
    ];
    for (const layer of asArray(data.scrolling?.ScrollingBGdata?.layers?.Layer))
      textures.push(`screens/scrolling/textures/${layer.texture}`);
    for (const weather of data.weather)
      textures.push(
        ...Object.keys(this.manifest.textures).filter((key) =>
          key.startsWith(`particles/${weather.name}/`),
        ),
      );
    const mask = `screens/masks/${screen + 1}`;
    if (this.manifest.textures[mask]) textures.push(mask);
    const sounds = data.ambience
      .map((sound) => this.ambienceKey(sound.name))
      .filter((key): key is string => !!key);
    textures.push(
      ...this.details.npcs
        .filter((npc) => npc.screen === screen)
        .map((npc) => npc.texture),
    );
    textures.push(
      ...(this.details.walls[screen] || []).map((wall) => wall.texture),
    );
    return {
      textures: textures.filter((key) => !!this.manifest.textures[key]),
      sounds,
    };
  }
  private screenProps(screen: number) {
    const flags = this.simulation.adventure?.getState().flags || [];
    return [
      ...this.manifest.screens[screen].props,
      ...(this.details.extraProps?.[screen] || []).filter(
        (prop) => !prop.flag || flags.includes(prop.flag),
      ),
    ];
  }

  private ambienceKey(name: string) {
    return Object.keys(this.manifest.sounds).find(
      (key) => key.toLowerCase() === `audio/background/${name}`.toLowerCase(),
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
          this.fail(error.message),
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
        this.add.image(0, top, key).setOrigin(0).setDepth(depth),
      );
    }
    for (const prop of this.screenProps(screen)) {
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
            h,
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
            }),
          ),
          frameRate: prop.fps,
          repeat: -1,
        });
      this.visuals.push(
        this.add
          .sprite(prop.Position.X, prop.Position.Y + top, prop.texture, '0')
          .setOrigin(0)
          .setFlipX(!!prop.flipped)
          .setDepth(4)
          .play(animation),
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
        key.startsWith(`particles/${weather.name}/`),
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
              ],
            );
        },
      });
      weatherSprite.once('destroy', () => timer.remove());
      this.visuals.push(weatherSprite);
    }
    for (const npc of this.details.npcs.filter(
      (npc) => npc.screen === screen,
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
            height,
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
    for (const [index, wall] of (this.details.walls[screen] || []).entries()) {
      const image = this.add
        .image(wall.position.X, wall.position.Y + top, wall.texture)
        .setOrigin(0)
        .setDepth(25);
      const id = `${screen}:${index}`;
      image.setAlpha(this.worldEvents.getState().walls[id]?.alpha || 0);
      this.walls.push({ id, info: wall, image, touched: false, played: false });
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
            frame,
          )
          .setDepth(9),
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
    const frame = originalPlayerFrame({
      splat: sim.splatTicks,
      charge: sim.chargeTicks,
      grounded: body.isGrounded,
      knocked: sim.knocked,
      vy: body.velocity.y,
      vx: body.velocity.x,
      snow: sim.onSnow,
      ticks: sim.elapsedTicks,
    });
    this.player
      .setPosition(
        Math.trunc(body.position.x) + 9,
        Math.trunc(body.position.y) + 26,
      )
      .setFrame(frame)
      .setFlipX(sim.direction === -1);
    this.effects?.dress('self', this.player, sim.adventure?.equipped || []);
    if (sim.adventure)
      this.effects?.sync(sim.adventure, sim.screen, this.worldClock);
  }

  update(_time: number, delta: number) {
    if (!this.ready || this.disposed || this.completed) return;
    const pad = readGamepads().find((pad) => pad?.connected);
    const padPause = !this.chatFocused && !!pad?.buttons[9]?.pressed;
    if (padPause && !this.gamepadPause) {
      this.setPaused(!this.paused);
      this.gamepadPause = true;
      return;
    }
    this.gamepadPause = padPause;
    if (this.paused || this.changingScreen) return;
    this.accumulator += (Math.min(delta, 100) / 1000) * this.autoplaySpeed;
    while (this.accumulator >= 1 / 60) {
      this.accumulator -= 1 / 60;
      const sim = this.simulation;
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
          (!sim.freeFlight && (this.keys.UP.isDown || this.keys.W.isDown)) ||
          this.touch.jump ||
          !!pad?.buttons[0]?.pressed,
        up:
          this.keys.UP.isDown || this.keys.W.isDown || this.touch.up ||
          !!pad?.buttons[12]?.pressed || (pad?.axes[1] ?? 0) < -0.35,
        down:
          this.keys.DOWN.isDown || this.keys.S.isDown || this.touch.down ||
          !!pad?.buttons[13]?.pressed || (pad?.axes[1] ?? 0) > 0.35,
      };
      let tourInput: PlayerInput | undefined;
      try {
        tourInput = this.tour?.prepare(sim);
      } catch (error) {
        this.fail(error instanceof Error ? error.message : String(error));
        return;
      }
      const input =
        tourInput ||
        ((this.canMove || sim.freeFlight) && !this.chatFocused
          ? rawInput
          : { left: false, right: false, jump: false });
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
      try {
        this.tour?.afterTick(sim);
      } catch (error) {
        this.fail(error instanceof Error ? error.message : String(error));
        return;
      }
      for (const adventureEvent of event.adventure) {
        if (adventureEvent.sound) this.playSound(adventureEvent.sound);
        else if (
          adventureEvent.type === 'pickup' ||
          adventureEvent.type === 'sale'
        )
          this.playSound('audio/plink');
      }
      for (const worldEvent of this.worldEvents.tick({
        ...sim.getState(),
        ticks: ++this.worldClock,
      }))
        this.applyWorldEvent(worldEvent);
      this.effects?.tick();
      this.recordAchievements(false);
      for (const effect of event.effects) this.playEffect(effect);
      this.best = Math.max(this.best, sim.screen);
      if (
        !this.room &&
        (!this.tour || this.tour.finishing) &&
        isOriginalFinish(
          this.options.campaign,
          sim.body.position.x,
          sim.body.position.y,
          sim.body.isGrounded,
          sim.screen,
        )
      ) {
        this.recordAchievements(true);
        this.completed = true;
        this.persist();
        void this.showEnding();
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
    this.updateDetails(delta * this.autoplaySpeed);
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
    const adventure = this.simulation.adventure!;
    const speakers = adventure.dialogue.getState();
    for (const npc of this.npcs) {
      const info = npc.info;
      const line =
        adventure.merchantLine(info.name) || adventure.dialogue.line(info.name);
      if (!line) {
        npc.text.setVisible(false);
        npc.bubble.setVisible(false);
        const busy = speakers[info.name]?.busy || 0;
        const duration = info.busy.reduce(
          (sum, frame) => sum + frame.duration,
          0,
        );
        let phase = duration > 0 ? ((1800 - busy) / 60) % duration : 0;
        let frame = '0';
        if (busy > 0)
          for (const step of info.busy) {
            if (phase < step.duration) {
              frame = String(step.sprite_index);
              break;
            }
            phase -= step.duration;
          }
        npc.sprite.setFrame(frame);
        npc.elapsed = 0;
        continue;
      }
      npc.elapsed += delta / 1000;
      const width = info.bubble.width || 160;
      npc.text
        .setText(line.text.substring(0, line.characters))
        .setVisible(true);
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
    }
  }
  playSound(key: string) {
    if (this.cache.audio.exists(key) && !this.sound.locked)
      this.sound.play(key, { volume: 0.6 });
  }
  private applyWorldEvent(event: OriginalWorldEvent) {
    if (event.type === 'sound') this.playSound(event.key);
    else if (event.type === 'wall')
      this.walls
        .find((wall) => wall.id === event.id)
        ?.image.setAlpha(event.alpha);
    else this.effects?.event(event);
  }
  private recordAchievements(completed: boolean, equipped?: string[]) {
    const state = this.simulation.getState();
    const result = evaluateOriginalAchievements(
      state,
      this.profile.achievements,
      {
        ...state.adventure,
        campaign: this.options.campaign,
        completed,
        runId: this.runId,
        ...(equipped ? { equipped } : {}),
      },
    );
    this.profile.achievements = result.progress;
    if (result.newlyUnlocked.length) {
      this.achievementNotice = result.newlyUnlocked
        .map((id) => ORIGINAL_ACHIEVEMENTS[id].name)
        .join(' · ');
      this.achievementNoticeAt = this.time.now;
      this.persist();
    }
  }

  private playEffect(
    effect: OriginalMovementEffect,
    terrain = {
      water: this.simulation.inWater,
      snow: this.simulation.onSnow,
      ice: this.simulation.onIce,
    },
    volume = 0.65,
  ) {
    const variant = terrain.water
      ? `water/water_${effect}`
      : terrain.snow && effect !== 'bump'
        ? `snow/king_${effect}`
        : terrain.ice && (effect === 'jump' || effect === 'land')
          ? `ice/king_${effect}`
          : `king_${effect}`;
    const key = `audio/jump_king/${variant}`;
    if (this.cache.audio.exists(key) && !this.sound.locked)
      this.sound.play(key, { volume });
  }

  private async showEnding(resume = false, equipped?: string[]) {
    this.stopAmbience();
    this.activeCutscene = 'ending';
    this.ready = false;
    this.paused = false;
    this.emitUi();
    try {
      const music =
        this.options.campaign === 'original'
          ? 'audio/music/ending'
          : this.options.campaign === 'nbp'
            ? 'audio/music/ending2'
            : 'audio/music/ending3';
      await this.loadKeys(
        [],
        ORIGINAL_CUTSCENE_SOUND_KEYS.filter(
          (key) => !key.startsWith('audio/music/') || key === music,
        ),
      );
      if (this.disposed) return;
      this.cutscenes?.destroy();
      this.cutscenes = new OriginalCutscenes(this, this.options.campaign, {
        equipped:
          equipped || (this.tour ? [] : this.simulation.adventure!.equipped),
        ravenDone: this.simulation.adventure!.getState().birds.raven?.done,
        tsuchinokoDone:
          (!this.tour || this.alternateTourEnding) &&
          this.simulation.adventure!.getState().birds.tsuchinoko?.done,
        player: this.player,
        hide: [
          ...(this.effects?.playerLayers || []),
          ...this.visuals.filter(
            (visual): visual is Phaser.GameObjects.Sprite =>
              visual instanceof Phaser.GameObjects.Sprite &&
              visual.texture.key === 'king/base',
          ),
        ],
        onEquipment: (item) => {
          if (!this.room) this.simulation.adventure!.add(item, true);
          this.persist();
        },
        onComplete: () => {
          if (!this.room)
            this.simulation.adventure!.complete(this.options.campaign);
          this.activeCutscene = undefined;
          this.ready = true;
          this.persist();
          if (this.tour && !this.alternateTourEnding) {
            this.activeCutscene = 'ending';
            this.ready = false;
            this.tourEndingTimer = window.setTimeout(() => {
              if (this.disposed) return;
              this.alternateTourEnding = true;
              void this.showEnding(
                false,
                this.options.campaign === 'original'
                  ? ['Shoes']
                  : this.options.campaign === 'nbp'
                    ? ['GiantBoots']
                    : [],
              );
            }, 2000);
            this.emitUi();
            return;
          }
          this.emitUi();
          const adventure = this.simulation.adventure!.getState();
          if (this.tour)
            this.options.onAutoplayComplete?.({
              campaign: this.options.campaign,
              screens: this.tour.screens.filter((screen) =>
                this.tour!.visited.has(screen),
              ),
              jumps: this.simulation.jumps,
              falls: this.simulation.falls,
              seconds: this.simulation.elapsedTicks / 60,
              items: Object.keys(this.simulation.adventure!.inventory),
              pickups: adventure.collected.length,
              npcs: this.tour.npcs.length,
              sales: Object.values(adventure.merchants).filter(
                (merchant) => merchant.sold,
              ).length,
              birds: Object.values(adventure.birds).filter((bird) => bird.done)
                .length,
              endings: 2,
            });
        },
      });
      if (resume) this.cutscenes.showEndingPicture();
      else this.cutscenes.playEnding();
      this.emitUi();
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }
  skipCutscene() {
    this.cutscenes?.skip();
  }
  setAutoplaySpeed(speed: number) {
    if (!this.tour || ![1, 4, 8, 16, 32, 64].includes(speed)) return;
    this.autoplaySpeed = speed;
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
    this.anims.globalTimeScale = speed;
  }
  setEquipped(item: string, enabled: boolean) {
    if (this.tour || this.activeCutscene || this.completed) return;
    if (this.room) {
      this.room.send('equip', { item, enabled });
      return;
    }
    if (this.simulation.adventure?.setEquipped(item, enabled)) {
      this.recordAchievements(false);
      this.renderPlayer();
      this.persist();
      this.emitUi();
    }
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

  setControl(control: 'left' | 'right' | 'jump' | 'up' | 'down', down: boolean) {
    this.touch[control] = down;
  }
  setMuted(muted: boolean) {
    this.options.muted = muted;
    this.sound?.setMute(muted);
    for (const audio of this.ambience) audio.muted = muted;
  }
  setPaused(paused: boolean) {
    if (!this.ready || this.completed) return;
    if (paused && !this.paused) this.playSound('audio/gui_sfx/menu_open');
    this.paused = paused;
    this.accumulator = 0;
    this.touch = { left: false, right: false, jump: false, up: false, down: false };
    this.input.keyboard?.resetKeys();
    if (this.input.keyboard) {
      this.input.keyboard.enabled = !paused && !this.chatFocused;
      // DOM menus own keyboard events while the game is paused.
      this.input.keyboard.manager.enabled = !paused && !this.chatFocused;
    }
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
      this.options.autoplay ||
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
          runId: this.runId,
          worldEvents: this.worldEvents?.getState(),
        }),
      );
      const adventure = this.simulation.adventure?.getState();
      if (adventure) {
        this.profile.inventory = adventure.inventory;
        this.profile.equipped = adventure.equipped;
        this.profile.flags = adventure.flags;
        localStorage.setItem(progressKey, JSON.stringify(this.profile));
      }
      this.saveError = '';
    } catch {
      this.saveError = 'Trình duyệt không cho phép lưu tiến trình.';
    }
  };
  private fail(error: string) {
    if (this.disposed) return;
    this.ready = false;
    this.gameError = error || 'Không thể mở game. Hãy thử lại.';
    this.emitUi();
  }
  private ui(): OriginalUi {
    const sim = this.simulation;
    const location = this.manifest?.screens[sim?.screen ?? 0]?.location || '';
    return {
      status: this.gameError
        ? 'ERROR'
        : this.activeCutscene
          ? 'CUTSCENE'
          : this.completed
            ? 'COMPLETE'
            : this.ready
              ? 'PLAYING'
              : 'LOADING',
      cutscene: this.activeCutscene,
      error: this.gameError || undefined,
      cutsceneReady: this.cutscenes?.state === this.activeCutscene,
      inventory: Object.entries(sim?.adventure?.inventory || {})
        .filter(([, count]) => count > 0)
        .map(([item, count]) => ({
          item,
          label: itemLabels[item] || item,
          count,
          wearable: ORIGINAL_ADVENTURE.skins.some((skin) => skin.item === item),
          equipped: !!sim?.adventure?.equipped.includes(item),
        })),
      achievements: this.profile.achievements.unlocked.map((id) => ({
        id,
        name: ORIGINAL_ACHIEVEMENTS[id].name,
        description: ORIGINAL_ACHIEVEMENTS[id].description,
      })),
      achievementNotice:
        this.time.now - this.achievementNoticeAt < 5000
          ? this.achievementNotice
          : undefined,
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
      freeFlight: sim?.freeFlight ?? false,
      progress: this.progress,
      autoplay: this.tour
        ? {
            progress: this.tour.finishing ? 1 : this.tour.progress,
            visited: this.tour.screens.filter((screen) =>
              this.tour!.visited.has(screen),
            ).length,
            totalScreens: this.tour.screens.length,
            label: this.tour.label,
          }
        : undefined,
      saveError: this.saveError || this.audioError,
      players: this.room?.state.players.size ?? 1,
      roomId: this.room?.roomId,
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
                Number(b.finished) - Number(a.finished) ||
                a.seconds - b.seconds,
            )
        : [],
    };
  }
  private emitUi() {
    if (!this.disposed) this.options.onUi(this.ui());
  }
}
