import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { MappingRule } from '@/lib/db/models/mapping-rule';
import { getSession } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/mapping-rules/:id
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  await connectDB();
  const rule = await MappingRule.findById(id).lean();
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: rule._id.toString(),
    name: rule.name,
    description: rule.description,
    enabled: rule.enabled,
    priority: rule.priority,
    category: rule.category,
    match: rule.match,
    transform: rule.transform,
    figmaOverrides: rule.figmaOverrides,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  });
}

// PUT /api/admin/mapping-rules/:id — full update
export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  await connectDB();
  const body = await request.json();

  const rule = await MappingRule.findByIdAndUpdate(
    id,
    {
      name: body.name,
      description: body.description,
      enabled: body.enabled,
      priority: body.priority,
      category: body.category,
      match: body.match,
      transform: body.transform,
      figmaOverrides: body.figmaOverrides,
    },
    { new: true },
  ).lean();

  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: rule._id.toString(),
    name: rule.name,
    description: rule.description,
    enabled: rule.enabled,
    priority: rule.priority,
    category: rule.category,
    match: rule.match,
    transform: rule.transform,
    figmaOverrides: rule.figmaOverrides,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  });
}

// PATCH /api/admin/mapping-rules/:id — partial update (toggle enabled, etc.)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  await connectDB();
  const body = await request.json();

  const rule = await MappingRule.findByIdAndUpdate(id, { $set: body }, { new: true }).lean();
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: rule._id.toString(),
    name: rule.name,
    description: rule.description,
    enabled: rule.enabled,
    priority: rule.priority,
    category: rule.category,
    match: rule.match,
    transform: rule.transform,
    figmaOverrides: rule.figmaOverrides,
  });
}

// DELETE /api/admin/mapping-rules/:id
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  await connectDB();
  const result = await MappingRule.findByIdAndDelete(id);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
