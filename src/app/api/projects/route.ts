import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Project } from '@/lib/db/models/project';
import { v4 as uuid } from 'uuid';

// GET /api/projects — List projects (lightweight: no document data)
export async function GET() {
  await connectDB();

  const projects = await Project.find({}, {
    name: 1,
    updatedAt: 1,
    'pages._id': 1,
    'pages.name': 1,
  })
    .sort({ updatedAt: -1 })
    .lean();

  const result = projects.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    updatedAt: p.updatedAt,
    pageCount: p.pages?.length ?? 0,
  }));

  return NextResponse.json(result);
}

// POST /api/projects — Create new project
export async function POST(request: Request) {
  await connectDB();

  const body = await request.json();
  const name = body.name || 'Untitled';

  const defaultPage = {
    _id: uuid(),
    name: 'Page 1',
    documents: [],
    activeDocumentId: null,
    selectedIds: [],
    camera: { x: 0, y: 0, zoom: 1 },
  };

  const project = await Project.create({
    name,
    pages: [defaultPage],
  });

  return NextResponse.json(
    { id: project._id.toString(), name: project.name },
    { status: 201 }
  );
}
