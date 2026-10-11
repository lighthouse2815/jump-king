import { describe, expect, it } from 'vitest';
import { OriginalSimulation } from '../src/OriginalSimulation';
import { OriginalAdventure } from '../src/OriginalAdventure';
import { ORIGINAL_SCREENS, ORIGINAL_ADVENTURE } from '../../maps/src';

const idle = { left: false, right: false, jump: false };
const flat = [
  {
    tiles: Array.from({ length: 45 }, (_, row) =>
      row >= 41 ? '#'.repeat(60) : ' '.repeat(60),
    ),
    wind: false,
    teleport: -1,
  },
];
const create = (x = 231, y = 302, screens = ORIGINAL_SCREENS) =>
  new OriginalSimulation(screens, x, y, ORIGINAL_ADVENTURE);

describe('original adventure through the shared simulation', () => {
  it('collects the original Cap once and preserves collection after restoring', () => {
    const sim = create(312, 132 - 5 * 360);
    sim.tick(idle);
    expect(sim.getState().adventure?.inventory.Cap).toBe(1);
    expect(sim.getState().adventure?.equipped).toContain('Cap');
    const restored = create();
    restored.restore(JSON.parse(JSON.stringify(sim.getState())));
    restored.tick(idle);
    expect(restored.getState().adventure?.inventory.Cap).toBe(1);
  });

  it('keeps the displayed Giant Boots until the merchant sells them', () => {
    const sim = create(116, 110 - 70 * 360);
    sim.tick(idle);
    expect(sim.getState().adventure).toBeDefined();
    expect(sim.getState().adventure?.inventory.GiantBoots || 0).toBe(0);
  });

  it('rejects equipping an item that the player has not acquired', () => {
    const sim = create();
    expect(sim.adventure?.setEquipped('SnakeRing', true)).toBe(false);
    expect(sim.getState().adventure?.equipped).not.toContain('SnakeRing');
  });

  it('Giant Boots prevent walking while allowing a charged directional jump', () => {
    const sim = create(231, 302, flat);
    const state = sim.getState();
    sim.restore({
      ...state,
      adventure: {
        ...state.adventure!,
        inventory: { GiantBoots: 1 },
        equipped: ['GiantBoots'],
      },
    });
    for (let i = 0; i < 30; i++) sim.tick({ ...idle, right: true });
    expect(sim.body.position.x).toBe(231);
    for (let i = 0; i < 36; i++) sim.tick({ ...idle, right: true, jump: true });
    expect(sim.jumps).toBe(1);
    expect(sim.body.velocity.x).toBe(3.5);
  });

  it('Snake Ring makes normal ground slippery and survives snapshot reconciliation', () => {
    const sim = create(231, 302, flat);
    const state = sim.getState();
    sim.restore({
      ...state,
      adventure: {
        ...state.adventure!,
        inventory: { SnakeRing: 1 },
        equipped: ['SnakeRing'],
      },
    });
    for (let i = 0; i < 30; i++) sim.tick({ ...idle, right: true });
    const x = sim.body.position.x;
    sim.tick(idle);
    expect(sim.body.position.x).toBeGreaterThan(x);
    expect(sim.onIce).toBe(true);
    const restored = create(231, 302, flat);
    restored.restore(JSON.parse(JSON.stringify(sim.getState())));
    sim.tick(idle);
    restored.tick(idle);
    expect(restored.getState()).toEqual(sim.getState());
  });

  it('never sells Shoes without payment and trades once after the original dialogue', () => {
    const adventure = new OriginalAdventure(ORIGINAL_ADVENTURE);
    const player = {
      ...create().getState(),
      x: 40,
      y: 278 - 14 * 360,
      screen: 14,
    };
    for (let i = 0; i < 20000; i++) adventure.tick(player);
    expect(adventure.inventory.Shoes || 0).toBe(0);
    adventure.add('GoldRing');
    for (let i = 0; i < 20000; i++) adventure.tick(player);
    expect(adventure.inventory.Shoes).toBe(1);
    expect(adventure.inventory.GoldRing).toBe(0);
    expect(adventure.equipped).toContain('Shoes');
    expect(adventure.getState().flags).toContain('PURCHASE_SHOES');
    for (let i = 0; i < 20000; i++) adventure.tick(player);
    expect(adventure.inventory.Shoes).toBe(1);
  });

  it('preserves the original increasing merchant price across a save', () => {
    const original = new OriginalAdventure(ORIGINAL_ADVENTURE);
    original.add('GoldRing');
    original.add('GoldRing');
    const newRun = new OriginalAdventure(ORIGINAL_ADVENTURE, {
      ...original.getState(),
      merchants: {},
    });
    expect(newRun.getState().merchants.merchant.price).toBe(3);
    original.restore(newRun.getState());
    expect(original.getState().merchants.merchant.price).toBe(3);
  });

  it('replaces the hat layer without removing the separately equipped ring', () => {
    const adventure = new OriginalAdventure(ORIGINAL_ADVENTURE);
    adventure.add('SnakeRing');
    adventure.add('Cap');
    adventure.add('Crown');
    expect(adventure.equipped).toEqual(['SnakeRing', 'Crown']);
    expect(adventure.setEquipped('Crown', false)).toBe(true);
    expect(adventure.equipped).toEqual(['SnakeRing']);
  });

  it('chases the raven along the original positions and drops its ring only at the final perch', () => {
    const adventure = new OriginalAdventure(ORIGINAL_ADVENTURE);
    const bird = ORIGINAL_ADVENTURE.birds.find(
      (bird) => bird.name === 'raven',
    )!;
    const base = create().getState();
    for (let i = 0; i < bird.positions.length - 1; i++) {
      const pos = bird.positions[i];
      const player = {
        ...base,
        x: pos.x - 9,
        y: pos.y - pos.screen * 360 - 13,
        screen: pos.screen,
      };
      for (let tick = 0; tick < 120; tick++) adventure.tick(player);
      expect(adventure.getState().birds.raven.index).toBe(i + 1);
      expect(
        adventure.getWorldItems().some((item) => item.item === 'GoldRing'),
      ).toBe(i === bird.positions.length - 2);
    }
    const ring = adventure
      .getWorldItems()
      .find((item) => item.item === 'GoldRing')!;
    adventure.tick({
      ...base,
      x: ring.x - 9,
      y: ring.y - ring.screen * 360 - 13,
      screen: ring.screen,
    });
    expect(adventure.inventory.GoldRing).toBe(1);
    expect(adventure.getState().flags).toContain('CHASE_BIRD_PAST_SNOWSTORM');
  });
});
