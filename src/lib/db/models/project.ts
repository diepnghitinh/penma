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

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true },
    pages: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true, strict: false }
);

// Clear cached model to pick up schema changes across HMR
if (mongoose.models.Project) {
  mongoose.deleteModel('Project');
}

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
