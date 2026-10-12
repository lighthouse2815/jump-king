export interface TextureInfo {
  file: string;
  width: number;
  height: number;
}
export interface OriginalProp {
  flag?: string | null;
  flipped?: boolean;
  type: string;
  Position: { X: number; Y: number };
  texture: string | null;
  cells: { X: number; Y: number };
  fps: number;
  durations: number[];
}
export interface OriginalVisualScreen {
  layers: string[];
  props: OriginalProp[];
  location: string;
  ambience: { name: string; volume: number }[];
  weather: { name: string; fps: number; foreground?: boolean; mask: string | null }[];
  scrolling: {
    ScrollingBGdata?: {
      scroll_speed: number;
      layers?: { Layer: ScrollLayer | ScrollLayer[] };
    };
  } | null;
}
export interface ScrollLayer {
  texture: string;
  position: number;
  scroll_multiplier: number;
  foreground?: boolean;
}
export interface OriginalManifest {
  fonts: Record<string, {
    texture: string;
    data: string;
    lineHeight: number;
    defaultCharacter: string;
  }>;
  textures: Record<string, TextureInfo>;
  sounds: Record<string, { file: string; duration: number }>;
  screens: OriginalVisualScreen[];
}
export const originalUrl = (file: string) =>
  `${import.meta.env.BASE_URL}original/${file.split('/').map(encodeURIComponent).join('/')}`;
export const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export interface OriginalNpc {
  font: string;
  name: string;
  screen: number;
  texture: string;
  position: { X: number; Y: number };
  cells: { X: number; Y: number };
  bubble: { direction: string; width: number };
  trigger: {
    center_x: number;
    center_y: number;
    width: number;
    height: number;
  };
  delay: number;
  speed: number;
  talking: { sprite_index: number; duration: number }[];
  busy: { sprite_index: number; duration: number }[];
  quotes: { screen: number; lines: string[] }[];
}
export interface OriginalWall {
  appearSound?: string;
  disappearSound?: string | null;
  playMode?: 'once' | 'every-time';
  texture: string;
  position: { X: number; Y: number };
  screenCoordinates: boolean;
  hitboxes: { X: number; Y: number; Width: number; Height: number }[];
}
export interface OriginalDetails {
  extraProps?: Record<number, OriginalProp[]>;
  npcs: OriginalNpc[];
  walls: Record<number, OriginalWall[]>;
  locations: Record<string, string>;
}
