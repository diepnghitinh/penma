import type { Camera, Point } from '@/types/editor';

export function documentToScreen(point: Point, camera: Camera): Point {
  return {
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
  };
}

export function screenToDocument(point: Point, camera: Camera): Point {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  };
}

export function getCanvasTransform(camera: Camera): string {
  return `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
}

/**
 * Pan the camera so that a given element (by data-penma-id) is centered on screen.
 * Uses getBoundingClientRect to find the element's current screen position,
 * then adjusts camera to center it within the canvas.
 */
export function scrollCameraToElement(
  nodeId: string,
  camera: Camera,
  canvasRect: { left: number; top: number; width: number; height: number },
): Camera | null {
  const el = document.querySelector(`[data-penma-id="${nodeId}"]`);
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  // Element center in screen coords, relative to canvas
  const elCenterX = rect.left + rect.width / 2 - canvasRect.left;
  const elCenterY = rect.top + rect.height / 2 - canvasRect.top;
  // Canvas center
  const canvasCenterX = canvasRect.width / 2;
  const canvasCenterY = canvasRect.height / 2;
  // Pan delta needed to center the element
  const dx = canvasCenterX - elCenterX;
  const dy = canvasCenterY - elCenterY;

  return {
    x: camera.x + dx,
    y: camera.y + dy,
    zoom: camera.zoom,
  };
}

export function zoomAtPoint(
  camera: Camera,
  point: Point,
  newZoom: number
): Camera {
  const clampedZoom = Math.max(0.1, Math.min(10, newZoom));
  return {
    x: point.x - (point.x - camera.x) * (clampedZoom / camera.zoom),
    y: point.y - (point.y - camera.y) * (clampedZoom / camera.zoom),
    zoom: clampedZoom,
  };
}
