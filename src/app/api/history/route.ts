import { readAdminSession, tokenFromCookie } from '@/core/auth/admin';
import type { StoredDay } from '@/core/history/archive';
import { readRemoteDays, writeRemoteDays } from '@/core/history/remote-store';

export const runtime = 'nodejs';

export async function GET() {
  const result = await readRemoteDays(process.env);
  return Response.json(result);
}

export async function POST(request: Request) {
  if (!readAdminSession(tokenFromCookie(request.headers.get('cookie')))) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { day?: StoredDay } | null;
  const day = body?.day;
  if (!day?.windowLabel || day.actuation !== 'NONE') {
    return Response.json({ ok: false, errorClass: 'bad_request' }, { status: 400 });
  }
  const saved = await writeRemoteDays([day], process.env);
  return Response.json({ ok: saved.saved, ...saved });
}
