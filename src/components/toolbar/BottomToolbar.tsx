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
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = ({ items, activeId, onSelect, onClose, onMouseEnter, onMouseLeave }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 rounded-2xl overflow-hidden"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: 'linear-gradient(135deg, #383838 0%, #2A2A2A 100%)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset',
        zIndex: 60,
        minWidth: 220,
        padding: '6px 0',
        backdropFilter: 'blur(20px)',
      }}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className="flex w-full items-start cursor-pointer"
            style={{
              padding: '8px 14px',
              gap: 12,
              transition: 'background 80ms',
            }}
            onClick={() => { onSelect(item.id); onClose(); }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Checkmark */}
            <div style={{ width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isActive && <Check size={15} color="white" strokeWidth={2.5} />}
            </div>
            {/* Icon */}
            <div style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={isActive ? 'white' : 'rgba(255,255,255,0.75)'} strokeWidth={1.5} />
            </div>
            {/* Label */}
            <span style={{
              flex: 1,
              fontSize: 13.5,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'white' : 'rgba(255,255,255,0.85)',
              letterSpacing: '-0.01em',
            }}>
              {item.label}
            </span>
            {/* Shortcut */}
            {item.shortcut && (
              <span style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.3)',
                marginLeft: 16,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.02em',
              }}>
                {item.shortcut}
              </span>
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

  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChevronEnter = useCallback((gi: number) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setOpenGroup(gi);
  }, []);

  const handleChevronLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setOpenGroup(null), 200);
  }, []);

  const handleDropdownEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }, []);

  const handleDropdownLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setOpenGroup(null), 150);
  }, []);

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

            <div className="relative flex items-start" data-tool-group>
              {/* Main tool button */}
              <button
                className="group/btn relative flex items-center justify-center rounded-xl cursor-pointer"
                style={{
                  width: isGroupActive ? 40 : 36,
                  height: isGroupActive ? 40 : 36,
                  color: isGroupActive ? '#fff' : 'var(--penma-text-secondary)',
                  background: isGroupActive ? 'var(--penma-primary)' : 'transparent',
                  transition: 'all 150ms',
                }}
                onClick={() => handleGroupClick(gi)}
              >
                <Icon size={20} strokeWidth={1.5} />
                {/* Tooltip — only when dropdown is closed */}
                {openGroup !== gi && (
                  <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap rounded-lg px-2.5 py-1.5"
                    style={{ background: '#2C2C2C', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 61 }}
                  >
                    <span className="text-[11px] text-white font-medium">{activeItem.label}</span>
                    {activeItem.shortcut && (
                      <span className="text-[11px] text-white/40 ml-2">{activeItem.shortcut}</span>
                    )}
                  </div>
                )}
              </button>

              {/* Dropdown chevron */}
              {hasDropdown && (
                <button
                  className="flex items-center justify-center cursor-pointer rounded"
                  style={{
                    width: 24,
                    height: 32,
                    color: isGroupActive ? 'var(--penma-primary)' : 'var(--penma-text-muted)',
                    opacity: 0.6,
                    transition: 'opacity 100ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; handleChevronEnter(gi); }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; handleChevronLeave(); }}
                >
                  <ChevronDown size={12} />
                </button>
              )}

              {/* Dropdown — absolute, positioned above this group */}
              {openGroup === gi && (
                <ToolDropdown
                  items={group.items}
                  activeId={activeTool}
                  onSelect={(id) => { setActiveTool(id); setOpenGroup(null); }}
                  onClose={() => setOpenGroup(null)}
                  onMouseEnter={handleDropdownEnter}
                  onMouseLeave={handleDropdownLeave}
                />
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
