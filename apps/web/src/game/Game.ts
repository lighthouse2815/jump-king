import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-game',
  width: 800,
  height: 600,
  scene: [MainScene],
  // We use our own custom physics engine, so we don't strictly need Arcade physics, 
  // but we can enable it for debug rendering or simple raycasts if needed. 
  // We will primarily rely on @jump-king/physics.
  pixelArt: true,
  backgroundColor: '#1a1a2e',
};
