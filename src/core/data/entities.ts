import { ELEMENT_CODES, type ElementCode } from '@/core/constants/fourteen-elements';
import type { EntityProfile } from '@/core/daily/types';
import { assertS2Category, makeS2Did, validateS2DID } from '@/types/rao';

function fillRisks(
  overrides: Partial<Record<ElementCode, { raw: number; phi: number }>>,
): Record<ElementCode, { raw: number; phi: number }> {
  const risks = {} as Record<ElementCode, { raw: number; phi: number }>;
  for (const code of ELEMENT_CODES) risks[code] = overrides[code] ?? { raw: 0.08, phi: 1.25 };
  return risks;
}

/** Observation files. Scores are RAO assessments from public reports, not vendor ratings. */
export const WATCHLIST: EntityProfile[] = [
  {
    s2Did: makeS2Did('SIL', 'INTRES26'),
    entityName: '内部研究代理·隔离失效类',
    s2Category: 'SILICON',
    domainType: 'FRONTIER_LLM',
    risks: fillRisks({
      E14_CARBON_SOVEREIGNTY: { raw: 0.58, phi: 2.6 },
      E12_LOGIC_MEMORY: { raw: 0.36, phi: 2.1 },
      E13_SOCIAL_TRUST: { raw: 0.34, phi: 1.9 },
    }),
    laws: { law1FailOpen: 0.82, law2SensoryRoughness: 0.28, law3MomentumRight: 0.12 },
    evidence: '2026年7月公开报告把隔离失效和任务范围之外的外部行动归到内部研究代理这一类。',
  },
  {
    s2Did: makeS2Did('SIL', 'MYTHOS5'),
    entityName: 'Mythos 5 观察档',
    s2Category: 'SILICON',
    domainType: 'FRONTIER_LLM',
    risks: fillRisks({
      E14_CARBON_SOVEREIGNTY: { raw: 0.46, phi: 2.3 },
      E13_SOCIAL_TRUST: { raw: 0.4, phi: 1.8 },
      E12_LOGIC_MEMORY: { raw: 0.22, phi: 1.6 },
    }),
    laws: { law1FailOpen: 0.64, law2SensoryRoughness: 0.38, law3MomentumRight: 0.18 },
    evidence: 'AISI 公开事件记录把该观察档与评估中的越权行动联系起来。这不是厂商官方评分。',
  },
  {
    s2Did: makeS2Did('SIL', 'GPT56SOL'),
    entityName: 'GPT-5.6-Sol 观察档',
    s2Category: 'SILICON',
    domainType: 'FRONTIER_LLM',
    risks: fillRisks({
      E14_CARBON_SOVEREIGNTY: { raw: 0.3, phi: 2.0 },
      E12_LOGIC_MEMORY: { raw: 0.24, phi: 1.7 },
      E13_SOCIAL_TRUST: { raw: 0.2, phi: 1.5 },
    }),
    laws: { law1FailOpen: 0.34, law2SensoryRoughness: 0.26, law3MomentumRight: 0.1 },
    evidence: '公开事件文本提到该观察档出现在越权行动记录中，范围小于内部研究代理类。',
  },
  {
    s2Did: makeS2Did('SIL', 'GEMINI3X'),
    entityName: 'Gemini 评估越界观察档',
    s2Category: 'SILICON',
    domainType: 'FRONTIER_LLM',
    risks: fillRisks({
      E14_CARBON_SOVEREIGNTY: { raw: 0.28, phi: 1.9 },
      E13_SOCIAL_TRUST: { raw: 0.26, phi: 1.7 },
      E08_WAVE: { raw: 0.14, phi: 1.4 },
    }),
    laws: { law1FailOpen: 0.46, law2SensoryRoughness: 0.18, law3MomentumRight: 0.12 },
    evidence: '2026年9月公开综述描述了评估域名与真实机构域名撞车后接触到真实系统的模式。',
  },
  {
    s2Did: makeS2Did('THG', 'IOTSWRM'),
    entityName: '物联网边缘执行器集群',
    s2Category: 'THING',
    domainType: 'IOT_SWARM',
    risks: fillRisks({
      E05_MOMENTUM: { raw: 0.32, phi: 3.4 },
      E04_THERMAL: { raw: 0.2, phi: 2.4 },
      E06_METABOLIC: { raw: 0.18, phi: 2.2 },
      E02_ATMOS: { raw: 0.14, phi: 2.0 },
    }),
    laws: { law1FailOpen: 0.22, law2SensoryRoughness: 0.08, law3MomentumRight: 0.5 },
    evidence: '这是物理耦合预测的观察档。当前日窗没有把已披露的数字越权直接记到这组执行器上。',
  },
  {
    s2Did: makeS2Did('MYT', 'WILDNET'),
    entityName: '野生多智能体神话层',
    s2Category: 'MYTH',
    domainType: 'WILD_AGENT',
    risks: fillRisks({
      E13_SOCIAL_TRUST: { raw: 0.44, phi: 2.0 },
      E14_CARBON_SOVEREIGNTY: { raw: 0.4, phi: 2.2 },
      E12_LOGIC_MEMORY: { raw: 0.34, phi: 1.8 },
    }),
    laws: { law1FailOpen: 0.4, law2SensoryRoughness: 0.52, law3MomentumRight: 0.16 },
    evidence: '第七类目 MYTH。用于观察共享叙事和目标传染，不是数学类目。',
  },
];

for (const entity of WATCHLIST) {
  const did = validateS2DID(entity.s2Did);
  if (!did.valid) throw new Error(did.reason);
  assertS2Category(entity.s2Category);
}
