import type { PrimaryAxisAlign, CounterAxisAlign } from '@/types/document';

// ── CSS → Penma alignment maps ──────────────────────────────

export const HALIGN_MAP: Record<string, 'start' | 'center' | 'end'> = {
  'flex-start': 'start', start: 'start', left: 'start',
  center: 'center',
  'flex-end': 'end', end: 'end', right: 'end',
};

export const VALIGN_MAP: Record<string, 'start' | 'center' | 'end'> = {
  'flex-start': 'start', start: 'start',
  center: 'center',
  'flex-end': 'end', end: 'end',
};

export const VALIGN_TO_TEXT: Record<string, string> = {
  center: 'middle', 'flex-end': 'bottom', end: 'bottom',
};

export const TEXT_STYLE_KEYS = new Set([
  'font-family', 'font-size', 'font-weight', 'line-height',
  'letter-spacing', 'text-align', 'text-valign', 'text-decoration', 'color',
  'text-transform', 'white-space', 'word-break', 'word-spacing',
  'background-image', 'background-clip', '-webkit-background-clip', '-webkit-text-fill-color',
]);

export function mapJustify(v: string): PrimaryAxisAlign {
  if (v === 'center') return 'center';
  if (v === 'flex-end' || v === 'end') return 'end';
  if (v === 'space-between') return 'space-between';
  return 'start';
}

export function mapAlign(v: string): CounterAxisAlign {
  if (v === 'center') return 'center';
  if (v === 'flex-end' || v === 'end') return 'end';
  if (v === 'stretch') return 'stretch';
  if (v === 'baseline') return 'baseline';
  return 'start';
}

// ── Padding helper ──────────────────────────────────────────

export function parsePadding(styles: Record<string, string>) {
  const top = parseFloat(styles['padding-top'] || '0') || 0;
  const right = parseFloat(styles['padding-right'] || '0') || 0;
  const bottom = parseFloat(styles['padding-bottom'] || '0') || 0;
  const left = parseFloat(styles['padding-left'] || '0') || 0;
  return {
    padding: { top, right, bottom, left },
    independentPadding: !(top === right && right === bottom && bottom === left),
  };
}
