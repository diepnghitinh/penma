import { create } from 'zustand';
import { createViewportSlice, type ViewportSlice } from './slices/viewport-slice';
import { createDocumentSlice, type DocumentSlice } from './slices/document-slice';
import { createSelectionSlice, type SelectionSlice } from './slices/selection-slice';
import { createUISlice, type UISlice } from './slices/ui-slice';
import { createHistorySlice, type HistorySlice } from './slices/history-slice';
import { createPagesSlice, type PagesSlice } from './slices/pages-slice';

export type EditorState = ViewportSlice &
  DocumentSlice &
  SelectionSlice &
  UISlice &
  HistorySlice &
  PagesSlice;

export const useEditorStore = create<EditorState>()((...a) => ({
  ...createViewportSlice(...a),
  ...createDocumentSlice(...a),
  ...createSelectionSlice(...a),
  ...createUISlice(...a),
  ...createHistorySlice(...a),
  ...createPagesSlice(...a),
}));
