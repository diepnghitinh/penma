export type Tool = 'select' | 'hand' | 'text' | 'zoom';

export type PanelId = 'layers' | 'styles';

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

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Laptop', width: 1024, height: 768 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 },
];
