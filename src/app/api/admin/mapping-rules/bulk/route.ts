import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { MappingRule } from '@/lib/db/models/mapping-rule';
import { getSession } from '@/lib/auth';

// GET /api/admin/mapping-rules/bulk — export all rules as JSON
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const rules = await MappingRule.find().sort({ priority: -1 }).lean();

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    rules: rules.map((r) => ({
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      priority: r.priority,
      category: r.category,
      match: r.match,
      transform: r.transform,
      figmaOverrides: r.figmaOverrides,
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="mapping-rules-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

// POST /api/admin/mapping-rules/bulk — import rules from JSON
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const body = await request.json();

  if (!body.rules || !Array.isArray(body.rules)) {
    return NextResponse.json({ error: 'Invalid format: expected { rules: [...] }' }, { status: 400 });
  }

  const created = [];
  for (const r of body.rules) {
    const rule = await MappingRule.create({
      name: r.name || 'Imported Rule',
      description: r.description || '',
      enabled: r.enabled ?? true,
      priority: r.priority ?? 0,
      category: r.category || 'general',
      match: r.match || {},
      transform: r.transform || {},
      figmaOverrides: r.figmaOverrides || {},
    });
    created.push(rule._id.toString());
  }

  return NextResponse.json({
    success: true,
    imported: created.length,
    ids: created,
  }, { status: 201 });
}
