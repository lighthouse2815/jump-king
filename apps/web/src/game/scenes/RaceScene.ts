import Phaser from 'phaser';
import { PhysicsWorld, Body, PlayerController, GAME_CONFIG } from '@jump-king/physics';
import { PlayerInputMessage, PlayerState } from '@jump-king/protocol';
import { NetworkManager } from '../networking/NetworkManager';

export class RaceScene extends Phaser.Scene {
  private physicsWorld!: PhysicsWorld;
  private localPlayerBody!: Body;
  private localPlayerController!: PlayerController;
  
  private playerSprites = new Map<string, Phaser.GameObjects.Rectangle>();
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  private network!: NetworkManager;
  private inputSeq = 0;
  
  private roomId: string = '';
  private setUiState: (state: any) => void = () => {};
  private uiStateRef: any = { status: 'CONNECTING', isReady: false };
  private canMove = false;

  constructor() {
    super({ key: 'RaceScene' });
  }

  setRoomId(id: string, setUiState: (state: any) => void) {
    this.roomId = id;
    this.setUiState = setUiState;
    this.connect();
  }

  toggleReady() {
    this.uiStateRef.isReady = !this.uiStateRef.isReady;
    this.network.sendReady(this.uiStateRef.isReady);
    this.updateReactUi();
  }

  private updateReactUi() {
    this.setUiState({ ...this.uiStateRef });
  }

  async connect() {
    this.network = new NetworkManager();
    const joined = await this.network.joinRaceRoom(this.roomId);
    
    if (joined && this.network.room) {
      this.uiStateRef.status = 'WAITING';
      this.updateReactUi();

      this.network.room.state.listen('status', (newStatus) => {
        this.uiStateRef.status = newStatus;
        this.canMove = newStatus === 'RUNNING';
        this.updateReactUi();
      });

      this.network.room.state.listen('countdown', (val) => {
        this.uiStateRef.countdown = val;
        this.updateReactUi();
      });

      this.network.room.state.players.onAdd((player: PlayerState, sessionId: string) => {
        this.onPlayerAdd(player, sessionId);
      });
      
      this.network.room.state.players.onRemove((player: PlayerState, sessionId: string) => {
        this.onPlayerRemove(sessionId);
      });
    } else {
      this.uiStateRef.status = 'ERROR';
      this.updateReactUi();
    }
  }

  create() {
    this.physicsWorld = new PhysicsWorld();

    this.createPlatform(0, 580, 800, 20); // Ground
    this.createPlatform(300, 450, 200, 20); // Platform 1
    this.createPlatform(100, 300, 150, 20); // Platform 2
    this.createPlatform(500, 150, 200, 20); // Platform 3
    this.createPlatform(300, -50, 150, 20); // Platform 4
    this.createPlatform(100, -250, 150, 20, 0x00ff00); // Finish line

    this.createPlatform(-20, -1000, 20, 1600); // Left wall
    this.createPlatform(800, -1000, 20, 1600); // Right wall

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }
  }

  private onPlayerAdd(player: PlayerState, sessionId: string) {
    const isLocal = sessionId === this.network.sessionId;
    
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
      player.onChange(() => {
        sprite.setPosition(player.x + 10, player.y + 15);
        this.updateSpriteColor(sprite, player.chargeTime, false);
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

  private createPlatform(x: number, y: number, w: number, h: number, color: number = 0x888888) {
    const body = new Body(x, y, w, h, true);
    this.physicsWorld.addBody(body);
    this.add.rectangle(x + w/2, y + h/2, w, h, color);
  }

  update(time: number, delta: number) {
    if (!this.localPlayerController || !this.network?.room) return;

    const dt = delta / 1000;

    const input = {
      left: this.canMove && (this.cursors.left.isDown || this.keyA.isDown),
      right: this.canMove && (this.cursors.right.isDown || this.keyD.isDown),
      jump: this.canMove && this.spaceKey.isDown,
      seq: this.inputSeq++
    };

    if (this.canMove) {
      this.network.sendInput(input);
    }

    this.localPlayerController.update(input, dt);
    this.physicsWorld.step(dt);

    const serverPlayer = this.network.room.state.players.get(this.network.sessionId);
    if (serverPlayer) {
      const dx = Math.abs(serverPlayer.x - this.localPlayerBody.position.x);
      const dy = Math.abs(serverPlayer.y - this.localPlayerBody.position.y);
      // Hard reconciliation
      if (dx > 20 || dy > 20 || !this.canMove) { 
        this.localPlayerBody.position.x = serverPlayer.x;
        this.localPlayerBody.position.y = serverPlayer.y;
      }
    }

    const sprite = this.playerSprites.get(this.network.sessionId);
    if (sprite) {
      sprite.setPosition(
        this.localPlayerBody.position.x + this.localPlayerBody.size.x / 2,
        this.localPlayerBody.position.y + this.localPlayerBody.size.y / 2
      );
      this.updateSpriteColor(sprite, this.localPlayerController.chargeTime, true);
    }
  }

  private updateSpriteColor(sprite: Phaser.GameObjects.Rectangle, chargeTime: number, isLocal: boolean) {
    if (chargeTime > 0) {
      const chargeRatio = chargeTime / GAME_CONFIG.maxChargeTime;
      const g = Math.floor(255 * chargeRatio);
      sprite.setFillStyle(isLocal ? ((0 << 16) | (g << 8) | 255) : ((255 << 16) | (g << 8) | 0));
    } else {
      sprite.setFillStyle(isLocal ? 0x00ffff : 0xff0000);
    }
  }
}
