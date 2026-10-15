import { createHmac, timingSafeEqual } from 'node:crypto';

/** The only account. There is no registration path. */
export const ADMIN_USERNAME = 'rao-admin';
export const ADMIN_COOKIE = 'rao_admin';

export function configuredAdminPassword(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.RAO_ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sessionSecret(env: Record<string, string | undefined>): string {
  return env.RAO_SESSION_SECRET?.trim() || env.RAO_ADMIN_PASSWORD?.trim() || '';
}

export function signAdminSession(env: Record<string, string | undefined> = process.env, now = Date.now()): string {
  const secret = sessionSecret(env);
  const exp = now + 12 * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ u: ADMIN_USERNAME, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readAdminSession(
  token: string | undefined,
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
): boolean {
  const secret = sessionSecret(env);
  if (!token || !secret) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as { u?: string; exp?: number };
    return payload.u === ADMIN_USERNAME && typeof payload.exp === 'number' && payload.exp > now;
  } catch {
    return false;
  }
}

export function tokenFromCookie(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === ADMIN_COOKIE) return rest.join('=');
  }
  return undefined;
}

export function adminCookie(token: string, maxAge: number): string {
  return `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}
