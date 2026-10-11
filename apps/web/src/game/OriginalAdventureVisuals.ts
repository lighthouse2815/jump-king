import Phaser from 'phaser';
import { ORIGINAL_ADVENTURE } from '@jump-king/maps';
import { OriginalAdventure, OriginalWorldEvent } from '@jump-king/physics';
import { OriginalManifest } from './originalAssets';

const layers = ['Cape', 'Boots', 'Shirt', 'SnakeRing', 'Hat'];
const frames = [
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

export class OriginalAdventureVisuals {
  private items = new Map<string, Phaser.GameObjects.Image>();
  private birds = new Map<string, Phaser.GameObjects.Sprite>();
  private costumes = new Map<string, Map<string, Phaser.GameObjects.Sprite>>();
  private lightning: Phaser.GameObjects.Rectangle;
  private gargoyles: {
    sprite: Phaser.GameObjects.Sprite;
    age: number;
    delay: number;
    speed: number;
    base: number;
    acceleration: number;
  }[] = [];
  constructor(
    private scene: Phaser.Scene,
    private manifest: OriginalManifest,
  ) {
    this.lightning = scene.add
      .rectangle(0, 0, 480, 360, 0xffffff)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(60)
      .setAlpha(0);
    for (const skin of ORIGINAL_ADVENTURE.skins) {
      const texture = scene.textures.get(skin.texture);
      frames.forEach((name, i) => {
        if (!texture.has(name))
          texture.add(
            name,
            0,
            224 + (i % 4) * 48,
            Math.floor(i / 4) * 48,
            48,
            48,
          );
      });
    }
    for (const bird of ORIGINAL_ADVENTURE.birds) {
      const texture = scene.textures.get(bird.texture);
      for (let i = 0; i < 8; i++)
        if (!texture.has(`idle:${i}`))
          texture.add(
            `idle:${i}`,
            0,
            (i % 4) * 32,
            Math.floor(i / 4) * 32,
            32,
            32,
          );
      for (let i = 0; i < 9; i++)
        if (!texture.has(`fly:${i}`))
          texture.add(
            `fly:${i}`,
            0,
            (i % 3) * 48,
            64 + Math.floor(i / 3) * 32,
            48,
            32,
          );
    }
  }
  sync(adventure: OriginalAdventure, screen: number, ticks: number) {
    const wanted = new Set<string>();
    for (const item of adventure.getWorldItems()) {
      if (
        item.invisible ||
        item.screen !== screen ||
        !this.scene.textures.exists(item.texture)
      )
        continue;
      wanted.add(item.id);
      if (!this.items.has(item.id))
        this.items.set(
          item.id,
          this.scene.add
            .image(item.x, item.y - screen * 360, item.texture)
            .setOrigin(0.5, 1)
            .setDepth(9),
        );
    }
    for (const [id, image] of this.items)
      if (!wanted.has(id)) {
        image.destroy();
        this.items.delete(id);
      }
    const state = adventure.getState();
    for (const bird of ORIGINAL_ADVENTURE.birds) {
      const current = state.birds[bird.name],
        perch = bird.positions[current.index];
      let sprite = this.birds.get(bird.name);
      if (!sprite) {
        sprite = this.scene.add
          .sprite(0, 0, bird.texture, 'idle:0')
          .setOrigin(0.5)
          .setDepth(9);
        this.birds.set(bird.name, sprite);
      }
      sprite
        .setVisible(!current.done && perch.screen === screen)
        .setPosition(current.x, current.y)
        .setFlipX((current.flying ? perch.flyDirection : perch.direction) < 0);
      sprite.setFrame(
        current.flying
          ? `fly:${(perch.treasure ? (current.vy > 0 ? 6 : 3) : 0) + (Math.floor(current.ticks / 6) % 3)}`
          : `idle:${(perch.treasure ? 4 : 0) + [0, 2, 3][Math.floor(ticks / 12) % 3]}`,
      );
    }
  }
  dress(
    id: string,
    player: Phaser.GameObjects.Sprite,
    equipped: readonly string[],
  ) {
    let costume = this.costumes.get(id);
    if (!costume) {
      costume = new Map();
      this.costumes.set(id, costume);
    }
    const skins = ORIGINAL_ADVENTURE.skins
      .filter((skin) => equipped.includes(skin.item))
      .sort((a, b) => layers.indexOf(a.layer) - layers.indexOf(b.layer));
    for (const [item, sprite] of costume)
      if (!equipped.includes(item)) {
        sprite.destroy();
        costume.delete(item);
      }
    for (const [index, skin] of skins.entries()) {
      let sprite = costume.get(skin.item);
      if (!sprite) {
        sprite = this.scene.add
          .sprite(0, 0, skin.texture, 'idle')
          .setOrigin(0.5, 1);
        costume.set(skin.item, sprite);
      }
      sprite
        .setPosition(player.x, player.y)
        .setFrame(player.frame.name)
        .setFlipX(player.flipX)
        .setDepth(player.depth + (index + 1) / 10)
        .setVisible(player.visible)
        .setAlpha(player.alpha);
    }
  }
  removePlayer(id: string) {
    this.costumes.get(id)?.forEach((sprite) => sprite.destroy());
    this.costumes.delete(id);
  }
  get playerLayers() {
    return [...(this.costumes.get('self')?.values() || [])];
  }
  event(event: OriginalWorldEvent) {
    if (event.type === 'lightning') this.lightning.setAlpha(event.alpha);
    if (event.type !== 'gargoyles') return;
    const texture = this.scene.textures.get(event.texture),
      info = this.manifest.textures[event.texture];
    for (let i = 0; i < 3; i++)
      if (!texture.has(String(i)))
        texture.add(
          String(i),
          0,
          0,
          (i * info.height) / 3,
          info.width,
          info.height / 3,
        );
    for (const spawn of event.spawns)
      this.gargoyles.push({
        sprite: this.scene.add
          .sprite(spawn.x, spawn.y, event.texture, '0')
          .setOrigin(0.5, 0)
          .setFlipX(spawn.flipped)
          .setDepth(8)
          .setVisible(false),
        age: 0,
        delay: spawn.delaySeconds,
        speed: 0,
        base: event.baseSpeed,
        acceleration: event.acceleration,
      });
  }
  tick() {
    this.gargoyles = this.gargoyles.filter((gargoyle) => {
      gargoyle.age += 1 / 60;
      if (gargoyle.age < gargoyle.delay) return true;
      gargoyle.speed += gargoyle.acceleration / 60;
      gargoyle.sprite
        .setVisible(true)
        .setY(gargoyle.sprite.y - gargoyle.speed - gargoyle.base)
        .setFrame(String(Math.floor(gargoyle.age / 0.1) % 3));
      if (gargoyle.sprite.y < -147 * 360 - 64) {
        gargoyle.sprite.destroy();
        return false;
      }
      return true;
    });
  }
  destroy() {
    this.items.forEach((sprite) => sprite.destroy());
    this.birds.forEach((sprite) => sprite.destroy());
    for (const id of this.costumes.keys()) this.removePlayer(id);
    this.gargoyles.forEach((gargoyle) => gargoyle.sprite.destroy());
    this.lightning.destroy();
  }
}
