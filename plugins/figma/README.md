# Penma → Figma Plugin

Imports Penma JSON exports into Figma as real design nodes.

## Setup

1. Install Figma plugin typings:
   ```bash
   cd plugins/figma
   npm init -y
   npm install --save-dev @figma/plugin-typings typescript
   ```

2. Build the plugin:
   ```bash
   npx tsc
   ```

3. In Figma Desktop:
   - Go to **Plugins → Development → Import plugin from manifest**
   - Select `plugins/figma/manifest.json`

## Usage

1. In **Penma**, select a frame or element and use the **Export** panel to export as **Figma JSON** or **Penma JSON**
2. In **Figma**, run the **Penma Import** plugin
3. Either:
   - **Drop** the exported `.json` file onto the plugin
   - **Paste** the JSON content into the text area
4. Click **Import to Figma**

## Supported Formats

| Format | Description |
|--------|-------------|
| **Figma JSON** | Exported from Penma with node types (FRAME, TEXT, RECTANGLE), fills, strokes, auto layout |
| **Penma JSON** | Raw Penma document with `rootNode`, auto-converted to Figma nodes |
| **Single Node** | Any JSON with a `type` field (FRAME, TEXT, etc.) |

## What Gets Imported

- **Frames** with auto layout (direction, gap, padding, alignment)
- **Text** with font family, size, weight, color, alignment, line height, letter spacing
- **Rectangles** with fills, strokes, corner radius
- **Nested children** preserving hierarchy
- **Colors** (SOLID fills from rgba/hex)
- **Effects** (drop shadows)
- **Opacity**, **visibility**, **locked** state
