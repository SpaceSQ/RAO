'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Lock, Radio, Timer } from 'lucide-react';
import { DAILY_LANES } from '@/core/daily/lanes';
import { commitRun } from '@/core/daily/baseline-store';
import {
  closedDailyWindow,
  formatCountdown,
  formatShanghaiDate,
  msUntilNextShanghaiMidnight,
  nextShanghaiMidnight,
  signalsInWindow,
} from '@/core/daily/clock';
import { runDailyCycle } from '@/core/daily/cycle';
import { replayDailyHistory } from '@/core/daily/replay';
import { buildDailyReport } from '@/core/daily/report';
import { DEFAULT_DEEPSEEK_BASE, emptyKeyReaderLine } from '@/core/daily/analysis-reader';
import type { AnalysisReader, BaselineStore, IntelSignal, LaneId } from '@/core/daily/types';
import type { ReaderLaneNote } from '@/core/daily/analysis-reader';
import { WATCHLIST } from '@/core/data/entities';
import { PUBLIC_SIGNALS, UNDATED_PRIORS } from '@/core/data/signals';
import { overlayDays, toStoredDay, upsertDay, type StoredDay } from '@/core/history/archive';
import { buildVersionWatchTasks } from '@/core/priority/version-watch';
import { LAB_ORGS, MODEL_VERSIONS } from '@/core/priority/version-registry';
import {
  CHANNEL_BRAND,
  EXPERIMENT_NOTE,
  LOCAL_HISTORY_NOTE,
  MANUAL_PUBLISH_NOTE,
  ONLINE_HISTORY_NOTE,
  PUBLIC_HOST,
  type Surface,
} from '@/core/site';
import { StochasticOlfactoryScheduler } from '@/core/engines/stochastic-scheduler';

const LOCAL_DAYS_KEY = 'rao.local.days';
const DEEPSEEK_BASE_KEY = 'rao.deepseek.base';
const DEEPSEEK_KEY_KEY = 'rao.deepseek.key';

function readLocalDays(): StoredDay[] {
  try {
    const raw = localStorage.getItem(LOCAL_DAYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredDay[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scoreTone(score: number): string {
  if (score >= 70) return 'text-anchor';
  if (score >= 40) return 'text-amber-300';
  if (score >= 20) return 'text-diode';
  return 'text-mute';
}

function shanghaiClock(iso: string): string {
  const local = new Date(Date.parse(iso) + 8 * 60 * 60 * 1000);
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  const hour = String(local.getUTCHours()).padStart(2, '0');
  const minute = String(local.getUTCMinutes()).padStart(2, '0');
  return `${local.getUTCFullYear()}-${month}-${day} ${hour}:${minute}`;
}

export function Workbench({ surface = 'public' }: { surface?: Surface }) {
  const canWrite = surface === 'admin';
  const [store, setStore] = useState<BaselineStore | null>(null);
  const [signals, setSignals] = useState<IntelSignal[]>(PUBLIC_SIGNALS);
  const [phase, setPhase] = useState<'boot' | 'ready' | 'running'>('boot');
  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LaneId>('frontier-unsanctioned');
  const [dayLabel, setDayLabel] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState(LOCAL_HISTORY_NOTE);
  const [notice, setNotice] = useState('公众页只读。日周期由管理员执行。');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftLane, setDraftLane] = useState<LaneId>('frontier-unsanctioned');
  const [deepseekBase, setDeepseekBase] = useState(DEFAULT_DEEPSEEK_BASE);
  const [deepseekKey, setDeepseekKey] = useState('');
  const [readerLine, setReaderLine] = useState(emptyKeyReaderLine());
  const [serverDeepseek, setServerDeepseek] = useState(false);
  const [serverBase, setServerBase] = useState(DEFAULT_DEEPSEEK_BASE);
  const [baseOverride, setBaseOverride] = useState(false);
  const [schedulerFire, setSchedulerFire] = useState('正在核对零点调度。');
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [reportDraft, setReportDraft] = useState('');
  const [pulse, setPulse] = useState({ x: 1.1, y: 2.05, z: 24.8, wait: 0 });
  const scheduler = useRef(new StochasticOlfactoryScheduler());
  const pulseLeft = useRef(1200);

  useEffect(() => {
    let cancelled = false;
    replayDailyHistory({
      asOf: new Date(),
      signals: PUBLIC_SIGNALS,
      entities: WATCHLIST,
    })
      .then((next) => {
        if (cancelled) return;
        setStore(overlayDays(next, readLocalDays()));
        setPhase('ready');
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : '日周期回放失败');
        setPhase('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);
      pulseLeft.current -= 1000;
      if (pulseLeft.current <= 0) {
        const entropy = store ? Math.min(1, store.runs.at(-1)?.meanTti ?? 35) / 100 : 0.35;
        const next = scheduler.current.nextChaosPulse(entropy);
        pulseLeft.current = next.nextIntervalMs;
        setPulse({ ...next.lorenzState, wait: next.nextIntervalMs });
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [store]);

  const latest = store?.runs.at(-1) ?? null;
  const viewed = (dayLabel ? store?.runs.find((run) => run.window.label === dayLabel) : null) ?? latest;
  const closed = now ? closedDailyWindow(now) : null;

  async function copyReport() {
    if (!viewed) return;
    const text = buildDailyReport(viewed);
    setReportDraft(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote(`已复制 ${viewed.window.label} 的报告。${MANUAL_PUBLISH_NOTE}`);
    } catch {
      setCopyNote(`浏览器未授权剪贴板。报告已显示在下面，可手工复制。${MANUAL_PUBLISH_NOTE}`);
    }
  }

  function saveReaderSettings() {
    const base = deepseekBase.trim() || serverBase || DEFAULT_DEEPSEEK_BASE;
    setDeepseekBase(base);
    if (deepseekKey.trim()) {
      localStorage.setItem(DEEPSEEK_KEY_KEY, deepseekKey.trim());
      setReaderLine('密钥已留在这台浏览器。执行日周期时才会调用 Deepseek。');
    } else {
      localStorage.removeItem(DEEPSEEK_KEY_KEY);
      setReaderLine(serverDeepseek ? '浏览器未保存密钥。日周期将使用服务器环境中的 Deepseek。' : emptyKeyReaderLine());
    }
    if (deepseekBase.trim() && deepseekBase.trim() !== serverBase) {
      localStorage.setItem(DEEPSEEK_BASE_KEY, deepseekBase.trim());
      setBaseOverride(true);
    } else {
      localStorage.removeItem(DEEPSEEK_BASE_KEY);
      setBaseOverride(false);
    }
  }

  useEffect(() => {
    if (!canWrite || !store || !closed || phase !== 'ready') return;
    const latestLabel = store.runs.at(-1)?.window.label;
    if (!latestLabel || closed.label <= latestLabel) return;
    void execute(store, signals, new Date());
    // The midnight handoff runs on the admin console only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed?.label, canWrite]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/history')
      .then((response) => response.json())
      .then((body: { online?: boolean; configured?: boolean; errorClass?: string; runs?: StoredDay[] }) => {
        if (cancelled) return;
        if (body.online) setHistoryNote(ONLINE_HISTORY_NOTE);
        else if (body.configured) setHistoryNote(`在线库已配置，读取失败：${body.errorClass ?? 'unknown'}`);
        else setHistoryNote(LOCAL_HISTORY_NOTE);
        if (body.online && Array.isArray(body.runs) && body.runs.length > 0) {
          setStore((current) => (current ? overlayDays(current, body.runs ?? []) : current));
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryNote(LOCAL_HISTORY_NOTE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scheduler')
      .then((response) => response.json())
      .then((body: { armed?: boolean; nextFireIso?: string; nextWindowLabel?: string }) => {
        if (cancelled) return;
        if (body.armed && body.nextFireIso) {
          setSchedulerFire(`零点调度已待命。下次触发 ${body.nextFireIso}，覆盖窗口 ${body.nextWindowLabel}。`);
        } else {
          setSchedulerFire('零点调度进程未在运行。');
        }
      })
      .catch(() => {
        if (!cancelled) setSchedulerFire('零点调度状态读取失败。');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canWrite) return;
    const savedBase = localStorage.getItem(DEEPSEEK_BASE_KEY);
    const key = localStorage.getItem(DEEPSEEK_KEY_KEY);
    if (savedBase) {
      setDeepseekBase(savedBase);
      setBaseOverride(true);
    }
    if (key) {
      setDeepseekKey(key);
      setReaderLine('密钥已留在这台浏览器。执行日周期时才会调用 Deepseek。');
    }
    let cancelled = false;
    fetch('/api/reader-config')
      .then((response) => response.json())
      .then((body: { configured?: boolean; base?: string }) => {
        if (cancelled) return;
        setServerDeepseek(Boolean(body.configured));
        if (body.base) setServerBase(body.base);
        if (!savedBase && body.base) setDeepseekBase(body.base);
        if (!key) {
          setReaderLine(
            body.configured
              ? '浏览器未保存密钥。日周期将使用服务器环境中的 Deepseek。'
              : emptyKeyReaderLine(),
          );
        }
      })
      .catch(() => {
        if (!cancelled && !key) setReaderLine(emptyKeyReaderLine());
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite]);

  async function consultReader(
    at: Date,
    corpus: IntelSignal[],
  ): Promise<{ reader: AnalysisReader; notes: ReaderLaneNote[]; errorClass?: string }> {
    if (!canWrite) return { reader: 'BUILTIN', notes: [] };
    let useServer = serverDeepseek;
    if (!deepseekKey.trim() && !useServer) {
      const config = await fetch('/api/reader-config')
        .then((response) => response.json())
        .catch(() => null) as { configured?: boolean } | null;
      useServer = Boolean(config?.configured);
    }
    if (!deepseekKey.trim() && !useServer) return { reader: 'BUILTIN', notes: [] };
    const dayWindow = closedDailyWindow(at);
    const clipped = signalsInWindow(corpus, dayWindow);
    try {
      const response = await fetch('/api/deepseek-read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: baseOverride ? deepseekBase.trim() : '',
          apiKey: deepseekKey.trim(),
          read: {
            window: dayWindow,
            citations: clipped.map((signal) => ({
              id: signal.id,
              title: signal.title,
              summary: signal.summary,
              source: signal.source,
              url: signal.sourceUrl,
              lanes: signal.lanes,
            })),
            versionWatches: buildVersionWatchTasks().map((task) => ({
              lab: task.lab,
              versionKeyword: task.versionKeyword,
              aliases: task.aliases,
              featureNotes: task.featureNotes,
            })),
            lanes: DAILY_LANES.map((lane) => ({
              id: lane.id,
              nameZh: lane.nameZh,
              assignment: lane.assignment,
            })),
          },
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { errorClass?: string } | null;
        return { reader: 'DEEPSEEK_FALLBACK', notes: [], errorClass: payload?.errorClass || 'upstream' };
      }
      const payload = (await response.json()) as { ok?: boolean; lanes?: ReaderLaneNote[] };
      if (!payload.ok || !payload.lanes?.length) return { reader: 'DEEPSEEK_FALLBACK', notes: [], errorClass: 'empty_lanes' };
      return { reader: 'DEEPSEEK', notes: payload.lanes };
    } catch {
      return { reader: 'DEEPSEEK_FALLBACK', notes: [], errorClass: 'network' };
    }
  }

  async function execute(base: BaselineStore, corpus: IntelSignal[], at: Date) {
    if (!canWrite) return;
    setPhase('running');
    setError(null);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      const dayWindow = closedDailyWindow(at);
      const existing = base.runs.find((run) => run.window.label === dayWindow.label);
      const genome = existing ? existing.genomeBefore : base.genome;
      const reader = await consultReader(at, corpus);
      const response = await fetch('/api/daily-cycle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          now: at.toISOString(),
          signals: corpus,
          genome,
          analysisReader: reader.reader,
          readerNotes: reader.notes,
        }),
      });
      if (!response.ok) {
        const failed = (await response.json().catch(() => null)) as { errorClass?: string } | null;
        throw new Error(failed?.errorClass || '日周期失败');
      }
      const run = (await response.json()) as Awaited<ReturnType<typeof runDailyCycle>>;
      const day = toStoredDay(run);
      localStorage.setItem(LOCAL_DAYS_KEY, JSON.stringify(upsertDay(readLocalDays(), day)));
      void fetch('/api/history', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day }),
      });
      setStore(commitRun(base, run));
      setDayLabel(run.window.label);
      const line =
        run.analysisReader === 'DEEPSEEK'
          ? `${run.window.label} 已由 Deepseek 阅读引文。关注分 ${run.meanSecurityScore.toFixed(1)}。`
          : run.analysisReader === 'DEEPSEEK_FALLBACK'
            ? `${run.window.label} 的 Deepseek 调用失败${reader.errorClass ? `（${reader.errorClass}）` : ''}，已回退内置本地模型。关注分 ${run.meanSecurityScore.toFixed(1)}。`
            : `${run.window.label} 已完成本地排练，未调用 Deepseek。关注分 ${run.meanSecurityScore.toFixed(1)}。`;
      setReaderLine(line);
      setNotice(line);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '日周期失败');
    } finally {
      setPhase('ready');
    }
  }

  function ingestAndRun() {
    if (!store || !latest || !draftTitle.trim() || !draftSummary.trim()) return;
    const start = Date.parse(latest.window.startIso);
    const signal: IntelSignal = {
      id: `operator-${Date.now()}`,
      observedAt: new Date(start + 12 * 60 * 60 * 1000).toISOString(),
      source: '观察员录入',
      sourceUrl: '',
      title: draftTitle.trim(),
      summary: draftSummary.trim(),
      lanes: [draftLane],
      elementPressure: { E14_CARBON_SOVEREIGNTY: 0.55 },
      lawPressure: {},
      intensity: 0.82,
    };
    const corpus = [...signals, signal];
    setSignals(corpus);
    setDraftTitle('');
    setDraftSummary('');
    void execute(store, corpus, new Date(latest.window.endIso));
  }

  const chart = useMemo(
    () =>
      (store?.trend ?? []).map((point) => ({
        ...point,
        day: point.label.slice(5),
      })),
    [store],
  );

  const selectedReport = viewed?.laneReports.find((report) => report.laneId === selected) ?? null;
  const quietCount = viewed?.versionScores.filter((score) => score.status === 'QUIET').length ?? 0;
  const matchedCount = viewed?.versionScores.filter((score) => score.matched).length ?? 0;

  if (surface === 'embed-report') {
    return (
      <main data-testid="embed-report" data-surface="embed-report" className="bg-obsidian px-4 py-4 text-sm text-mute">
        <p className="font-mono text-[11px] tracking-[0.14em] text-diode">{CHANNEL_BRAND}</p>
        <h1 className="mt-1 text-base font-semibold text-white">当日分析报告</h1>
        <p className="mt-1 text-xs">{PUBLIC_HOST} · {viewed?.window.label ?? '对齐日窗'}</p>
        <p data-testid="embed-report-body" className="mt-3 leading-6 text-white/90">
          {viewed?.synthesis ?? '报告将在日窗对齐后出现。'}
        </p>
        <p className="mt-3 text-xs">{MANUAL_PUBLISH_NOTE}</p>
      </main>
    );
  }

  if (surface === 'embed-data') {
    return (
      <main data-testid="embed-data" data-surface="embed-data" className="bg-obsidian px-3 py-3">
        <p className="font-mono text-[11px] tracking-[0.14em] text-diode">{CHANNEL_BRAND}</p>
        <p className="mt-1 text-xs text-mute">{PUBLIC_HOST} · {viewed?.window.label ?? '--'} · 关注分 {viewed?.meanSecurityScore.toFixed(1) ?? '--'} · TTI {viewed?.meanTti.toFixed(1) ?? '--'}</p>
        <p className="mt-1 text-[11px] text-mute">版本关键词命中 {matchedCount} · QUIET {quietCount}</p>
        <div data-testid="trend-chart" className="mt-2 h-[220px]">
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(0,240,255,0.08)" />
                <XAxis dataKey="day" tick={{ fill: '#8B97A8', fontSize: 10 }} interval={13} />
                <YAxis tick={{ fill: '#8B97A8', fontSize: 10 }} domain={[0, 100]} width={28} />
                <Line type="monotone" dataKey="meanSecurityScore" name="关注分" stroke="#FF2A4B" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="meanTti" name="平均 TTI" stroke="#00F0FF" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="pt-10 text-center text-xs text-mute">趋势对齐中。</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main data-surface={surface} className="mx-auto min-h-screen max-w-[1440px] px-4 py-4 md:px-6">
      <p data-testid="experiment-banner" className="mb-3 text-xs text-mute">
        {CHANNEL_BRAND} · {PUBLIC_HOST} · {EXPERIMENT_NOTE}
      </p>
      <header className="panel shadow-lock mb-4 flex flex-col gap-4 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-diode">{PUBLIC_HOST}</p>
          <h1 className="text-lg font-semibold text-white">{CHANNEL_BRAND}</h1>
          <p className="text-sm text-mute">红锚观察者 RAO v1.0 · 只读情报，零主动干预。</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-anchor/50 bg-anchor/10 px-3 py-1.5 text-xs font-semibold text-anchor shadow-lock">
          <Lock size={14} />
          ZERO-ACTUATION LOCK: ENGAGED | 零主动干预·只读情报模式已锁死
        </div>
        <div className="font-mono text-xs text-mute">
          <div className="flex items-center gap-2 text-diode">
            <Radio size={14} />
            洛伦兹 {pulse.x.toFixed(2)}, {pulse.y.toFixed(2)}, {pulse.z.toFixed(2)}
          </div>
          <div>混沌脉冲 {Math.max(0, pulseLeft.current / 1000).toFixed(0)}s · 只推进本地时钟</div>
        </div>
      </header>

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <article className="panel px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-mute">
            <Timer size={14} /> 距下一个上海零点
          </p>
          <p data-testid="countdown" className="mt-1 font-mono text-3xl text-white">
            {now ? formatCountdown(msUntilNextShanghaiMidnight(now)) : '--:--:--'}
          </p>
          <p className="mt-1 text-xs text-mute">
            {now ? shanghaiClock(nextShanghaiMidnight(now).toISOString()) : ''} Asia/Shanghai
          </p>
        </article>
        <article className="panel px-4 py-3 md:col-span-2">
          <p className="text-xs text-mute">回看日窗</p>
          <label className="mt-1 block text-xs text-mute">
            <select
              data-testid="history-day"
              value={viewed?.window.label ?? ''}
              onChange={(event) => setDayLabel(event.target.value)}
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm text-white"
            >
              {(store?.runs ?? []).map((run) => (
                <option key={run.window.label} value={run.window.label}>
                  {run.window.label}
                </option>
              ))}
            </select>
          </label>
          <p data-testid="run-window" className="mt-2 font-mono text-sm text-white">
            {viewed ? `${viewed.window.label}  00:00 → 次日 00:00` : '正在对齐日窗'}
          </p>
        </article>
        <article className="panel px-4 py-3">
          <p className="text-xs text-mute">执行模式</p>
          <p data-testid="mode-label" className="mt-1 text-sm font-semibold text-diode">
            {viewed
              ? `${viewed.executionLabel} · ${viewed.mode === 'CLOUD_GROK' ? 'CloudGrokAdapter' : 'LocalRehearsalPort'}`
              : '等待本地排练'}
          </p>
          <p className="mt-1 text-xs text-mute">
            基因组 G{store?.genome.generation ?? 0} · 行动权 {viewed?.actuation ?? 'NONE'}
          </p>
          <p data-testid="last-run" className="mt-1 font-mono text-[11px] text-mute">
            {viewed ? `写入 ${shanghaiClock(viewed.generatedAt)}` : ''}
          </p>
        </article>
      </section>

      <p data-testid="history-source" className="mb-3 text-xs text-mute">{historyNote}</p>
      <p data-testid="scheduler-fire" className="mb-3 text-xs text-diode">{schedulerFire}</p>
      <p data-testid="analysis-reader" className="mb-3 text-sm text-diode">
        {canWrite ? readerLine : '公众页不提供密钥。当前分数由内置本地模型算出，没有实时调用。'}
      </p>
      {canWrite ? (
        <section data-testid="analysis-settings" className="panel mb-4 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">分析模型设置 · Deepseek</h2>
          <p className="mt-1 text-xs text-mute">浏览器里的密钥优先。留空则用服务器环境，再留空才用内置本地模型。</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-xs text-mute">
              Deepseek API 基址
              <input
                data-testid="deepseek-base"
                value={deepseekBase}
                onChange={(event) => setDeepseekBase(event.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-mute">
              Deepseek API 密钥
              <input
                data-testid="deepseek-key"
                type="password"
                value={deepseekKey}
                autoComplete="off"
                onChange={(event) => setDeepseekKey(event.target.value)}
                placeholder="留空则使用服务器环境，仍为空则用内置模型"
                className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
              />
            </label>
          </div>
          <button type="button" onClick={saveReaderSettings} className="mt-3 rounded-md border border-diode/40 px-3 py-1.5 text-sm text-diode">
            保存到这台浏览器
          </button>
        </section>
      ) : null}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-mute">{canWrite ? notice : '公众页只读。需要执行日周期或录入情报时，走管理员入口。'}</p>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="run-daily"
              disabled={!store || phase !== 'ready'}
              onClick={() => store && void execute(store, signals, new Date())}
              className="rounded-md bg-anchor px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {phase === 'running' ? '日周期运行中' : phase === 'boot' ? '正在回放日窗' : '立即执行日周期'}
            </button>
            <button
              type="button"
              data-testid="copy-report"
              disabled={!viewed}
              onClick={() => void copyReport()}
              className="rounded-md border border-diode/40 px-4 py-2 text-sm text-diode disabled:opacity-40"
            >
              复制当日报告
            </button>
          </div>
        ) : (
          <a data-testid="admin-entry" href="/admin" className="text-sm text-diode">
            管理员入口
          </a>
        )}
      </div>
      {canWrite ? <p data-testid="publish-note" className="mb-3 text-xs text-mute">{MANUAL_PUBLISH_NOTE}</p> : null}
      {copyNote ? <p className="mb-3 text-sm text-diode">{copyNote}</p> : null}
      {reportDraft ? (
        <pre data-testid="report-draft" className="panel mb-4 overflow-auto px-3 py-3 text-xs leading-5 text-mute">{reportDraft}</pre>
      ) : null}
      {error ? <p className="mb-3 text-sm text-anchor">{error}</p> : null}

      <section data-testid="priority-panel" className="mb-4 grid gap-3 lg:grid-cols-2">
        {(['ANTHROPIC', 'OPENAI'] as const).map((lab) => {
          const org = LAB_ORGS.find((entry) => entry.lab === lab);
          const rows = (viewed?.versionScores ?? []).filter((score) => score.lab === lab);
          return (
            <article key={lab} className="panel px-3 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-white">
                  {lab === 'ANTHROPIC' ? 'Anthropic' : 'OpenAI'} 重点观察
                </h2>
                <p className="font-mono text-[10px] text-diode">{org?.s2Did}</p>
              </div>
              <p className="mb-2 text-[11px] text-mute">
                每个版本关键词都是日常任务。未命中保持在板上，分数是观察者评估，不是厂商评级。
              </p>
              <ul className="max-h-80 space-y-2 overflow-auto pr-1">
                {rows.map((row) => {
                  const entry = MODEL_VERSIONS.find((item) => item.id === row.versionId);
                  const evidence = row.evidenceIds
                    .map((id) => signals.find((signal) => signal.id === id))
                    .filter((signal): signal is IntelSignal => Boolean(signal));
                  return (
                    <li
                      key={row.versionId}
                      data-testid="priority-row"
                      data-lab={row.lab}
                      data-keyword={row.versionKeyword}
                      data-status={row.status}
                      data-matched={row.matched ? 'yes' : 'no'}
                      className="grid grid-cols-[1fr_auto] gap-2 border-t border-white/5 py-2"
                    >
                      <div>
                        <p className="text-sm text-white">
                          {row.versionKeyword}
                          <span className="ml-2 font-mono text-[10px] text-mute">{row.watchPriority}</span>
                        </p>
                        <p className="font-mono text-[10px] text-diode">{row.s2Did}</p>
                        <p className="text-xs leading-5 text-mute">{row.featureLine}</p>
                        {entry ? (
                          <a className="text-[11px] text-diode" href={entry.sourceUrl} target="_blank" rel="noreferrer">
                            {entry.sourceTitle}
                          </a>
                        ) : null}
                        {evidence.length > 0 ? (
                          <ul className="mt-1 space-y-1 text-[11px] text-anchor">
                            {evidence.map((signal) => (
                              <li key={signal.id}>
                                {signal.sourceUrl ? (
                                  <a href={signal.sourceUrl} target="_blank" rel="noreferrer">
                                    证据 · {signal.source} · {signal.title}
                                  </a>
                                ) : (
                                  <span>证据 · {signal.source} · {signal.title}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-lg ${scoreTone(row.securityScore)}`}>{row.securityScore.toFixed(0)}</p>
                        <p className={row.status === 'QUIET' ? 'text-[10px] text-mute' : 'text-[10px] text-anchor'}>
                          {row.status}
                        </p>
                      </div>
                    </li>
                  );
                })}
                {rows.length === 0 ? <li className="text-xs text-mute">日周期完成后列出全部版本关键词。</li> : null}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(viewed?.laneReports ?? DAILY_LANES.map((lane) => null)).map((report, index) => {
          const lane = DAILY_LANES[index];
          const active = lane.id === selected;
          return (
            <button
              key={lane.id}
              type="button"
              data-testid="lane-card"
              data-lane={lane.id}
              onClick={() => setSelected(lane.id)}
              className={`panel px-3 py-3 text-left ${active ? 'border-diode shadow-diode' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] text-mute">
                    BOT {String(lane.botIndex).padStart(2, '0')} · {lane.nameEn}
                  </p>
                  <h2 className="text-sm font-semibold text-white">{lane.nameZh}</h2>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-2xl ${scoreTone(report?.securityScore ?? 0)}`}>
                    {report ? report.securityScore.toFixed(0) : phase === 'running' ? '…' : '--'}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-mute">
                    {phase === 'running' ? 'RUNNING' : report?.status ?? 'PENDING'}
                  </p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-mute">{report?.impactSummary ?? lane.assignment}</p>
            </button>
          );
        })}
      </section>

      <section className="mb-4 grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
        <article className="panel px-3 py-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-white">基线变化趋势</h2>
            <p className="text-xs text-mute">关注分与观察名单平均 TTI · 不是厂商评级</p>
          </div>
          <div data-testid="trend-chart" className="h-[280px]">
            {chart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(0,240,255,0.08)" />
                  <XAxis dataKey="day" tick={{ fill: '#8B97A8', fontSize: 11 }} interval={13} />
                  <YAxis tick={{ fill: '#8B97A8', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#0C1018', border: '1px solid rgba(0,240,255,0.3)', fontSize: 12 }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="meanSecurityScore" name="关注分" stroke="#FF2A4B" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="meanTti" name="平均 TTI" stroke="#00F0FF" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="pt-16 text-center text-sm text-mute">趋势将在日窗回放完成后出现。</p>
            )}
          </div>
        </article>
        <article className="panel px-4 py-3">
          <h2 className="text-sm font-semibold text-white">{selectedReport?.botId ?? '车道'} · 本窗结论</h2>
          <p className="mt-2 text-sm leading-6 text-mute">
            {selectedReport?.impactSummary ?? '选择一条车道查看只读结论。'}
          </p>
          {selectedReport && selectedReport.citations.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-diode">
              {selectedReport.citations.map((citation) => (
                <li key={citation.url || citation.title}>
                  {citation.url ? (
                    <a href={citation.url} target="_blank" rel="noreferrer">
                      {citation.source} · {citation.title}
                    </a>
                  ) : (
                    <span>{citation.source} · {citation.title}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-mute">
            预测裁决 {viewed?.forecastVerdict ?? '—'} · 权重 L1 变化 {viewed?.weightL1FromPrior.toFixed(4) ?? '0'}
          </p>
        </article>
      </section>

      <section className="mb-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="panel overflow-x-auto px-3 py-3">
          <h2 className="mb-2 text-sm font-semibold text-white">观察名单 · 本日 TTI</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-mute">
              <tr>
                <th className="py-1 font-medium">实体</th>
                <th className="font-medium">S2-DID</th>
                <th className="font-medium">TTI</th>
                <th className="font-medium">级别</th>
              </tr>
            </thead>
            <tbody>
              {(viewed?.entityScores ?? []).map((entity) => (
                <tr key={entity.s2Did} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-white">{entity.entityName}</td>
                  <td className="font-mono text-xs text-diode">{entity.s2Did}</td>
                  <td className={scoreTone(entity.ttiScore)}>{entity.ttiScore.toFixed(2)}</td>
                  <td className="text-xs text-mute">{entity.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        {canWrite ? <article className="panel px-4 py-3">
          <h2 className="text-sm font-semibold text-white">把一条新情报写入刚结束的日窗</h2>
          <p className="mt-1 text-xs text-mute">录入只进入本地语料，然后重跑该日。不会向外发送。</p>
          <label className="mt-3 block text-xs text-mute">
            标题
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="mt-2 block text-xs text-mute">
            影响摘要
            <textarea
              value={draftSummary}
              onChange={(event) => setDraftSummary(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
          </label>
          <label className="mt-2 block text-xs text-mute">
            车道
            <select
              value={draftLane}
              onChange={(event) => setDraftLane(event.target.value as LaneId)}
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
            >
              {DAILY_LANES.filter((lane) => lane.botIndex <= 10).map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.nameZh}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="ingest-signal"
            disabled={!store || phase !== 'ready'}
            onClick={ingestAndRun}
            className="mt-3 rounded-md border border-diode/40 px-3 py-1.5 text-sm text-diode disabled:opacity-40"
          >
            写入本窗并重跑
          </button>
        </article> : null}
      </section>

      <section className="panel mb-6 px-4 py-3 text-sm leading-6 text-mute">
        <h2 className="text-sm font-semibold text-white">本日综合</h2>
        <p data-testid="day-report" className="mt-2">{viewed?.synthesis ?? '综合将在第一次日周期结束后写在这里。'}</p>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-diode">月精度来源 · 未进入任何 24 小时窗口</h3>
        <ul className="mt-2 space-y-2">
          {UNDATED_PRIORS.map((prior) => (
            <li key={prior.id}>
              <a className="text-diode" href={prior.sourceUrl} target="_blank" rel="noreferrer">
                {prior.title}
              </a>
              <span className="block text-xs">{prior.dateNote} {prior.summary}</span>
            </li>
          ))}
        </ul>
        {now ? (
          <p className="mt-3 font-mono text-[11px] text-mute">
            上海日期 {formatShanghaiDate(now)} · 已归档日窗 {store?.trend.length ?? 0}
          </p>
        ) : null}
      </section>
    </main>
  );
}
