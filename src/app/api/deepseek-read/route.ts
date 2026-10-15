import { readAdminSession, tokenFromCookie } from '@/core/auth/admin';
import type { DeepseekReadBody } from '@/core/daily/analysis-reader';
import { completeDeepseekRead, resolveDeepseekAccess } from '@/core/daily/deepseek-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!readAdminSession(tokenFromCookie(request.headers.get('cookie')))) {
    return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    baseUrl?: unknown;
    apiKey?: unknown;
    read?: DeepseekReadBody;
  } | null;
  if (!body?.read) return Response.json({ ok: false, errorClass: 'bad_request' }, { status: 400 });
  const access = resolveDeepseekAccess({
    browserKey: typeof body.apiKey === 'string' ? body.apiKey : '',
    browserBase: typeof body.baseUrl === 'string' ? body.baseUrl : '',
    env: process.env,
  });
  if (!access) return Response.json({ ok: false, errorClass: 'missing_key' }, { status: 400 });
  const result = await completeDeepseekRead(access, body.read);
  if (!result.ok) return Response.json({ ok: false, reason: 'upstream', errorClass: result.errorClass }, { status: 502 });
  return Response.json({ ok: true, lanes: result.notes, source: access.source });
}
