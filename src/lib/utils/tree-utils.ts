import type { PenmaNode } from '@/types/document';

export function findNodeById(
  root: PenmaNode,
  id: string
): PenmaNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function findParentNode(
  root: PenmaNode,
  childId: string
): PenmaNode | null {
  for (const child of root.children) {
    if (child.id === childId) return root;
    const found = findParentNode(child, childId);
    if (found) return found;
  }
  return null;
}

export function updateNodeById(
  root: PenmaNode,
  id: string,
  updater: (node: PenmaNode) => void
): boolean {
  if (root.id === id) {
    updater(root);
    return true;
  }
  for (const child of root.children) {
    if (updateNodeById(child, id, updater)) return true;
  }
  return false;
}

export function flattenTree(node: PenmaNode): PenmaNode[] {
  const result: PenmaNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenTree(child));
  }
  return result;
}

export function getNodeDepth(root: PenmaNode, targetId: string, depth = 0): number {
  if (root.id === targetId) return depth;
  for (const child of root.children) {
    const found = getNodeDepth(child, targetId, depth + 1);
    if (found >= 0) return found;
  }
  return -1;
}

/** Returns all ancestor IDs from root down to (but not including) the target node. */
export function getAncestorIds(root: PenmaNode, targetId: string): string[] {
  const path: string[] = [];
  function walk(node: PenmaNode): boolean {
    if (node.id === targetId) return true;
    for (const child of node.children) {
      if (walk(child)) {
        path.push(node.id);
        return true;
      }
    }
    return false;
  }
  walk(root);
  return path;
}
