# Penma

**Turn any website into an editable design — instantly.**

Penma imports live web pages and transforms them into fully editable designs on an infinite canvas. Think Figma, but you start from real websites instead of blank artboards.

![Penma Editor](images/demo-1.png)

## Why Penma

- **Skip the screenshot.** Import a URL and get a real, editable design — not a flat image. Every element is selectable, stylable, and exportable.
- **Reverse-engineer any UI.** Inspect spacing, colors, typography, and layout of any live website. Penma extracts the full design system automatically.
- **Export to Figma.** One click to generate Figma-compatible JSON with auto layout, components, and design tokens preserved.
- **Compare responsive layouts.** Import the same URL at Desktop, Tablet, and Mobile side by side on one canvas.

## How it works

1. **Paste a URL** — A headless browser captures the complete DOM: styles, assets, layout, and structure.
2. **Edit visually** — Select any element, change styles, edit text inline, resize, reposition. Full undo/redo.
3. **Extract the design system** — Colors, typography, spacing, and radii are auto-detected and organized.
4. **Export** — Download as Figma JSON, HTML, or Penma's native format.

## Key features

**Canvas** — Infinite pan & zoom, multi-frame workspace, dot-grid background, frame resize handles.

**Import** — 5 screen presets + custom sizes, real-time progress, auto-detected flexbox layouts converted to Auto Layout, design system components extracted automatically.

**Editing** — Inline text editing, drag-to-move, resize handles, full CSS inspector, Figma-style Auto Layout (direction, gap, padding, alignment, sizing), position & constraints panel, undo/redo history.

**Panels** — Layer tree with expand/collapse, unified Layout panel with auto layout toggle, Position panel with alignment & constraints, Fill editor, Design System tab (colors, typography, spacing, radii).

**Export** — Figma JSON with auto layout, components, absolute positioning, and image/SVG references. HTML and Penma JSON formats.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and import any URL.

## Tech stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4
- **Zustand** + Immer for state management
- **Puppeteer** for server-side page capture

## License

MIT
