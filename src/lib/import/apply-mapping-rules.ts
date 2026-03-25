import { v4 as uuid } from 'uuid';
import type { PenmaNode, AutoLayout, PenmaFill } from '@/types/document';
import type { IRuleMatchCondition, IRuleTransform, IRuleFigmaOverrides } from '@/lib/db/models/mapping-rule';

// ── Public rule shape (serialized from DB) ──────────────────

export interface MappingRuleData {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: IRuleMatchCondition;
  transform: IRuleTransform;
  figmaOverrides: IRuleFigmaOverrides;
}

// ── Match a node against a rule's conditions ────────────────

function matchesRule(node: PenmaNode, match: IRuleMatchCondition): boolean {
  // Tag match
  if (match.tag && match.tag !== '*' && match.tag !== node.tagName) {
    return false;
  }

  // CSS match: check computed styles
  if (match.cssMatch) {
    const styles = { ...node.styles.computed, ...node.styles.overrides };
    for (const [prop, expected] of Object.entries(match.cssMatch)) {
      const actual = styles[prop] || '';

      // Support comparison operators: >16px, <100px, >=20px
      const cmpMatch = expected.match(/^([><=]+)\s*([\d.]+)(px|em|rem|%)?$/);
      if (cmpMatch) {
        const op = cmpMatch[1];
        const target = parseFloat(cmpMatch[2]);
        const actualNum = parseFloat(actual);
        if (isNaN(actualNum)) return false;
        if (op === '>' && !(actualNum > target)) return false;
        if (op === '>=' && !(actualNum >= target)) return false;
        if (op === '<' && !(actualNum < target)) return false;
        if (op === '<=' && !(actualNum <= target)) return false;
        if (op === '=' && actualNum !== target) return false;
      } else if (expected.startsWith('/') && expected.endsWith('/')) {
        // Regex match
        const regex = new RegExp(expected.slice(1, -1));
        if (!regex.test(actual)) return false;
      } else {
        // Exact match
        if (actual !== expected) return false;
      }
    }
  }

  // Class pattern match
  if (match.classPattern) {
    const className = node.attributes.class || '';
    const regex = new RegExp(match.classPattern, 'i');
    if (!regex.test(className)) return false;
  }

  // Attribute match
  if (match.attributeMatch) {
    for (const [attr, expected] of Object.entries(match.attributeMatch)) {
      const actual = node.attributes[attr];
      if (expected === '*') {
        // Just check presence
        if (actual === undefined) return false;
      } else if (actual !== expected) {
        return false;
      }
    }
  }

  // Children count
  if (match.minChildren !== undefined && node.children.length < match.minChildren) {
    return false;
  }

  // Has text
  if (match.hasText !== undefined) {
    const hasText = !!node.textContent || node.children.some((c) => !!c.textContent);
    if (match.hasText !== hasText) return false;
  }

  return true;
}

// ── Apply transform to a matched node ───────────────────────

function applyTransform(node: PenmaNode, transform: IRuleTransform): void {
  if (transform.name) {
    node.name = transform.name;
  }

  if (transform.tagName) {
    node.tagName = transform.tagName;
  }

  if (transform.styleOverrides) {
    for (const [prop, value] of Object.entries(transform.styleOverrides)) {
      node.styles.overrides[prop] = value;
    }
  }

  if (transform.styleRemovals) {
    for (const prop of transform.styleRemovals) {
      delete node.styles.computed[prop];
      delete node.styles.overrides[prop];
    }
  }

  if (transform.autoLayout && node.autoLayout) {
    if (transform.autoLayout.direction) node.autoLayout.direction = transform.autoLayout.direction;
    if (transform.autoLayout.gap !== undefined) node.autoLayout.gap = transform.autoLayout.gap;
    if (transform.autoLayout.primaryAxisAlign) {
      node.autoLayout.primaryAxisAlign = transform.autoLayout.primaryAxisAlign as AutoLayout['primaryAxisAlign'];
    }
    if (transform.autoLayout.counterAxisAlign) {
      node.autoLayout.counterAxisAlign = transform.autoLayout.counterAxisAlign as AutoLayout['counterAxisAlign'];
    }
  }

  if (transform.sizing && node.sizing) {
    if (transform.sizing.horizontal) node.sizing.horizontal = transform.sizing.horizontal;
    if (transform.sizing.vertical) node.sizing.vertical = transform.sizing.vertical;
  }

  if (transform.fills) {
    node.fills = transform.fills.map((f) => ({
      id: uuid(),
      color: f.color,
      opacity: f.opacity,
      visible: true,
    }));
  }

  if (transform.visible !== undefined) node.visible = transform.visible;
  if (transform.locked !== undefined) node.locked = transform.locked;
}

// ── Store Figma overrides on the node for later export ──────

function applyFigmaOverrides(node: PenmaNode, overrides: IRuleFigmaOverrides): void {
  // Store figma overrides in a special style override prefix
  if (overrides.nodeType) {
    node.styles.overrides['__figma_nodeType'] = overrides.nodeType;
  }
  if (overrides.layoutMode) {
    node.styles.overrides['__figma_layoutMode'] = overrides.layoutMode;
  }
  if (overrides.properties) {
    for (const [key, value] of Object.entries(overrides.properties)) {
      node.styles.overrides[`__figma_${key}`] = String(value);
    }
  }
}

// ── Main: apply all rules to a node tree recursively ────────

export function applyMappingRules(
  rootNode: PenmaNode,
  rules: MappingRuleData[],
): { applied: number; matchLog: Array<{ nodeId: string; nodeName: string; ruleName: string }> } {
  // Sort by priority descending (higher priority first)
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);

  let applied = 0;
  const matchLog: Array<{ nodeId: string; nodeName: string; ruleName: string }> = [];

  function walkAndApply(node: PenmaNode) {
    for (const rule of sorted) {
      if (matchesRule(node, rule.match)) {
        applyTransform(node, rule.transform);
        if (rule.figmaOverrides && Object.keys(rule.figmaOverrides).length > 0) {
          applyFigmaOverrides(node, rule.figmaOverrides);
        }
        applied++;
        matchLog.push({
          nodeId: node.id,
          nodeName: node.name || node.tagName,
          ruleName: rule.name,
        });
      }
    }

    for (const child of node.children) {
      walkAndApply(child);
    }
  }

  walkAndApply(rootNode);
  return { applied, matchLog };
}
