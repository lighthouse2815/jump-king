import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('player_idle', '/assets/player_idle.svg');
    this.load.image('player_jump', '/assets/player_jump.svg');
    this.load.image('platform', '/assets/platform.svg');
    this.load.image('finish', '/assets/finish.svg');
    this.load.image('bg', '/assets/bg.svg');
  }

  create() {
    // Check registry for next scene
    const nextScene = this.registry.get('nextScene');
    if (nextScene) {
      this.scene.start(nextScene);
    }
  }
}
