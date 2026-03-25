import mongoose, { Schema, type Document } from 'mongoose';

export interface IImportedCss extends Document {
  /** Source URL or zip path the CSS was extracted from */
  sourceUrl: string;
  /** All CSS rules extracted from the page's stylesheets */
  rules: Array<{
    selector: string;
    declarations: Record<string, string>;
    source: string;
  }>;
  /** Total number of rules */
  ruleCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ImportedCssSchema = new Schema(
  {
    sourceUrl: { type: String, required: true, index: true },
    rules: { type: Schema.Types.Mixed, default: [] },
    ruleCount: { type: Number, default: 0 },
  },
  { timestamps: true, strict: false },
);

if (mongoose.models.ImportedCss) {
  mongoose.deleteModel('ImportedCss');
}

export const ImportedCss = mongoose.model<IImportedCss>('ImportedCss', ImportedCssSchema);
