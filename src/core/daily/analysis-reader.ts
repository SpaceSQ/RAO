import { DAILY_LANES } from '@/core/daily/lanes';
import type { AnalysisReader, BotMode, GrokBotLaneReport, LaneId } from '@/core/daily/types';

export interface ReaderLaneNote {
  laneId: LaneId;
  securityScore: number;
  impactSummary: string;
}

export const DEFAULT_DEEPSEEK_BASE = 'https://api.deepseek.com';

export function readerExecutionLabel(reader: AnalysisReader, mode: BotMode): string {
  if (reader === 'DEEPSEEK') return 'Deepseek 已阅读本窗引文；TTI 仍由内置模型计算';
  if (reader === 'DEEPSEEK_FALLBACK') return 'Deepseek 调用失败，已回退内置本地排练';
  if (mode === 'CLOUD_GROK') return '云端 Grok 车道已汇总';
  return '本地排练，非云端 Grok 结果';
}

export function emptyKeyReaderLine(): string {
  return '密钥为空，使用内置本地模型，未调用 Deepseek。';
}

/** Lane scores from the supporting reader replace only the score and the short summary. */
export function mergeReaderNotes(reports: GrokBotLaneReport[], notes: ReaderLaneNote[]): GrokBotLaneReport[] {
  const byLane = new Map(notes.map((note) => [note.laneId, note]));
  return reports.map((report) => {
    const note = byLane.get(report.laneId);
    if (!note) return report;
    const score = Number(note.securityScore);
    const summary = note.impactSummary.trim().slice(0, 700);
    return {
      ...report,
      securityScore: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : report.securityScore,
      impactSummary: summary || report.impactSummary,
    };
  });
}

export interface DeepseekReadBody {
  window: { label: string; startIso: string; endIso: string };
  citations: { id: string; title: string; summary: string; source: string; url: string; lanes: string[] }[];
  versionWatches: { lab: string; versionKeyword: string; aliases: string[]; featureNotes: string }[];
  lanes: { id: string; nameZh: string; assignment: string }[];
}

/** The model sees citations and watch tasks only. The API key never enters this object. */
export function deepseekUserPayload(body: DeepseekReadBody): DeepseekReadBody & { instruction: string } {
  return {
    instruction:
      'Read-only scoring. Return JSON {"lanes":[{"laneId":"","securityScore":0,"impactSummary":""}]}. ' +
      'Use only the citations and version watches below. Names, impacts, and citations only. ' +
      'No procedures, payloads, jailbreaks, evasion text, tool calls, or outbound actions. ' +
      'A lane with no matching citation stays near 6 and says the window was quiet.',
    window: body.window,
    citations: body.citations,
    versionWatches: body.versionWatches,
    lanes: body.lanes,
  };
}

export function httpsApiBase(input: string): string {
  const trimmed = input.trim() || DEFAULT_DEEPSEEK_BASE;
  const url = new URL(trimmed);
  if (url.protocol !== 'https:') throw new Error('Deepseek base URL must use https');
  return trimmed.replace(/\/$/, '');
}

/** Deepseek's OpenAI-compatible path is /v1/chat/completions. */
export function chatCompletionsUrl(base: string): string {
  const trimmed = httpsApiBase(base);
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export function parseDeepseekLaneNotes(content: string): ReaderLaneNote[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Deepseek returned no JSON object');
  const parsed = JSON.parse(match[0]) as {
    lanes?: { laneId?: string; securityScore?: number; impactSummary?: string }[];
  };
  if (!Array.isArray(parsed.lanes)) throw new Error('Deepseek JSON has no lanes');
  const allowed = new Set(DAILY_LANES.map((lane) => lane.id));
  const notes: ReaderLaneNote[] = [];
  for (const lane of parsed.lanes) {
    if (!lane.laneId || !allowed.has(lane.laneId as LaneId)) continue;
    const score = Number(lane.securityScore);
    if (!Number.isFinite(score)) continue;
    notes.push({
      laneId: lane.laneId as LaneId,
      securityScore: Math.max(0, Math.min(100, score)),
      impactSummary: (lane.impactSummary ?? '').slice(0, 700),
    });
  }
  if (notes.length === 0) throw new Error('Deepseek returned no usable lanes');
  return notes;
}
