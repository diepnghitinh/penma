import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE = 'penma_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'penma-default-secret-change-me';

/** Create a signed session token */
export function createSessionToken(username: string): string {
  const payload = JSON.stringify({ username, ts: Date.now() });
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const token = Buffer.from(payload).toString('base64') + '.' + sig;
  return token;
}

/** Verify and decode a session token (Node.js runtime) */
export function verifySessionToken(token: string): { username: string } | null {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;
    const payload = Buffer.from(b64, 'base64').toString('utf-8');
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (sig !== expected) return null;
    const data = JSON.parse(payload);
    if (Date.now() - data.ts > 7 * 24 * 60 * 60 * 1000) return null;
    return { username: data.username };
  } catch {
    return null;
  }
}

/** Set the session cookie */
export async function setSessionCookie(username: string): Promise<void> {
  const token = createSessionToken(username);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
}

/** Clear the session cookie */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Get session from cookie (for API routes) */
export async function getSession(): Promise<{ username: string } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
