import { adminCookie, ADMIN_USERNAME, configuredAdminPassword, passwordsMatch, signAdminSession } from '@/core/auth/admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const expected = configuredAdminPassword();
  if (!expected) {
    return Response.json({ ok: false, reason: 'unconfigured' }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (username !== ADMIN_USERNAME || !passwordsMatch(password, expected)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return new Response(JSON.stringify({ ok: true, username: ADMIN_USERNAME }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': adminCookie(signAdminSession(), 12 * 60 * 60),
    },
  });
}
