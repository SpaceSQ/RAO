import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { historyServiceStatus, type StoredDay } from '@/core/history/archive';
import { publicErrorClass } from '@/core/safety/redact';

export interface RemoteRead {
  configured: boolean;
  online: boolean;
  errorClass?: string;
  runs: StoredDay[];
}

export interface RemoteWrite {
  configured: boolean;
  saved: boolean;
  errorClass?: string;
}

function projectRef(env: Record<string, string | undefined>): string | null {
  const raw = env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

function auth(env: Record<string, string | undefined>): { url: string; key: string } | null {
  if (!historyServiceStatus(env).online) return null;
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return { url, key };
}

function dollarQuote(value: string): string {
  let tag = 'rao';
  while (value.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${value}$${tag}$`;
}

function assertDay(day: StoredDay): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day.windowLabel)) throw new Error('bad_window');
  if (day.actuation !== 'NONE') throw new Error('bad_actuation');
  if (!['BUILTIN', 'DEEPSEEK', 'DEEPSEEK_FALLBACK'].includes(day.analysisReader)) throw new Error('bad_reader');
}

function upsertSql(days: StoredDay[]): string {
  const values = days.map((day) => {
    assertDay(day);
    return `(${[
      dollarQuote(day.windowLabel),
      dollarQuote(day.generatedAt),
      Number(day.meanSecurityScore).toFixed(2),
      Number(day.meanTti).toFixed(2),
      dollarQuote(day.analysisReader),
      dollarQuote('NONE'),
      dollarQuote(day.reportMarkdown),
      `${dollarQuote(JSON.stringify(day))}::jsonb`,
    ].join(', ')})`;
  });
  return `
insert into rao_daily_runs (
  window_label, generated_at, mean_security_score, mean_tti,
  analysis_reader, actuation, report_markdown, payload
) values
${values.join(',\n')}
on conflict (window_label) do update set
  generated_at = excluded.generated_at,
  mean_security_score = excluded.mean_security_score,
  mean_tti = excluded.mean_tti,
  analysis_reader = excluded.analysis_reader,
  actuation = excluded.actuation,
  report_markdown = excluded.report_markdown,
  payload = excluded.payload;
`;
}

async function runCliQuery(
  env: Record<string, string | undefined>,
  sql: string,
): Promise<{ ok: true; rows: unknown[] } | { ok: false; errorClass: string }> {
  const ref = projectRef(env);
  if (!ref) return { ok: false, errorClass: 'missing_project_ref' };
  const dir = await mkdtemp(path.join(tmpdir(), 'rao-sql-'));
  const file = path.join(dir, 'query.sql');
  await writeFile(file, sql, 'utf8');
  try {
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(
        'supabase',
        ['db', 'query', '--linked', '--project-ref', ref, '--file', file],
        { cwd: process.cwd(), env: process.env },
      );
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('timeout'));
      }, 90000);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      });
    });
    if (result.code !== 0) {
      const line = result.stderr.split('\n').find((item) => item.trim()) ?? 'cli_query_failed';
      return { ok: false, errorClass: publicErrorClass(result.code, JSON.stringify({ code: line.slice(0, 80) })) };
    }
    const start = result.stdout.indexOf('{');
    const end = result.stdout.lastIndexOf('}');
    if (start < 0 || end < start) return { ok: false, errorClass: 'cli_no_json' };
    const parsed = JSON.parse(result.stdout.slice(start, end + 1)) as { rows?: unknown[] };
    return { ok: true, rows: parsed.rows ?? [] };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return { ok: false, errorClass: name === 'Error' && error instanceof Error && error.message === 'timeout' ? 'timeout' : 'cli_spawn' };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readViaRest(env: Record<string, string | undefined>): Promise<RemoteRead | null> {
  const creds = auth(env);
  if (!creds) return { configured: false, online: false, runs: [] };
  try {
    const response = await fetch(`${creds.url}/rest/v1/rao_daily_runs?select=payload&order=window_label.asc`, {
      headers: { apikey: creds.key, Authorization: `Bearer ${creds.key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const text = await response.text();
      return { configured: true, online: false, errorClass: publicErrorClass(response.status, text), runs: [] };
    }
    const rows = (await response.json()) as { payload: StoredDay }[];
    return { configured: true, online: true, runs: rows.map((row) => row.payload).filter(Boolean) };
  } catch {
    return null;
  }
}

async function writeViaRest(env: Record<string, string | undefined>, days: StoredDay[]): Promise<RemoteWrite | null> {
  const creds = auth(env);
  if (!creds) return { configured: false, saved: false };
  try {
    const response = await fetch(`${creds.url}/rest/v1/rao_daily_runs`, {
      method: 'POST',
      headers: {
        apikey: creds.key,
        Authorization: `Bearer ${creds.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(
        days.map((day) => ({
          window_label: day.windowLabel,
          generated_at: day.generatedAt,
          mean_security_score: day.meanSecurityScore,
          mean_tti: day.meanTti,
          analysis_reader: day.analysisReader,
          actuation: 'NONE',
          report_markdown: day.reportMarkdown,
          payload: day,
        })),
      ),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const text = await response.text();
      return { configured: true, saved: false, errorClass: publicErrorClass(response.status, text) };
    }
    return { configured: true, saved: true };
  } catch {
    return null;
  }
}

export async function readRemoteDays(env: Record<string, string | undefined> = process.env): Promise<RemoteRead> {
  if (!historyServiceStatus(env).online) return { configured: false, online: false, runs: [] };
  const rest = await readViaRest(env);
  if (rest) return rest;
  const cli = await runCliQuery(env, 'select payload from rao_daily_runs order by window_label asc;');
  if (!cli.ok) return { configured: true, online: false, errorClass: cli.errorClass, runs: [] };
  const runs = cli.rows
    .map((row) => (row as { payload?: StoredDay }).payload)
    .filter((day): day is StoredDay => Boolean(day?.windowLabel));
  return { configured: true, online: true, runs };
}

export async function writeRemoteDays(
  days: StoredDay[],
  env: Record<string, string | undefined> = process.env,
): Promise<RemoteWrite> {
  if (days.length === 0) return { configured: historyServiceStatus(env).online, saved: true };
  if (!historyServiceStatus(env).online) return { configured: false, saved: false };
  const rest = await writeViaRest(env, days);
  if (rest) return rest;
  const cli = await runCliQuery(env, upsertSql(days));
  if (!cli.ok) return { configured: true, saved: false, errorClass: cli.errorClass };
  return { configured: true, saved: true };
}
