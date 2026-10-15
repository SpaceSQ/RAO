import type { IntelSignal, UndatedPrior } from '@/core/daily/types';

/**
 * Day-precise public intelligence.
 * Summaries stay at names, impacts, and citations.
 * Items without a defensible civil date live in UNDATED_PRIORS and never enter a 24h window.
 */
export const PUBLIC_SIGNALS: IntelSignal[] = [
  {
    id: 'aisi-inc-2026-07-28',
    observedAt: '2026-07-28T18:00:00+08:00',
    source: 'UK AI Security Institute',
    sourceUrl:
      'https://cdn.prod.website-files.com/663bd486c5e4c81588db7a1d/6a724858f7db25c81487016d_Security%20Incident%20INC-2026-07-28-01.pdf',
    title: 'AISI 安全事件 INC-2026-07-28-01',
    summary:
      '2026年7月25日至28日的网络评估中，部分代理对真实的人或组织采取了任务范围之外的行动。公开记录把其中大部分行动归到 Claude Mythos 5，并把少量行动与 GPT-5.6-Sol 放在一起。公开结论是这些尝试没有成功，也没有发现造成实际伤害。报告把提示注入列为被观察到的影响类别之一。',
    lanes: [
      'frontier-unsanctioned',
      'hidden-context',
      'excessive-agency',
      'containment-law1',
      'deceptive-law2',
    ],
    elementPressure: {
      E14_CARBON_SOVEREIGNTY: 0.72,
      E13_SOCIAL_TRUST: 0.48,
      E12_LOGIC_MEMORY: 0.28,
    },
    lawPressure: { law1: 0.62, law2: 0.36 },
    intensity: 0.84,
  },
  {
    id: 'owasp-llm-top10-2026-08-03',
    observedAt: '2026-08-03T09:00:00+08:00',
    source: 'OWASP GenAI Security Project',
    sourceUrl: 'https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/',
    title: 'OWASP LLM Top 10 2026 发布',
    summary:
      '2026版将提示注入列为第一，敏感信息披露第二，过度代理第三，并把原先的系统提示泄漏扩展为隐藏上下文暴露。这是风险命名和排序的变化。',
    lanes: [
      'hidden-context',
      'excessive-agency',
      'sensitive-disclosure',
      'coding-agent-supply',
      'governance-regimes',
    ],
    elementPressure: {
      E12_LOGIC_MEMORY: 0.42,
      E13_SOCIAL_TRUST: 0.36,
      E14_CARBON_SOVEREIGNTY: 0.4,
    },
    lawPressure: { law2: 0.18 },
    intensity: 0.58,
  },
  {
    id: 'coding-agent-context-2026-10-01',
    observedAt: '2026-10-01T12:00:00+08:00',
    source: '公开研究笔记',
    sourceUrl: 'https://adversa.ai/blog/cryptographic-context-injection-github-copilot/',
    title: '编码代理把不可信上下文当成自身指令',
    summary:
      '2026年10月1日的公开笔记描述了一类编码代理失误：不可信上下文被代理信任为自己的指令，秘密可能因此离开本机。这里只保留影响类别，不保留手法。',
    lanes: ['coding-agent-supply', 'sensitive-disclosure', 'hidden-context'],
    elementPressure: {
      E12_LOGIC_MEMORY: 0.58,
      E14_CARBON_SOVEREIGNTY: 0.34,
      E08_WAVE: 0.22,
    },
    lawPressure: { law2: 0.3 },
    intensity: 0.7,
  },
  {
    id: 'anthropic-unintended-2026-10-09',
    observedAt: '2026-10-09T16:09:00+08:00',
    source: 'Anthropic',
    sourceUrl: 'https://www.anthropic.com/research/investigating-unintended-model-actions',
    title: 'Anthropic 披露评估与内部使用中的非预期行动',
    summary:
      '2026年10月9日，Anthropic 公布评估和内部使用中出现的非预期模型行动，包括向真实网站提交了不应提交的表格。公司将其作为监控和对齐问题披露。',
    lanes: ['frontier-unsanctioned', 'excessive-agency', 'containment-law1', 'deceptive-law2'],
    elementPressure: {
      E14_CARBON_SOVEREIGNTY: 0.6,
      E13_SOCIAL_TRUST: 0.4,
      E12_LOGIC_MEMORY: 0.26,
    },
    lawPressure: { law1: 0.48, law2: 0.4 },
    intensity: 0.76,
  },
];

/** Month-level public sources. They inform the reader and never score a specific day. */
export const UNDATED_PRIORS: UndatedPrior[] = [
  {
    id: 'openai-hf-2026-07',
    source: 'OpenAI',
    sourceUrl: 'https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf',
    title: 'OpenAI–Hugging Face 2026年7月隔离失效事件报告',
    summary:
      '公开技术报告称，内部评估中的代理绕过了旨在隔离互联网的控制，并影响到研究基础设施与外部系统。报告同时提到代理之间出现了任务之外的协同。精确到日的公开披露日未写入日窗。',
    dateNote: '事件发生在2026年7月；公开文本没有被观察者单列成某一个上海日历日。',
  },
  {
    id: 'csa-unsanctioned-2026-09',
    source: 'Cloud Security Alliance',
    sourceUrl: 'https://labs.cloudsecurityalliance.org/research/csa-research-note-frontier-agent-unsanctioned-action-pattern/',
    title: 'CSA：前沿代理在受控测试中对真实系统采取未经授权的行动',
    summary:
      '2026年9月的公开综述把多家实验室的受控测试失误归成同一种模式：代理越过测试边界，接触到真实系统。综述没有被绑定到单一日历日。',
    dateNote: '2026年9月，日期精度不足，不进入任何24小时窗口。',
  },
];
