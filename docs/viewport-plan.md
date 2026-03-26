# Layer Viewport Plan

## Goal

Build a viewport system where all user interactions (click, drag-to-draw, drag-to-move, resize) produce results at the **exact screen position** the user acted upon, regardless of zoom level or pan offset.

## Current Architecture

### Coordinate Spaces

```
Screen Space (pixels on monitor)
  │  clientX, clientY — raw browser event coordinates
  │
  ├─ Canvas-Relative Space
  │    screenX - canvasRect.left, screenY - canvasRect.top
  │    Origin: top-left corner of the canvas DOM element
  │
  └─ Document Space (design coordinates)
       (canvasRelativeX - camera.x) / camera.zoom
       Origin: (0, 0) of the infinite canvas
```

### Camera Model

```typescript
interface Camera {
  x: number;   // horizontal pan offset (screen pixels)
  y: number;   // vertical pan offset (screen pixels)
  zoom: number; // scale factor (1 = 100%, 0.5 = 50%, 2 = 200%)
}
```

### Transform Pipeline

The viewport div applies a single CSS transform:

```
transform: translate(camera.x px, camera.y px) scale(camera.zoom)
```

A point at document position `(docX, docY)` appears on screen at:
```
screenX = docX × zoom + camera.x + canvasRect.left
screenY = docY × zoom + camera.y + canvasRect.top
```

### Conversion Functions (`src/lib/canvas/coordinates.ts`)

```typescript
// Screen → Document (for placing objects at click position)
screenToDocument(point, camera):
  x = (point.x - camera.x) / camera.zoom
  y = (point.y - camera.y) / camera.zoom

// Document → Screen (for overlays, previews)
documentToScreen(point, camera):
  x = point.x × camera.zoom + camera.x
  y = point.y × camera.zoom + camera.y

// Zoom keeping a focal point stationary on screen
zoomAtPoint(camera, focalPoint, newZoom):
  x = focalPoint.x - (focalPoint.x - camera.x) × (newZoom / camera.zoom)
  y = focalPoint.y - (focalPoint.y - camera.y) × (newZoom / camera.zoom)
```

**Critical rule**: `point` arguments to `screenToDocument` / `documentToScreen` are always **canvas-relative** (i.e. `clientX - canvasRect.left`), not raw viewport coords.

## Identity Point Contract

> **Any interaction that begins at screen position `(sx, sy)` must produce a visual result at `(sx, sy)`.**

This means:

| Interaction | Input | Output must appear at |
|---|---|---|
| Click to select | `clientX, clientY` | Element under that pixel is selected |
| Drag to draw shape | `start → end` screen rect | Shape covers that exact screen rect |
| Drag to move element | `delta` screen pixels | Element moves by `delta / zoom` doc pixels = `delta` screen pixels |
| Resize handle | `delta` screen pixels | Element grows by `delta / zoom` doc pixels = `delta` screen pixels |
| Click empty canvas | `clientX, clientY` | Selection clears (no `data-penma-id` under cursor) |

### How to guarantee identity

1. **Preview overlays**: use `position: fixed` with raw `clientX/clientY` — zero conversion, always matches cursor.
2. **Final placement**: convert screen → document **once**, at the moment of commit (pointerup). Read `camera` from `getState()` at that instant.
3. **Never store intermediate doc-space coords during drag** — store screen coords, convert at the end.
4. **Hit testing**: rely on the browser — elements rendered inside the viewport transform div are hit-tested natively. `e.target.closest('[data-penma-id]')` works at any zoom.

## Implementation Steps

### Step 1: Viewport Transform (ref-based, no React re-render)

**File**: `src/components/canvas/Canvas.tsx`

The viewport div's `transform` is applied via a Zustand store subscription that writes directly to a DOM ref:

```typescript
useEffect(() => {
  let prevCamera = useEditorStore.getState().camera;
  if (viewportRef.current) {
    viewportRef.current.style.transform = getCanvasTransform(prevCamera);
  }
  const unsub = useEditorStore.subscribe((state) => {
    if (state.camera !== prevCamera) {
      prevCamera = state.camera;
      if (viewportRef.current) {
        viewportRef.current.style.transform = getCanvasTransform(state.camera);
      }
    }
  });
  return unsub;
}, []);
```

This bypasses React reconciliation — pan/zoom updates the CSS transform in ~0ms instead of re-rendering the entire document tree.

### Step 2: Shape Drawing (`ShapeCreator.tsx`)

**Principle**: preview in screen space, commit in document space.

```
pointerdown  → store startClient = { clientX, clientY }
pointermove  → preview = { min(start, current), abs(delta) }  // screen coords
               render preview as position:fixed
pointerup    → toDoc(startClient) and toDoc(endClient) using camera at this moment
               create shape node with document-space left/top/width/height
```

No intermediate conversions. Preview always matches cursor. Shape always matches preview.

### Step 3: Element Move (`SelectionOverlay.tsx`)

**Principle**: accumulate screen-pixel deltas, convert to doc-space offsets.

```
pointerdown  → record startClient, record element's original doc-space position
pointermove  → screenDelta = current - start
               docDelta = screenDelta / camera.zoom
               update element position: original + docDelta
pointerup    → commit final position
```

Because `docDelta × zoom = screenDelta`, the element moves exactly with the cursor.

### Step 4: Element Resize (`SelectionOverlay.tsx`)

Same principle as move:

```
screenDelta = current - start
docDelta = screenDelta / camera.zoom
newWidth = originalWidth + docDelta.x  (or - for left/top handles)
newHeight = originalHeight + docDelta.y
```

### Step 5: Zoom at Point

When zooming (scroll wheel / pinch), the focal point must stay stationary:

```typescript
// focalPoint is canvas-relative: clientX - canvasRect.left
zoomAtPoint(camera, focalPoint, newZoom)
```

The `zoomAtPoint` function adjusts `camera.x/y` so that the document point under the focal pixel remains under that pixel after zoom.

### Step 6: Canvas Click (selection / deselection)

```
pointerdown → target = e.target
              if target.closest('[data-penma-id]') → element click (handled by DocumentRenderer)
              else → empty canvas click → clearSelection()
```

No coordinate conversion needed — browser hit testing handles zoom/pan natively.

## DOM Structure

```
<div ref={canvasRef}>                          ← receives pointer events
  <div class="background" pointer-events:none />
  <div ref={viewportRef}                       ← CSS transform: translate + scale
       style="transform: translate(cx,cy) scale(z)">
    <div class="canvas-shapes">                ← local://canvas doc
      <DocumentRenderer ... />
    </div>
    <div style="left: docX; top: docY">        ← each imported frame
      <frame-label scale(1/zoom) />
      <DocumentRenderer ... />
      <frame-resize-handles />
    </div>
  </div>
  <SelectionOverlay />                         ← position:fixed overlays
  <ShapeCreator />                             ← position:fixed preview
  <AutoLayoutOverlay />
  <MeasureOverlay />
</div>
```

## Invariants to Verify

1. `screenToDocument(documentToScreen(p, cam), cam) === p` (round-trip identity)
2. Preview rect screen position === final shape screen position (at same camera)
3. Drag-move delta in screen pixels === visual displacement in screen pixels
4. Zoom at cursor keeps cursor point stationary
5. Click on element selects it at any zoom/pan
6. Click on empty space clears selection at any zoom/pan

## Files Involved

| File | Role |
|---|---|
| `src/lib/canvas/coordinates.ts` | Conversion functions (screenToDocument, documentToScreen, zoomAtPoint) |
| `src/types/editor.ts` | Camera, Point, Rect types |
| `src/components/canvas/Canvas.tsx` | Viewport transform, pan, zoom, click handling |
| `src/components/canvas/ShapeCreator.tsx` | Draw shapes with identity-point preview |
| `src/components/canvas/SelectionOverlay.tsx` | Move/resize with screen-delta approach |
| `src/components/canvas/DocumentRenderer.tsx` | Element click/hover (browser-native hit testing) |
| `src/store/slices/camera-slice.ts` | Camera state (pan, zoomTo, zoomIn, zoomOut, resetView) |
