import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Project } from '@/lib/db/models/project';

// GET /api/public/projects/[shareId] — Load project by public share token (read-only)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  await connectDB();
  const { shareId } = await params;

  const project = await Project.findOne({ publicShareId: shareId }).lean();
  if (!project) {
    return NextResponse.json({ error: 'Project not found or not shared' }, { status: 404 });
  }

  const pages = (project.pages ?? []).map((p) => ({
    id: p._id,
    name: p.name,
    documents: p.documents,
    activeDocumentId: p.activeDocumentId,
    selectedIds: [],
    camera: p.camera,
  }));

  return NextResponse.json({
    id: project._id.toString(),
    name: project.name,
    pages,
    readOnly: true,
  });
}
