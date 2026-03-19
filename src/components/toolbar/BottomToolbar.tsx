'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MousePointer2,
  Hand,
  Frame,
  ScanLine,
  Scissors,
  Square,
  Minus,
  ArrowUpRight,
  Circle,
  Triangle,
  Star,
  ImagePlus,
  Pen,
  Pencil,
  Type,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { Tool } from '@/types/editor';

// ── Tool definitions ────────────────────────────────────────

interface ToolItem {
  id: Tool;
  icon: React.ElementType;
  label: string;
  shortcut?: string;
}

interface ToolGroup {
  items: ToolItem[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    items: [
      { id: 'select', icon: MousePointer2, label: 'Move', shortcut: 'V' },
      { id: 'hand', icon: Hand, label: 'Hand tool', shortcut: 'H' },
    ],
  },
  {
    items: [
      { id: 'frame', icon: Frame, label: 'Frame', shortcut: 'F' },
      { id: 'section', icon: ScanLine, label: 'Section', shortcut: 'S' },
      { id: 'slice', icon: Scissors, label: 'Slice' },
    ],
  },
  {
    items: [
      { id: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'R' },
      { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
      { id: 'arrow', icon: ArrowUpRight, label: 'Arrow', shortcut: '\u21E7L' },
      { id: 'ellipse', icon: Circle, label: 'Ellipse', shortcut: 'O' },
      { id: 'polygon', icon: Triangle, label: 'Polygon' },
      { id: 'star', icon: Star, label: 'Star' },
      { id: 'image', icon: ImagePlus, label: 'Image/video...', shortcut: '\u21E7\u2318K' },
    ],
  },
  {
    items: [
      { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
      { id: 'pencil', icon: Pencil, label: 'Pencil' },
    ],
  },
  {
    items: [
      { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
    ],
  },
];

// ── Dark dropdown (matches Figma style) ─────────────────────

const ToolDropdown: React.FC<{
  items: ToolItem[];
  activeId: Tool;
  onSelect: (id: Tool) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}> = ({ items, activeId, onSelect, onClose, anchorRect }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Position: centered above the anchor, like Figma
  const left = anchorRect.left + anchorRect.width / 2;

  return (
    <div
      ref={ref}
      className="fixed rounded-xl py-2"
      style={{
        left,
        bottom: window.innerHeight - anchorRect.top + 8,
        transform: 'translateX(-50%)',
        background: '#2C2C2C',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 60,
        minWidth: 200,
      }}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            className="flex w-full items-center gap-3 px-3 py-2 cursor-pointer"
            style={{ transition: 'background 100ms' }}
            onClick={() => { onSelect(item.id); onClose(); }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Checkmark column */}
            <div className="w-4 flex-shrink-0 flex items-center justify-center">
              {isActive && <Check size={14} color="white" />}
            </div>
            {/* Icon */}
            <item.icon size={16} color="white" strokeWidth={1.5} />
            {/* Label */}
            <span className="text-[13px] flex-1 text-white">{item.label}</span>
            {/* Shortcut */}
            {item.shortcut && (
              <span className="text-[12px] text-white/40 ml-4">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ── Main bottom toolbar ─────────────────────────────────────

export const BottomToolbar: React.FC = () => {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Track last selected sub-tool per group
  const [selectedPerGroup, setSelectedPerGroup] = useState<Record<number, number>>({});

  useEffect(() => {
    TOOL_GROUPS.forEach((group, gi) => {
      const idx = group.items.findIndex((item) => item.id === activeTool);
      if (idx >= 0) {
        setSelectedPerGroup((prev) => ({ ...prev, [gi]: idx }));
      }
    });
  }, [activeTool]);

  const handleGroupClick = useCallback((gi: number) => {
    const group = TOOL_GROUPS[gi];
    const selectedIdx = selectedPerGroup[gi] || 0;
    setActiveTool(group.items[selectedIdx].id);
    setOpenGroup(null);
  }, [selectedPerGroup, setActiveTool]);

  const handleChevronClick = useCallback((gi: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const btn = (e.currentTarget.closest('[data-tool-group]') as HTMLElement);
    if (btn) {
      setAnchorRect(btn.getBoundingClientRect());
    }
    setOpenGroup(openGroup === gi ? null : gi);
  }, [openGroup]);

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center rounded-2xl px-1 py-1"
      style={{
        background: 'var(--penma-surface)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.10), 0 0 0 1px var(--penma-border)',
        zIndex: 'var(--z-toolbar)',
      }}
    >
      {TOOL_GROUPS.map((group, gi) => {
        const selectedIdx = selectedPerGroup[gi] || 0;
        const activeItem = group.items[selectedIdx];
        const isGroupActive = group.items.some((item) => item.id === activeTool);
        const hasDropdown = group.items.length > 1;
        const Icon = activeItem.icon;

        return (
          <React.Fragment key={gi}>
            {gi > 0 && <div className="w-px h-6 mx-0.5" style={{ background: 'var(--penma-border)' }} />}

            <div className="relative flex items-center" data-tool-group>
              {/* Main tool button */}
              <button
                className="flex items-center justify-center rounded-xl cursor-pointer"
                style={{
                  width: isGroupActive ? 40 : 36,
                  height: isGroupActive ? 40 : 36,
                  color: isGroupActive ? '#fff' : 'var(--penma-text-secondary)',
                  background: isGroupActive ? 'var(--penma-primary)' : 'transparent',
                  transition: 'all 150ms',
                }}
                onClick={() => handleGroupClick(gi)}
                title={`${activeItem.label}${activeItem.shortcut ? ` (${activeItem.shortcut})` : ''}`}
              >
                <Icon size={20} strokeWidth={1.5} />
              </button>

              {/* Dropdown chevron */}
              {hasDropdown && (
                <button
                  className="flex items-center justify-center cursor-pointer -ml-1.5"
                  style={{
                    width: 12,
                    height: 20,
                    color: isGroupActive ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
                    opacity: 0.6,
                    transition: 'opacity 100ms',
                  }}
                  onClick={(e) => handleChevronClick(gi, e)}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                >
                  <ChevronDown size={10} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {openGroup === gi && anchorRect && (
              <ToolDropdown
                items={group.items}
                activeId={activeTool}
                onSelect={(id) => setActiveTool(id)}
                onClose={() => setOpenGroup(null)}
                anchorRect={anchorRect}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
