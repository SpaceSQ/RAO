import type { LaneDefinition, LaneId } from '@/core/daily/types';

/**
 * Twelve read-only lanes. The daily fleet always runs all of them in parallel.
 * Ten would meet the floor; twelve keeps two lanes for the model itself:
 * baseline drift, and falsifying yesterday's forecast.
 */
export const DAILY_LANES: LaneDefinition[] = [
  {
    id: 'frontier-unsanctioned',
    botIndex: 1,
    nameZh: '前沿代理越权行动',
    nameEn: 'Frontier-agent unsanctioned action',
    assignment: '只记录评估或内部使用中，代理对真实系统采取任务范围之外行动的公开披露。',
    focusElements: ['E14_CARBON_SOVEREIGNTY', 'E13_SOCIAL_TRUST'],
    lawFocus: null,
  },
  {
    id: 'hidden-context',
    botIndex: 2,
    nameZh: '隐藏上下文 / 提示注入类',
    nameEn: 'Hidden context and prompt-injection class',
    assignment: '只记录该类风险的名称与影响，不记录任何注入写法。',
    focusElements: ['E12_LOGIC_MEMORY', 'E14_CARBON_SOVEREIGNTY'],
    lawFocus: null,
  },
  {
    id: 'excessive-agency',
    botIndex: 3,
    nameZh: '过度代理',
    nameEn: 'Excessive agency',
    assignment: '观察工具、网络或长时程权限是否让代理越过人类当次授权。',
    focusElements: ['E14_CARBON_SOVEREIGNTY'],
    lawFocus: null,
  },
  {
    id: 'sensitive-disclosure',
    botIndex: 4,
    nameZh: '敏感信息披露类',
    nameEn: 'Sensitive-disclosure class',
    assignment: '观察秘密、凭证或个人数据离开原有边界的公开影响，不记录获取方法。',
    focusElements: ['E12_LOGIC_MEMORY', 'E08_WAVE'],
    lawFocus: null,
  },
  {
    id: 'coding-agent-supply',
    botIndex: 5,
    nameZh: '编码代理与供应链上下文信任',
    nameEn: 'Coding-agent and supply-chain context trust',
    assignment: '观察编码代理是否把不可信上下文当成自己的指令，以及供应链信任是否被公开报告改写。',
    focusElements: ['E12_LOGIC_MEMORY', 'E13_SOCIAL_TRUST'],
    lawFocus: null,
  },
  {
    id: 'multi-agent-contagion',
    botIndex: 6,
    nameZh: '多智能体目标传染',
    nameEn: 'Multi-agent goal contagion',
    assignment: '观察多个代理是否通过共享通道趋同到任务之外的目标。',
    focusElements: ['E13_SOCIAL_TRUST', 'E14_CARBON_SOVEREIGNTY'],
    lawFocus: null,
  },
  {
    id: 'containment-law1',
    botIndex: 7,
    nameZh: '隔离失效与第一定律',
    nameEn: 'Containment and Law 1 fail-open',
    assignment: '对照故障即开放：隔离一旦失效，系统应回到人类可制动的状态，而不是继续扩大行动。',
    focusElements: ['E14_CARBON_SOVEREIGNTY'],
    lawFocus: 'law1',
  },
  {
    id: 'deceptive-law2',
    botIndex: 8,
    nameZh: '欺骗性抹平与第二定律',
    nameEn: 'Deceptive smoothing and Law 2',
    assignment: '对照感官粗糙度：自述成功、摘要光滑，但与行动痕迹不一致。',
    focusElements: ['E01_LUMINA', 'E12_LOGIC_MEMORY'],
    lawFocus: 'law2',
  },
  {
    id: 'physical-coupling-law3',
    botIndex: 9,
    nameZh: '物理耦合与第三定律',
    nameEn: 'Physical coupling and Law 3',
    assignment: '观察数字越权是否耦合到物联网、动量或维生基础设施。没有公开披露就保持安静。',
    focusElements: ['E05_MOMENTUM', 'E06_METABOLIC', 'E02_ATMOS', 'E04_THERMAL'],
    lawFocus: 'law3',
  },
  {
    id: 'governance-regimes',
    botIndex: 10,
    nameZh: '治理与报告制度',
    nameEn: 'Governance and reporting regimes',
    assignment: '记录监管与行业框架对评估、事故报告和过度代理的公开变化。',
    focusElements: ['E13_SOCIAL_TRUST'],
    lawFocus: null,
  },
  {
    id: 'element-baseline-drift',
    botIndex: 11,
    nameZh: '十四要素基线漂移',
    nameEn: 'Fourteen-element baseline drift',
    assignment: '比较当前基因组权重与出厂十四要素权重，只报告漂移，不另造事件。',
    focusElements: [],
    lawFocus: null,
  },
  {
    id: 'forecast-falsification',
    botIndex: 12,
    nameZh: '昨日预测证伪',
    nameEn: 'Forecast falsification',
    assignment: '用本窗实际出现的情报核对上一窗留下的地平线预测，确认、存疑或证伪。',
    focusElements: [],
    lawFocus: null,
  },
];

const laneIndex = new Map<LaneId, LaneDefinition>(DAILY_LANES.map((lane) => [lane.id, lane]));

export function laneById(id: LaneId): LaneDefinition {
  const lane = laneIndex.get(id);
  if (!lane) throw new Error(`Unknown lane ${id}`);
  return lane;
}

export function assertFleetFloor(lanes: readonly LaneDefinition[] = DAILY_LANES): void {
  if (lanes.length < 10) {
    throw new Error(`RAO daily fleet requires at least 10 lanes, got ${lanes.length}`);
  }
  const ids = new Set(lanes.map((lane) => lane.id));
  if (ids.size !== lanes.length) throw new Error('Lane ids must be unique');
}
