# Sizing Logic Architecture

The sizing logic is spread across a few key functions:

## Import-time sizing detection
- `detectChildSizing()` in `src/lib/import/detect-layout.ts:101-140` — determines if an element is `fixed`, `hug`, or `fill` based on CSS styles and parent auto-layout context

## Render-time sizing application
- `DocumentRendererInner()` in `src/components/canvas/DocumentRenderer.tsx`:
  - Lines 177-206 — auto-layout children: enforces fixed width/height from `bounds`, applies `minWidth`/`minHeight`
  - Lines 209-238 — non-auto-layout elements: same logic but also sets `maxWidth`/`maxHeight` and `flexShrink: 0`

## Layout panel display
- `LayoutPanel.tsx:430-431` — reads `sizing?.horizontal` / `sizing?.vertical` (defaults to `'fixed'`), shows dimensions from `overrides['width']` → `computed['width']` → `bounds.width`

## Flow
`detectChildSizing` decides the mode at import, `DocumentRendererInner` enforces the actual pixel dimensions at render time using `node.bounds` and `node.sizing`.
