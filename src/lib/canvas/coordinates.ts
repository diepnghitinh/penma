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
