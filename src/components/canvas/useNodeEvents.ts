'use client';

import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { PenmaNode } from '@/types/document';
import { useEditorStore } from '@/store/editor-store';

export function useNodeEvents(node: PenmaNode) {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const { activeTool, select } = useEditorStore.getState();
      if (activeTool !== 'select') return;
      e.stopPropagation();
      select(node.id, e.shiftKey);
    },
    [node.id]
  );

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { selectedIds, select } = useEditorStore.getState();
      if (!selectedIds.includes(node.id)) {
        select(node.id, false);
      }
      window.dispatchEvent(new CustomEvent('penma:contextmenu', {
        detail: { x: e.clientX, y: e.clientY, nodeId: node.id },
      }));
    },
    [node.id]
  );

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      const { editEnabled, editSettings, pushHistory, updateNodeText } = useEditorStore.getState();
      if (!editEnabled || !editSettings.textEditable) return;
      const hasEditableText = node.textContent || (e.currentTarget as HTMLElement).textContent?.trim();
      if (!hasEditableText) return;
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      el.contentEditable = 'true';
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      const originalText = el.textContent?.trim() || '';
      const handleBlur = () => {
        el.contentEditable = 'false';
        const newText = el.textContent?.trim() || '';
        if (newText !== originalText) {
          pushHistory('Edit text');
          updateNodeText(node.id, newText);
        }
        el.removeEventListener('blur', handleBlur);
        el.removeEventListener('keydown', handleKey);
      };
      const handleKey = (ke: KeyboardEvent) => {
        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          el.blur();
        }
        if (ke.key === 'Escape') {
          el.textContent = originalText;
          el.blur();
        }
      };
      el.addEventListener('blur', handleBlur);
      el.addEventListener('keydown', handleKey);
    },
    [node.textContent, node.id]
  );

  const handleMouseEnter = useCallback(() => {
    const { activeTool, setHovered } = useEditorStore.getState();
    if (activeTool === 'select') {
      setHovered(node.id);
    }
  }, [node.id]);

  const handleMouseLeave = useCallback(() => {
    useEditorStore.getState().setHovered(null);
  }, []);

  return { handleClick, handleContextMenu, handleDoubleClick, handleMouseEnter, handleMouseLeave };
}
