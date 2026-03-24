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
  /** Random token for public read-only sharing (null = not shared) */
  publicShareId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true },
    pages: { type: Schema.Types.Mixed, default: [] },
    publicShareId: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true, strict: false }
);

// Clear cached model to pick up schema changes across HMR
if (mongoose.models.Project) {
  mongoose.deleteModel('Project');
}

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
