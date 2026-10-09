import Phaser from 'phaser';
import { MAP_1 } from '@jump-king/maps';
import { PhysicsWorld, Body, PlayerController, GAME_CONFIG } from '@jump-king/physics';
import { PlayerInputMessage, PlayerState } from '@jump-king/protocol';
import { NetworkManager } from '../networking/NetworkManager';

export class MainScene extends Phaser.Scene {
  private physicsWorld!: PhysicsWorld;
  private localPlayerBody!: Body;
  private localPlayerController!: PlayerController;
  
  // Visuals
  private playerSprites = new Map<string, Phaser.GameObjects.Rectangle>();
  private platforms: Phaser.GameObjects.Rectangle[] = [];
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  private network!: NetworkManager;
  private accumulator = 0;
  private inputSeq = 0;

  constructor() {
    super({ key: 'MainScene' });
  }

  async create() {
    this.physicsWorld = new PhysicsWorld();
    MAP_1.forEach(p => this.createPlatform(p.x, p.y, p.w, p.h));

                                
    // Connect to server
    this.network = new NetworkManager();
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
    const sprite = this.add.rectangle(
      player.x + 10,
      player.y + 15,
      20,
      30,
      isLocal ? 0x00ffff : 0xff0000
    );
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
        this.updateSpriteColor(sprite, player.chargeTicks, false);
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

  private createPlatform(x: number, y: number, w: number, h: number) {
    const body = new Body(x, y, w, h, true);
    this.physicsWorld.addBody(body);
    const visual = this.add.rectangle(x + w/2, y + h/2, w, h, 0x00ff00);
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

      this.network.sendInput(input);
      this.localPlayerController.tick(input);
      this.physicsWorld.tick();
    }

    // Server reconciliation (simplified for now, runs after local ticks)
    const serverPlayer = this.network.room.state.players.get(this.network.sessionId);
    if (serverPlayer) {
      const dx = Math.abs(serverPlayer.x - this.localPlayerBody.position.x);
      const dy = Math.abs(serverPlayer.y - this.localPlayerBody.position.y);
      if (dx > 20 || dy > 20) {
        this.localPlayerBody.position.x = serverPlayer.x;
        this.localPlayerBody.position.y = serverPlayer.y;
      }
    }

    // Update local sprite visually
    const sprite = this.playerSprites.get(this.network.sessionId);
    if (sprite) {
      sprite.setPosition(
        this.localPlayerBody.position.x + this.localPlayerBody.size.x / 2,
        this.localPlayerBody.position.y + this.localPlayerBody.size.y / 2
      );
      this.updateSpriteColor(sprite, this.localPlayerController.chargeTicks, true);
    }
  }

  private updateSpriteColor(sprite: Phaser.GameObjects.Rectangle, chargeTicks: number, isLocal: boolean) {
    if (chargeTicks > 0) {
      const chargeRatio = chargeTicks / GAME_CONFIG.maxChargeTicks;
      const g = Math.floor(255 * chargeRatio);
      sprite.setFillStyle(isLocal ? ((0 << 16) | (g << 8) | 255) : ((255 << 16) | (g << 8) | 0));
    } else {
      sprite.setFillStyle(isLocal ? 0x00ffff : 0xff0000);
    }
  }
}
