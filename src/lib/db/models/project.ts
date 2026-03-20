import mongoose, { Schema, type Document } from 'mongoose';

export interface IProjectPage {
  _id: string;
  name: string;
  documents: unknown[];
  activeDocumentId: string | null;
  selectedIds: string[];
  camera: { x: number; y: number; zoom: number };
}

export interface IProject extends Document {
  name: string;
  pages: IProjectPage[];
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    documents: { type: Schema.Types.Mixed, default: [] },
    activeDocumentId: { type: String, default: null },
    selectedIds: { type: [String], default: [] },
    camera: {
      type: new Schema({ x: Number, y: Number, zoom: Number }, { _id: false }),
      default: { x: 0, y: 0, zoom: 1 },
    },
  },
  { _id: false }
);

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true },
    pages: { type: [PageSchema], default: [] },
  },
  { timestamps: true }
);

export const Project =
  mongoose.models.Project as mongoose.Model<IProject> ??
  mongoose.model<IProject>('Project', ProjectSchema);
