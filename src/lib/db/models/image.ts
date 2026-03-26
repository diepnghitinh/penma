import mongoose, { Schema, type Document } from 'mongoose';

export interface IImage extends Document {
  /** Original URL or file path the image was downloaded from */
  originalUrl: string;
  /** Source page URL that used this image */
  sourceUrl: string;
  /** MIME type (e.g. "image/svg+xml", "image/png") */
  contentType: string;
  /** Original filename (e.g. "google-logo.svg") */
  filename: string;
  /** Binary image data */
  data: Buffer;
  /** File size in bytes */
  size: number;
  createdAt: Date;
}

const ImageSchema = new Schema(
  {
    originalUrl: { type: String, required: true, unique: true },
    sourceUrl: { type: String },
    contentType: { type: String, required: true },
    filename: { type: String, default: '' },
    data: { type: Buffer, required: true },
    size: { type: Number, default: 0 },
  },
  { timestamps: true }
);

if (mongoose.models.Image) {
  mongoose.deleteModel('Image');
}

export const Image = mongoose.model<IImage>('Image', ImageSchema);
