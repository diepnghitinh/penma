import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/view', '/api/public'];
const SESSION_SECRET = process.env.SESSION_SECRET || 'penma-default-secret-change-me';

function verifyToken(token: string): boolean {
  try {
    const crypto = require('crypto');
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return false;
    const payload = Buffer.from(b64, 'base64').toString('utf-8');
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (sig !== expected) return false;
    const data = JSON.parse(payload);
    if (Date.now() - data.ts > 7 * 24 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths, static assets, and Next.js internals
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = request.cookies.get('penma_session')?.value;
  if (!token || !verifyToken(token)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
