import type { PenmaNode } from '@/types/document';
import type {
  DesignSystem,
  ColorToken,
  FontSizeToken,
  FontFamilyToken,
  TypographyStyle,
  RadiusToken,
} from '@/types/design-system';
import { flattenTree } from '@/lib/utils/tree-utils';

/**
 * Analyzes a PenmaNode tree and extracts a design system:
 * - Color palette (text, background, border)
 * - Font size scale
 * - Font families
 * - Typography styles (unique combos of family+size+weight+lineHeight)
 * - Spacing scale
 * - Border radii
 */
export function analyzeDesignSystem(rootNode: PenmaNode): DesignSystem {
  const nodes = flattenTree(rootNode);

  const colors = extractColors(nodes);
  const fontSizes = extractFontSizes(nodes);
  const fontFamilies = extractFontFamilies(nodes);
  const typographyStyles = extractTypographyStyles(nodes);
  const spacingScale = extractSpacingScale(nodes);
  const borderRadii = extractBorderRadii(nodes);

  return { colors, fontSizes, fontFamilies, typographyStyles, spacingScale, borderRadii };
}

// ── Color extraction ────────────────────────────────────────

import { parseCssColor } from '@/lib/styles/color-parser';

function normalizeColor(raw: string): string | null {
  const parsed = parseCssColor(raw);
  if (!parsed || parsed.opacity < 5) return null;
  return parsed.hex.toLowerCase();
}

function extractColors(nodes: PenmaNode[]): ColorToken[] {
  const map: Record<string, { count: number; categories: Set<string> }> = {};

  for (const node of nodes) {
    const cs = node.styles.computed;

    const pairs: [string | undefined, string][] = [
      [cs['color'], 'text'],
      [cs['background-color'], 'background'],
      [cs['border-top-color'], 'border'],
      [cs['border-right-color'], 'border'],
      [cs['border-bottom-color'], 'border'],
      [cs['border-left-color'], 'border'],
    ];

    for (const [raw, category] of pairs) {
      if (!raw) continue;
      const hex = normalizeColor(raw);
      if (!hex || hex === '#000000' && category === 'border') continue; // skip default
      if (!map[hex]) map[hex] = { count: 0, categories: new Set() };
      map[hex].count++;
      map[hex].categories.add(category);
    }
  }

  // Determine primary category per color
  const tokens: ColorToken[] = Object.entries(map)
    .map(([value, { count, categories }]) => {
      let category: ColorToken['category'] = 'other';
      if (categories.has('text')) category = 'text';
      else if (categories.has('background')) category = 'background';
      else if (categories.has('border')) category = 'border';
      return { value, count, category, name: autoNameColor(value) };
    })
    .filter((c) => c.count >= 1)
    .sort((a, b) => b.count - a.count);

  // Deduplicate very similar colors (within 10 distance)
  const deduped: ColorToken[] = [];
  for (const token of tokens) {
    const isTooClose = deduped.some(
      (existing) => colorDistance(existing.value, token.value) < 10
    );
    if (!isTooClose) deduped.push(token);
    else {
      // Merge count into the existing similar color
      const similar = deduped.find((e) => colorDistance(e.value, token.value) < 10);
      if (similar) similar.count += token.count;
    }
  }

  return deduped.slice(0, 24); // Cap at 24 colors
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function autoNameColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;

  if (lightness > 0.95) return 'White';
  if (lightness < 0.05) return 'Black';
  if (max - min < 20) return lightness > 0.5 ? 'Light Gray' : 'Dark Gray';

  // Simple hue detection
  if (r > g && r > b) return r - g > 60 ? 'Red' : 'Orange';
  if (g > r && g > b) return 'Green';
  if (b > r && b > g) return r > 100 ? 'Purple' : 'Blue';
  if (r > 200 && g > 200 && b < 100) return 'Yellow';
  return hex;
}

// ── Font size extraction ────────────────────────────────────

function extractFontSizes(nodes: PenmaNode[]): FontSizeToken[] {
  const map: Record<string, { px: number; count: number; tags: string[] }> = {};

  for (const node of nodes) {
    const fs = node.styles.computed['font-size'];
    if (!fs) continue;
    const px = parseFloat(fs);
    if (isNaN(px) || px === 0) continue;
    const key = `${Math.round(px)}px`;
    if (!map[key]) map[key] = { px: Math.round(px), count: 0, tags: [] };
    map[key].count++;
    if (!map[key].tags.includes(node.tagName)) map[key].tags.push(node.tagName);
  }

  return Object.entries(map)
    .map(([value, { px, count, tags }]) => ({
      value,
      px,
      count,
      role: inferFontRole(px, tags),
    }))
    .sort((a, b) => b.px - a.px);
}

function inferFontRole(px: number, tags: string[]): string {
  if (tags.includes('h1') || px >= 36) return 'Display';
  if (tags.includes('h2') || px >= 28) return 'Heading L';
  if (tags.includes('h3') || px >= 22) return 'Heading M';
  if (tags.includes('h4') || px >= 18) return 'Heading S';
  if (px >= 15 && px <= 17) return 'Body';
  if (px >= 13 && px <= 14) return 'Small';
  if (px <= 12) return 'Caption';
  return 'Text';
}

// ── Font family extraction ──────────────────────────────────

function extractFontFamilies(nodes: PenmaNode[]): FontFamilyToken[] {
  const map: Record<string, { full: string; count: number; headingCount: number }> = {};

  for (const node of nodes) {
    const ff = node.styles.computed['font-family'];
    if (!ff) continue;
    const shortName = ff.split(',')[0].trim().replace(/['"]/g, '');
    if (!map[shortName]) map[shortName] = { full: ff, count: 0, headingCount: 0 };
    map[shortName].count++;
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName)) {
      map[shortName].headingCount++;
    }
  }

  const sorted = Object.entries(map)
    .map(([shortName, { full, count, headingCount }]) => {
      let role: string | undefined;
      if (shortName.toLowerCase().includes('mono') || shortName.toLowerCase().includes('code')) {
        role = 'Monospace';
      } else if (headingCount > 0 && headingCount / count > 0.3) {
        role = 'Heading';
      } else {
        role = 'Body';
      }
      return { value: full, shortName, count, role };
    })
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, 8);
}

// ── Typography styles (unique combos) ───────────────────────

function extractTypographyStyles(nodes: PenmaNode[]): TypographyStyle[] {
  const map: Record<string, { style: TypographyStyle; count: number }> = {};

  for (const node of nodes) {
    const cs = node.styles.computed;
    if (!cs['font-size'] || node.rawHtml) continue;

    const family = (cs['font-family'] || '').split(',')[0].trim().replace(/['"]/g, '');
    const size = cs['font-size'] || '';
    const weight = cs['font-weight'] || '400';
    const lineHeight = cs['line-height'] || 'normal';
    const letterSpacing = cs['letter-spacing'] || 'normal';
    const color = normalizeColor(cs['color'] || '') || '#000000';

    // Normalize weight
    const w = normalizeWeight(weight);

    const key = `${family}|${Math.round(parseFloat(size))}|${w}|${Math.round(parseFloat(lineHeight) || 0)}`;

    if (!map[key]) {
      const px = parseFloat(size);
      const name = inferTypoName(px, w, node.tagName);
      map[key] = {
        style: {
          id: key,
          name,
          fontFamily: family,
          fontSize: size,
          fontWeight: w,
          lineHeight,
          letterSpacing,
          color,
          count: 0,
        },
        count: 0,
      };
    }
    map[key].count++;
    map[key].style.count = map[key].count;
  }

  return Object.values(map)
    .map((v) => v.style)
    .filter((s) => s.count >= 2) // Only styles used 2+ times
    .sort((a, b) => parseFloat(b.fontSize) - parseFloat(a.fontSize))
    .slice(0, 20);
}

function normalizeWeight(w: string): string {
  const n = parseInt(w);
  if (isNaN(n)) {
    if (w === 'bold') return '700';
    if (w === 'normal') return '400';
    if (w === 'lighter') return '300';
    if (w === 'bolder') return '800';
    return '400';
  }
  return String(Math.round(n / 100) * 100);
}

function inferTypoName(px: number, weight: string, tag: string): string {
  const w = parseInt(weight);
  if (tag === 'h1' || px >= 36) return 'Display';
  if (tag === 'h2' || px >= 28) return 'Heading Large';
  if (tag === 'h3' || px >= 22) return 'Heading Medium';
  if (tag === 'h4' || px >= 18) return w >= 600 ? 'Heading Small' : 'Subheading';
  if (px >= 15 && px <= 17) return w >= 600 ? 'Body Bold' : 'Body';
  if (px >= 13 && px <= 14) return w >= 600 ? 'Small Bold' : 'Small';
  if (px <= 12) return 'Caption';
  return w >= 600 ? 'Text Bold' : 'Text';
}

// ── Spacing scale ───────────────────────────────────────────

function extractSpacingScale(nodes: PenmaNode[]): number[] {
  const counts: Record<number, number> = {};

  for (const node of nodes) {
    const cs = node.styles.computed;
    const props = [
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'gap',
    ];
    for (const prop of props) {
      const val = parseFloat(cs[prop] || '');
      if (!isNaN(val) && val > 0 && val < 200) {
        const rounded = Math.round(val);
        counts[rounded] = (counts[rounded] || 0) + 1;
      }
    }
  }

  return Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([val]) => parseInt(val))
    .slice(0, 12);
}

// ── Border radii ────────────────────────────────────────────

function extractBorderRadii(nodes: PenmaNode[]): RadiusToken[] {
  const counts: Record<string, number> = {};

  for (const node of nodes) {
    const cs = node.styles.computed;
    const r = cs['border-top-left-radius'];
    if (!r || r === '0px') continue;
    const px = Math.round(parseFloat(r));
    if (isNaN(px) || px === 0) continue;
    const key = `${px}px`;
    counts[key] = (counts[key] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .filter((t) => t.count >= 2)
    .sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
}
