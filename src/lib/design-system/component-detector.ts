import { v4 as uuid } from 'uuid';
import type { PenmaNode } from '@/types/document';
import { flattenTree } from '@/lib/utils/tree-utils';

/**
 * Detects repeating UI patterns in an imported node tree and marks them as components.
 * Identifies: buttons, nav links, list items, cards, and similar repeated siblings.
 *
 * Mutates nodes in-place by setting componentId on master nodes
 * and componentRef on instances.
 */
export function autoDetectComponents(rootNode: PenmaNode): void {
  // 1. Detect component-worthy elements by tag/role
  markTagBasedComponents(rootNode);

  // 2. Detect repeated sibling patterns (e.g. cards in a grid, nav items)
  detectRepeatedSiblings(rootNode);
}

// ── Tag/role-based detection ────────────────────────────────

const COMPONENT_TAGS = new Set(['button', 'a', 'input', 'select', 'textarea']);
const COMPONENT_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'listitem']);

function markTagBasedComponents(root: PenmaNode): void {
  const nodes = flattenTree(root);

  // Group nodes by their "signature" (tag + key styles) to find repeated patterns
  const signatureMap = new Map<string, PenmaNode[]>();

  for (const node of nodes) {
    if (!isComponentCandidate(node)) continue;
    const sig = getNodeSignature(node);
    const group = signatureMap.get(sig);
    if (group) group.push(node);
    else signatureMap.set(sig, [node]);
  }

  // For groups with 2+ matching nodes, mark as components
  for (const [, group] of signatureMap) {
    if (group.length < 2) continue;

    const master = group[0];
    if (master.componentId || master.componentRef) continue;

    const compId = uuid();
    master.componentId = compId;
    if (!master.name?.startsWith('Component/')) {
      master.name = `Component/${inferComponentName(master)}`;
    }

    for (let i = 1; i < group.length; i++) {
      const instance = group[i];
      if (instance.componentId || instance.componentRef) continue;
      instance.componentRef = compId;
      instance.name = master.name;
    }
  }
}

function isComponentCandidate(node: PenmaNode): boolean {
  // Must have some visual content
  if (!node.tagName) return false;

  // Skip root-level structural elements
  if (['html', 'body', 'head', 'script', 'style', 'meta', 'link'].includes(node.tagName)) return false;

  // Interactive elements are always component candidates
  if (COMPONENT_TAGS.has(node.tagName)) return true;

  // Check role attribute
  const role = node.attributes?.role;
  if (role && COMPONENT_ROLES.has(role)) return true;

  // Elements with specific classes that suggest components
  const cls = node.attributes?.class || '';
  if (/btn|button|card|badge|chip|tag|pill|avatar|icon/i.test(cls)) return true;

  return false;
}

// ── Repeated sibling detection ──────────────────────────────

function detectRepeatedSiblings(node: PenmaNode): void {
  // Recurse first so we process bottom-up
  for (const child of node.children) {
    detectRepeatedSiblings(child);
  }

  // Need at least 2 children to find patterns
  if (node.children.length < 2) return;

  // Group children by structural signature
  const sigGroups = new Map<string, PenmaNode[]>();
  for (const child of node.children) {
    // Skip already-marked nodes
    if (child.componentId || child.componentRef) continue;
    // Skip trivial nodes (no children and no text)
    if (child.children.length === 0 && !child.textContent) continue;

    const sig = getStructuralSignature(child);
    const group = sigGroups.get(sig);
    if (group) group.push(child);
    else sigGroups.set(sig, [child]);
  }

  for (const [, group] of sigGroups) {
    if (group.length < 2) continue;
    // Only mark if the structure is non-trivial (has children or meaningful content)
    if (group[0].children.length === 0) continue;

    const master = group[0];
    const compId = uuid();
    master.componentId = compId;
    if (!master.name?.startsWith('Component/')) {
      master.name = `Component/${inferComponentName(master)}`;
    }

    for (let i = 1; i < group.length; i++) {
      const instance = group[i];
      instance.componentRef = compId;
      instance.name = master.name;
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────

/** Create a signature from tag + key visual styles for grouping similar elements */
function getNodeSignature(node: PenmaNode): string {
  const cs = node.styles.computed;
  return [
    node.tagName,
    cs['display'] || '',
    cs['background-color'] || '',
    cs['color'] || '',
    cs['font-size'] || '',
    cs['font-weight'] || '',
    cs['border-radius'] || '',
    cs['padding'] || '',
    cs['height'] || '',
    node.children.length,
  ].join('|');
}

/** Create a structural signature from tag hierarchy (ignores text/style differences) */
function getStructuralSignature(node: PenmaNode): string {
  const childSigs = node.children
    .slice(0, 10) // cap depth to avoid perf issues
    .map((c) => `${c.tagName}[${c.children.length}]`)
    .join(',');
  return `${node.tagName}:{${childSigs}}`;
}

/** Infer a human-readable component name */
function inferComponentName(node: PenmaNode): string {
  const tag = node.tagName;
  const cls = node.attributes?.class || '';
  const role = node.attributes?.role || '';

  // Check class for common patterns
  const classMatch = cls.match(/\b(btn|button|card|nav-item|menu-item|tab|badge|chip|avatar|header|footer|sidebar|modal|dropdown|alert|toast|input|form|list-item)\b/i);
  if (classMatch) {
    return classMatch[1].charAt(0).toUpperCase() + classMatch[1].slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase());
  }

  if (role) return role.charAt(0).toUpperCase() + role.slice(1);

  // Map common tags to names
  const TAG_NAMES: Record<string, string> = {
    button: 'Button',
    a: 'Link',
    input: 'Input',
    select: 'Select',
    textarea: 'TextArea',
    nav: 'Navigation',
    li: 'ListItem',
    img: 'Image',
    form: 'Form',
  };

  if (TAG_NAMES[tag]) return TAG_NAMES[tag];

  // Fallback: use tag with child count hint
  if (node.children.length > 0) return `${tag.charAt(0).toUpperCase() + tag.slice(1)}Block`;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
