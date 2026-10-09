import Phaser from 'phaser';
import { PhysicsWorld, Body, PlayerController, GAME_CONFIG } from '@jump-king/physics';

export class MainScene extends Phaser.Scene {
  private physicsWorld!: PhysicsWorld;
  private playerBody!: Body;
  private playerController!: PlayerController;
  private playerSprite!: Phaser.GameObjects.Rectangle;
  
  private platforms: Phaser.GameObjects.Rectangle[] = [];
  
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    this.physicsWorld = new PhysicsWorld();

    // Setup Map (Static Bodies)
    // We will create a simple tower for testing offline mechanics
    this.createPlatform(0, 580, 800, 20); // Ground
    this.createPlatform(300, 450, 200, 20); // Platform 1
    this.createPlatform(100, 300, 150, 20); // Platform 2
    this.createPlatform(500, 150, 200, 20); // Platform 3
    this.createPlatform(300, -50, 150, 20); // Platform 4
    this.createPlatform(100, -250, 150, 20); // Platform 5

    // Walls
    this.createPlatform(-20, -1000, 20, 1600); // Left wall
    this.createPlatform(800, -1000, 20, 1600); // Right wall

    // Setup Player
    this.playerBody = new Body(400, 500, 20, 30);
    this.physicsWorld.addBody(this.playerBody);
    this.playerController = new PlayerController(this.playerBody);

    this.playerSprite = this.add.rectangle(
      this.playerBody.position.x + this.playerBody.size.x / 2,
      this.playerBody.position.y + this.playerBody.size.y / 2,
      this.playerBody.size.x,
      this.playerBody.size.y,
      0xff0000
    );

    // Camera
    this.cameras.main.setBounds(0, -2000, 800, 2600);
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(100, 150);

    // Inputs
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }
  }

  private createPlatform(x: number, y: number, w: number, h: number) {
    const body = new Body(x, y, w, h, true);
    this.physicsWorld.addBody(body);
    
    // Add visual
    const visual = this.add.rectangle(x + w/2, y + h/2, w, h, 0x00ff00);
    this.platforms.push(visual);
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;

    const input = {
      left: this.cursors.left.isDown || this.keyA.isDown,
      right: this.cursors.right.isDown || this.keyD.isDown,
      jump: this.spaceKey.isDown
    };

    // 1. Update controller
    this.playerController.update(input, dt);

    // 2. Step physics
    this.physicsWorld.step(dt);

    // 3. Sync visual
    // The visual rectangle is centered, but our body position is top-left
    this.playerSprite.setPosition(
      this.playerBody.position.x + this.playerBody.size.x / 2,
      this.playerBody.position.y + this.playerBody.size.y / 2
    );

    // Update jump charge visual
    if (this.playerController.chargeTime > 0) {
      const chargeRatio = this.playerController.chargeTime / GAME_CONFIG.maxChargeTime;
      // Fade color to yellow based on charge
      const r = 255;
      const g = Math.floor(255 * chargeRatio);
      const b = 0;
      this.playerSprite.setFillStyle((r << 16) | (g << 8) | b);
    } else {
      this.playerSprite.setFillStyle(0xff0000);
    }
    
    // Simple vertical follow logic (Jump King style vertical screen transitions if we don't do smooth follow)
    // Currently we use smooth follow, which is acceptable, but Jump King usually locks camera to current screen.
    // We'll stick to smooth follow with deadzone for now as a better default for online multiplayer.
  }
}
