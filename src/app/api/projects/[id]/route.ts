import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db/connection';
import { Project } from '@/lib/db/models/project';

// GET /api/projects/[id] — Load full project
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;

  const project = await Project.findById(id).lean();
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Normalize page _id → id for the client
  const pages = (project.pages ?? []).map((p) => ({
    id: p._id,
    name: p.name,
    documents: p.documents,
    activeDocumentId: p.activeDocumentId,
    selectedIds: p.selectedIds,
    camera: p.camera,
  }));

  return NextResponse.json({
    id: project._id.toString(),
    name: project.name,
    pages,
    publicShareId: project.publicShareId ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

// PUT /api/projects/[id] — Save full pages array
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const project = await Project.findByIdAndUpdate(
      id,
      { $set: { pages: body.pages } },
      { new: true, timestamps: true }
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, updatedAt: project.updatedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[PUT /api/projects/[id]]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/projects/[id] — Update project (rename, toggle share)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;

  // Toggle public sharing
  if (body.toggleShare !== undefined) {
    if (body.toggleShare) {
      updates.publicShareId = crypto.randomBytes(12).toString('hex');
    } else {
      updates.publicShareId = null;
    }
  }

  const project = await Project.findByIdAndUpdate(id, updates, { new: true });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    name: project.name,
    publicShareId: project.publicShareId ?? null,
  });
}

// DELETE /api/projects/[id] — Delete project
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;

  const result = await Project.findByIdAndDelete(id);
  if (!result) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
