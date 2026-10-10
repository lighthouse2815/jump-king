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
