You are a senior frontend engineer building a canvas-based design editor similar to Figma.

Your task is to implement a "Smart Guides & Snapping System" for aligning elements on a 2D canvas.

## CONTEXT
We have a canvas with multiple rectangular nodes (elements). Each node has:
- id
- x, y (top-left)
- width, height

The system supports drag & move interactions.

## GOAL
Implement a system that provides:
1. Smart alignment guides (visual lines)
2. Snapping behavior
3. Equal spacing detection between elements

## FEATURES

### 1. SMART GUIDES (visual feedback)
While dragging an element, show guide lines when:
- Left / right / top / bottom edges align with another element
- Horizontal or vertical center aligns
- Element aligns with canvas center

Return a list of guide lines:
{
  type: "vertical" | "horizontal",
  position: number,
  start: number,
  end: number
}

---

### 2. SNAPPING
When the dragged element is within a threshold (e.g. 5px):
- Snap to nearest edge (left/right/top/bottom)
- Snap to center alignment
- Snap to canvas center

Return adjusted x, y position.

---

### 3. SPACING DETECTION (Equal spacing)
Detect when 3 elements form equal spacing:
[A]   [B]   [C]

While dragging B:
- If distance(A, B) ≈ distance(B, C)
→ show spacing indicator

Return:
{
  type: "equal-spacing",
  direction: "horizontal" | "vertical",
  value: number
}

---

### 4. PERFORMANCE
- Must handle 100+ elements smoothly
- Use spatial indexing (e.g. quadtree or simple bounding box filtering)
- Only check nearby elements (within threshold range)

---

### 5. ARCHITECTURE

Split into modules:

- getAlignmentGuides(draggedNode, allNodes)
- getSnappingPosition(draggedNode, allNodes)
- getEqualSpacing(draggedNode, allNodes)

---

### 6. IMPLEMENTATION DETAILS

- Use pure functions where possible
- No DOM dependency (logic layer only)
- Provide example usage with mock data
- Include edge cases:
  - overlapping elements
  - multiple candidates → choose closest snap
  - floating point tolerance

---

### 7. OPTIONAL (ADVANCED)
- Add priority system:
  center alignment > edge alignment
- Combine multiple guides at once
- Support grid snapping

---

## OUTPUT FORMAT

- Clean, modular TypeScript code
- Include types/interfaces
- Include comments explaining logic
- Include example input/output
