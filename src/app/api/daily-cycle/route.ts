import { readAdminSession, tokenFromCookie } from '@/core/auth/admin';
import { runDailyCycle } from '@/core/daily/cycle';
import type { AnalysisReader, IntelSignal, ModelGenome } from '@/core/daily/types';
import type { ReaderLaneNote } from '@/core/daily/analysis-reader';
import { WATCHLIST } from '@/core/data/entities';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!readAdminSession(tokenFromCookie(request.headers.get('cookie')))) {
    return Response.json({ ok: false, errorClass: 'unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    now?: string;
    signals?: IntelSignal[];
    genome?: ModelGenome;
    analysisReader?: AnalysisReader;
    readerNotes?: ReaderLaneNote[];
  } | null;
  if (!body?.now || !body.genome || !Array.isArray(body.signals)) {
    return Response.json({ ok: false, errorClass: 'bad_request' }, { status: 400 });
  }
  try {
    const run = await runDailyCycle({
      now: new Date(body.now),
      signals: body.signals,
      genome: body.genome,
      entities: WATCHLIST,
      analysisReader: body.analysisReader,
      readerNotes: body.readerNotes,
    });
    return Response.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'daily_cycle_failed';
    const errorClass = message.replace(/sk-[A-Za-z0-9_-]+/g, '').replace(/Bearer\s+\S+/gi, 'Bearer').slice(0, 120);
    return Response.json({ ok: false, errorClass }, { status: 502 });
  }
}
