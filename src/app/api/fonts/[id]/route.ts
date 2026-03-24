import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import { Font } from '@/lib/db/models/font';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const font = await Font.findById(id).select('data format');

    if (!font) {
      return NextResponse.json({ error: 'Font not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(font.data), {
      headers: {
        'Content-Type': font.format,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
