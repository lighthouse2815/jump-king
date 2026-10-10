import Phaser from 'phaser';
import { MAP_1 } from '@jump-king/maps';
import { PhysicsWorld, Body, PlayerController, GAME_CONFIG } from '@jump-king/physics';
import { PlayerInputMessage, PlayerState } from '@jump-king/protocol';
import { networkManager } from '../networking/NetworkManager';

import { preloadAssets } from '../utils/preloadAssets';

export class MainScene extends Phaser.Scene {
  private physicsWorld!: PhysicsWorld;
  private localPlayerBody!: Body;
  private localPlayerController!: PlayerController;
  
  // Visuals
  private playerSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private platforms: Phaser.GameObjects.TileSprite[] = [];
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  private network = networkManager;
  private accumulator = 0;
  private inputSeq = 0;
  private pendingInputs: PlayerInputMessage[] = [];

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    preloadAssets(this);
  }

  async create() {
    this.physicsWorld = new PhysicsWorld();
    
    this.add.tileSprite(400, -200, 800, 3000, 'bg').setScrollFactor(0.2, 0.2);
    
    MAP_1.forEach(p => {
      const isFinish = p.y === -250 && p.w === 150;
      this.createPlatform(p.x, p.y, p.w, p.h, isFinish);
    });

                                
    // Connect to server
    // this.network is singleton
    await this.network.connectToCommunityTower();

    if (this.network.room) {
      this.network.room.state.players.onAdd((player: PlayerState, sessionId: string) => {
        this.onPlayerAdd(player, sessionId);
      });
      
      this.network.room.state.players.onRemove((player: PlayerState, sessionId: string) => {
        this.onPlayerRemove(sessionId);
      });
    }

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }
  }

  private onPlayerAdd(player: PlayerState, sessionId: string) {
    const isLocal = sessionId === this.network.sessionId;
    
    // Create visual
    const sprite = this.add.sprite(player.x + 10, player.y + 15, 'player_idle');
    this.playerSprites.set(sessionId, sprite);

    if (isLocal) {
      this.localPlayerBody = new Body(player.x, player.y, 20, 30);
      this.physicsWorld.addBody(this.localPlayerBody);
      this.localPlayerController = new PlayerController(this.localPlayerBody);
      
      this.cameras.main.setBounds(0, -2000, 800, 2600);
      this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
      this.cameras.main.setDeadzone(100, 150);
    } else {
      // Listen for remote state changes
      player.onChange(() => {
        // Simple interpolation or snapping
        // For MVP, just snap to server position
        sprite.setPosition(player.x + 10, player.y + 15);
        
        // Update charge color for remote
        this.updateSpriteState(sprite, player.chargeTicks, player.y, player.direction, false);
      });
    }
  }

  private onPlayerRemove(sessionId: string) {
    const sprite = this.playerSprites.get(sessionId);
    if (sprite) {
      sprite.destroy();
      this.playerSprites.delete(sessionId);
    }
  }

  private createPlatform(x: number, y: number, w: number, h: number, isFinish = false) {
    const body = new Body(x, y, w, h, true);
    this.physicsWorld.addBody(body);
    const tex = isFinish ? 'finish' : 'platform';
    const visual = this.add.tileSprite(x + w/2, y + h/2, w, h, tex);
    this.platforms.push(visual);
  }

  update(time: number, delta: number) {
    if (!this.localPlayerController || !this.network.room) return;

    this.accumulator += delta / 1000;
    const TICK_RATE = 60;
    const TICK_DT = 1 / TICK_RATE;

    while (this.accumulator >= TICK_DT) {
      this.accumulator -= TICK_DT;

      const input = {
        left: this.cursors.left.isDown || this.keyA.isDown,
        right: this.cursors.right.isDown || this.keyD.isDown,
        jump: this.spaceKey.isDown,
        seq: this.inputSeq++
      };

      this.pendingInputs.push(input);
      this.network.sendInput(input);
      this.localPlayerController.tick(input);
      this.physicsWorld.tick();
    }

    // Client Prediction / Reconciliation
    const serverPlayer = this.network.room.state.players.get(this.network.sessionId);
    if (serverPlayer) {
      // Remove acknowledged inputs
      this.pendingInputs = this.pendingInputs.filter(i => i.seq > serverPlayer.lastProcessedInputSeq);

      // Simple positional divergence check to trigger reconciliation
      const dx = Math.abs(serverPlayer.x - this.localPlayerBody.position.x);
      (window as any).debugRecon = (window as any).debugRecon || 0;
      if ((window as any).debugRecon++ % 60 === 0) {
        console.log("SERVER: ", serverPlayer.x, serverPlayer.y, serverPlayer.chargeTicks, serverPlayer.lastProcessedInputSeq);
        console.log("CLIENT BEFORE RECON: ", this.localPlayerBody.position.x, this.localPlayerBody.position.y, this.localPlayerController.chargeTicks, "pending length:", this.pendingInputs.length);
      }
      const dy = Math.abs(serverPlayer.y - this.localPlayerBody.position.y);
      
      // If server and client deviate too much, we reconcile
      // Usually you always snap & replay, but for smoother visuals we snap if diff > threshold
      // Or we can just always snap and replay. Let's do true reconciliation.
      if (dx > 1 || dy > 1 || serverPlayer.chargeTicks !== this.localPlayerController.chargeTicks) {
        // 1. Snap to server state
        this.localPlayerBody.position.x = serverPlayer.x;
        this.localPlayerBody.position.y = serverPlayer.y;
        this.localPlayerBody.velocity.x = serverPlayer.velX;
        this.localPlayerBody.velocity.y = serverPlayer.velY;
        this.localPlayerController.chargeTicks = serverPlayer.chargeTicks;
        this.localPlayerController.direction = serverPlayer.direction as (1 | -1);
        this.localPlayerBody.isGrounded = serverPlayer.isGrounded;
        this.localPlayerController.prevJump = serverPlayer.prevJump;

        // 2. Replay pending inputs
        // Note: this effectively fast-forwards physics for the local player
        // Since we tick physicsWorld, other entities might double-move if not careful,
        // but since bodies only move if they have velocity, and we only set velocity via input,
        // it's mostly fine for this single-player simulation world. 
        // Realistically we should have a separate physics world just for local replay,
        // or just apply manual integration. We'll use the main world but ONLY integrate our body.
        for (const pendingInput of this.pendingInputs) {
           this.localPlayerController.tick(pendingInput);
           this.physicsWorld.tickBody(this.localPlayerBody);
        }
      }
    }

    // Update local sprite visually
    const sprite = this.playerSprites.get(this.network.sessionId);
    if (sprite) {
      sprite.setPosition(
        this.localPlayerBody.position.x + this.localPlayerBody.size.x / 2,
        this.localPlayerBody.position.y + this.localPlayerBody.size.y / 2
      );
      this.updateSpriteState(sprite, this.localPlayerController.chargeTicks, this.localPlayerBody.position.y, this.localPlayerController.direction, true);
    }

  }

  private updateSpriteState(sprite: Phaser.GameObjects.Sprite, chargeTicks: number, y: number, dir: number, isLocal: boolean) {
    sprite.setFlipX(dir === -1);
    
    if (chargeTicks > 0) {
      sprite.setTexture('player_jump');
      const chargeRatio = chargeTicks / 60; // GAME_CONFIG.maxChargeTicks
      const g = Math.floor(255 * (1 - chargeRatio));
      const r = isLocal ? 0 : 255;
      const b = isLocal ? 255 : 0;
      sprite.setTint((r << 16) | (g << 8) | b);
    } else {
      sprite.setTexture('player_idle');
      sprite.clearTint();
      if (!isLocal) {
        sprite.setTint(0xffaaaa);
      }
    }
  }
}