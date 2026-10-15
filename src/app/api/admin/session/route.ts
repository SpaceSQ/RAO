import { ADMIN_USERNAME, readAdminSession, tokenFromCookie } from '@/core/auth/admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const ok = readAdminSession(tokenFromCookie(request.headers.get('cookie')));
  return Response.json({ ok, username: ok ? ADMIN_USERNAME : null }, { status: ok ? 200 : 401 });
}
