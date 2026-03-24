import mongoose, { Schema, type Document } from 'mongoose';

export interface IFont extends Document {
  /** Font family name (e.g. "Noto Sans KR") */
  family: string;
  /** Font weight (e.g. "400", "700") */
  weight: string;
  /** Font style (e.g. "normal", "italic") */
  style: string;
  /** MIME type (e.g. "font/woff2", "font/woff") */
  format: string;
  /** Original URL the font was downloaded from */
  originalUrl: string;
  /** Source page URL that used this font */
  sourceUrl: string;
  /** Binary font data */
  data: Buffer;
  createdAt: Date;
}

const FontSchema = new Schema(
  {
    family: { type: String, required: true, index: true },
    weight: { type: String, default: '400' },
    style: { type: String, default: 'normal' },
    format: { type: String, required: true },
    originalUrl: { type: String, required: true, unique: true },
    sourceUrl: { type: String },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

// Compound index for lookup by family+weight+style
FontSchema.index({ family: 1, weight: 1, style: 1 });

// Clear cached model to pick up schema changes across HMR
if (mongoose.models.Font) {
  mongoose.deleteModel('Font');
}

export const Font = mongoose.model<IFont>('Font', FontSchema);
