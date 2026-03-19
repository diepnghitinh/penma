import type { PenmaNode } from '@/types/document';
import { getEffectiveStyles } from '@/lib/styles/style-resolver';

/**
 * Exports a PenmaNode tree back to clean HTML + inline styles.
 */
export function nodeToHtml(node: PenmaNode, indent = 0): string {
  if (!node.visible) return '';

  const pad = '  '.repeat(indent);
  const tag = node.tagName;

  if (node.rawHtml) {
    return `${pad}${node.rawHtml}\n`;
  }

  const styles = getEffectiveStyles(node.styles);
  const styleStr = Object.entries(styles)
    .filter(([, v]) => v && v !== 'initial' && v !== 'none')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  const attrs = Object.entries(node.attributes)
    .filter(([k]) => !k.startsWith('on'))
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(' ');

  const opening = `<${tag}${attrs ? ' ' + attrs : ''}${styleStr ? ` style="${escapeAttr(styleStr)}"` : ''}>`;

  if (node.textContent && node.children.length === 0) {
    return `${pad}${opening}${escapeHtml(node.textContent)}</${tag}>\n`;
  }

  if (node.children.length === 0) {
    const voids = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'col', 'embed', 'source', 'track', 'wbr']);
    if (voids.has(tag)) return `${pad}${opening}\n`;
    return `${pad}${opening}</${tag}>\n`;
  }

  let html = `${pad}${opening}\n`;
  for (const child of node.children) {
    html += nodeToHtml(child, indent + 1);
  }
  html += `${pad}</${tag}>\n`;
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
