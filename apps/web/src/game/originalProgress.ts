import {
  createOriginalAchievementProgress,
  ORIGINAL_ACHIEVEMENTS,
  OriginalAchievementProgress,
  OriginalAdventureState,
} from '@jump-king/physics';

export const progressKey = 'jumpking.progress.v1';
export interface OriginalProgress {
  version: 1;
  inventory: Record<string, number>;
  equipped: string[];
  flags: string[];
  achievements: OriginalAchievementProgress;
}
export function createProgress(): OriginalProgress {
  return {
    version: 1,
    inventory: {},
    equipped: [],
    flags: [],
    achievements: createOriginalAchievementProgress(),
  };
}
export function readProgress(): OriginalProgress {
  const empty = createProgress();
  try {
    const value = JSON.parse(localStorage.getItem(progressKey) || 'null');
    if (value?.version !== 1) return empty;
    const achievements = value.achievements;
    if (
      achievements?.version === 1 &&
      Array.isArray(achievements.unlocked) &&
      achievements.unlocked.every((id: string) =>
        Object.prototype.hasOwnProperty.call(ORIGINAL_ACHIEVEMENTS, id),
      ) &&
      [
        achievements.totals?.ticks,
        achievements.totals?.jumps,
        achievements.totals?.falls,
      ].every((n) => Number.isSafeInteger(n) && n >= 0) &&
      (!achievements.run ||
        (achievements.run.fullRun &&
          [
            achievements.run.counters?.ticks,
            achievements.run.counters?.jumps,
            achievements.run.counters?.falls,
          ].every((n) => Number.isSafeInteger(n) && n >= 0)))
    )
      empty.achievements = achievements;
    empty.inventory =
      typeof value.inventory === 'object' && value.inventory
        ? value.inventory
        : {};
    empty.equipped = Array.isArray(value.equipped)
      ? value.equipped.filter((item: unknown) => typeof item === 'string')
      : [];
    empty.flags = Array.isArray(value.flags)
      ? value.flags.filter((item: unknown) => typeof item === 'string')
      : [];
  } catch {
    /* An invalid local save starts a fresh profile. */
  }
  return empty;
}
export const profileAdventure = (
  profile: OriginalProgress,
): OriginalAdventureState => ({
  inventory: profile.inventory,
  equipped: profile.equipped,
  flags: profile.flags,
  collected: [],
  birds: {},
  merchants: {},
  npcTalks: {},
});
export const itemLabels: Record<string, string> = {
  Crown: 'Crown',
  Shoes: 'Shoes',
  GoldRing: 'Gold Ring',
  CrownNBP: 'Magic Crown',
  Ruby: 'Blood Red Stone',
  SnakeRing: 'Snake Ring',
  GiantBoots: 'Giant Boots',
  Silver: 'Silver Coin',
  Cap: 'Cap',
  GnomeHat: "Scholar's Hat",
  Tunic: 'Tunic',
  YellowShoes: 'Yellow Shoes',
  CrownOwl: 'Golden Cap',
  CapeOwl: "King's Cape",
  BabeGhostItem: 'Ghost of the Babe',
  GhostFragment: 'Ghost Fragment',
  Shroom: 'Mushroom',
  BugNote: "Bug's Note",
};
