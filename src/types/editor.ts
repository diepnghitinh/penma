export type Tool =
  | 'select' | 'hand'
  | 'frame' | 'section' | 'slice'
  | 'rectangle' | 'line' | 'arrow' | 'ellipse' | 'polygon' | 'star' | 'image'
  | 'pen' | 'pencil'
  | 'text'
  | 'zoom';

export type PanelId = 'layers' | 'styles' | 'design-system';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ViewportPreset = {
  name: string;
  width: number;
  height: number;
};

export type ViewportPresetGroup = {
  label: string;
  presets: ViewportPreset[];
};

export const VIEWPORT_PRESET_GROUPS: ViewportPresetGroup[] = [
  {
    label: 'Phone',
    presets: [
      { name: 'iPhone 17', width: 402, height: 874 },
      { name: 'iPhone 16 & 17 Pro', width: 402, height: 874 },
      { name: 'iPhone 16', width: 393, height: 852 },
      { name: 'iPhone 16 & 17 Pro Max', width: 440, height: 956 },
      { name: 'iPhone 16 Plus', width: 430, height: 932 },
      { name: 'iPhone Air', width: 420, height: 912 },
      { name: 'iPhone 14 & 15 Pro Max', width: 430, height: 932 },
      { name: 'iPhone 14 & 15 Pro', width: 393, height: 852 },
      { name: 'iPhone 13 & 14', width: 390, height: 844 },
      { name: 'iPhone 14 Plus', width: 428, height: 926 },
      { name: 'Android Compact', width: 412, height: 917 },
      { name: 'Android Medium', width: 700, height: 840 },
    ],
  },
  {
    label: 'Tablet',
    presets: [
      { name: 'iPad mini 8.3', width: 744, height: 1133 },
      { name: 'Surface Pro 8', width: 1440, height: 960 },
      { name: 'iPad Pro 11"', width: 834, height: 1194 },
      { name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
      { name: 'Android Expanded', width: 1280, height: 800 },
    ],
  },
  {
    label: 'Desktop',
    presets: [
      { name: 'MacBook Air', width: 1280, height: 832 },
      { name: 'MacBook Pro 14"', width: 1512, height: 982 },
      { name: 'MacBook Pro 16"', width: 1728, height: 1117 },
      { name: 'Desktop', width: 1440, height: 1024 },
      { name: 'Wireframes', width: 1440, height: 1024 },
      { name: 'TV', width: 1280, height: 720 },
    ],
  },
  {
    label: 'Presentation',
    presets: [
      { name: 'Slide 16:9', width: 1920, height: 1080 },
      { name: 'Slide 4:3', width: 1024, height: 768 },
    ],
  },
];

export const VIEWPORT_PRESETS: ViewportPreset[] = VIEWPORT_PRESET_GROUPS.flatMap((g) => g.presets);
