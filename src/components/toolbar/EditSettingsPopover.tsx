'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Settings, Type, Move, Scaling, Lock, Unlock } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { EditSettings } from '@/store/slices/ui-slice';

const SETTING_ITEMS: { key: keyof EditSettings; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'textEditable', label: 'Edit Text', icon: Type, description: 'Double-click to edit text content' },
  { key: 'resizable', label: 'Resize', icon: Scaling, description: 'Drag handles to resize elements' },
  { key: 'movable', label: 'Move', icon: Move, description: 'Drag elements to reposition them' },
];

export const EditSettingsPopover: React.FC = () => {
  const [open, setOpen] = useState(false);
  const editEnabled = useEditorStore((s) => s.editEnabled);
  const toggleEditEnabled = useEditorStore((s) => s.toggleEditEnabled);
  const editSettings = useEditorStore((s) => s.editSettings);
  const toggleEditSetting = useEditorStore((s) => s.toggleEditSetting);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const el = popoverRef.current;
    if (!el) return;
    if (open) { el.hidePopover(); setOpen(false); }
    else { el.showPopover(); setOpen(true); }
  };

  // Sync state when popover is dismissed (e.g. click outside, Escape)
  useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      setOpen((e as ToggleEvent).newState === 'open');
    };
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, []);

  // Position the popover below the button
  useEffect(() => {
    if (!open || !btnRef.current || !popoverRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    popoverRef.current.style.top = `${rect.bottom + 6}px`;
    popoverRef.current.style.left = `${rect.right - popoverRef.current.offsetWidth}px`;
  }, [open]);

  const allEnabled = Object.values(editSettings).every(Boolean);
  const noneEnabled = Object.values(editSettings).every((v) => !v);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded cursor-pointer"
        style={{
          color: !editEnabled ? 'var(--penma-danger)' : noneEnabled ? 'var(--penma-cta)' : allEnabled ? 'var(--penma-text-muted)' : 'var(--penma-cta)',
          background: open ? 'var(--penma-hover-bg)' : 'transparent',
          transition: 'var(--transition-base)',
        }}
        title={editEnabled ? 'Edit Settings' : 'Editing Disabled'}
      >
        {editEnabled ? <Settings size={16} /> : <Lock size={16} />}
      </button>

      {/* Popover renders in top layer — above all z-index stacking contexts */}
      <div
        ref={popoverRef}
        popover="auto"
        className="w-56 rounded-lg shadow-lg border m-0"
        style={{
          background: 'var(--penma-surface)',
          borderColor: 'var(--penma-border)',
          position: 'fixed',
        }}
      >
        {/* Master toggle */}
        <button
          onClick={toggleEditEnabled}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 cursor-pointer"
          style={{
            borderBottom: '1px solid var(--penma-border)',
            transition: 'var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {editEnabled ? <Unlock size={15} style={{ color: 'var(--penma-primary)' }} /> : <Lock size={15} style={{ color: 'var(--penma-danger)' }} />}
          <div className="flex-1 text-left">
            <div className="text-[11px] font-semibold" style={{ color: 'var(--penma-text)', fontFamily: 'var(--font-heading)' }}>
              {editEnabled ? 'Editing Enabled' : 'Editing Disabled'}
            </div>
            <div className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>
              Master switch for all editing
            </div>
          </div>
          <div
            className="w-8 h-[18px] rounded-full flex items-center px-0.5 flex-shrink-0"
            style={{
              background: editEnabled ? 'var(--penma-primary)' : 'var(--penma-border)',
              transition: 'var(--transition-base)',
            }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full bg-white shadow-sm"
              style={{
                transform: editEnabled ? 'translateX(14px)' : 'translateX(0)',
                transition: 'var(--transition-base)',
              }}
            />
          </div>
        </button>

        {/* Individual toggles */}
        <div className="py-1" style={{ opacity: editEnabled ? 1 : 0.4, pointerEvents: editEnabled ? 'auto' : 'none' }}>
          {SETTING_ITEMS.map(({ key, label, icon: Icon, description }) => (
            <button
              key={key}
              onClick={() => toggleEditSetting(key)}
              className="flex w-full items-center gap-2.5 px-3 py-2 cursor-pointer"
              style={{ transition: 'var(--transition-fast)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--penma-hover-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon size={14} style={{ color: editSettings[key] ? 'var(--penma-primary)' : 'var(--penma-text-muted)' }} />
              <div className="flex-1 text-left">
                <div className="text-[11px] font-medium" style={{ color: 'var(--penma-text)' }}>{label}</div>
                <div className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>{description}</div>
              </div>
              {/* Toggle switch */}
              <div
                className="w-7 h-4 rounded-full flex items-center px-0.5 flex-shrink-0"
                style={{
                  background: editSettings[key] ? 'var(--penma-primary)' : 'var(--penma-border)',
                  transition: 'var(--transition-base)',
                }}
              >
                <div
                  className="w-3 h-3 rounded-full bg-white shadow-sm"
                  style={{
                    transform: editSettings[key] ? 'translateX(12px)' : 'translateX(0)',
                    transition: 'var(--transition-base)',
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
