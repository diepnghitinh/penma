import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { ImportedCss } from '@/lib/db/models/imported-css';

// GET /api/admin/imported-css?sourceUrl=xxx — fetch stored CSS rules for a source URL
export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get('sourceUrl');
  if (!sourceUrl) {
    return NextResponse.json({ error: 'sourceUrl is required' }, { status: 400 });
  }

  await connectDB();
  const doc = await ImportedCss.findOne({ sourceUrl }).lean();

  if (!doc) {
    return NextResponse.json({ rules: [], ruleCount: 0, sourceUrl });
  }

  return NextResponse.json({
    rules: doc.rules,
    ruleCount: doc.ruleCount,
    classCss: doc.classCss || {},
    classCount: Object.keys(doc.classCss || {}).length,
    sourceUrl: doc.sourceUrl,
    updatedAt: doc.updatedAt,
  });
}
