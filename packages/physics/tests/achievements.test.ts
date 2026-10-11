import { describe, expect, it } from 'vitest';
import {
  OriginalSimulation,
  type OriginalState,
} from '../src/OriginalSimulation';
import { ORIGINAL_SCREENS } from '../../maps/src';
import {
  ORIGINAL_ACHIEVEMENTS,
  createOriginalAchievementProgress,
  evaluateOriginalAchievements,
  type OriginalAchievementContext,
  type OriginalAchievementProgress,
} from '../src/OriginalAchievements';

const initialState = new OriginalSimulation(ORIGINAL_SCREENS).getState();
const state = (changes: Partial<OriginalState> = {}): OriginalState => ({
  ...initialState,
  ...changes,
});
const context = (
  changes: Partial<OriginalAchievementContext> = {},
): OriginalAchievementContext => ({
  campaign: 'original',
  completed: false,
  ...changes,
});
const evaluate = (
  changes: Partial<OriginalState> = {},
  ctx: Partial<OriginalAchievementContext> = {},
  progress = createOriginalAchievementProgress(),
) => evaluateOriginalAchievements(state(changes), progress, context(ctx));
const at = (screen: number, x = 231, y = 100) =>
  state({ screen, x, y: y - screen * 360 });

describe('original lifetime statistics and saved progress', () => {
  it.each([
    [999, []],
    [1000, ['JUMP_1000']],
    [9999, ['JUMP_1000']],
    [10000, ['JUMP_1000', 'JUMP_10000']],
    [19999, ['JUMP_1000', 'JUMP_10000']],
    [20000, ['JUMP_1000', 'JUMP_10000', 'JUMP_100000']],
  ])('checks original jump thresholds at %i jumps', (jumps, expected) => {
    expect(evaluate({ jumps }).newlyUnlocked).toEqual(expected);
  });

  it.each([
    [99, []],
    [100, ['FALL_100']],
    [999, ['FALL_100']],
    [1000, ['FALL_100', 'FALL_1000']],
  ])('replays splat milestones at %i falls', (falls, expected) => {
    expect(evaluate({ falls }).newlyUnlocked).toEqual(expected);
  });

  it('does not count descending motion or repeated splat frames as new falls', () => {
    expect(
      evaluate({ vy: 10, grounded: false, splat: 0 }).progress.totals.falls,
    ).toBe(0);
    const first = evaluate({ falls: 99, splat: 30 });
    const repeat = evaluate({ falls: 99, splat: 29 }, {}, first.progress);
    expect(repeat.progress.totals.falls).toBe(99);
    expect(repeat.newlyUnlocked).toEqual([]);
    expect(
      evaluate({ falls: 100, splat: 30 }, {}, repeat.progress).newlyUnlocked,
    ).toEqual(['FALL_100']);
  });

  it('unlocks one splat milestone from real simulation ticks through the landing animation', () => {
    const simulation = new OriginalSimulation(ORIGINAL_SCREENS, 240, 100);
    simulation.body.isGrounded = false;
    simulation.body.velocity.y = 10;
    let progress = createOriginalAchievementProgress();
    progress.totals.falls = 99;
    const unlocked: string[] = [];
    for (let tick = 0; tick < 60; tick++) {
      simulation.tick({ left: false, right: false, jump: false });
      const result = evaluateOriginalAchievements(
        simulation.getState(),
        progress,
        context(),
      );
      progress = result.progress;
      unlocked.push(...result.newlyUnlocked);
    }
    expect(unlocked).toEqual(['FALL_100']);
    expect(progress.totals.falls).toBe(100);
  });

  it('counts the actual jump release once instead of counting held charge frames', () => {
    const simulation = new OriginalSimulation(ORIGINAL_SCREENS);
    let progress = createOriginalAchievementProgress();
    progress.totals.jumps = 999;
    const unlocked: string[] = [];
    for (let tick = 0; tick < 36; tick++) {
      simulation.tick({ left: false, right: false, jump: true });
      const result = evaluateOriginalAchievements(
        simulation.getState(),
        progress,
        context(),
      );
      progress = result.progress;
      unlocked.push(...result.newlyUnlocked);
      if (tick < 35) expect(unlocked).toEqual([]);
    }
    expect(unlocked).toEqual(['JUMP_1000']);
    expect(progress.totals.jumps).toBe(1000);
  });

  it('accumulates separate attempts without counting unchanged snapshots twice', () => {
    const first = evaluate(
      { jumps: 600, falls: 60, ticks: 1200 },
      { runId: 'a' },
    );
    const second = evaluate(
      { jumps: 400, falls: 40, ticks: 800 },
      { runId: 'b' },
      first.progress,
    );
    expect(second.newlyUnlocked).toEqual(['FALL_100', 'JUMP_1000']);
    expect(second.progress.totals).toEqual({
      jumps: 1000,
      falls: 100,
      ticks: 2000,
    });
    expect(
      evaluate(
        { jumps: 400, falls: 40, ticks: 800 },
        { runId: 'b' },
        second.progress,
      ).progress,
    ).toEqual(second.progress);
  });

  it('recognizes counter resets and campaign changes when no run id is provided', () => {
    const first = evaluate({ jumps: 600, ticks: 100 });
    const reset = evaluate({}, {}, first.progress);
    const next = evaluate({ jumps: 400 }, { campaign: 'nbp' }, reset.progress);
    expect(next.newlyUnlocked).toEqual(['JUMP_1000']);
  });

  it('does not recount old snapshots within an explicitly identified attempt', () => {
    const first = evaluate(
      { jumps: 600, falls: 60, ticks: 1200 },
      { runId: 'a' },
    );
    const older = evaluate(
      { jumps: 500, falls: 50, ticks: 1000 },
      { runId: 'a' },
      first.progress,
    );
    expect(older.progress.totals).toEqual({
      jumps: 600,
      falls: 60,
      ticks: 1200,
    });
    const restored = evaluate(
      { jumps: 600, falls: 60, ticks: 1200 },
      { runId: 'a' },
      older.progress,
    );
    expect(restored.progress.totals).toEqual(first.progress.totals);
  });

  it('returns new JSON progress without mutating state, context, or prior progress', () => {
    const player = Object.freeze(state({ jumps: 1000 }));
    const prior = Object.freeze(createOriginalAchievementProgress());
    const ctx = Object.freeze(context());
    const result = evaluateOriginalAchievements(player, prior, ctx);
    expect(prior.unlocked).toEqual([]);
    expect(result.progress).not.toBe(prior);
    const restored: OriginalAchievementProgress = JSON.parse(
      JSON.stringify(result.progress),
    );
    expect(
      evaluateOriginalAchievements(player, restored, ctx).newlyUnlocked,
    ).toEqual([]);
    expect(
      result.newlyUnlocked.every((id) => id in ORIGINAL_ACHIEVEMENTS),
    ).toBe(true);
  });
});

describe('original victory conditions', () => {
  it.each([
    ['original', 53999, ['WIN', 'WIN_TIME_60', 'WIN_TIME_15']],
    ['original', 54000, ['WIN', 'WIN_TIME_60']],
    ['original', 215999, ['WIN', 'WIN_TIME_60']],
    ['original', 216000, ['WIN']],
    ['ghost', 107999, ['WIN_OWL', 'WIN_TIME_60_OWL', 'WIN_TIME_30_OWL']],
    ['ghost', 108000, ['WIN_OWL', 'WIN_TIME_60_OWL']],
    ['ghost', 215999, ['WIN_OWL', 'WIN_TIME_60_OWL']],
    ['ghost', 216000, ['WIN_OWL']],
    ['nbp', 1, ['WIN_NBP']],
  ] as const)(
    'uses strict speedrun limits for %s at %i ticks',
    (campaign, ticks, expected) => {
      expect(
        evaluate(
          { ticks, falls: 1 },
          { campaign, completed: true },
        ).newlyUnlocked.sort(),
      ).toEqual([...expected].sort());
    },
  );

  it.each([
    ['original', 0, 'WIN_NO_FALLS', true],
    ['original', 1, 'WIN_NO_FALLS', false],
    ['nbp', 0, 'WIN_NBP_NO_FALLS', true],
    ['nbp', 1, 'WIN_NBP_NO_FALLS', false],
    ['ghost', 0, 'WIN_OWL_2_FALL', false],
    ['ghost', 1, 'WIN_OWL_2_FALL', false],
    ['ghost', 2, 'WIN_OWL_2_FALL', true],
    ['ghost', 3, 'WIN_OWL_2_FALL', false],
  ] as const)(
    'checks %s finishing with %i splats',
    (campaign, falls, id, expected) => {
      expect(
        evaluate(
          { falls },
          { campaign, completed: true },
        ).newlyUnlocked.includes(id),
      ).toBe(expected);
    },
  );

  it('uses current attempt time and splats rather than lifetime totals on victory', () => {
    const previous = evaluate({ ticks: 216000, falls: 100 }, { runId: 'old' });
    const next = evaluate(
      { ticks: 100 },
      { runId: 'new', completed: true },
      previous.progress,
    );
    expect(next.newlyUnlocked).toEqual([
      'WIN',
      'WIN_TIME_60',
      'WIN_TIME_15',
      'WIN_NO_FALLS',
    ]);
  });

  it('requires a victory event and processes a given victory only once', () => {
    expect(
      evaluate({ screen: 42 }, { equipped: ['Crown', 'Shoes'] }).newlyUnlocked,
    ).toEqual([]);
    const first = evaluate({}, { completed: true });
    const repeat = evaluate(
      {},
      { completed: true, equipped: ['Crown', 'Shoes'] },
      first.progress,
    );
    expect(repeat.newlyUnlocked).toEqual([]);
  });

  it('does not mistake the end of a victory event for a new attempt', () => {
    const won = evaluate({ ticks: 100, jumps: 10 }, { completed: true });
    const afterEvent = evaluate(
      { ticks: 100, jumps: 10 },
      { completed: false },
      won.progress,
    );
    expect(afterEvent.progress.totals).toEqual({
      ticks: 100,
      jumps: 10,
      falls: 0,
    });
    expect(
      evaluate(
        { ticks: 100, jumps: 10 },
        { completed: true, equipped: ['Crown'] },
        afterEvent.progress,
      ).newlyUnlocked,
    ).toEqual([]);
  });

  it.each(['original', 'nbp', 'ghost'] as const)(
    'allows the original Crown and Shoes finish conditions in %s',
    (campaign) => {
      const result = evaluate(
        {},
        { campaign, completed: true, equipped: ['Crown', 'Shoes'] },
      );
      expect(result.newlyUnlocked).toContain('WIN_WITH_CROWN');
      expect(result.newlyUnlocked).toContain('WIN_WITH_SHOES');
      const otherCrowns = evaluate(
        {},
        { campaign, completed: true, equipped: ['CrownNBP', 'CrownOwl'] },
      );
      expect(otherCrowns.newlyUnlocked).not.toContain('WIN_WITH_CROWN');
    },
  );

  it.each([1, 2, 3])(
    'requires exactly two raven home changes at normal victory: %i',
    (home_screen) => {
      const result = evaluate(
        {},
        {
          completed: true,
          birdStates: { raven: { home_screen, is_done: false } },
        },
      );
      expect(result.newlyUnlocked.includes('WIN_TOUCH_CROW_2')).toBe(
        home_screen === 2,
      );
    },
  );
});

describe('equipped items and full-run tracking', () => {
  it.each([
    [['GiantBoots', 'SnakeRing'], ['WEAR_GIANTBOOTS_AND_ICERING']],
    [
      ['Tunic', 'YellowShoes', 'GnomeHat'],
      ['WEAR_TUNIC_YELLOWSHOES_AND_GNOMEHAT', 'GET_GNOME_HAT'],
    ],
    [['Shoes', 'SnakeRing', 'CapeOwl'], ['WEAR_SHOES_RING_AND_OWLCAPE']],
    [['GnomeHat'], ['GET_GNOME_HAT']],
  ])('checks actual equipped combination %j', (equipped, expected) => {
    expect(evaluate({}, { equipped }).newlyUnlocked.sort()).toEqual(
      [...expected].sort(),
    );
    for (const removed of equipped) {
      const partial = evaluate(
        {},
        { equipped: equipped.filter((item) => item !== removed) },
      );
      for (const id of expected.filter((id) => id !== 'GET_GNOME_HAT')) {
        expect(partial.newlyUnlocked).not.toContain(id);
      }
    }
  });

  it('does not treat owning an item as equipping or buying it', () => {
    expect(
      evaluate(
        {},
        { inventory: { Shoes: 1, GnomeHat: 1, GiantBoots: 1, SnakeRing: 1 } },
      ).newlyUnlocked,
    ).toEqual([]);
  });

  it.each([
    ['original', 'WIN_GIANTBOOTS_REGULAR', 'WIN_ICERING_REGULAR'],
    ['nbp', 'WIN_GIANTBOOTS_NBP', 'WIN_ICERING_NPB'],
    ['ghost', 'WIN_GIANTBOOTS_OWL', 'WIN_ICERING_OWL'],
  ] as const)(
    'tracks continuous wearing through the %s finish',
    (campaign, boots, ring) => {
      const equipped = ['GiantBoots', 'SnakeRing'];
      const start = evaluate({}, { campaign, equipped });
      const finish = evaluate(
        { screen: 42, ticks: 100 },
        { campaign, completed: true, equipped },
        start.progress,
      );
      expect(finish.newlyUnlocked).toContain(boots);
      expect(finish.newlyUnlocked).toContain(ring);
      const removed = evaluate(
        { screen: 1, ticks: 10 },
        { campaign, equipped: ['GiantBoots'] },
        start.progress,
      );
      const reequipped = evaluate(
        { screen: 42, ticks: 100 },
        { campaign, completed: true, equipped },
        removed.progress,
      );
      expect(reequipped.newlyUnlocked).toContain(boots);
      expect(reequipped.newlyUnlocked).not.toContain(ring);
    },
  );

  it('requalifies full-run gear only on the original global screen zero', () => {
    const equipped = ['GiantBoots', 'SnakeRing'];
    const start = evaluate({}, { equipped });
    const removed = evaluate({ screen: 1, ticks: 10 }, {}, start.progress);
    const returned = evaluate(
      { screen: 0, ticks: 20 },
      { equipped },
      removed.progress,
    );
    expect(
      evaluate(
        { screen: 42, ticks: 30 },
        { equipped, completed: true },
        returned.progress,
      ).newlyUnlocked,
    ).toContain('WIN_ICERING_REGULAR');
    expect(
      evaluate({ screen: 46 }, { campaign: 'nbp', equipped, completed: true })
        .newlyUnlocked,
    ).not.toContain('WIN_ICERING_NPB');
  });

  it('accepts verified FullRunSave flags when importing an already running game', () => {
    const result = evaluate(
      { screen: 99 },
      {
        campaign: 'nbp',
        completed: true,
        equipped: ['GiantBoots', 'SnakeRing'],
        fullRun: { wear_giant_boots: true, wear_snake_ring: true },
      },
    );
    expect(result.newlyUnlocked).toContain('WIN_GIANTBOOTS_NBP');
    expect(result.newlyUnlocked).toContain('WIN_ICERING_NPB');
  });
});

describe('XML achievement regions', () => {
  it.each([
    [32, 100, 100, 'REACH_CATHEDRAL'],
    [44, 100, 100, 'FIND_IMP_ROOM'],
    [89, 100, 100, 'REACH_SEA'],
    [70, 72, 280, 'FIND_NOSE'],
  ] as const)(
    'uses the world hitbox on zero-based screen %i',
    (screen, x, y, id) => {
      const result = evaluateOriginalAchievements(
        at(screen, x, y),
        createOriginalAchievementProgress(),
        context(),
      );
      expect(result.newlyUnlocked).toContain(id);
      expect(
        evaluateOriginalAchievements(
          at(screen + 1, x, y),
          createOriginalAchievementProgress(),
          context(),
        ).newlyUnlocked,
      ).not.toContain(id);
    },
  );

  it.each([
    [54, 280, false],
    [55, 280, true],
    [85, 280, false],
    [72, 254, false],
    [72, 255, true],
    [72, 288, false],
    [54.9, 280, false],
  ])(
    'uses strict integer rectangle overlap for the nose at (%f,%i)',
    (x, y, touches) => {
      const result = evaluateOriginalAchievements(
        at(70, x, y),
        createOriginalAchievementProgress(),
        context(),
      );
      expect(result.newlyUnlocked.includes('FIND_NOSE')).toBe(touches);
    },
  );

  it('does not unlock the sea from the lower half of the ocean screen', () => {
    expect(
      evaluateOriginalAchievements(
        at(89, 100, 160),
        createOriginalAchievementProgress(),
        context(),
      ).newlyUnlocked,
    ).not.toContain('REACH_SEA');
  });

  it.each([
    [5, 303, 95],
    [6, 303, 223],
    [6, 288, 119],
    [6, 336, 63],
    [6, 351, 48],
    [6, 382, 47],
    [6, 167, 0],
    [7, 240, 303],
    [7, 240, 320],
    [7, 152, 279],
    [21, 7, 287],
  ])('detects the XML illusory-wall trigger at %i:%i,%i', (screen, x, y) => {
    expect(
      evaluateOriginalAchievements(
        at(screen, x, y),
        createOriginalAchievementProgress(),
        context(),
      ).newlyUnlocked,
    ).toContain('GO_THOUGH_ILLUSORY_WALL');
  });

  it('does not unlock a hidden wall merely by being on its screen', () => {
    expect(
      evaluateOriginalAchievements(
        at(5, 100, 100),
        createOriginalAchievementProgress(),
        context(),
      ).newlyUnlocked,
    ).toEqual([]);
  });
});

describe('NPC, merchant and bird state triggers', () => {
  it('accepts the web adventure snapshot structurally without importing adventure types', () => {
    const adventure = {
      inventory: { Shoes: 1 },
      equipped: [],
      collected: [],
      flags: [],
      npcTalks: { old_man: 10 },
      birds: {
        raven: { index: 13, done: false },
        fly: { index: 38, done: true },
      },
      merchants: { merchant: { price: 10, sold: true } },
    };
    expect(evaluate({}, adventure).newlyUnlocked).toEqual([
      'TALK_OLDMAN_10',
      'PURCHASE_SHOES',
      'PURCHASE_FOR_10',
      'CHASE_BIRD_PAST_SNOWSTORM',
      'CHASE_AWAY_BUG',
    ]);
  });

  it('accepts web birdStates fields for exact raven and tsuchinoko victory conditions', () => {
    expect(
      evaluate(
        {},
        { completed: true, birdStates: { raven: { index: 2, done: false } } },
      ).newlyUnlocked,
    ).toContain('WIN_TOUCH_CROW_2');
    expect(
      evaluate(
        {},
        {
          campaign: 'ghost',
          completed: true,
          birdStates: { tsuchinoko: { index: 16, done: true } },
        },
      ).newlyUnlocked,
    ).toContain('GET_OWLCAPE');
  });

  it.each([
    ['old_man', 10, 'TALK_OLDMAN_10'],
    ['old_man', 40, 'TALK_OLDMAN_ALL'],
    ['hermit', 10, 'TALK_HERMIT_10'],
    ['merchant', 4, 'TALK_MERCHANT_10'],
    ['owl_chars/owl_boss_gargoyle', 1, 'TIMESTOP_GARGOYLE_TALK'],
    ['owl_chars/cat_outsider', 1, 'FIND_9TH_CAT'],
  ] as const)(
    'checks the exact XML dialogue count for %s: %i',
    (npc, count, id) => {
      expect(
        evaluate({}, { npcTalks: { [npc]: count - 1 } }).newlyUnlocked,
      ).not.toContain(id);
      expect(
        evaluate({}, { npcTalks: { [npc]: count } }).newlyUnlocked,
      ).toContain(id);
      expect(
        evaluate({}, { npcTalks: { [npc]: count + 1 } }).newlyUnlocked,
      ).not.toContain(id);
    },
  );

  it('does not activate the commented-out snake, NBP merchant, or skeleton talk achievements', () => {
    expect(
      evaluate({}, { npcTalks: { snake: 4, merchant_nbp: 4, skeleton: 10 } })
        .newlyUnlocked,
    ).toEqual([]);
  });

  it.each([
    ['merchant', 1, 'PURCHASE_SHOES'],
    ['merchant', 10, 'PURCHASE_FOR_10'],
    ['merchant_nbp', 10, 'BUY_GIANTBOOTS'],
    ['snake', 1, 'BUY_ICERING'],
    ['owl_chars/owl_shroom_guy', 9, 'PURCHASE_SCHOLAR_TUNIC'],
    ['owl_chars/owl_mold_man', 4, 'PURCHASE_YELLOW_SHOES'],
  ] as const)(
    'requires a real sale and the XML minimum price for %s',
    (merchant, price, id) => {
      expect(
        evaluate(
          {},
          {
            merchants: {
              [merchant]: { sold_shoes: false, required_gold: price },
            },
          },
        ).newlyUnlocked,
      ).not.toContain(id);
      expect(
        evaluate(
          {},
          {
            merchants: {
              [merchant]: { sold_shoes: true, required_gold: price - 1 },
            },
          },
        ).newlyUnlocked,
      ).not.toContain(id);
      expect(
        evaluate(
          {},
          {
            merchants: {
              [merchant]: { sold_shoes: true, required_gold: price },
            },
          },
        ).newlyUnlocked,
      ).toContain(id);
      expect(
        evaluate(
          {},
          {
            merchants: {
              [merchant]: { sold_shoes: true, required_gold: price + 1 },
            },
          },
        ).newlyUnlocked,
      ).toContain(id);
    },
  );

  it('requires the raven final home and the fly done state instead of a visited location', () => {
    expect(evaluate({ screen: 32 }).newlyUnlocked).toEqual([]);
    expect(
      evaluate(
        {},
        {
          birdStates: {
            raven: { home_screen: 12, is_done: false },
            fly: { home_screen: 38, is_done: false },
          },
        },
      ).newlyUnlocked,
    ).toEqual([]);
    expect(
      evaluate(
        {},
        {
          birdStates: {
            raven: { home_screen: 13, is_done: false },
            fly: { home_screen: 38, is_done: true },
          },
        },
      ).newlyUnlocked,
    ).toEqual(['CHASE_BIRD_PAST_SNOWSTORM', 'CHASE_AWAY_BUG']);
  });

  it('unlocks the owl cape only on a ghost victory with the completed tsuchinoko quest', () => {
    const birdStates = { tsuchinoko: { home_screen: 16, is_done: true } };
    expect(
      evaluate({}, { campaign: 'ghost', birdStates, inventory: { CapeOwl: 1 } })
        .newlyUnlocked,
    ).not.toContain('GET_OWLCAPE');
    expect(
      evaluate({}, { campaign: 'original', completed: true, birdStates })
        .newlyUnlocked,
    ).not.toContain('GET_OWLCAPE');
    expect(
      evaluate(
        {},
        { campaign: 'ghost', completed: true, inventory: { CapeOwl: 1 } },
      ).newlyUnlocked,
    ).not.toContain('GET_OWLCAPE');
    expect(
      evaluate({}, { campaign: 'ghost', completed: true, birdStates })
        .newlyUnlocked,
    ).toContain('GET_OWLCAPE');
  });
});
