import { OriginalState, OriginalWorldEventsState } from '@jump-king/physics';
import { CampaignId, CAMPAIGNS } from '@jump-king/maps';

export interface SoloSave {
  version: 1;
  campaign: CampaignId;
  state: OriginalState;
  bestScreen: number;
  completed: boolean;
  npcProgress?: Record<string, number>;
  runId?: string;
  worldEvents?: OriginalWorldEventsState;
}
export const saveKey = (campaign: CampaignId) =>
  `jumpking.original.v1.${campaign}`;
export function readSave(campaign: CampaignId): SoloSave | null {
  try {
    const text = localStorage.getItem(saveKey(campaign));
    if (!text) return null;
    const save: SoloSave = JSON.parse(text);
    const state = save.state;
    if (
      save.version !== 1 ||
      save.campaign !== campaign ||
      !CAMPAIGNS[save.campaign] ||
      !state ||
      !Array.isArray(state.directions) ||
      state.directions.length > 4 ||
      ![
        state.x,
        state.y,
        state.vx,
        state.vy,
        state.charge,
        state.screen,
        state.ticks,
        state.jumps,
        state.falls,
        state.splat,
        save.bestScreen,
      ].every(Number.isFinite) ||
      state.screen < 0 ||
      state.screen > 168 ||
      state.x < -9 ||
      state.x > 471 ||
      state.y < -60600 ||
      state.y > 360 ||
      state.ticks < 0
    )
      return null;
    return save;
  } catch {
    return null;
  }
}
