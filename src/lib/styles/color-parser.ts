/**
 * Comprehensive CSS color parser supporting:
 * - rgb(r, g, b) / rgba(r, g, b, a)           — legacy comma syntax
 * - rgb(r g b) / rgb(r g b / a)               — modern space syntax
 * - rgb(r g b / var(--alpha, 1))              — var() fallback (extracts default)
 * - color(srgb r g b) / color(srgb r g b / a) — modern Chrome format
 * - #hex (3, 4, 6, 8 chars)
 * - hsl(h, s%, l%) / hsl(h s% l%) / hsla()
 * - Named colors (transparent, etc.)
 */

/** Resolve var() with fallback: var(--foo, 1) → "1", var(--foo) → null */
function resolveVar(raw: string): string {
  return raw.replace(/var\([^,)]+,\s*([^)]+)\)/g, (_, fallback) => fallback.trim());
}

export function parseCssColor(raw: string | undefined): { hex: string; opacity: number } | null {
  if (!raw || raw === 'transparent' || raw === 'initial' || raw === 'none' || raw === 'inherit' || raw === 'currentcolor') return null;

  // Resolve var() fallback values first
  const resolved = resolveVar(raw);

  // Legacy comma syntax: rgb(r, g, b) / rgba(r, g, b, a)
  const rgbaComma = resolved.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+%?))?\s*\)/);
  if (rgbaComma) {
    const r = parseInt(rgbaComma[1]);
    const g = parseInt(rgbaComma[2]);
    const b = parseInt(rgbaComma[3]);
    const a = rgbaComma[4] !== undefined ? parseAlpha(rgbaComma[4]) : 1;
    if (a < 0.01) return null;
    return { hex: toHex(r, g, b), opacity: Math.round(a * 100) };
  }

  // Modern space syntax: rgb(r g b) / rgb(r g b / a)
  const rgbSpace = resolved.match(/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (rgbSpace) {
    const r = parseInt(rgbSpace[1]);
    const g = parseInt(rgbSpace[2]);
    const b = parseInt(rgbSpace[3]);
    const a = rgbSpace[4] !== undefined ? parseAlpha(rgbSpace[4]) : 1;
    if (a < 0.01) return null;
    return { hex: toHex(r, g, b), opacity: Math.round(a * 100) };
  }

  // color(srgb r g b) / color(srgb r g b / a)
  const srgbMatch = resolved.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (srgbMatch) {
    const r = Math.round(parseFloat(srgbMatch[1]) * 255);
    const g = Math.round(parseFloat(srgbMatch[2]) * 255);
    const b = Math.round(parseFloat(srgbMatch[3]) * 255);
    const a = srgbMatch[4] !== undefined ? parseFloat(srgbMatch[4]) : 1;
    if (a < 0.01) return null;
    return { hex: toHex(r, g, b), opacity: Math.round(a * 100) };
  }

  // HSL: hsl(h, s%, l%) or hsl(h s% l%) or hsla(h, s%, l%, a)
  const hslMatch = resolved.match(/hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%\s*(?:[,/]\s*([\d.]+%?))?\s*\)/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] !== undefined ? parseAlpha(hslMatch[4]) : 1;
    if (a < 0.01) return null;
    const [r, g, b] = hslToRgb(h, s, l);
    return { hex: toHex(r, g, b), opacity: Math.round(a * 100) };
  }

  // #hex — 3, 4, 6, or 8 characters
  if (resolved.startsWith('#')) {
    const h = resolved.slice(1);
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return { hex: toHex(r, g, b), opacity: 100 };
    }
    if (h.length === 4) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      const a = parseInt(h[3] + h[3], 16) / 255;
      if (a < 0.01) return null;
      return { hex: toHex(r, g, b), opacity: Math.round(a * 100) };
    }
    if (h.length >= 6) {
      const hex = `#${h.slice(0, 6)}`;
      const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      if (a < 0.01) return null;
      return { hex, opacity: Math.round(a * 100) };
    }
  }

  return null;
}

/** Parse to hex string without opacity */
export function parseColorToHex(color: string): string {
  const parsed = parseCssColor(color);
  return parsed?.hex ?? '#000000';
}

// ── Helpers ──

function parseAlpha(v: string): number {
  if (v.endsWith('%')) return parseFloat(v) / 100;
  return parseFloat(v);
}

function toHex(r: number, g: number, b: number): string {
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
