import { ORIGINAL_PHYSICS, type OriginalState } from './OriginalSimulation';

const managerSource = 'JumpKing.MiscSystems.Achievements/AchievementManager.cs';
const talkSource = 'JumpKing.MiscEntities.OldMan/TalkAchievementCheck.cs';
const saleSource = 'JumpKing.MiscEntities.Merchant/MerchantComp.cs';
const birdSource = 'JumpKing.MiscEntities.Raven/RavenComp.cs';
const propsSource = 'JumpKing.Props/PropManager.cs';
const xml = 'Content/props/';
const lines = `${xml}textures/old_man/lines/`;
const merchants = `${xml}textures/old_man/merchant/`;

const achievement = (
  name: string,
  description: string,
  ...sources: string[]
) => ({
  name,
  description,
  sources,
});

/**
 * All 48 identifiers from AchievementCode.cs, including its spelling mistakes.
 * The English resource contains item names but no achievement titles. These are
 * descriptive English labels, not claimed to be the platform's original titles.
 * Source paths are relative to the decompiled source or original game directory.
 */
export const ORIGINAL_ACHIEVEMENTS = {
  FALL_100: achievement(
    '100 Splats',
    'Splat 100 times across all attempts.',
    managerSource,
  ),
  FALL_1000: achievement(
    '1,000 Splats',
    'Splat 1,000 times across all attempts.',
    managerSource,
  ),
  JUMP_1000: achievement(
    '1,000 Jumps',
    'Jump at least 1,000 times across all attempts.',
    managerSource,
  ),
  JUMP_10000: achievement(
    '10,000 Jumps',
    'Jump at least 10,000 times across all attempts.',
    managerSource,
  ),
  JUMP_100000: achievement(
    '20,000 Jumps',
    'Jump at least 20,000 times; the original code uses this threshold despite the ID.',
    managerSource,
  ),
  TALK_OLDMAN_10: achievement(
    'Old Man Conversation',
    "Complete the old man's tenth conversation.",
    talkSource,
    `${lines}old_man_quotes.xml`,
  ),
  TALK_OLDMAN_ALL: achievement(
    'All Old Man Conversations',
    "Complete the old man's fortieth conversation.",
    talkSource,
    `${lines}old_man_quotes.xml`,
  ),
  TALK_HERMIT_10: achievement(
    'Hermit Conversation',
    "Complete the hermit's tenth conversation.",
    talkSource,
    `${lines}hermit_quotes.xml`,
  ),
  TALK_MERCHANT_10: achievement(
    'Merchant Conversation',
    'Reach exactly four merchant conversations, as specified by the original XML.',
    talkSource,
    `${merchants}merchant_quotes.xml`,
  ),
  WIN: achievement(
    'Jump King Victory',
    'Complete the original campaign.',
    managerSource,
  ),
  WIN_TIME_60: achievement(
    'Jump King Under an Hour',
    'Complete the original campaign in strictly less than 60 minutes.',
    managerSource,
  ),
  WIN_TIME_15: achievement(
    'Jump King Under 15 Minutes',
    'Complete the original campaign in strictly less than 15 minutes.',
    managerSource,
  ),
  WIN_WITH_CROWN: achievement(
    'Victory Wearing the Crown',
    'Complete any campaign wearing the original Crown.',
    managerSource,
  ),
  WIN_WITH_SHOES: achievement(
    'Victory Wearing Shoes',
    'Complete any campaign wearing Shoes.',
    managerSource,
  ),
  WIN_TOUCH_CROW_2: achievement(
    'Two Raven Encounters',
    'Complete the original campaign with the raven home index exactly two.',
    managerSource,
  ),
  WIN_NO_FALLS: achievement(
    'Jump King Without Splats',
    'Complete the original campaign with no splats in this attempt.',
    managerSource,
  ),
  PURCHASE_SHOES: achievement(
    'Buy Shoes',
    'Buy Shoes from the merchant for at least one Gold Ring.',
    saleSource,
    `${merchants}merchant_quotes.xml`,
  ),
  PURCHASE_FOR_10: achievement(
    'Ten Gold Rings for Shoes',
    'Buy Shoes from the merchant for at least ten Gold Rings.',
    saleSource,
    `${merchants}merchant_quotes.xml`,
  ),
  CHASE_BIRD_PAST_SNOWSTORM: achievement(
    'Chase the Raven Past the Snowstorm',
    'Move the raven to its final home (index 13).',
    birdSource,
    `${xml}textures/raven/raven.ravset`,
  ),
  REACH_CATHEDRAL: achievement(
    'Reach the Cathedral',
    'Touch the achievement region on original screen 33.',
    propsSource,
    `${xml}achievements/cathedral.xml`,
  ),
  GO_THOUGH_ILLUSORY_WALL: achievement(
    'Discover an Illusory Wall',
    'Touch an achievement-bearing hidden-wall hitbox on original screen 6, 7, 8, or 22.',
    propsSource,
    'JumpKing.Props.RaymanWall/RaymanData.cs',
    `${xml}hidden_walls/hidden_wall6.xml`,
    `${xml}hidden_walls/hidden_wall7.xml`,
    `${xml}hidden_walls/hidden_wall8.xml`,
    `${xml}hidden_walls/hidden_wall22.xml`,
  ),
  FIND_IMP_ROOM: achievement(
    'Find the Imp Room',
    'Touch the achievement region on original screen 45.',
    propsSource,
    `${xml}achievements/hidden.xml`,
  ),
  WIN_GIANTBOOTS_REGULAR: achievement(
    'Jump King with Giant Boots',
    'Complete Jump King with the Giant Boots full-run flag intact.',
    managerSource,
    'JumpKing.MiscSystems/FullRunManager.cs',
  ),
  WIN_GIANTBOOTS_NBP: achievement(
    'New Babe Plus with Giant Boots',
    'Complete New Babe Plus with the Giant Boots full-run flag intact.',
    managerSource,
    'JumpKing.MiscSystems/FullRunManager.cs',
  ),
  WIN_ICERING_REGULAR: achievement(
    'Jump King with the Snake Ring',
    'Complete Jump King with the Snake Ring full-run flag intact.',
    managerSource,
    'JumpKing.MiscSystems/FullRunManager.cs',
  ),
  WIN_ICERING_NPB: achievement(
    'New Babe Plus with the Snake Ring',
    'Complete New Babe Plus with the Snake Ring full-run flag intact.',
    managerSource,
    'JumpKing.MiscSystems/FullRunManager.cs',
  ),
  WIN_NBP: achievement(
    'New Babe Plus Victory',
    'Complete New Babe Plus.',
    managerSource,
  ),
  WIN_NBP_NO_FALLS: achievement(
    'New Babe Plus Without Splats',
    'Complete New Babe Plus with no splats in this attempt.',
    managerSource,
  ),
  BUY_GIANTBOOTS: achievement(
    'Buy Giant Boots',
    'Buy Giant Boots from merchant_nbp for at least ten Silver.',
    saleSource,
    `${merchants}merchant_nbp.xml`,
  ),
  BUY_ICERING: achievement(
    'Buy the Snake Ring',
    'Buy the Snake Ring from snake for at least one Ruby.',
    saleSource,
    `${merchants}snake.xml`,
  ),
  REACH_SEA: achievement(
    'Reach the Sea',
    'Touch the upper 160 pixels of original screen 90.',
    propsSource,
    `${xml}achievements/ocean.xml`,
  ),
  FIND_NOSE: achievement(
    'Find the Nose',
    'Touch the 13 by 8 pixel nose region at (72, 280) on original screen 71.',
    propsSource,
    `${xml}achievements/nose.xml`,
  ),
  WEAR_GIANTBOOTS_AND_ICERING: achievement(
    'Giant Boots and Snake Ring',
    'Wear Giant Boots and Snake Ring simultaneously.',
    managerSource,
  ),
  WIN_GIANTBOOTS_OWL: achievement(
    'Ghost of the Babe with Giant Boots',
    'Complete Ghost of the Babe with the Giant Boots full-run flag intact.',
    managerSource,
    'JumpKing.MiscSystems/FullRunManager.cs',
  ),
  WIN_ICERING_OWL: achievement(
    'Ghost of the Babe with the Snake Ring',
    'Complete Ghost of the Babe with the Snake Ring full-run flag intact.',
    managerSource,
    'JumpKing.MiscSystems/FullRunManager.cs',
  ),
  GET_OWLCAPE: achievement(
    "Earn the King's Cape",
    'Complete Ghost of the Babe with the tsuchinoko quest done.',
    managerSource,
  ),
  WIN_OWL: achievement(
    'Ghost of the Babe Victory',
    'Complete Ghost of the Babe.',
    managerSource,
  ),
  WEAR_TUNIC_YELLOWSHOES_AND_GNOMEHAT: achievement(
    'Tunic, Yellow Shoes and Gnome Hat',
    'Wear Tunic, YellowShoes and GnomeHat simultaneously.',
    managerSource,
  ),
  WEAR_SHOES_RING_AND_OWLCAPE: achievement(
    "Shoes, Snake Ring and King's Cape",
    'Wear Shoes, SnakeRing and CapeOwl simultaneously.',
    managerSource,
  ),
  WIN_OWL_2_FALL: achievement(
    'Ghost of the Babe with Two Splats',
    'Complete Ghost of the Babe with exactly two splats in this attempt.',
    managerSource,
  ),
  GET_GNOME_HAT: achievement(
    'Wear the Gnome Hat',
    'Wear GnomeHat; merely owning it does not trigger the original check.',
    managerSource,
  ),
  TIMESTOP_GARGOYLE_TALK: achievement(
    'Speak to the Gargoyle',
    'Complete the first conversation with owl_chars/owl_boss_gargoyle.',
    talkSource,
    `${lines}owl_gargoyles_quotes.xml`,
  ),
  PURCHASE_SCHOLAR_TUNIC: achievement(
    'Buy the Tunic',
    'Buy Tunic from owl_chars/owl_shroom_guy for at least nine Shrooms.',
    saleSource,
    `${merchants}owl_shroom_guy.xml`,
  ),
  PURCHASE_YELLOW_SHOES: achievement(
    'Buy Yellow Shoes',
    'Buy YellowShoes from owl_chars/owl_mold_man for at least four GhostFragments.',
    saleSource,
    `${merchants}owl_mold_man.xml`,
  ),
  CHASE_AWAY_BUG: achievement(
    'Chase Away the Bug',
    'Complete the fly chase; reaching its last home alone is insufficient.',
    birdSource,
    `${xml}textures/raven/fly.ravset`,
  ),
  FIND_9TH_CAT: achievement(
    'Find the Ninth Cat',
    'Complete the first conversation with owl_chars/cat_outsider.',
    talkSource,
    `${lines}owl_cat_outsider_quotes.xml`,
  ),
  WIN_TIME_60_OWL: achievement(
    'Ghost of the Babe Under an Hour',
    'Complete Ghost of the Babe in strictly less than 60 minutes.',
    managerSource,
  ),
  WIN_TIME_30_OWL: achievement(
    'Ghost of the Babe Under 30 Minutes',
    'Complete Ghost of the Babe in strictly less than 30 minutes.',
    managerSource,
  ),
} as const;

export type OriginalAchievementId = keyof typeof ORIGINAL_ACHIEVEMENTS;
export type OriginalAchievementCampaign = 'original' | 'nbp' | 'ghost';

export interface OriginalAchievementStats {
  ticks: number;
  jumps: number;
  /** OnSplat events, not every downward movement or screen transition. */
  falls: number;
}

export interface OriginalAchievementFullRun {
  wear_giant_boots: boolean;
  wear_snake_ring: boolean;
}

/** Original save fields or the equivalent fields in the web adventure snapshot. */
export type OriginalAchievementBirdState =
  { home_screen: number; is_done: boolean } | { index: number; done: boolean };

export type OriginalAchievementMerchantState =
  | { sold_shoes: boolean; required_gold: number }
  | { sold: boolean; price: number };

export interface OriginalAchievementContext {
  campaign: OriginalAchievementCampaign;
  /** Evaluate the finish event before granting or equipping victory rewards. */
  completed: boolean;
  /** Change on a new attempt, keep stable across save/load and menu visits. */
  runId?: string;
  inventory?: Readonly<Partial<Record<string, number>>>;
  equipped?: readonly string[];
  npcTalks?: Readonly<Record<string, number>>;
  birdStates?: Readonly<Record<string, OriginalAchievementBirdState>>;
  /** Allows spreading the web adventure snapshot directly into this context. */
  birds?: Readonly<Record<string, OriginalAchievementBirdState>>;
  merchants?: Readonly<Record<string, OriginalAchievementMerchantState>>;
  /** Import a verified FullRunSave; never infer it from finish-time inventory. */
  fullRun?: Readonly<OriginalAchievementFullRun>;
  flags?: readonly string[];
}

/** Plain JSON data. Persist the returned progress alongside the simulation save. */
export interface OriginalAchievementProgress {
  version: 1;
  unlocked: OriginalAchievementId[];
  totals: OriginalAchievementStats;
  run: {
    campaign: OriginalAchievementCampaign;
    id?: string;
    counters: OriginalAchievementStats;
    completed: boolean;
    fullRun: OriginalAchievementFullRun;
  } | null;
}

export function createOriginalAchievementProgress(): OriginalAchievementProgress {
  return {
    version: 1,
    unlocked: [],
    totals: { ticks: 0, jumps: 0, falls: 0 },
    run: null,
  };
}

// One-based XML screen, x/y in screen pixels, width/height. Default wall hitboxes
// use original texture dimensions (also preserved by the imported PNG assets).
const regions: readonly [
  OriginalAchievementId,
  number,
  number,
  number,
  number,
  number,
][] = [
  ['REACH_CATHEDRAL', 33, 0, 0, 480, 360],
  ['FIND_IMP_ROOM', 45, 0, 0, 480, 360],
  ['REACH_SEA', 90, 0, 0, 480, 160],
  ['FIND_NOSE', 71, 72, 280, 13, 8],
  ['GO_THOUGH_ILLUSORY_WALL', 6, 303, 95, 177, 170],
  ['GO_THOUGH_ILLUSORY_WALL', 7, 303, 223, 65, 82],
  ['GO_THOUGH_ILLUSORY_WALL', 7, 288, 119, 64, 34],
  ['GO_THOUGH_ILLUSORY_WALL', 7, 336, 63, 16, 57],
  ['GO_THOUGH_ILLUSORY_WALL', 7, 351, 48, 32, 106],
  ['GO_THOUGH_ILLUSORY_WALL', 7, 382, 47, 91, 89],
  ['GO_THOUGH_ILLUSORY_WALL', 7, 167, 0, 98, 73],
  ['GO_THOUGH_ILLUSORY_WALL', 8, 240, 303, 40, 17],
  ['GO_THOUGH_ILLUSORY_WALL', 8, 240, 320, 56, 33],
  ['GO_THOUGH_ILLUSORY_WALL', 8, 152, 279, 89, 81],
  ['GO_THOUGH_ILLUSORY_WALL', 22, 7, 287, 127, 50],
];

const talks: readonly [OriginalAchievementId, string, number][] = [
  ['TALK_OLDMAN_10', 'old_man', 10],
  ['TALK_OLDMAN_ALL', 'old_man', 40],
  ['TALK_HERMIT_10', 'hermit', 10],
  ['TALK_MERCHANT_10', 'merchant', 4],
  ['TIMESTOP_GARGOYLE_TALK', 'owl_chars/owl_boss_gargoyle', 1],
  ['FIND_9TH_CAT', 'owl_chars/cat_outsider', 1],
];

const sales: readonly [OriginalAchievementId, string, number][] = [
  ['PURCHASE_SHOES', 'merchant', 1],
  ['PURCHASE_FOR_10', 'merchant', 10],
  ['BUY_GIANTBOOTS', 'merchant_nbp', 10],
  ['BUY_ICERING', 'snake', 1],
  ['PURCHASE_SCHOLAR_TUNIC', 'owl_chars/owl_shroom_guy', 9],
  ['PURCHASE_YELLOW_SHOES', 'owl_chars/owl_mold_man', 4],
];

/**
 * Pure evaluation: neither state, context, nor prior progress is mutated.
 * Call after each simulation tick and completed NPC dialogue/sale/quest event.
 * Evaluate a victory before awarding its Crown/Cape, using finish-time gear.
 * Counter deltas replay batched OnJump/OnSplat events, so each splat threshold
 * is checked once as in the original event handler, even across skipped frames.
 * Supply runId for explicit attempt boundaries; otherwise counter resets
 * or campaign changes identify a new attempt. A completed event may be a pulse;
 * its end does not reset the attempt. Use runId for ambiguous identical saves.
 * Inventory and free-form flags alone deliberately grant no achievements.
 */
export function evaluateOriginalAchievements(
  state: OriginalState,
  progress: OriginalAchievementProgress,
  context: OriginalAchievementContext,
): {
  newlyUnlocked: OriginalAchievementId[];
  progress: OriginalAchievementProgress;
} {
  const last = progress.run;
  const newRun =
    !last ||
    last.campaign !== context.campaign ||
    last.id !== context.runId ||
    (context.runId === undefined &&
      (state.ticks < last.counters.ticks ||
        state.jumps < last.counters.jumps ||
        state.falls < last.counters.falls));
  const previous = newRun ? { ticks: 0, jumps: 0, falls: 0 } : last!.counters;
  const counters = {
    ticks: Math.max(previous.ticks, state.ticks),
    jumps: Math.max(previous.jumps, state.jumps),
    falls: Math.max(previous.falls, state.falls),
  };
  const totals = {
    ticks: progress.totals.ticks + counters.ticks - previous.ticks,
    jumps: progress.totals.jumps + counters.jumps - previous.jumps,
    falls: progress.totals.falls + counters.falls - previous.falls,
  };
  const candidates = new Set<OriginalAchievementId>();
  const grant = (id: OriginalAchievementId, condition: boolean) => {
    if (condition) candidates.add(id);
  };

  grant('FALL_100', progress.totals.falls < 100 && totals.falls >= 100);
  grant('FALL_1000', progress.totals.falls < 1000 && totals.falls >= 1000);
  if (counters.jumps > previous.jumps) {
    grant('JUMP_1000', totals.jumps >= 1000);
    grant('JUMP_10000', totals.jumps >= 10000);
    grant('JUMP_100000', totals.jumps >= 20000);
  }

  const wearing = (item: string) => context.equipped?.includes(item) === true;
  grant(
    'WEAR_GIANTBOOTS_AND_ICERING',
    wearing('GiantBoots') && wearing('SnakeRing'),
  );
  grant(
    'WEAR_TUNIC_YELLOWSHOES_AND_GNOMEHAT',
    wearing('Tunic') && wearing('YellowShoes') && wearing('GnomeHat'),
  );
  grant(
    'WEAR_SHOES_RING_AND_OWLCAPE',
    wearing('Shoes') && wearing('SnakeRing') && wearing('CapeOwl'),
  );
  grant('GET_GNOME_HAT', wearing('GnomeHat'));

  // FullRunManager resets eligibility on GLOBAL screen 1, even for DLC. On
  // every other screen it only clears flags. Returning to screen 1 requalifies.
  const priorFullRun = newRun
    ? { wear_giant_boots: false, wear_snake_ring: false }
    : last!.fullRun;
  const fullRun = context.fullRun
    ? { ...context.fullRun }
    : {
        wear_giant_boots:
          wearing('GiantBoots') &&
          (state.screen === 0 || priorFullRun.wear_giant_boots),
        wear_snake_ring:
          wearing('SnakeRing') &&
          (state.screen === 0 || priorFullRun.wear_snake_ring),
      };

  const x = Math.trunc(state.x),
    y = Math.trunc(state.y);
  for (const [id, screen, left, localTop, width, height] of regions) {
    const top = localTop - (screen - 1) * 360;
    grant(
      id,
      x < left + width &&
        x + ORIGINAL_PHYSICS.width > left &&
        y < top + height &&
        y + ORIGINAL_PHYSICS.height > top,
    );
  }
  for (const [id, npc, count] of talks) {
    grant(id, context.npcTalks?.[npc] === count);
  }
  for (const [id, merchant, price] of sales) {
    const sale = context.merchants?.[merchant];
    if (!sale) continue;
    const sold = 'sold_shoes' in sale ? sale.sold_shoes : sale.sold;
    const paid = 'required_gold' in sale ? sale.required_gold : sale.price;
    grant(id, sold && paid >= price);
  }
  const birds = context.birdStates ?? context.birds;
  const raven = birds?.raven;
  const ravenHome =
    raven && ('home_screen' in raven ? raven.home_screen : raven.index);
  const birdDone = (name: string) => {
    const bird = birds?.[name];
    return bird && ('is_done' in bird ? bird.is_done : bird.done) === true;
  };
  grant('CHASE_BIRD_PAST_SNOWSTORM', ravenHome === 13);
  grant('CHASE_AWAY_BUG', birdDone('fly') === true);

  const wasCompleted = !newRun && last!.completed;
  if (context.completed && !wasCompleted) {
    grant('WIN_WITH_CROWN', wearing('Crown'));
    grant('WIN_WITH_SHOES', wearing('Shoes'));
    switch (context.campaign) {
      case 'original':
        grant('WIN', true);
        grant('WIN_TIME_60', counters.ticks < 216000);
        grant('WIN_TIME_15', counters.ticks < 54000);
        grant('WIN_NO_FALLS', counters.falls === 0);
        grant('WIN_GIANTBOOTS_REGULAR', fullRun.wear_giant_boots);
        grant('WIN_ICERING_REGULAR', fullRun.wear_snake_ring);
        grant('WIN_TOUCH_CROW_2', ravenHome === 2);
        break;
      case 'nbp':
        grant('WIN_NBP', true);
        grant('WIN_NBP_NO_FALLS', counters.falls === 0);
        grant('WIN_GIANTBOOTS_NBP', fullRun.wear_giant_boots);
        grant('WIN_ICERING_NPB', fullRun.wear_snake_ring);
        break;
      case 'ghost':
        grant('WIN_OWL', true);
        grant('WIN_TIME_60_OWL', counters.ticks < 216000);
        grant('WIN_TIME_30_OWL', counters.ticks < 108000);
        grant('WIN_OWL_2_FALL', counters.falls === 2);
        grant('WIN_GIANTBOOTS_OWL', fullRun.wear_giant_boots);
        grant('WIN_ICERING_OWL', fullRun.wear_snake_ring);
        grant('GET_OWLCAPE', birdDone('tsuchinoko') === true);
        break;
    }
  }

  const unlocked = new Set(progress.unlocked);
  const newlyUnlocked = (
    Object.keys(ORIGINAL_ACHIEVEMENTS) as OriginalAchievementId[]
  ).filter((id) => candidates.has(id) && !unlocked.has(id));
  return {
    newlyUnlocked,
    progress: {
      version: 1,
      unlocked: [...progress.unlocked, ...newlyUnlocked],
      totals,
      run: {
        campaign: context.campaign,
        ...(context.runId === undefined ? {} : { id: context.runId }),
        counters,
        completed: wasCompleted || context.completed,
        fullRun,
      },
    },
  };
}
