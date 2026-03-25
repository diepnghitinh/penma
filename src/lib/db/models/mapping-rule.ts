import mongoose, { Schema, type Document } from 'mongoose';

// ── Match conditions ─────────────────────────────────────────

export interface IRuleMatchCondition {
  /** HTML tag to match (e.g. 'button', 'nav', 'div'). Empty or '*' = any tag */
  tag?: string;
  /** CSS property conditions: { 'display': 'flex', 'font-size': '>16px' } */
  cssMatch?: Record<string, string>;
  /** CSS class pattern (regex). e.g. 'btn|button' */
  classPattern?: string;
  /** Match attribute presence or value. e.g. { 'role': 'navigation' } */
  attributeMatch?: Record<string, string>;
  /** Minimum number of children to match */
  minChildren?: number;
  /** Has text content */
  hasText?: boolean;
}

// ── Transform actions ────────────────────────────────────────

export interface IRuleTransform {
  /** Override the Penma node name */
  name?: string;
  /** Force a specific tagName in Penma output */
  tagName?: string;
  /** Override or add computed styles */
  styleOverrides?: Record<string, string>;
  /** Remove these CSS properties */
  styleRemovals?: string[];
  /** Force auto layout config */
  autoLayout?: {
    direction?: 'horizontal' | 'vertical' | 'wrap';
    gap?: number;
    primaryAxisAlign?: string;
    counterAxisAlign?: string;
  };
  /** Force sizing mode */
  sizing?: {
    horizontal?: 'fixed' | 'hug' | 'fill';
    vertical?: 'fixed' | 'hug' | 'fill';
  };
  /** Force fills (background colors) */
  fills?: Array<{ color: string; opacity: number }>;
  /** Set visibility */
  visible?: boolean;
  /** Set locked */
  locked?: boolean;
}

// ── Figma-specific overrides ─────────────────────────────────

export interface IRuleFigmaOverrides {
  /** Figma node type override: FRAME, TEXT, RECTANGLE, etc. */
  nodeType?: string;
  /** Figma layout mode */
  layoutMode?: string;
  /** Extra Figma properties as key-value */
  properties?: Record<string, unknown>;
}

// ── Full rule document ───────────────────────────────────────

export interface IMappingRule extends Document {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  category: string;
  match: IRuleMatchCondition;
  transform: IRuleTransform;
  figmaOverrides: IRuleFigmaOverrides;
  createdAt: Date;
  updatedAt: Date;
}

const MappingRuleSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    category: { type: String, default: 'general' },
    match: { type: Schema.Types.Mixed, default: {} },
    transform: { type: Schema.Types.Mixed, default: {} },
    figmaOverrides: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: false },
);

MappingRuleSchema.index({ enabled: 1, priority: -1 });

if (mongoose.models.MappingRule) {
  mongoose.deleteModel('MappingRule');
}

export const MappingRule = mongoose.model<IMappingRule>('MappingRule', MappingRuleSchema);
