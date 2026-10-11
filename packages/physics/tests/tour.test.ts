import { describe, expect, it } from 'vitest';
import { OriginalAutoplayTour, OriginalSimulation } from '../src';
import {
  CAMPAIGNS,
  ORIGINAL_ADVENTURE,
  ORIGINAL_SCREENS,
  isOriginalFinish,
} from '../../maps/src';

describe('developer tour with real adventure triggers', () => {
  for (const [id, range] of [
    ['original', [0, 45]],
    ['nbp', [46, 100]],
    ['ghost', [101, 168]],
  ] as const)
    it(`visits every ${id} screen, item, NPC, merchant and bird quest`, () => {
      const c = CAMPAIGNS[id];
      const screens = Array.from(
        { length: range[1] - range[0] + 1 },
        (_, index) => range[0] + index,
      );
      const tour = new OriginalAutoplayTour(ORIGINAL_ADVENTURE, screens, {
        screen: c.endScreen,
        x: c.finishX + (id === 'nbp' ? -27 : 9),
        y: c.finishY - 26,
      });
      const sim = new OriginalSimulation(
        ORIGINAL_SCREENS,
        c.spawnX,
        c.spawnY - c.startScreen * 360,
        ORIGINAL_ADVENTURE,
      );
      for (let tick = 0; tick < 200000; tick++) {
        sim.tick(tour.prepare(sim));
        tour.afterTick(sim);
        if (
          tour.finishing &&
          isOriginalFinish(
            id,
            sim.body.position.x,
            sim.body.position.y,
            sim.body.isGrounded,
            sim.screen,
          )
        )
          break;
      }
      const state = sim.adventure!.getState();
      expect(
        isOriginalFinish(
          id,
          sim.body.position.x,
          sim.body.position.y,
          sim.body.isGrounded,
          sim.screen,
        ),
      ).toBe(true);
      expect(screens.every((screen) => tour.visited.has(screen))).toBe(true);
      for (const item of ORIGINAL_ADVENTURE.items.filter(
        (item) => screens.includes(item.screen) && !item.displayOnly,
      ))
        expect(state.collected, item.id).toContain(item.id);
      for (const npc of [
        ...ORIGINAL_ADVENTURE.npcs,
        ...ORIGINAL_ADVENTURE.merchants,
      ].filter((npc) => screens.includes(npc.screen)))
        expect(tour.npcs, npc.name).toContain(npc.name);
      for (const merchant of ORIGINAL_ADVENTURE.merchants.filter((npc) =>
        screens.includes(npc.screen),
      )) {
        expect(state.merchants[merchant.name].sold, merchant.name).toBe(true);
        expect(tour.testedEquipment.has(merchant.item), merchant.item).toBe(
          true,
        );
      }
      for (const bird of ORIGINAL_ADVENTURE.birds.filter((bird) =>
        screens.includes(bird.positions[0].screen),
      ))
        expect(state.birds[bird.name].done, bird.name).toBe(true);
    }, 30000);
});
