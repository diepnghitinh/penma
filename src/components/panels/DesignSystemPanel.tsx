'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  Palette,
  Type,
  ALargeSmall,
  Space,
  Circle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { analyzeDesignSystem } from '@/lib/design-system/analyzer';
import type { DesignSystem, ColorToken, TypographyStyle } from '@/types/design-system';

// ── Copy helper ─────────────────────────────────────────────

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 cursor-pointer"
      style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-fast)' }}
      title="Copy"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
};

// ── Section wrapper ─────────────────────────────────────────

const Section: React.FC<{
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon: Icon, count, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--penma-border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full h-8 items-center gap-2 px-3 cursor-pointer"
        style={{ transition: 'var(--transition-fast)' }}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Icon size={13} style={{ color: 'var(--penma-primary)' }} />
        <span className="text-[11px] font-semibold" style={{ color: 'var(--penma-text)', fontFamily: 'var(--font-heading)' }}>
          {title}
        </span>
        <span className="ml-auto text-[10px] rounded-full px-1.5 py-0.5" style={{ background: 'var(--penma-primary-light)', color: 'var(--penma-primary)' }}>
          {count}
        </span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
};

// ── Color grid ──────────────────────────────────────────────

const ColorGrid: React.FC<{ colors: ColorToken[]; category: string }> = ({ colors, category }) => {
  if (colors.length === 0) return null;
  return (
    <div className="mb-2">
      <span className="text-[9px] uppercase font-medium tracking-wider mb-1 block" style={{ color: 'var(--penma-text-muted)' }}>
        {category}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <div key={c.value} className="group flex flex-col items-center gap-0.5">
            <div className="relative">
              <div
                className="w-8 h-8 rounded-lg border cursor-pointer"
                style={{
                  background: c.value,
                  borderColor: 'var(--penma-border)',
                  transition: 'var(--transition-fast)',
                }}
                title={`${c.value} — used ${c.count}×`}
              />
              <div className="absolute -top-1 -right-1">
                <CopyButton text={c.value} />
              </div>
            </div>
            <span className="text-[8px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Typography style card ───────────────────────────────────

const TypoCard: React.FC<{ style: TypographyStyle }> = ({ style: s }) => (
  <div className="group flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid var(--penma-border)' }}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold" style={{ color: 'var(--penma-primary)', fontFamily: 'var(--font-heading)' }}>
          {s.name}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--penma-text-muted)' }}>×{s.count}</span>
      </div>
      <p
        className="truncate text-[11px] mt-0.5"
        style={{
          fontFamily: s.fontFamily,
          fontSize: Math.min(parseFloat(s.fontSize), 20) + 'px',
          fontWeight: s.fontWeight,
          color: s.color,
          lineHeight: '1.4',
        }}
      >
        The quick brown fox
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[9px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
          {s.fontFamily}
        </span>
        <span className="text-[9px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
          {s.fontSize} / {s.fontWeight}
        </span>
      </div>
    </div>
    <div
      className="w-4 h-4 rounded-sm flex-shrink-0"
      style={{ background: s.color, border: '1px solid var(--penma-border)' }}
      title={s.color}
    />
  </div>
);

// ── Font size scale bar ─────────────────────────────────────

const FontSizeScale: React.FC<{ sizes: { value: string; px: number; count: number; role?: string }[] }> = ({ sizes }) => {
  const maxPx = Math.max(...sizes.map((s) => s.px), 1);
  return (
    <div className="flex flex-col gap-1">
      {sizes.map((s) => (
        <div key={s.value} className="group flex items-center gap-2">
          <span className="w-8 text-right text-[9px] font-mono flex-shrink-0" style={{ color: 'var(--penma-text-muted)' }}>
            {s.value}
          </span>
          <div className="flex-1 h-3 rounded-sm" style={{ background: 'var(--penma-hover-bg)' }}>
            <div
              className="h-full rounded-sm"
              style={{
                width: `${Math.max((s.px / maxPx) * 100, 8)}%`,
                background: 'var(--penma-primary)',
                opacity: 0.6,
                transition: 'var(--transition-base)',
              }}
            />
          </div>
          <span className="w-12 text-[9px] flex-shrink-0" style={{ color: 'var(--penma-text-muted)' }}>
            {s.role || ''}
          </span>
          <span className="w-6 text-right text-[9px] font-mono flex-shrink-0" style={{ color: 'var(--penma-text-muted)' }}>
            ×{s.count}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Spacing scale ───────────────────────────────────────────

const SpacingScale: React.FC<{ values: number[] }> = ({ values }) => (
  <div className="flex flex-wrap gap-2">
    {values.map((v) => (
      <div key={v} className="flex flex-col items-center gap-0.5">
        <div
          className="rounded border"
          style={{
            width: Math.min(v, 40),
            height: Math.min(v, 40),
            minWidth: 12,
            minHeight: 12,
            background: 'var(--penma-primary-light)',
            borderColor: 'var(--penma-primary)',
            opacity: 0.6,
          }}
        />
        <span className="text-[8px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>{v}</span>
      </div>
    ))}
  </div>
);

// ── Main panel ──────────────────────────────────────────────

export const DesignSystemPanel: React.FC = () => {
  const documents = useEditorStore((s) => s.documents);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const document = documents.find((d) => d.id === activeDocumentId) ?? documents[0] ?? null;

  const designSystem = useMemo<DesignSystem | null>(() => {
    if (!document) return null;
    return analyzeDesignSystem(document.rootNode);
  }, [document]);

  if (!document || !designSystem) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4" style={{ color: 'var(--penma-text-muted)' }}>
        <Palette size={24} className="mb-2" />
        <span className="text-xs">Import a page to extract its design system</span>
      </div>
    );
  }

  const textColors = designSystem.colors.filter((c) => c.category === 'text');
  const bgColors = designSystem.colors.filter((c) => c.category === 'background');
  const borderColors = designSystem.colors.filter((c) => c.category === 'border');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-9 items-center px-3" style={{ borderBottom: '1px solid var(--penma-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)', fontFamily: 'var(--font-heading)' }}>
          Design System
        </span>
      </div>

      <div className="flex-1 overflow-y-auto penma-scrollbar">
        {/* Colors */}
        <Section title="Colors" icon={Palette} count={designSystem.colors.length}>
          <ColorGrid colors={textColors} category="Text" />
          <ColorGrid colors={bgColors} category="Background" />
          <ColorGrid colors={borderColors} category="Border" />
        </Section>

        {/* Typography Styles */}
        <Section title="Typography" icon={Type} count={designSystem.typographyStyles.length}>
          {designSystem.typographyStyles.map((s) => (
            <TypoCard key={s.id} style={s} />
          ))}
        </Section>

        {/* Font Scale */}
        <Section title="Font Scale" icon={ALargeSmall} count={designSystem.fontSizes.length} defaultOpen={false}>
          <FontSizeScale sizes={designSystem.fontSizes} />
        </Section>

        {/* Font Families */}
        <Section title="Font Families" icon={Type} count={designSystem.fontFamilies.length} defaultOpen={false}>
          {designSystem.fontFamilies.map((f) => (
            <div key={f.shortName} className="group flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--penma-border)' }}>
              <div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--penma-text)', fontFamily: f.value }}>
                  {f.shortName}
                </span>
                <span className="ml-1.5 text-[9px] rounded px-1 py-0.5" style={{
                  background: f.role === 'Heading' ? 'var(--penma-primary-light)' : f.role === 'Monospace' ? '#fef3c7' : 'var(--penma-hover-bg)',
                  color: f.role === 'Heading' ? 'var(--penma-primary)' : f.role === 'Monospace' ? '#92400e' : 'var(--penma-text-muted)',
                }}>
                  {f.role}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>×{f.count}</span>
                <CopyButton text={f.shortName} />
              </div>
            </div>
          ))}
        </Section>

        {/* Spacing */}
        {designSystem.spacingScale.length > 0 && (
          <Section title="Spacing" icon={Space} count={designSystem.spacingScale.length} defaultOpen={false}>
            <SpacingScale values={designSystem.spacingScale} />
          </Section>
        )}

        {/* Border Radii */}
        {designSystem.borderRadii.length > 0 && (
          <Section title="Radii" icon={Circle} count={designSystem.borderRadii.length} defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {designSystem.borderRadii.map((r) => (
                <div key={r.value} className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-8 h-8 border-2"
                    style={{
                      borderRadius: r.value,
                      borderColor: 'var(--penma-primary)',
                      background: 'var(--penma-primary-light)',
                    }}
                  />
                  <span className="text-[8px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};
