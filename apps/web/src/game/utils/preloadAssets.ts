import Phaser from 'phaser';

export function preloadAssets(scene: Phaser.Scene) {
  scene.load.image('player_idle', '/assets/player_idle.svg');
  scene.load.image('player_jump', '/assets/player_jump.svg');
  scene.load.image('platform', '/assets/platform.svg');
  scene.load.image('finish', '/assets/finish.svg');
  scene.load.image('bg', '/assets/bg.svg');
}
