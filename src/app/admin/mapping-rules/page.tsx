'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Plus, Trash2, Pencil, Save, X, ArrowLeft, Upload, Download,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Copy, Search,
  GripVertical, Zap, Eye, EyeOff, AlertCircle, Check, Hash,
  Code2, Tag, Type, Palette, Layout, Box, Layers, ArrowRightLeft,
  FileJson, BookOpen, Sparkles, Shield,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface MappingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  category: string;
  match: Record<string, unknown>;
  transform: Record<string, unknown>;
  figmaOverrides: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

type TabId = 'rules' | 'presets' | 'docs';

const CATEGORIES = ['general', 'layout', 'typography', 'color', 'component', 'figma', 'cleanup'] as const;

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  general:    { icon: <Box size={12} />,       color: '#64748B', bg: '#F1F5F9', label: 'General' },
  layout:     { icon: <Layout size={12} />,    color: '#3B82F6', bg: '#EFF6FF', label: 'Layout' },
  typography: { icon: <Type size={12} />,      color: '#8B5CF6', bg: '#F5F3FF', label: 'Typography' },
  color:      { icon: <Palette size={12} />,   color: '#EC4899', bg: '#FDF2F8', label: 'Color' },
  component:  { icon: <Layers size={12} />,    color: '#22C55E', bg: '#F0FDF4', label: 'Component' },
  figma:      { icon: <Sparkles size={12} />,  color: '#F97316', bg: '#FFF7ED', label: 'Figma' },
  cleanup:    { icon: <Shield size={12} />,    color: '#EF4444', bg: '#FEF2F2', label: 'Cleanup' },
};

const PRESET_RULES: Array<Partial<MappingRule> & { _presetIcon: React.ReactNode }> = [
  {
    _presetIcon: <Layout size={16} />,
    name: 'Navigation \u2192 Horizontal Layout',
    description: 'Convert nav elements to horizontal auto-layout with 8px gap',
    category: 'layout',
    priority: 10,
    match: { tag: 'nav' },
    transform: { autoLayout: { direction: 'horizontal', gap: 8, primaryAxisAlign: 'start' } },
    figmaOverrides: { nodeType: 'FRAME' },
  },
  {
    _presetIcon: <Zap size={16} />,
    name: 'Button \u2192 Component Frame',
    description: 'Style all button elements as named Figma component frames',
    category: 'component',
    priority: 20,
    match: { tag: 'button' },
    transform: { name: 'Button' },
    figmaOverrides: { nodeType: 'FRAME' },
  },
  {
    _presetIcon: <EyeOff size={16} />,
    name: 'Hidden Elements \u2192 Invisible',
    description: 'Hide elements with display:none',
    category: 'cleanup',
    priority: 50,
    match: { cssMatch: { display: 'none' } },
    transform: { visible: false },
    figmaOverrides: {},
  },
  {
    _presetIcon: <Layers size={16} />,
    name: 'Card Pattern',
    description: 'Detect card-like elements by CSS class pattern',
    category: 'component',
    priority: 15,
    match: { classPattern: 'card|Card' },
    transform: { name: 'Card' },
    figmaOverrides: { nodeType: 'FRAME' },
  },
  {
    _presetIcon: <Type size={16} />,
    name: 'Large Text \u2192 Heading',
    description: 'Mark text nodes larger than 24px as headings',
    category: 'typography',
    priority: 5,
    match: { tag: '*', cssMatch: { 'font-size': '>24px' }, hasText: true },
    transform: { name: 'Heading' },
    figmaOverrides: { nodeType: 'TEXT' },
  },
  {
    _presetIcon: <Box size={16} />,
    name: 'Input \u2192 Fixed Height',
    description: 'Fix input elements to fill width / fixed height sizing',
    category: 'component',
    priority: 10,
    match: { tag: 'input' },
    transform: { sizing: { horizontal: 'fill', vertical: 'fixed' } },
    figmaOverrides: { nodeType: 'FRAME' },
  },
  {
    _presetIcon: <ArrowRightLeft size={16} />,
    name: 'Flex Row \u2192 Horizontal',
    description: 'Ensure flex-direction:row maps to horizontal auto-layout',
    category: 'layout',
    priority: 8,
    match: { tag: '*', cssMatch: { display: 'flex', 'flex-direction': 'row' } },
    transform: { autoLayout: { direction: 'horizontal' } },
    figmaOverrides: {},
  },
  {
    _presetIcon: <Palette size={16} />,
    name: 'Transparent BG \u2192 Remove Fill',
    description: 'Strip background from transparent elements',
    category: 'color',
    priority: 3,
    match: { cssMatch: { 'background-color': '/rgba.*,\\s*0\\)/' } },
    transform: { fills: [] },
    figmaOverrides: {},
  },
];

// ── Admin Page ───────────────────────────────────────────────

export default function MappingRulesAdmin() {
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<MappingRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabId>('rules');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchRules = useCallback(async () => {
    const res = await fetch('/api/admin/mapping-rules');
    if (res.ok) {
      const data = await res.json();
      setRules(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ── CRUD ─────────────────────────────────────────────────

  const handleCreate = async (rule: Partial<MappingRule>) => {
    const res = await fetch('/api/admin/mapping-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (res.ok) {
      await fetchRules();
      setIsCreating(false);
      setEditingRule(null);
      showToast('Rule created');
    }
  };

  const handleUpdate = async (rule: MappingRule) => {
    const res = await fetch(`/api/admin/mapping-rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (res.ok) {
      await fetchRules();
      setEditingRule(null);
      showToast('Rule updated');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mapping rule?')) return;
    await fetch(`/api/admin/mapping-rules/${id}`, { method: 'DELETE' });
    await fetchRules();
    showToast('Rule deleted');
  };

  const handleToggle = async (rule: MappingRule) => {
    await fetch(`/api/admin/mapping-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    await fetchRules();
  };

  const handleDuplicate = async (rule: MappingRule) => {
    await handleCreate({
      name: `${rule.name} (copy)`,
      description: rule.description,
      enabled: false,
      priority: rule.priority,
      category: rule.category,
      match: rule.match,
      transform: rule.transform,
      figmaOverrides: rule.figmaOverrides,
    });
  };

  // ── Bulk actions ─────────────────────────────────────────

  const handleEnableAll = async () => {
    for (const r of filtered) {
      if (!r.enabled) {
        await fetch(`/api/admin/mapping-rules/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        });
      }
    }
    await fetchRules();
    showToast(`Enabled ${filtered.length} rules`);
  };

  const handleDisableAll = async () => {
    for (const r of filtered) {
      if (r.enabled) {
        await fetch(`/api/admin/mapping-rules/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false }),
        });
      }
    }
    await fetchRules();
    showToast(`Disabled ${filtered.length} rules`);
  };

  // ── Import / Export ──────────────────────────────────────

  const handleExport = async () => {
    const res = await fetch('/api/admin/mapping-rules/bulk');
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapping-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Rules exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const res = await fetch('/api/admin/mapping-rules/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Imported ${result.imported} rules`);
        await fetchRules();
      }
    } catch {
      showToast('Invalid JSON file', 'error');
    }
    e.target.value = '';
  };

  const handleAddPreset = async (preset: Partial<MappingRule>) => {
    const { ...data } = preset;
    delete (data as Record<string, unknown>)._presetIcon;
    await handleCreate(data);
  };

  // ── Filter ───────────────────────────────────────────────

  const filtered = useMemo(() => rules.filter((r) => {
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        JSON.stringify(r.match).toLowerCase().includes(q)
      );
    }
    return true;
  }), [rules, categoryFilter, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rules) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return counts;
  }, [rules]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(filtered.map((r) => r.id)));
  const collapseAll = () => setExpandedIds(new Set());

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="flex h-screen" style={{ background: 'var(--penma-bg)', color: 'var(--penma-text)', fontFamily: 'var(--font-body)' }}>
      {/* ─── Sidebar ────────────────────────────────────────── */}
      <aside
        className="flex w-[260px] flex-col border-r"
        style={{ background: 'var(--penma-surface)', borderColor: 'var(--penma-border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--penma-border)' }}>
          <a href="/" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--penma-primary)' }}>
            <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-heading)' }}>P</span>
          </a>
          <div>
            <h1 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Mapping Rules</h1>
            <p className="text-[10px]" style={{ color: 'var(--penma-text-muted)' }}>Admin Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          <SidebarTab active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={<Layers size={15} />} label="Rules" count={rules.length} />
          <SidebarTab active={activeTab === 'presets'} onClick={() => setActiveTab('presets')} icon={<Sparkles size={15} />} label="Presets" count={PRESET_RULES.length} />
          <SidebarTab active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<BookOpen size={15} />} label="Documentation" />

          <div className="pt-3 pb-1">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)' }}>Categories</p>
          </div>
          <SidebarTab
            active={categoryFilter === 'all'}
            onClick={() => setCategoryFilter('all')}
            icon={<Hash size={14} />}
            label="All"
            count={rules.length}
            mini
          />
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            return (
              <SidebarTab
                key={cat}
                active={categoryFilter === cat}
                onClick={() => { setCategoryFilter(cat); setActiveTab('rules'); }}
                icon={meta.icon}
                label={meta.label}
                count={categoryCounts[cat] || 0}
                mini
                accent={meta.color}
              />
            );
          })}
        </nav>

        {/* Pipeline diagram */}
        <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--penma-border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--penma-text-muted)' }}>Pipeline</p>
          <div className="flex items-center gap-1 text-[10px]">
            <PipelineStep label="HTML" color="#F97316" />
            <PipelineArrow />
            <PipelineStep label="Match" color="#3B82F6" />
            <PipelineArrow />
            <PipelineStep label="Penma" color="#8B5CF6" />
            <PipelineArrow />
            <PipelineStep label="Figma" color="#22C55E" />
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--penma-border)' }}>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Total" value={rules.length} />
            <StatBox label="Active" value={rules.filter((r) => r.enabled).length} color="var(--penma-primary)" />
            <StatBox label="Off" value={rules.filter((r) => !r.enabled).length} color="var(--penma-text-muted)" />
          </div>
        </div>
      </aside>

      {/* ─── Main ───────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-3 border-b"
          style={{ background: 'var(--penma-surface)', borderColor: 'var(--penma-border)' }}
        >
          <div className="flex items-center gap-3">
            <a href="/" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-neutral-100 cursor-pointer" style={{ color: 'var(--penma-text-muted)' }}>
              <ArrowLeft size={16} />
            </a>
            {activeTab === 'rules' && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--penma-text-muted)' }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rules..."
                  className="w-72 rounded-lg border py-1.5 pl-9 pr-3 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-bg)', color: 'var(--penma-text)' }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer"
              style={{ borderColor: 'var(--penma-border)', color: 'var(--penma-text-secondary)' }}
            >
              <Upload size={13} />
              Import
            </button>
            <button
              onClick={handleExport}
              disabled={rules.length === 0}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 cursor-pointer"
              style={{ borderColor: 'var(--penma-border)', color: 'var(--penma-text-secondary)' }}
            >
              <Download size={13} />
              Export
            </button>
            <button
              onClick={() => {
                setIsCreating(true);
                setEditingRule({
                  id: '', name: '', description: '', enabled: true,
                  priority: 0, category: 'general', match: {}, transform: {}, figmaOverrides: {},
                });
                setActiveTab('rules');
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
              style={{ background: 'var(--penma-primary)' }}
            >
              <Plus size={13} />
              New Rule
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {activeTab === 'rules' && (
            <RulesTab
              rules={filtered}
              allRules={rules}
              loading={loading}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              onToggleEnabled={handleToggle}
              onEdit={(r) => { setEditingRule(r); setIsCreating(false); }}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onEnableAll={handleEnableAll}
              onDisableAll={handleDisableAll}
              categoryFilter={categoryFilter}
            />
          )}
          {activeTab === 'presets' && (
            <PresetsTab onAddPreset={handleAddPreset} />
          )}
          {activeTab === 'docs' && <DocsTab />}
        </div>
      </main>

      {/* ─── Modal ──────────────────────────────────────────── */}
      {editingRule && (
        <RuleEditor
          rule={editingRule}
          isNew={isCreating}
          onSave={(r) => isCreating ? handleCreate(r) : handleUpdate(r as MappingRule)}
          onClose={() => { setEditingRule(null); setIsCreating(false); }}
        />
      )}

      {/* ─── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg animate-in slide-in-from-bottom-4"
          style={{
            background: toast.type === 'success' ? '#22C55E' : '#EF4444',
            zIndex: 'var(--z-modal)',
            animation: 'slideUp 300ms ease',
          }}
        >
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Sidebar Components ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const SidebarTab: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  mini?: boolean;
  accent?: string;
}> = ({ active, onClick, icon, label, count, mini, accent }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-2.5 rounded-lg cursor-pointer transition-colors ${mini ? 'px-3 py-1.5' : 'px-3 py-2'}`}
    style={{
      background: active ? 'var(--penma-primary-light)' : 'transparent',
      color: active ? 'var(--penma-primary)' : (accent || 'var(--penma-text-secondary)'),
      fontWeight: active ? 600 : 400,
    }}
  >
    <span style={{ color: accent && !active ? accent : undefined }}>{icon}</span>
    <span className={`flex-1 text-left ${mini ? 'text-xs' : 'text-sm'}`}>{label}</span>
    {count !== undefined && (
      <span className={`${mini ? 'text-[10px]' : 'text-xs'} font-mono`} style={{ color: 'var(--penma-text-muted)' }}>
        {count}
      </span>
    )}
  </button>
);

const PipelineStep: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className="flex items-center justify-center rounded px-2 py-1 font-semibold" style={{ background: color + '15', color, fontSize: 9 }}>
    {label}
  </span>
);

const PipelineArrow: React.FC = () => (
  <ChevronRight size={10} style={{ color: 'var(--penma-text-muted)', flexShrink: 0 }} />
);

const StatBox: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div className="text-center">
    <div className="text-base font-bold font-mono" style={{ color: color || 'var(--penma-text)' }}>{value}</div>
    <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--penma-text-muted)' }}>{label}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ── Rules Tab ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const RulesTab: React.FC<{
  rules: MappingRule[];
  allRules: MappingRule[];
  loading: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleEnabled: (rule: MappingRule) => void;
  onEdit: (rule: MappingRule) => void;
  onDelete: (id: string) => void;
  onDuplicate: (rule: MappingRule) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  categoryFilter: string;
}> = ({ rules, allRules, loading, expandedIds, onToggleExpand, onExpandAll, onCollapseAll, onToggleEnabled, onEdit, onDelete, onDuplicate, onEnableAll, onDisableAll, categoryFilter }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--penma-border)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <>
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
            {categoryFilter === 'all' ? 'All Rules' : CATEGORY_META[categoryFilter]?.label || categoryFilter}
          </h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--penma-hover-bg)', color: 'var(--penma-text-muted)' }}>
            {rules.length}/{allRules.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <SmallBtn onClick={onExpandAll} icon={<ChevronDown size={12} />} label="Expand" />
          <SmallBtn onClick={onCollapseAll} icon={<ChevronRight size={12} />} label="Collapse" />
          <span className="w-px h-4 mx-1" style={{ background: 'var(--penma-border)' }} />
          <SmallBtn onClick={onEnableAll} icon={<Eye size={12} />} label="Enable all" />
          <SmallBtn onClick={onDisableAll} icon={<EyeOff size={12} />} label="Disable all" />
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              expanded={expandedIds.has(rule.id)}
              onToggleExpand={() => onToggleExpand(rule.id)}
              onToggleEnabled={() => onToggleEnabled(rule)}
              onEdit={() => onEdit(rule)}
              onDelete={() => onDelete(rule.id)}
              onDuplicate={() => onDuplicate(rule)}
            />
          ))}
        </div>
      )}
    </>
  );
};

const SmallBtn: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium cursor-pointer"
    style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-fast)' }}
    title={label}
  >
    {icon}
    <span className="hidden lg:inline">{label}</span>
  </button>
);

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--penma-hover-bg)' }}>
      <FileJson size={24} style={{ color: 'var(--penma-text-muted)' }} />
    </div>
    <p className="text-sm font-medium" style={{ color: 'var(--penma-text-muted)' }}>No rules found</p>
    <p className="text-xs" style={{ color: 'var(--penma-text-muted)' }}>Create a rule, use a preset, or import from JSON</p>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ── Rule Card ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const RuleCard: React.FC<{
  rule: MappingRule;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ rule, expanded, onToggleExpand, onToggleEnabled, onEdit, onDelete, onDuplicate }) => {
  const meta = CATEGORY_META[rule.category] || CATEGORY_META.general;

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        background: 'var(--penma-surface)',
        borderColor: expanded ? 'var(--penma-primary)' : 'var(--penma-border)',
        opacity: rule.enabled ? 1 : 0.55,
        boxShadow: expanded ? '0 0 0 1px var(--penma-primary-light)' : 'none',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical size={14} className="cursor-grab flex-shrink-0" style={{ color: 'var(--penma-border-strong)' }} />

        <button onClick={onToggleExpand} className="flex-shrink-0 cursor-pointer" style={{ color: 'var(--penma-text-muted)' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        <button onClick={onToggleEnabled} className="flex-shrink-0 cursor-pointer" title={rule.enabled ? 'Disable' : 'Enable'}>
          {rule.enabled ? (
            <ToggleRight size={22} style={{ color: '#22C55E' }} />
          ) : (
            <ToggleLeft size={22} style={{ color: 'var(--penma-border-strong)' }} />
          )}
        </button>

        <div className="flex-1 min-w-0" onClick={onToggleExpand} style={{ cursor: 'pointer' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{rule.name}</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.icon}
              {meta.label}
            </span>
            <span
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono"
              style={{ background: 'var(--penma-hover-bg)', color: 'var(--penma-text-muted)' }}
            >
              P{rule.priority}
            </span>
          </div>
          {rule.description && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--penma-text-muted)' }}>{rule.description}</p>
          )}
        </div>

        {/* Match summary pills */}
        <div className="hidden xl:flex items-center gap-1.5 flex-shrink-0">
          {typeof rule.match.tag === 'string' && rule.match.tag !== '*' ? (
            <MatchPill icon={<Tag size={10} />} label={rule.match.tag} />
          ) : null}
          {rule.match.cssMatch != null && typeof rule.match.cssMatch === 'object' ? (
            <MatchPill icon={<Code2 size={10} />} label={`${Object.keys(rule.match.cssMatch as object).length} CSS`} />
          ) : null}
          {typeof rule.match.classPattern === 'string' ? (
            <MatchPill icon={<Hash size={10} />} label="class" />
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <IconBtn onClick={onDuplicate} icon={<Copy size={13} />} title="Duplicate" />
          <IconBtn onClick={onEdit} icon={<Pencil size={13} />} title="Edit" hoverColor="var(--penma-primary)" />
          <IconBtn onClick={onDelete} icon={<Trash2 size={13} />} title="Delete" hoverColor="var(--penma-danger)" />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 py-4" style={{ borderColor: 'var(--penma-border)' }}>
          {/* Three-column pipeline view */}
          <div className="grid grid-cols-3 gap-4">
            <JsonBlock
              title="Match Conditions"
              subtitle="When HTML matches..."
              icon={<Search size={12} />}
              color="#3B82F6"
              json={rule.match}
            />
            <JsonBlock
              title="Penma Transform"
              subtitle="Convert node to..."
              icon={<ArrowRightLeft size={12} />}
              color="#8B5CF6"
              json={rule.transform}
            />
            <JsonBlock
              title="Figma Overrides"
              subtitle="In Figma, set..."
              icon={<Sparkles size={12} />}
              color="#F97316"
              json={rule.figmaOverrides}
            />
          </div>

          {rule.updatedAt && (
            <p className="text-[10px] mt-3 pt-2 border-t" style={{ color: 'var(--penma-text-muted)', borderColor: 'var(--penma-border)' }}>
              Updated {new Date(rule.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const MatchPill: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span
    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono"
    style={{ background: 'var(--penma-hover-bg)', color: 'var(--penma-text-muted)' }}
  >
    {icon}
    {label}
  </span>
);

const IconBtn: React.FC<{ onClick: () => void; icon: React.ReactNode; title: string; hoverColor?: string }> = ({ onClick, icon, title, hoverColor }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer group/icon"
    style={{ color: 'var(--penma-text-muted)', transition: 'var(--transition-fast)' }}
    title={title}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--penma-hover-bg)';
      if (hoverColor) e.currentTarget.style.color = hoverColor;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'var(--penma-text-muted)';
    }}
  >
    {icon}
  </button>
);

const JsonBlock: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  json: Record<string, unknown>;
}> = ({ title, subtitle, icon, color, json }) => {
  const isEmpty = !json || Object.keys(json).length === 0;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] font-semibold" style={{ color }}>{title}</span>
      </div>
      <p className="text-[10px] mb-2" style={{ color: 'var(--penma-text-muted)' }}>{subtitle}</p>
      {isEmpty ? (
        <div className="rounded-lg p-3 text-center text-[10px]" style={{ background: 'var(--penma-bg)', color: 'var(--penma-text-muted)' }}>
          No conditions set
        </div>
      ) : (
        <pre
          className="rounded-lg p-3 text-[11px] leading-relaxed overflow-auto max-h-48 whitespace-pre-wrap"
          style={{
            background: 'var(--penma-bg)',
            color: 'var(--penma-text-secondary)',
            fontFamily: 'var(--font-mono)',
            border: `1px solid ${color}20`,
          }}
        >
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ── Presets Tab ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const PresetsTab: React.FC<{ onAddPreset: (p: Partial<MappingRule>) => void }> = ({ onAddPreset }) => (
  <>
    <div className="mb-4">
      <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>Preset Rules</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--penma-text-muted)' }}>
        Click to instantly add a pre-configured rule to your database
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {PRESET_RULES.map((preset, i) => {
        const meta = CATEGORY_META[preset.category || 'general'];
        return (
          <button
            key={i}
            onClick={() => onAddPreset(preset)}
            className="flex items-start gap-3 rounded-xl border p-4 text-left cursor-pointer transition-all group"
            style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${meta.color}20`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--penma-border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>
              {preset._presetIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{preset.name}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ background: meta.bg, color: meta.color }}>
                  {meta.label}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--penma-text-muted)' }}>{preset.description}</p>
              <div className="flex items-center gap-3 mt-2">
                {preset.match?.tag ? (
                  <span className="text-[10px] font-mono" style={{ color: '#3B82F6' }}>
                    tag:{String(preset.match.tag)}
                  </span>
                ) : null}
                {preset.match?.cssMatch ? (
                  <span className="text-[10px] font-mono" style={{ color: '#8B5CF6' }}>
                    css:{Object.keys(preset.match.cssMatch as object).length}
                  </span>
                ) : null}
                <span className="text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
                  P{preset.priority}
                </span>
              </div>
            </div>
            <Plus size={16} className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: meta.color }} />
          </button>
        );
      })}
    </div>
  </>
);

// ═══════════════════════════════════════════════════════════════
// ── Docs Tab ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const DocsTab: React.FC = () => (
  <div className="max-w-3xl">
    <h2 className="text-sm font-semibold mb-4" style={{ fontFamily: 'var(--font-heading)' }}>Documentation</h2>

    <div className="space-y-4">
      <DocSection title="How Mapping Rules Work" icon={<Zap size={14} />} color="#3B82F6">
        <p>Mapping rules intercept the HTML → Penma → Figma conversion pipeline. When importing a website, each node in the DOM tree is checked against all enabled rules (sorted by priority, highest first). Matching rules transform the Penma node output and optionally set Figma-specific overrides for export.</p>
      </DocSection>

      <DocSection title="Match Conditions" icon={<Search size={14} />} color="#8B5CF6">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--penma-border)' }}>
              <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Field</th>
              <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Type</th>
              <th className="text-left py-2 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Description</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--penma-border)' }}>
            <DocRow field="tag" type="string" desc={<>HTML tag name. Use <C>*</C> to match any tag.</>} />
            <DocRow field="cssMatch" type="object" desc={<>CSS property conditions. Values can be exact (<C>&quot;flex&quot;</C>), comparison (<C>&quot;&gt;16px&quot;</C>, <C>&quot;&lt;=100px&quot;</C>), or regex (<C>&quot;/bold|700/&quot;</C>).</>} />
            <DocRow field="classPattern" type="string" desc={<>Regular expression matched against CSS class names. Case-insensitive. Example: <C>&quot;btn|button|Card&quot;</C></>} />
            <DocRow field="attributeMatch" type="object" desc={<>Key-value attribute pairs. Use <C>&quot;*&quot;</C> as value for presence check. Example: <C>{`{ "role": "navigation" }`}</C></>} />
            <DocRow field="minChildren" type="number" desc="Minimum number of child nodes." />
            <DocRow field="hasText" type="boolean" desc="Whether the node must contain text content." />
          </tbody>
        </table>
      </DocSection>

      <DocSection title="Transform (Penma Output)" icon={<ArrowRightLeft size={14} />} color="#22C55E">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--penma-border)' }}>
              <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Field</th>
              <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Type</th>
              <th className="text-left py-2 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Description</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--penma-border)' }}>
            <DocRow field="name" type="string" desc="Override node name in the layers panel." />
            <DocRow field="tagName" type="string" desc="Force a specific HTML tag in Penma output." />
            <DocRow field="styleOverrides" type="object" desc={<>Add or replace CSS properties. Example: <C>{`{ "border-radius": "8px" }`}</C></>} />
            <DocRow field="styleRemovals" type="string[]" desc={<>Array of CSS property names to remove. Example: <C>{`["box-shadow", "text-decoration"]`}</C></>} />
            <DocRow field="autoLayout" type="object" desc={<><C>direction</C> (horizontal|vertical|wrap), <C>gap</C>, <C>primaryAxisAlign</C>, <C>counterAxisAlign</C></>} />
            <DocRow field="sizing" type="object" desc={<><C>horizontal</C> and <C>vertical</C>: <C>fixed</C> | <C>hug</C> | <C>fill</C></>} />
            <DocRow field="fills" type="array" desc={<>Background colors: <C>{`[{ "color": "#hex", "opacity": 0-100 }]`}</C>. Empty array removes fills.</>} />
            <DocRow field="visible" type="boolean" desc="Toggle node visibility." />
            <DocRow field="locked" type="boolean" desc="Lock the node from editing." />
          </tbody>
        </table>
      </DocSection>

      <DocSection title="Figma Overrides" icon={<Sparkles size={14} />} color="#F97316">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--penma-border)' }}>
              <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Field</th>
              <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Type</th>
              <th className="text-left py-2 font-semibold" style={{ color: 'var(--penma-text-secondary)' }}>Description</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--penma-border)' }}>
            <DocRow field="nodeType" type="string" desc={<>Override Figma node type: <C>FRAME</C>, <C>TEXT</C>, <C>RECTANGLE</C>, <C>VECTOR</C>, <C>COMPONENT</C>, <C>INSTANCE</C></>} />
            <DocRow field="layoutMode" type="string" desc={<><C>HORIZONTAL</C>, <C>VERTICAL</C>, or <C>NONE</C></>} />
            <DocRow field="properties" type="object" desc="Arbitrary key-value Figma node properties passed directly to the export." />
          </tbody>
        </table>
      </DocSection>

      <DocSection title="Examples" icon={<Code2 size={14} />} color="#EC4899">
        <div className="space-y-3">
          <DocExample
            title="Hide cookie banners"
            match={{ classPattern: 'cookie|consent|gdpr', tag: '*' }}
            transform={{ visible: false }}
            figma={{}}
          />
          <DocExample
            title="Hero section layout"
            match={{ tag: 'section', cssMatch: { display: 'flex', 'min-height': '>400px' } }}
            transform={{ name: 'Hero', autoLayout: { direction: 'vertical', gap: 24, primaryAxisAlign: 'center' } }}
            figma={{ nodeType: 'FRAME' }}
          />
          <DocExample
            title="Icon containers"
            match={{ tag: 'svg' }}
            transform={{ name: 'Icon', sizing: { horizontal: 'fixed', vertical: 'fixed' } }}
            figma={{ nodeType: 'VECTOR' }}
          />
        </div>
      </DocSection>
    </div>
  </div>
);

const DocSection: React.FC<{ title: string; icon: React.ReactNode; color: string; children: React.ReactNode }> = ({ title, icon, color, children }) => (
  <div className="rounded-xl border p-5" style={{ background: 'var(--penma-surface)', borderColor: 'var(--penma-border)' }}>
    <div className="flex items-center gap-2 mb-3">
      <span style={{ color }}>{icon}</span>
      <h3 className="text-sm font-semibold" style={{ color }}>{title}</h3>
    </div>
    <div className="text-xs leading-relaxed" style={{ color: 'var(--penma-text-secondary)' }}>
      {children}
    </div>
  </div>
);

const DocRow: React.FC<{ field: string; type: string; desc: React.ReactNode }> = ({ field, type, desc }) => (
  <tr>
    <td className="py-2 pr-4 font-mono font-semibold whitespace-nowrap" style={{ color: 'var(--penma-primary)' }}>{field}</td>
    <td className="py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--penma-text-muted)' }}>{type}</td>
    <td className="py-2">{desc}</td>
  </tr>
);

const C: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="rounded px-1 py-0.5 font-mono text-[10px]" style={{ background: 'var(--penma-hover-bg)', color: 'var(--penma-primary)' }}>
    {children}
  </code>
);

const DocExample: React.FC<{ title: string; match: object; transform: object; figma: object }> = ({ title, match, transform, figma }) => (
  <div className="rounded-lg p-3" style={{ background: 'var(--penma-bg)' }}>
    <p className="text-[11px] font-semibold mb-2">{title}</p>
    <div className="grid grid-cols-3 gap-2">
      <pre className="text-[10px] rounded p-2 overflow-auto" style={{ background: 'var(--penma-surface)', fontFamily: 'var(--font-mono)', color: '#3B82F6' }}>
        {JSON.stringify(match, null, 2)}
      </pre>
      <pre className="text-[10px] rounded p-2 overflow-auto" style={{ background: 'var(--penma-surface)', fontFamily: 'var(--font-mono)', color: '#8B5CF6' }}>
        {JSON.stringify(transform, null, 2)}
      </pre>
      <pre className="text-[10px] rounded p-2 overflow-auto" style={{ background: 'var(--penma-surface)', fontFamily: 'var(--font-mono)', color: '#F97316' }}>
        {JSON.stringify(figma, null, 2)}
      </pre>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ── Rule Editor Modal ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const RuleEditor: React.FC<{
  rule: MappingRule;
  isNew: boolean;
  onSave: (rule: Partial<MappingRule>) => void;
  onClose: () => void;
}> = ({ rule, isNew, onSave, onClose }) => {
  // Guard against null/undefined nested objects from DB
  const rMatch = rule.match || {};
  const rTransform = rule.transform || {};
  const rFigma = rule.figmaOverrides || {};

  const [name, setName] = useState(rule.name);
  const [description, setDescription] = useState(rule.description);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [priority, setPriority] = useState(rule.priority);
  const [category, setCategory] = useState(rule.category);

  // Match fields
  const [matchTag, setMatchTag] = useState((rMatch.tag as string) || '');
  const [matchCss, setMatchCss] = useState(
    rMatch.cssMatch ? JSON.stringify(rMatch.cssMatch, null, 2) : '',
  );
  const [matchClassPattern, setMatchClassPattern] = useState((rMatch.classPattern as string) || '');
  const [matchAttr, setMatchAttr] = useState(
    rMatch.attributeMatch ? JSON.stringify(rMatch.attributeMatch, null, 2) : '',
  );
  const [matchMinChildren, setMatchMinChildren] = useState(
    rMatch.minChildren !== undefined ? String(rMatch.minChildren) : '',
  );
  const [matchHasText, setMatchHasText] = useState<'any' | 'true' | 'false'>(
    rMatch.hasText === true ? 'true' : rMatch.hasText === false ? 'false' : 'any',
  );

  // Transform fields
  const [trName, setTrName] = useState((rTransform.name as string) || '');
  const [trTagName, setTrTagName] = useState((rTransform.tagName as string) || '');

  // Style overrides as key-value pairs
  const initStyleOverrides = (): Array<{ key: string; value: string }> => {
    const obj = rTransform.styleOverrides as Record<string, string> | undefined;
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  };
  const [trStylePairs, setTrStylePairs] = useState(initStyleOverrides);

  // Style removals as tag list
  const initStyleRemovals = (): string[] => {
    const arr = rTransform.styleRemovals as string[] | undefined;
    return arr && Array.isArray(arr) ? arr : [];
  };
  const [trRemovalTags, setTrRemovalTags] = useState(initStyleRemovals);
  const [removalInput, setRemovalInput] = useState('');

  // Auto layout as structured fields
  const initAL = rTransform.autoLayout as Record<string, unknown> | undefined;
  const [alDirection, setAlDirection] = useState<string>((initAL?.direction as string) || '');
  const [alGap, setAlGap] = useState<string>(initAL?.gap !== undefined ? String(initAL.gap) : '');
  const [alPrimaryAlign, setAlPrimaryAlign] = useState<string>((initAL?.primaryAxisAlign as string) || '');
  const [alCounterAlign, setAlCounterAlign] = useState<string>((initAL?.counterAxisAlign as string) || '');

  const [trSizingH, setTrSizingH] = useState(
    (rTransform.sizing as Record<string, string>)?.horizontal || '',
  );
  const [trSizingV, setTrSizingV] = useState(
    (rTransform.sizing as Record<string, string>)?.vertical || '',
  );

  // Fills as structured list
  const initFills = (): Array<{ color: string; opacity: number }> => {
    const arr = rTransform.fills as Array<{ color: string; opacity: number }> | undefined;
    return arr && Array.isArray(arr) ? arr : [];
  };
  const [trFillsList, setTrFillsList] = useState(initFills);

  const [trVisible, setTrVisible] = useState<'any' | 'true' | 'false'>(
    rTransform.visible === true ? 'true' : rTransform.visible === false ? 'false' : 'any',
  );
  const [trLocked, setTrLocked] = useState<'any' | 'true' | 'false'>(
    rTransform.locked === true ? 'true' : rTransform.locked === false ? 'false' : 'any',
  );

  // Figma fields
  const [fgNodeType, setFgNodeType] = useState((rFigma.nodeType as string) || '');
  const [fgLayoutMode, setFgLayoutMode] = useState((rFigma.layoutMode as string) || '');
  const [fgProperties, setFgProperties] = useState(
    rFigma.properties ? JSON.stringify(rFigma.properties, null, 2) : '',
  );

  const [editorTab, setEditorTab] = useState<'match' | 'transform' | 'figma'>('match');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      // Build match
      const match: Record<string, unknown> = {};
      if (matchTag) match.tag = matchTag;
      if (matchCss.trim()) match.cssMatch = JSON.parse(matchCss);
      if (matchClassPattern) match.classPattern = matchClassPattern;
      if (matchAttr.trim()) match.attributeMatch = JSON.parse(matchAttr);
      if (matchMinChildren) match.minChildren = parseInt(matchMinChildren);
      if (matchHasText !== 'any') match.hasText = matchHasText === 'true';

      // Build transform
      const transform: Record<string, unknown> = {};
      if (trName) transform.name = trName;
      if (trTagName) transform.tagName = trTagName;
      if (trStylePairs.length > 0) {
        const obj: Record<string, string> = {};
        for (const p of trStylePairs) { if (p.key.trim()) obj[p.key.trim()] = p.value; }
        if (Object.keys(obj).length > 0) transform.styleOverrides = obj;
      }
      if (trRemovalTags.length > 0) transform.styleRemovals = trRemovalTags;
      const al: Record<string, unknown> = {};
      if (alDirection) al.direction = alDirection;
      if (alGap) al.gap = parseFloat(alGap) || 0;
      if (alPrimaryAlign) al.primaryAxisAlign = alPrimaryAlign;
      if (alCounterAlign) al.counterAxisAlign = alCounterAlign;
      if (Object.keys(al).length > 0) transform.autoLayout = al;
      if (trSizingH || trSizingV) {
        const sizing: Record<string, string> = {};
        if (trSizingH) sizing.horizontal = trSizingH;
        if (trSizingV) sizing.vertical = trSizingV;
        transform.sizing = sizing;
      }
      if (trFillsList.length > 0) transform.fills = trFillsList;
      if (trVisible !== 'any') transform.visible = trVisible === 'true';
      if (trLocked !== 'any') transform.locked = trLocked === 'true';

      // Build figma
      const figmaOverrides: Record<string, unknown> = {};
      if (fgNodeType) figmaOverrides.nodeType = fgNodeType;
      if (fgLayoutMode) figmaOverrides.layoutMode = fgLayoutMode;
      if (fgProperties.trim()) figmaOverrides.properties = JSON.parse(fgProperties);

      onSave({
        ...(isNew ? {} : { id: rule.id }),
        name, description, enabled, priority, category,
        match, transform, figmaOverrides,
      });
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON in one of the fields');
    }
  };

  const tabColors = { match: '#3B82F6', transform: '#8B5CF6', figma: '#F97316' };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm" style={{ zIndex: 'var(--z-modal-overlay)' }}>
      <div className="w-full max-w-[880px] max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--penma-surface)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--penma-border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
              {isNew ? 'Create Rule' : 'Edit Rule'}
            </h2>
            {name && <p className="text-xs mt-0.5" style={{ color: 'var(--penma-text-muted)' }}>{name}</p>}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg cursor-pointer" style={{ color: 'var(--penma-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {/* Basic info */}
          <div className="grid grid-cols-[1fr_140px_100px] gap-3 mb-5">
            <FormField label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" className="form-input" />
            </FormField>
            <FormField label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-input cursor-pointer">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority">
              <input type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)} className="form-input font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
            </FormField>
          </div>

          <div className="mb-5">
            <FormField label="Description">
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this rule does" className="form-input" />
            </FormField>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded accent-blue-500 cursor-pointer" />
              <span className="text-xs font-medium" style={{ color: 'var(--penma-text-secondary)' }}>Enabled on import</span>
            </label>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--penma-bg)' }}>
            {(['match', 'transform', 'figma'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setEditorTab(tab)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium cursor-pointer transition-all"
                style={{
                  background: editorTab === tab ? 'var(--penma-surface)' : 'transparent',
                  color: editorTab === tab ? tabColors[tab] : 'var(--penma-text-muted)',
                  boxShadow: editorTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {tab === 'match' && <Search size={13} />}
                {tab === 'transform' && <ArrowRightLeft size={13} />}
                {tab === 'figma' && <Sparkles size={13} />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Match tab */}
          {editorTab === 'match' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="HTML Tag" hint="e.g. button, nav, div, * for any">
                  <input value={matchTag} onChange={(e) => setMatchTag(e.target.value)} placeholder="*" className="form-input font-mono" />
                </FormField>
                <FormField label="Class Pattern" hint="Regex, e.g. btn|button|Card">
                  <input value={matchClassPattern} onChange={(e) => setMatchClassPattern(e.target.value)} placeholder="btn|button" className="form-input font-mono" />
                </FormField>
              </div>
              <FormField label="CSS Match" hint='JSON: { "display": "flex", "font-size": ">16px" }'>
                <textarea
                  value={matchCss}
                  onChange={(e) => { setMatchCss(e.target.value); setJsonError(null); }}
                  rows={3}
                  spellCheck={false}
                  className="form-input font-mono resize-y"
                  placeholder='{ "display": "flex" }'
                />
              </FormField>
              <FormField label="Attribute Match" hint='JSON: { "role": "navigation" } — use "*" for presence'>
                <textarea
                  value={matchAttr}
                  onChange={(e) => { setMatchAttr(e.target.value); setJsonError(null); }}
                  rows={2}
                  spellCheck={false}
                  className="form-input font-mono resize-y"
                  placeholder='{ "role": "navigation" }'
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Min Children">
                  <input type="number" value={matchMinChildren} onChange={(e) => setMatchMinChildren(e.target.value)} placeholder="Any" className="form-input font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </FormField>
                <FormField label="Has Text">
                  <select value={matchHasText} onChange={(e) => setMatchHasText(e.target.value as 'any' | 'true' | 'false')} className="form-input cursor-pointer">
                    <option value="any">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </FormField>
              </div>
            </div>
          )}

          {/* Transform tab */}
          {editorTab === 'transform' && (
            <div className="grid grid-cols-[1fr_220px] gap-4">
              {/* ── Left: form ── */}
              <div className="space-y-4">
                {/* Identity section */}
                <TrSection title="Identity" icon={<Tag size={13} />}>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Node Name" hint="Layers panel">
                      <input value={trName} onChange={(e) => setTrName(e.target.value)} placeholder="Button" className="form-input" />
                    </FormField>
                    <FormField label="Tag Name" hint="HTML tag">
                      <input value={trTagName} onChange={(e) => setTrTagName(e.target.value)} placeholder="div" className="form-input font-mono" />
                    </FormField>
                  </div>
                </TrSection>

                {/* Auto Layout section */}
                <TrSection title="Auto Layout" icon={<Layout size={13} />}>
                  <div className="flex gap-2 mb-3">
                    {(['', 'horizontal', 'vertical', 'wrap'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setAlDirection(d)}
                        className="flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] font-medium cursor-pointer transition-all"
                        style={{
                          borderColor: alDirection === d ? '#8B5CF6' : 'var(--penma-border)',
                          background: alDirection === d ? '#F5F3FF' : 'var(--penma-bg)',
                          color: alDirection === d ? '#8B5CF6' : 'var(--penma-text-muted)',
                        }}
                      >
                        <span className="text-base leading-none">
                          {d === '' ? '\u2205' : d === 'horizontal' ? '\u2194' : d === 'vertical' ? '\u2195' : '\u21C4'}
                        </span>
                        {d === '' ? 'None' : d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                  {alDirection && (
                    <div className="grid grid-cols-3 gap-3">
                      <FormField label="Gap">
                        <input type="number" value={alGap} onChange={(e) => setAlGap(e.target.value)} placeholder="0" className="form-input font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                      </FormField>
                      <FormField label="Main Axis">
                        <select value={alPrimaryAlign} onChange={(e) => setAlPrimaryAlign(e.target.value)} className="form-input cursor-pointer">
                          <option value="">Auto</option>
                          <option value="start">Start</option>
                          <option value="center">Center</option>
                          <option value="end">End</option>
                          <option value="space-between">Space Between</option>
                        </select>
                      </FormField>
                      <FormField label="Cross Axis">
                        <select value={alCounterAlign} onChange={(e) => setAlCounterAlign(e.target.value)} className="form-input cursor-pointer">
                          <option value="">Auto</option>
                          <option value="start">Start</option>
                          <option value="center">Center</option>
                          <option value="end">End</option>
                          <option value="stretch">Stretch</option>
                          <option value="baseline">Baseline</option>
                        </select>
                      </FormField>
                    </div>
                  )}
                </TrSection>

                {/* Sizing section */}
                <TrSection title="Sizing" icon={<Box size={13} />}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>Horizontal</p>
                      <div className="flex gap-1">
                        {(['', 'fixed', 'hug', 'fill'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setTrSizingH(m)}
                            className="flex-1 rounded-md py-1.5 text-[10px] font-medium cursor-pointer transition-all"
                            style={{
                              border: `1px solid ${trSizingH === m ? '#8B5CF6' : 'var(--penma-border)'}`,
                              background: trSizingH === m ? '#F5F3FF' : 'var(--penma-bg)',
                              color: trSizingH === m ? '#8B5CF6' : 'var(--penma-text-muted)',
                            }}
                          >
                            {m === '' ? '\u2013' : m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--penma-text-muted)' }}>Vertical</p>
                      <div className="flex gap-1">
                        {(['', 'fixed', 'hug', 'fill'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setTrSizingV(m)}
                            className="flex-1 rounded-md py-1.5 text-[10px] font-medium cursor-pointer transition-all"
                            style={{
                              border: `1px solid ${trSizingV === m ? '#8B5CF6' : 'var(--penma-border)'}`,
                              background: trSizingV === m ? '#F5F3FF' : 'var(--penma-bg)',
                              color: trSizingV === m ? '#8B5CF6' : 'var(--penma-text-muted)',
                            }}
                          >
                            {m === '' ? '\u2013' : m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </TrSection>

                {/* Fills section */}
                <TrSection title="Fills" icon={<Palette size={13} />}>
                  {trFillsList.length === 0 ? (
                    <p className="text-[10px] mb-2" style={{ color: 'var(--penma-text-muted)' }}>No fills. Add one or leave empty to remove existing fills.</p>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {trFillsList.map((fill, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--penma-bg)' }}>
                          <input
                            type="color"
                            value={fill.color}
                            onChange={(e) => {
                              const next = [...trFillsList];
                              next[i] = { ...next[i], color: e.target.value };
                              setTrFillsList(next);
                            }}
                            className="h-7 w-7 rounded cursor-pointer border-0 p-0"
                          />
                          <input
                            value={fill.color}
                            onChange={(e) => {
                              const next = [...trFillsList];
                              next[i] = { ...next[i], color: e.target.value };
                              setTrFillsList(next);
                            }}
                            className="form-input font-mono flex-1"
                            style={{ padding: '4px 8px' }}
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={fill.opacity}
                              onChange={(e) => {
                                const next = [...trFillsList];
                                next[i] = { ...next[i], opacity: parseInt(e.target.value) };
                                setTrFillsList(next);
                              }}
                              className="w-14 h-1 accent-purple-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono w-8 text-right" style={{ color: 'var(--penma-text-muted)' }}>{fill.opacity}%</span>
                          </div>
                          <button
                            onClick={() => setTrFillsList(trFillsList.filter((_, j) => j !== i))}
                            className="flex h-6 w-6 items-center justify-center rounded cursor-pointer"
                            style={{ color: 'var(--penma-danger)' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setTrFillsList([...trFillsList, { color: '#3B82F6', opacity: 100 }])}
                    className="flex items-center gap-1 text-[10px] font-medium cursor-pointer"
                    style={{ color: '#8B5CF6' }}
                  >
                    <Plus size={12} />
                    Add fill
                  </button>
                </TrSection>

                {/* Style Overrides section */}
                <TrSection title="Style Overrides" icon={<Code2 size={13} />}>
                  {trStylePairs.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {trStylePairs.map((pair, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={pair.key}
                            onChange={(e) => {
                              const next = [...trStylePairs];
                              next[i] = { ...next[i], key: e.target.value };
                              setTrStylePairs(next);
                            }}
                            placeholder="property"
                            className="form-input font-mono flex-1"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          />
                          <span className="text-[10px]" style={{ color: 'var(--penma-text-muted)' }}>:</span>
                          <input
                            value={pair.value}
                            onChange={(e) => {
                              const next = [...trStylePairs];
                              next[i] = { ...next[i], value: e.target.value };
                              setTrStylePairs(next);
                            }}
                            placeholder="value"
                            className="form-input font-mono flex-1"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          />
                          <button
                            onClick={() => setTrStylePairs(trStylePairs.filter((_, j) => j !== i))}
                            className="flex h-6 w-6 items-center justify-center rounded flex-shrink-0 cursor-pointer"
                            style={{ color: 'var(--penma-danger)' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setTrStylePairs([...trStylePairs, { key: '', value: '' }])}
                    className="flex items-center gap-1 text-[10px] font-medium cursor-pointer"
                    style={{ color: '#8B5CF6' }}
                  >
                    <Plus size={12} />
                    Add property
                  </button>
                </TrSection>

                {/* Style Removals section */}
                <TrSection title="Style Removals" icon={<Trash2 size={13} />}>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {trRemovalTags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-medium"
                        style={{ background: '#FEF2F2', color: '#EF4444' }}
                      >
                        {tag}
                        <button onClick={() => setTrRemovalTags(trRemovalTags.filter((_, j) => j !== i))} className="cursor-pointer leading-none"><X size={10} /></button>
                      </span>
                    ))}
                    {trRemovalTags.length === 0 && (
                      <span className="text-[10px]" style={{ color: 'var(--penma-text-muted)' }}>No properties removed</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={removalInput}
                      onChange={(e) => setRemovalInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && removalInput.trim()) {
                          setTrRemovalTags([...trRemovalTags, removalInput.trim()]);
                          setRemovalInput('');
                        }
                      }}
                      placeholder="CSS property to remove"
                      className="form-input font-mono flex-1"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    />
                    <button
                      onClick={() => {
                        if (removalInput.trim()) {
                          setTrRemovalTags([...trRemovalTags, removalInput.trim()]);
                          setRemovalInput('');
                        }
                      }}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium cursor-pointer"
                      style={{ background: '#FEF2F2', color: '#EF4444' }}
                    >
                      <Plus size={10} />
                      Add
                    </button>
                  </div>
                </TrSection>

                {/* Visibility & Lock section */}
                <TrSection title="Visibility" icon={<Eye size={13} />}>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Visible">
                      <select value={trVisible} onChange={(e) => setTrVisible(e.target.value as 'any' | 'true' | 'false')} className="form-input cursor-pointer">
                        <option value="any">No change</option>
                        <option value="true">Visible</option>
                        <option value="false">Hidden</option>
                      </select>
                    </FormField>
                    <FormField label="Locked">
                      <select value={trLocked} onChange={(e) => setTrLocked(e.target.value as 'any' | 'true' | 'false')} className="form-input cursor-pointer">
                        <option value="any">No change</option>
                        <option value="true">Locked</option>
                        <option value="false">Unlocked</option>
                      </select>
                    </FormField>
                  </div>
                </TrSection>
              </div>

              {/* ── Right: live preview ── */}
              <TransformPreview
                trName={trName}
                trTagName={trTagName}
                alDirection={alDirection}
                alGap={alGap}
                alPrimaryAlign={alPrimaryAlign}
                alCounterAlign={alCounterAlign}
                trSizingH={trSizingH}
                trSizingV={trSizingV}
                trFillsList={trFillsList}
                trStylePairs={trStylePairs}
                trRemovalTags={trRemovalTags}
                trVisible={trVisible}
                trLocked={trLocked}
                matchTag={matchTag}
              />
            </div>
          )}

          {/* Figma tab */}
          {editorTab === 'figma' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Node Type" hint="Figma node type override">
                  <select value={fgNodeType} onChange={(e) => setFgNodeType(e.target.value)} className="form-input cursor-pointer">
                    <option value="">Auto-detect</option>
                    <option value="FRAME">FRAME</option>
                    <option value="TEXT">TEXT</option>
                    <option value="RECTANGLE">RECTANGLE</option>
                    <option value="VECTOR">VECTOR</option>
                    <option value="COMPONENT">COMPONENT</option>
                    <option value="INSTANCE">INSTANCE</option>
                  </select>
                </FormField>
                <FormField label="Layout Mode" hint="Figma layout mode">
                  <select value={fgLayoutMode} onChange={(e) => setFgLayoutMode(e.target.value)} className="form-input cursor-pointer">
                    <option value="">Auto-detect</option>
                    <option value="HORIZONTAL">HORIZONTAL</option>
                    <option value="VERTICAL">VERTICAL</option>
                    <option value="NONE">NONE</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Extra Properties" hint="JSON: arbitrary Figma node properties">
                <textarea
                  value={fgProperties}
                  onChange={(e) => { setFgProperties(e.target.value); setJsonError(null); }}
                  rows={4}
                  spellCheck={false}
                  className="form-input font-mono resize-y"
                  placeholder='{ "cornerRadius": 12, "clipsContent": true }'
                />
              </FormField>
            </div>
          )}

          {jsonError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-medium" style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA' }}>
              <AlertCircle size={14} />
              {jsonError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--penma-border)' }}>
          <div className="flex items-center gap-2">
            {/* Preview pills */}
            {matchTag && <MatchPill icon={<Tag size={10} />} label={matchTag} />}
            {matchClassPattern && <MatchPill icon={<Hash size={10} />} label={matchClassPattern} />}
            {trName && <span className="text-[10px] font-mono" style={{ color: '#8B5CF6' }}>{'\u2192'} {trName}</span>}
            {fgNodeType && <span className="text-[10px] font-mono" style={{ color: '#F97316' }}>{'\u2192'} {fgNodeType}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-xs font-medium cursor-pointer"
              style={{ borderColor: 'var(--penma-border)', color: 'var(--penma-text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--penma-primary)' }}
            >
              <Save size={13} />
              {isNew ? 'Create Rule' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Transform section wrapper ────────────────────────────────

const TrSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-xl border p-3.5" style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)' }}>
    <div className="flex items-center gap-1.5 mb-3">
      <span style={{ color: '#8B5CF6' }}>{icon}</span>
      <h4 className="text-[11px] font-semibold" style={{ color: '#8B5CF6' }}>{title}</h4>
    </div>
    {children}
  </div>
);

// ── Transform live preview ───────────────────────────────────

const TransformPreview: React.FC<{
  trName: string; trTagName: string;
  alDirection: string; alGap: string; alPrimaryAlign: string; alCounterAlign: string;
  trSizingH: string; trSizingV: string;
  trFillsList: Array<{ color: string; opacity: number }>;
  trStylePairs: Array<{ key: string; value: string }>;
  trRemovalTags: string[];
  trVisible: string; trLocked: string;
  matchTag: string;
}> = ({ trName, trTagName, alDirection, alGap, alPrimaryAlign, alCounterAlign, trSizingH, trSizingV, trFillsList, trStylePairs, trRemovalTags, trVisible, trLocked, matchTag }) => {

  // Build a mock style for the preview box
  const previewStyles: React.CSSProperties = {
    width: '100%',
    minHeight: 80,
    borderRadius: 8,
    border: '2px dashed var(--penma-border)',
    position: 'relative',
    transition: 'all 200ms',
    overflow: 'hidden',
  };

  if (trFillsList.length > 0) {
    const f = trFillsList[0];
    previewStyles.background = f.color;
    previewStyles.opacity = f.opacity / 100;
    previewStyles.border = 'none';
  }

  if (alDirection) {
    previewStyles.display = 'flex';
    previewStyles.flexDirection = alDirection === 'vertical' ? 'column' : 'row';
    previewStyles.flexWrap = alDirection === 'wrap' ? 'wrap' : undefined;
    if (alGap) previewStyles.gap = `${alGap}px`;
    if (alPrimaryAlign) {
      const map: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between' };
      previewStyles.justifyContent = map[alPrimaryAlign] || undefined;
    }
    if (alCounterAlign) {
      const map: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' };
      previewStyles.alignItems = map[alCounterAlign] || undefined;
    }
  }

  for (const p of trStylePairs) {
    if (p.key.trim()) {
      const camel = p.key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      (previewStyles as Record<string, string>)[camel] = p.value;
    }
  }

  if (trVisible === 'false') previewStyles.opacity = 0.2;

  // Count active transforms for summary
  const activeCount = [
    trName, trTagName, alDirection, trSizingH, trSizingV,
    trFillsList.length > 0, trStylePairs.length > 0, trRemovalTags.length > 0,
    trVisible !== 'any', trLocked !== 'any',
  ].filter(Boolean).length;

  const displayTag = trTagName || matchTag || 'div';

  return (
    <div className="space-y-3">
      {/* Preview card */}
      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8B5CF6' }}>Preview</p>
          <span className="text-[9px] rounded-full px-1.5 py-0.5 font-mono" style={{ background: '#F5F3FF', color: '#8B5CF6' }}>
            {activeCount} change{activeCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Visual preview box */}
        <div className="rounded-lg p-3 mb-3" style={{ background: 'var(--penma-bg)' }}>
          <div style={previewStyles}>
            {alDirection ? (
              <>
                <div className="rounded" style={{ background: '#8B5CF640', width: alDirection === 'horizontal' || alDirection === 'wrap' ? 32 : '100%', height: alDirection === 'vertical' ? 20 : 32, flexShrink: 0 }} />
                <div className="rounded" style={{ background: '#8B5CF640', width: alDirection === 'horizontal' || alDirection === 'wrap' ? 48 : '100%', height: alDirection === 'vertical' ? 20 : 32, flexShrink: 0 }} />
                <div className="rounded" style={{ background: '#8B5CF640', width: alDirection === 'horizontal' || alDirection === 'wrap' ? 28 : '100%', height: alDirection === 'vertical' ? 20 : 32, flexShrink: 0 }} />
              </>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[60px]">
                <span className="text-[10px] font-mono" style={{ color: 'var(--penma-text-muted)' }}>
                  &lt;{displayTag}&gt;
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Node info */}
        <div className="space-y-1.5">
          {trName && (
            <PreviewRow label="Name" value={trName} />
          )}
          {trTagName && (
            <PreviewRow label="Tag" value={`<${trTagName}>`} mono />
          )}
        </div>
      </div>

      {/* Properties summary */}
      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--penma-border)', background: 'var(--penma-surface)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--penma-text-muted)' }}>Properties</p>
        <div className="space-y-1">
          {alDirection && (
            <PreviewRow label="Layout" value={`${alDirection}${alGap ? `, gap ${alGap}` : ''}`} />
          )}
          {alPrimaryAlign && <PreviewRow label="Main" value={alPrimaryAlign} />}
          {alCounterAlign && <PreviewRow label="Cross" value={alCounterAlign} />}
          {(trSizingH || trSizingV) && (
            <PreviewRow label="Size" value={`${trSizingH || '\u2013'} \u00D7 ${trSizingV || '\u2013'}`} />
          )}
          {trFillsList.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[10px]" style={{ color: 'var(--penma-text-muted)' }}>Fill</span>
              <span className="inline-block h-3 w-3 rounded-sm border" style={{ background: f.color, borderColor: 'var(--penma-border)', opacity: f.opacity / 100 }} />
              <span className="text-[10px] font-mono" style={{ color: 'var(--penma-text-secondary)' }}>{f.color} {f.opacity}%</span>
            </div>
          ))}
          {trStylePairs.filter((p) => p.key.trim()).map((p, i) => (
            <PreviewRow key={i} label={p.key} value={p.value} mono />
          ))}
          {trRemovalTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px]" style={{ color: '#EF4444' }}>Remove</span>
              {trRemovalTags.map((t, i) => (
                <span key={i} className="text-[10px] font-mono line-through" style={{ color: '#EF4444' }}>{t}</span>
              ))}
            </div>
          )}
          {trVisible !== 'any' && (
            <PreviewRow label="Visible" value={trVisible === 'true' ? 'Yes' : 'No'} />
          )}
          {trLocked !== 'any' && (
            <PreviewRow label="Locked" value={trLocked === 'true' ? 'Yes' : 'No'} />
          )}
          {activeCount === 0 && (
            <p className="text-[10px] py-2 text-center" style={{ color: 'var(--penma-text-muted)' }}>No transforms configured</p>
          )}
        </div>
      </div>

      {/* JSON output */}
      <details className="group">
        <summary className="flex items-center gap-1 cursor-pointer text-[10px] font-medium select-none" style={{ color: 'var(--penma-text-muted)' }}>
          <ChevronRight size={10} className="group-open:rotate-90 transition-transform" />
          JSON output
        </summary>
        <pre
          className="mt-1.5 rounded-lg p-2 text-[9px] overflow-auto max-h-40 whitespace-pre-wrap"
          style={{ background: 'var(--penma-bg)', fontFamily: 'var(--font-mono)', color: '#8B5CF6' }}
        >
          {JSON.stringify(
            buildTransformPreviewJson(trName, trTagName, trStylePairs, trRemovalTags, alDirection, alGap, alPrimaryAlign, alCounterAlign, trSizingH, trSizingV, trFillsList, trVisible, trLocked),
            null, 2,
          )}
        </pre>
      </details>
    </div>
  );
};

function buildTransformPreviewJson(
  trName: string, trTagName: string,
  trStylePairs: Array<{ key: string; value: string }>,
  trRemovalTags: string[],
  alDir: string, alGap: string, alPA: string, alCA: string,
  szH: string, szV: string,
  fills: Array<{ color: string; opacity: number }>,
  vis: string, locked: string,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (trName) o.name = trName;
  if (trTagName) o.tagName = trTagName;
  const styles: Record<string, string> = {};
  for (const p of trStylePairs) { if (p.key.trim()) styles[p.key.trim()] = p.value; }
  if (Object.keys(styles).length > 0) o.styleOverrides = styles;
  if (trRemovalTags.length > 0) o.styleRemovals = trRemovalTags;
  const al: Record<string, unknown> = {};
  if (alDir) al.direction = alDir;
  if (alGap) al.gap = parseFloat(alGap) || 0;
  if (alPA) al.primaryAxisAlign = alPA;
  if (alCA) al.counterAxisAlign = alCA;
  if (Object.keys(al).length > 0) o.autoLayout = al;
  if (szH || szV) {
    const sz: Record<string, string> = {};
    if (szH) sz.horizontal = szH;
    if (szV) sz.vertical = szV;
    o.sizing = sz;
  }
  if (fills.length > 0) o.fills = fills;
  if (vis !== 'any') o.visible = vis === 'true';
  if (locked !== 'any') o.locked = locked === 'true';
  return o;
}

const PreviewRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--penma-text-muted)' }}>{label}</span>
    <span className={`text-[10px] truncate ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--penma-text-secondary)' }}>{value}</span>
  </div>
);

// ── Form helpers ─────────────────────────────────────────────

const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--penma-text-secondary)' }}>
      {label}
      {hint && <span className="font-normal ml-1" style={{ color: 'var(--penma-text-muted)' }}>{hint}</span>}
    </label>
    {children}
    <style jsx>{`
      div :global(.form-input) {
        width: 100%;
        border-radius: 8px;
        border: 1px solid var(--penma-border);
        padding: 6px 10px;
        font-size: 12px;
        color: var(--penma-text);
        background: var(--penma-bg);
        outline: none;
        transition: border-color 150ms;
      }
      div :global(.form-input:focus) {
        border-color: var(--penma-primary);
        box-shadow: 0 0 0 2px var(--penma-primary-light);
      }
      div :global(.form-input::placeholder) {
        color: var(--penma-text-muted);
      }
    `}</style>
  </div>
);
