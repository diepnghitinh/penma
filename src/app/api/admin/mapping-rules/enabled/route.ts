import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { MappingRule } from '@/lib/db/models/mapping-rule';

// GET /api/admin/mapping-rules/enabled — public endpoint for import pipeline
export async function GET() {
  await connectDB();
  const rules = await MappingRule.find({ enabled: true }).sort({ priority: -1 }).lean();

  return NextResponse.json(
    rules.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      enabled: true,
      priority: r.priority,
      match: r.match,
      transform: r.transform,
      figmaOverrides: r.figmaOverrides,
    })),
  );
}
