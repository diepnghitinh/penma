import { create } from 'zustand';
import { createViewportSlice, type ViewportSlice } from './slices/viewport-slice';
import { createDocumentSlice, type DocumentSlice } from './slices/document-slice';
import { createSelectionSlice, type SelectionSlice } from './slices/selection-slice';
import { createUISlice, type UISlice } from './slices/ui-slice';
import { createHistorySlice, type HistorySlice } from './slices/history-slice';
import { createPagesSlice, type PagesSlice } from './slices/pages-slice';
import { createProjectSlice, type ProjectSlice } from './slices/project-slice';
import type { GuideLine, SpacingIndicator } from '@/lib/canvas/smart-guides';

export interface SmartGuidesSlice {
  smartGuides: GuideLine[];
  spacingIndicators: SpacingIndicator[];
  setSmartGuides: (guides: GuideLine[], spacings: SpacingIndicator[]) => void;
  clearSmartGuides: () => void;
}

export type EditorState = ViewportSlice &
  DocumentSlice &
  SelectionSlice &
  UISlice &
  HistorySlice &
  PagesSlice &
  ProjectSlice &
  SmartGuidesSlice;

export const useEditorStore = create<EditorState>()((...a) => {
  const [set] = a;
  return {
    ...createViewportSlice(...a),
    ...createDocumentSlice(...a),
    ...createSelectionSlice(...a),
    ...createUISlice(...a),
    ...createHistorySlice(...a),
    ...createPagesSlice(...a),
    ...createProjectSlice(...a),
    // Smart guides state
    smartGuides: [],
    spacingIndicators: [],
    setSmartGuides: (guides, spacings) => set({ smartGuides: guides, spacingIndicators: spacings }),
    clearSmartGuides: () => set({ smartGuides: [], spacingIndicators: [] }),
  };
});
