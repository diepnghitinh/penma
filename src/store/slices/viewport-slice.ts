import type { StateCreator } from 'zustand';
import type { Camera, Point } from '@/types/editor';
import { zoomAtPoint } from '@/lib/canvas/coordinates';
import type { EditorState } from '../editor-store';

export interface ViewportSlice {
  camera: Camera;
  pan: (dx: number, dy: number) => void;
  zoomTo: (zoom: number, focalPoint?: Point) => void;
  zoomIn: (focalPoint?: Point) => void;
  zoomOut: (focalPoint?: Point) => void;
  resetView: () => void;
  fitToScreen: (contentBounds: { width: number; height: number }, viewportSize: { width: number; height: number }) => void;
}

const ZOOM_STEP = 1.2;

export const createViewportSlice: StateCreator<
  EditorState,
  [],
  [],
  ViewportSlice
> = (set) => ({
  camera: { x: 0, y: 0, zoom: 1 },

  pan: (dx, dy) =>
    set((state) => ({
      camera: {
        ...state.camera,
        x: state.camera.x + dx,
        y: state.camera.y + dy,
      },
    })),

  zoomTo: (zoom, focalPoint) =>
    set((state) => ({
      camera: focalPoint
        ? zoomAtPoint(state.camera, focalPoint, zoom)
        : { ...state.camera, zoom: Math.max(0.1, Math.min(10, zoom)) },
    })),

  zoomIn: (focalPoint) =>
    set((state) => {
      const newZoom = state.camera.zoom * ZOOM_STEP;
      return {
        camera: focalPoint
          ? zoomAtPoint(state.camera, focalPoint, newZoom)
          : { ...state.camera, zoom: Math.min(10, newZoom) },
      };
    }),

  zoomOut: (focalPoint) =>
    set((state) => {
      const newZoom = state.camera.zoom / ZOOM_STEP;
      return {
        camera: focalPoint
          ? zoomAtPoint(state.camera, focalPoint, newZoom)
          : { ...state.camera, zoom: Math.max(0.1, newZoom) },
      };
    }),

  resetView: () =>
    set({ camera: { x: 0, y: 0, zoom: 1 } }),

  fitToScreen: (contentBounds, viewportSize) =>
    set(() => {
      const padding = 40;
      const scaleX = (viewportSize.width - padding * 2) / contentBounds.width;
      const scaleY = (viewportSize.height - padding * 2) / contentBounds.height;
      const zoom = Math.min(scaleX, scaleY, 1);
      const x = (viewportSize.width - contentBounds.width * zoom) / 2;
      const y = (viewportSize.height - contentBounds.height * zoom) / 2;
      return { camera: { x, y, zoom } };
    }),
});
