You are a senior frontend engineer building a design editor similar to Figma.

Your task is to implement a "Drag & Drop Element System" between a LEFT SIDEBAR (component library) and a CANVAS.

---

## CONTEXT

We have 2 main areas:

1. LEFT SIDEBAR (palette / component library)
- Contains a list of draggable elements (rectangles, text, images, components)
- Each item is a "template" (not yet instantiated on canvas)

2. CANVAS
- A freeform 2D space where nodes (elements) exist
- Supports moving, selecting, and layout features

---

## GOAL

Implement a full drag-and-drop system that supports:

### A. Drag from SIDEBAR → CANVAS
- User drags a component from sidebar
- A "ghost preview" follows the cursor
- When dropped on canvas:
  → Create a new node instance
  → Position it at drop location
  → Apply default size/styles

---

### B. Drag INSIDE CANVAS
- Move existing elements
- Integrate with:
  - snapping
  - smart guides
  - auto layout (if applicable)

---

### C. Drag from CANVAS → SIDEBAR (Detach / Remove)
- Dragging element back to sidebar:
  → Remove it from canvas
  → (optional) Convert to reusable component

---

## ARCHITECTURE REQUIREMENTS

Design a modular system with clear separation:

### 1. STATE LAYER

Define global editor state:

- nodes: Map<NodeId, Node>
- selection: NodeId[]
- dragState:
    {
      type: "none" | "from-sidebar" | "move-node"
      nodeId?: string
      templateId?: string
      offset?: {x, y}
      currentPosition: {x, y}
    }

---

### 2. COMPONENTS

Break UI into components:

- Sidebar
  - SidebarItem (draggable template)

- Canvas
  - CanvasRoot
  - CanvasNode (render each node)
  - DragOverlay (ghost preview)
  - SmartGuidesOverlay

---

### 3. CORE MODULES

Implement logic in pure functions:

- createNodeFromTemplate(template, position)
- updateNodePosition(nodeId, position)
- removeNode(nodeId)

- handleDragStart(event, sourceType)
- handleDragMove(event)
- handleDragEnd(event)

---

### 4. DRAG SYSTEM

Do NOT rely on native HTML5 drag-and-drop.

Implement custom pointer-based drag system:
- pointerdown → start drag
- pointermove → update position
- pointerup → drop

Track:
- cursor position
- offset between cursor and element origin

---

### 5. DROP LOGIC

When dropping:

IF dragState.type == "from-sidebar":
  → create new node

IF dragState.type == "move-node":
  → update node position

IF dropped inside sidebar area:
  → remove node from canvas

---

### 6. COORDINATE SYSTEM

- Canvas may have zoom & pan
- Convert screen coordinates → canvas coordinates

Provide helper:
- screenToCanvas(point, viewport)

---

### 7. VISUAL FEEDBACK

- Ghost preview while dragging
- Highlight canvas drop area
- Show invalid drop (e.g. outside bounds)
- Smooth transitions

---

### 8. PERFORMANCE

- Avoid re-rendering all nodes during drag
- Use requestAnimationFrame for updates
- Use memoization/selectors for state

---

### 9. EDGE CASES

- Dragging multiple selected nodes
- Dragging outside viewport
- Fast mouse movement
- Cancel drag (ESC key)
- Nested nodes (future extensibility)

---

### 10. OUTPUT

Provide:
- TypeScript code
- Clear interfaces/types
- React-based implementation (functional components + hooks)
- Example usage
- Comments explaining key logic

---

## OPTIONAL (ADVANCED)

- Support multi-select drag
- Integrate snapping + smart guides
- Support drop into Auto Layout containers
- Undo/redo integration

---

## DESIGN PRINCIPLES

- Clean architecture (separate state, logic, UI)
- Extensible (future: groups, constraints, layout)
- Similar UX to Figma (but simplified)
