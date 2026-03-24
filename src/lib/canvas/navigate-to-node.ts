import type { PenmaDocument, PenmaNode } from '@/types/document';
import { findNodeById } from '@/lib/utils/tree-utils';

/**
 * Find a node across all documents and compute its absolute position on the canvas.
 * Returns the document containing the node and the node's absolute bounds (including canvasX/Y offset).
 */
export function findNodeAcrossDocuments(
  documents: PenmaDocument[],
  nodeId: string,
): { doc: PenmaDocument; node: PenmaNode; absoluteBounds: { x: number; y: number; width: number; height: number } } | null {
  for (const doc of documents) {
    const node = findNodeById(doc.rootNode, nodeId);
    if (node) {
      return {
        doc,
        node,
        absoluteBounds: {
          x: doc.canvasX + node.bounds.x,
          y: doc.canvasY + node.bounds.y,
          width: node.bounds.width,
          height: node.bounds.height,
        },
      };
    }
  }
  return null;
}

/**
 * Compute camera position to center a given bounds in the viewport.
 */
export function cameraToFitBounds(
  bounds: { x: number; y: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number; zoom: number } {
  const padding = 80;
  const scaleX = (viewportWidth - padding * 2) / bounds.width;
  const scaleY = (viewportHeight - padding * 2) / bounds.height;
  // Zoom to fit but cap at 1x to avoid over-zooming small elements
  const zoom = Math.min(scaleX, scaleY, 1);
  // Center the bounds in the viewport
  const x = (viewportWidth - bounds.width * zoom) / 2 - bounds.x * zoom;
  const y = (viewportHeight - bounds.height * zoom) / 2 - bounds.y * zoom;
  return { x, y, zoom };
}
