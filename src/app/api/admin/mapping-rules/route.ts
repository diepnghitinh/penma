import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { MappingRule } from '@/lib/db/models/mapping-rule';
import { getSession } from '@/lib/auth';

// GET /api/admin/mapping-rules — list all rules
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const rules = await MappingRule.find().sort({ priority: -1, createdAt: -1 }).lean();

  return NextResponse.json(
    rules.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      priority: r.priority,
      category: r.category,
      match: r.match,
      transform: r.transform,
      figmaOverrides: r.figmaOverrides,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  );
}

// POST /api/admin/mapping-rules — create a new rule
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const body = await request.json();

  const rule = await MappingRule.create({
    name: body.name || 'New Rule',
    description: body.description || '',
    enabled: body.enabled ?? true,
    priority: body.priority ?? 0,
    category: body.category || 'general',
    match: body.match || {},
    transform: body.transform || {},
    figmaOverrides: body.figmaOverrides || {},
  });

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
  }, { status: 201 });
}
