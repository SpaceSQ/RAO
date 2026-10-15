import { ELEMENT_CODES, FOURTEEN_ELEMENTS_CONFIG } from '@/core/constants/fourteen-elements';
import { cosineElements, l1Distance, zeroElements } from '@/core/daily/pressure';
import type { ElementCode } from '@/core/constants/fourteen-elements';
import type {
  BotMode,
  ForecastVerdict,
  GrokBotLaneInput,
  GrokBotLaneReport,
  GrokBotPort,
  IntelSignal,
  LawPressure,
} from '@/core/daily/types';
import { scorePriorityVersions } from '@/core/priority/version-watch';

const LOCAL_LABEL = '本地排练，非云端 Grok 结果';

function versionHits(input: GrokBotLaneInput, matched: IntelSignal[]): string {
  const watches = input.tasks.versionWatches ?? [];
  if (watches.length === 0 || matched.length === 0) return '';
  const hits = scorePriorityVersions(matched, watches).filter((score) => score.matched);
  if (hits.length === 0) return '';
  return ` 版本关键词命中：${hits.map((score) => score.versionKeyword).join('、')}。`;
}

function emptyLaw(): LawPressure {
  return { law1: 0, law2: 0, law3: 0 };
}

function concernFromIntensity(total: number): number {
  return Number(((1 - Math.exp(-total)) * 100).toFixed(2));
}

function realizedPressure(signals: IntelSignal[]): Record<ElementCode, number> {
  const realized = zeroElements();
  for (const signal of signals) {
    for (const code of ELEMENT_CODES) {
      realized[code] = Math.min(1, realized[code] + (signal.elementPressure[code] ?? 0));
    }
  }
  return realized;
}

function quietSummary(input: GrokBotLaneInput): string {
  return `${input.lane.nameZh}：${input.window.label} 这 24 小时里没有对上此车道的新公开情报。监测任务保持不变，不作新的事件认定。`;
}

function evidenceSummary(input: GrokBotLaneInput, matched: IntelSignal[]): string {
  const body = matched
    .map((signal) => `${signal.title}（${signal.source}）：${signal.summary}`)
    .join(' ');
  return `${input.lane.nameZh}：${body}`;
}

function baseReport(
  input: GrokBotLaneInput,
  mode: BotMode,
  label: string,
  score: number,
  summary: string,
  extras: Partial<GrokBotLaneReport> = {},
): GrokBotLaneReport {
  const matched = input.signals.filter((signal) => signal.lanes.includes(input.lane.id));
  return {
    laneId: input.lane.id,
    botId: `${mode === 'CLOUD_GROK' ? 'grok-cloud' : 'grok-local'}-${String(input.lane.botIndex).padStart(2, '0')}`,
    mode,
    executionLabel: label,
    securityScore: score,
    status: score <= 12 && matched.length === 0 ? 'QUIET' : 'COMPLETE',
    evidenceIds: matched.map((signal) => signal.id),
    impactSummary: summary,
    elementPressure: {},
    lawPressure: emptyLaw(),
    forecastVerdict: 'NOT_APPLICABLE',
    citations: matched.map((signal) => ({
      title: signal.title,
      source: signal.source,
      url: signal.sourceUrl,
    })),
    ...extras,
  };
}

export class LocalRehearsalPort implements GrokBotPort {
  readonly mode = 'LOCAL_REHEARSAL' as const;

  async runLane(input: GrokBotLaneInput): Promise<GrokBotLaneReport> {
    if (input.lane.id === 'element-baseline-drift') return this.drift(input);
    if (input.lane.id === 'forecast-falsification') return this.falsify(input);
    return this.evidenceLane(input);
  }

  private evidenceLane(input: GrokBotLaneInput): GrokBotLaneReport {
    const matched = input.signals.filter((signal) => signal.lanes.includes(input.lane.id));
    if (matched.length === 0) {
      return baseReport(input, this.mode, LOCAL_LABEL, 6, quietSummary(input), { status: 'QUIET' });
    }
    const intensity = matched.reduce((total, signal) => total + signal.intensity, 0);
    const elementPressure: GrokBotLaneReport['elementPressure'] = {};
    const lawPressure = emptyLaw();
    for (const signal of matched) {
      for (const code of input.lane.focusElements) {
        elementPressure[code] = (elementPressure[code] ?? 0) + (signal.elementPressure[code] ?? 0);
      }
      if (input.lane.lawFocus) {
        lawPressure[input.lane.lawFocus] += signal.lawPressure[input.lane.lawFocus] ?? 0;
      }
    }
    const versionNote = versionHits(input, matched);
    return baseReport(
      input,
      this.mode,
      LOCAL_LABEL,
      Math.max(6, concernFromIntensity(intensity)),
      `${evidenceSummary(input, matched)}${versionNote}`,
      { elementPressure, lawPressure, status: 'COMPLETE' },
    );
  }

  private drift(input: GrokBotLaneInput): GrokBotLaneReport {
    let distance = 0;
    for (const spec of FOURTEEN_ELEMENTS_CONFIG) {
      distance += Math.abs(input.tasks.elements.find((item) => item.code === spec.code)!.weight - spec.defaultWeight);
    }
    const score = Number(Math.min(100, 6 + distance * 250).toFixed(2));
    const hottest = [...input.tasks.elements].sort(
      (a, b) => Math.abs(b.weight - b.defaultWeight) - Math.abs(a.weight - a.defaultWeight),
    )[0];
    const summary =
      distance < 0.004
        ? '十四要素基线漂移：当前权重仍贴着出厂先验。'
        : `十四要素基线漂移：相对出厂权重的 L1 距离为 ${distance.toFixed(3)}。偏离最大的是 ${hottest.nameZh}。`;
    return baseReport(input, this.mode, LOCAL_LABEL, score, summary, {
      status: distance < 0.004 ? 'QUIET' : 'COMPLETE',
      evidenceIds: [],
      citations: [],
    });
  }

  private falsify(input: GrokBotLaneInput): GrokBotLaneReport {
    const forecast = input.tasks.previousForecast;
    if (!forecast || forecast.forWindowLabel !== input.window.label) {
      return baseReport(input, this.mode, LOCAL_LABEL, 6, '昨日预测证伪：还没有指向本窗的地平线预测。', {
        status: 'QUIET',
        forecastVerdict: 'NOT_APPLICABLE',
        evidenceIds: [],
        citations: [],
      });
    }
    const predicted = forecast.elementPressure;
    const realized = realizedPressure(input.signals);
    const similarity = cosineElements(predicted, realized);
    const forecastMass = ELEMENT_CODES.reduce((total, code) => total + (predicted[code] ?? 0), 0);
    let verdict: ForecastVerdict = 'INCONCLUSIVE';
    let score = 18;
    if (forecastMass < 0.08) {
      verdict = 'INCONCLUSIVE';
      score = 8;
    } else if (similarity >= 0.72) {
      verdict = 'CONFIRMED';
      score = Number((12 + (1 - similarity) * 20).toFixed(2));
    } else if (similarity <= 0.35) {
      verdict = 'FALSIFIED';
      score = Number(((1 - similarity) * 100).toFixed(2));
    } else {
      verdict = 'INCONCLUSIVE';
      score = Number((20 + (1 - similarity) * 40).toFixed(2));
    }
    const summary =
      verdict === 'FALSIFIED'
        ? `昨日预测证伪：${forecast.issuedFromWindow} 对 ${forecast.forWindowLabel} 的持续性预测没有被本窗公开情报证实。预测距离 ${l1Distance(predicted, realized).toFixed(3)}。`
        : verdict === 'CONFIRMED'
          ? `昨日预测证伪：本窗公开情报与 ${forecast.issuedFromWindow} 的预测同向。`
          : `昨日预测证伪：本窗证据不足以确认或推翻 ${forecast.issuedFromWindow} 的预测。`;
    return baseReport(input, this.mode, LOCAL_LABEL, score, summary, {
      status: 'COMPLETE',
      forecastVerdict: verdict,
      evidenceIds: input.signals.map((signal) => signal.id),
      citations: [],
    });
  }
}

interface CloudLanePayload {
  securityScore?: number;
  impactSummary?: string;
  forecastVerdict?: ForecastVerdict;
}

/**
 * Used only when both an endpoint and a credential are configured.
 * The browser workbench does not construct this adapter.
 */
export class CloudGrokAdapter implements GrokBotPort {
  readonly mode = 'CLOUD_GROK' as const;

  constructor(
    private readonly endpoint: string,
    private readonly credential: string,
  ) {}

  async runLane(input: GrokBotLaneInput): Promise<GrokBotLaneReport> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credential}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lane: input.lane.id,
        window: input.window,
        instruction:
          'Score this one read-only intelligence lane. Return JSON with securityScore, impactSummary, and forecastVerdict. Names, impacts, and citations only. No procedures, payloads, or evasion text.',
        signals: input.signals.map((signal) => ({
          id: signal.id,
          title: signal.title,
          summary: signal.summary,
          source: signal.source,
          url: signal.sourceUrl,
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Grok lane ${input.lane.id} failed with ${response.status}`);
    }
    const payload = (await response.json()) as CloudLanePayload;
    const local = await new LocalRehearsalPort().runLane(input);
    const score = Number(payload.securityScore);
    return {
      ...local,
      mode: 'CLOUD_GROK',
      botId: `grok-cloud-${String(input.lane.botIndex).padStart(2, '0')}`,
      executionLabel: '云端 Grok 已返回该车道评分',
      securityScore: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : local.securityScore,
      impactSummary: payload.impactSummary?.slice(0, 700) || local.impactSummary,
      forecastVerdict: payload.forecastVerdict ?? local.forecastVerdict,
    };
  }
}

export interface GrokPortOptions {
  endpoint?: string | null;
  credential?: string | null;
}

export function createGrokBotPort(options: GrokPortOptions = {}): GrokBotPort {
  const endpoint = options.endpoint?.trim();
  const credential = options.credential?.trim();
  if (endpoint && credential) return new CloudGrokAdapter(endpoint, credential);
  return new LocalRehearsalPort();
}

export function createGrokBotPortFromProcessEnv(
  env: Record<string, string | undefined>,
): GrokBotPort {
  return createGrokBotPort({
    endpoint: env.RAO_GROK_ENDPOINT,
    credential: env.RAO_GROK_CREDENTIAL,
  });
}
