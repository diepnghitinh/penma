# Penma

**Import any website. Edit it like a design tool.**

Penma is a web-based design editor that imports live web pages and presents them as fully editable designs on an infinite canvas — like Figma, but starting from real websites instead of blank artboards.

## What it does

1. **Paste a URL** — Penma launches a headless browser, navigates to the page, and extracts the complete DOM tree with computed styles, assets, and layout information.

2. **Edit visually** — The imported page appears as a frame on an infinite canvas. Select any element, modify its styles, edit text inline, resize it, or drag it to a new position.

3. **Extract the design system** — Penma automatically analyzes the imported page and surfaces its color palette, typography scale, font families, spacing values, and border radii — the building blocks of the site's visual language.

4. **Work with multiple frames** — Import several URLs side by side on the same canvas. Compare designs, mix and match elements, or capture responsive variants at different screen sizes.

## Features

### Canvas
- Infinite canvas with pan (scroll, middle-click, Space+drag) and zoom (pinch, Cmd+/-)
- Multiple frames positioned side by side with 80px gap
- Frame labels showing hostname and viewport size
- Active frame highlighting
- Dot-grid background

### Import
- Screen size presets: Full HD+ (1920x1200), Desktop (1440x900), Laptop (1024x768), Tablet (768x1024), Mobile (375x812), Custom
- Animated step-by-step progress indicator during import
- SVG icons, images, and media preserved as raw HTML
- CSS `position: absolute/relative` maintained for badges, overlays, and tooltips
- Flexbox layouts auto-detected and converted to Auto Layout
- Mixed text + element content (e.g., icon + label) correctly captured

### Editing
- **Select** — Click any element on the canvas or in the layer tree
- **Text** — Double-click to edit inline (Enter to confirm, Escape to cancel)
- **Resize** — Drag corner/edge handles
- **Move** — Drag selected elements to reposition
- **Styles** — Full CSS property inspector grouped by category (layout, size, spacing, typography, background, border, effects)
- **Auto Layout** — Figma-style flexbox controls: direction, gap, padding, alignment grid, sizing (fixed/hug/fill), clip content
- **Undo/Redo** — Full history with Cmd+Z / Cmd+Shift+Z
- **Edit Settings** — Toggle text editing, resize, and move independently via the gear icon

### Panels
- **Layers** (left, resizable) — Tree view of all frames and their DOM hierarchy. Click to select, auto-expands to reveal deeply nested elements. Visibility and lock toggles. Auto Layout direction badges.
- **Design** (right, resizable) — CSS property editor for the selected element, plus Auto Layout controls
- **Design System** (right, tab) — Auto-extracted from the imported page:
  - Color palette grouped by text/background/border with copy-to-clipboard
  - Typography styles (unique font+size+weight combos used 2+ times)
  - Font size scale with visual bar chart and role labels
  - Font families with heading/body/mono classification
  - Spacing scale visualization
  - Border radii preview

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| V | Select tool |
| H | Hand tool |
| T | Text tool |
| Space+drag | Pan |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+I | Open import dialog |
| Cmd+0 | Reset zoom |
| Cmd+/- | Zoom in/out |
| Escape | Deselect / close dialog |

## Tech Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Zustand** + **Immer** for state management
- **Puppeteer** for server-side page capture
- **Lucide React** for icons
- **tinykeys** for keyboard shortcuts

### Design System (applied to Penma itself)
Sourced from UI/UX Pro Max skill recommendations for productivity/design tools:
- **Typography:** Space Grotesk (headings) + DM Sans (body)
- **Colors:** Primary #3B82F6, text #1E293B, muted #94A3B8, border #E2E8F0
- **Style:** Minimalism & Swiss Style — WCAG AAA, 200ms transitions, systematic z-index scale
- **Accessibility:** `prefers-reduced-motion` support, focus-visible outlines, keyboard navigation

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and import any URL.

## Architecture

```
src/
  app/                    # Next.js App Router
    api/
      fetch-url/          # Puppeteer page import endpoint
      proxy-asset/        # CORS asset proxy with caching
    page.tsx              # Editor entry point
  components/
    canvas/               # Infinite canvas, document renderer, overlays
    panels/               # Layer tree, style editor, auto layout, design system
    toolbar/              # Top toolbar, edit settings
    dialogs/              # Import URL dialog with progress
    editor/               # Editor shell layout
    ui/                   # Resizable panel
  store/
    slices/               # Zustand slices: document, selection, viewport, UI, history
  lib/
    canvas/               # Coordinate math
    design-system/        # Design system analyzer
    layout/               # Auto layout engine (flexbox)
    styles/               # Style resolver
    utils/                # Tree utilities
  types/                  # TypeScript interfaces
```

## License

MIT
