import originalScreens from './original-data.json';
import originalAdventure from './original-adventure-data.json';

export const ORIGINAL_SCREENS = originalScreens;
export const ORIGINAL_ADVENTURE = originalAdventure;

export const CAMPAIGNS = {
  original: {
    name: 'Jump King',
    startScreen: 0,
    endScreen: 42,
    spawnX: 231,
    spawnY: 302,
    finishX: 336,
    finishY: 144,
    ending: 'ending/imagecrown',
  },
  nbp: {
    name: 'New Babe Plus',
    startScreen: 46,
    endScreen: 99,
    spawnX: 320,
    spawnY: 302,
    finishX: 144,
    finishY: 144,
    ending: 'ending/nbp_imagecrown',
  },
  ghost: {
    name: 'Ghost of the Babe',
    startScreen: 156,
    endScreen: 153,
    spawnX: 231,
    spawnY: 302,
    finishX: 240,
    finishY: 144,
    ending: 'ending/owl_imagecrown',
  },
} as const;
export type CampaignId = keyof typeof CAMPAIGNS;

export function isOriginalFinish(
  campaignId: CampaignId,
  x: number,
  y: number,
  grounded: boolean,
  screen: number
) {
  const campaign = CAMPAIGNS[campaignId];
  if (!grounded || screen !== campaign.endScreen) return false;
  const correctSide =
    campaignId === 'nbp'
      ? x + 9 <= campaign.finishX
      : x + 9 >= campaign.finishX;
  return (
    correctSide &&
    (campaignId === 'original' ||
      y + 13 <= campaign.finishY + 1 - campaign.endScreen * 360)
  );
}

export interface PlatformDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAP_1: PlatformDef[] = [
  { x: 0, y: 580, w: 800, h: 20 }, // Ground
  { x: 300, y: 460, w: 200, h: 20 },
  { x: 100, y: 340, w: 150, h: 20 },
  { x: 320, y: 220, w: 200, h: 20 },
  { x: 550, y: 100, w: 150, h: 20 },
  { x: 350, y: -20, w: 150, h: 20 },
  { x: 150, y: -140, w: 150, h: 20 },
  { x: 350, y: -250, w: 150, h: 20 }, // Finish
  { x: -20, y: -1000, w: 20, h: 1600 }, // Left wall
  { x: 800, y: -1000, w: 20, h: 1600 }  // Right wall
];
