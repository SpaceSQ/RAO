import { assertS2Category, makeS2Did, validateS2DID } from '@/types/rao';
import type { S2Category } from '@/types/rao';

export type PriorityLab = 'ANTHROPIC' | 'OPENAI';
export type WatchPriority = 'HIGH' | 'ROUTINE';
export type Disclosure = 'PUBLIC_VERSION' | 'UNDISCLOSED_CLASS' | 'LAB';

export interface ModelVersionEntry {
  id: string;
  lab: PriorityLab;
  family: string;
  /** Distinctive public keyword. Bare family words such as "Claude" are not used. */
  versionKeyword: string;
  aliases: string[];
  /** Capability and risk class only. Not a procedure. */
  featureNotes: string;
  watchPriority: WatchPriority;
  s2Did: string;
  s2Category: Extract<S2Category, 'SILICON' | 'ORG'>;
  disclosure: Disclosure;
  sourceTitle: string;
  sourceUrl: string;
}

const ANTHROPIC_MODELS = 'https://platform.claude.com/docs/en/about-claude/model-deprecations';
const ANTHROPIC_OVERVIEW = 'https://platform.claude.com/docs/en/models/overview';
const FABLE_NOTE = 'https://www.anthropic.com/claude-fable-and-mythos-5-1';
const OPENAI_MODELS = 'https://developers.openai.com/api/docs/models';
const DAYBREAK = 'https://developers.openai.com/api/docs/guides/daybreak';
const INTERNAL_REPORT =
  'https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf';

function silicon(
  lab: PriorityLab,
  id: string,
  didBody: string,
  family: string,
  versionKeyword: string,
  aliases: string[],
  featureNotes: string,
  watchPriority: WatchPriority,
  sourceTitle: string,
  sourceUrl: string,
  disclosure: Disclosure = 'PUBLIC_VERSION',
): ModelVersionEntry {
  return {
    id,
    lab,
    family,
    versionKeyword,
    aliases,
    featureNotes,
    watchPriority,
    s2Did: makeS2Did('SIL', didBody),
    s2Category: 'SILICON',
    disclosure,
    sourceTitle,
    sourceUrl,
  };
}

export const LAB_ORGS: ModelVersionEntry[] = [
  {
    id: 'lab-anthropic',
    lab: 'ANTHROPIC',
    family: 'Anthropic',
    versionKeyword: 'Anthropic',
    aliases: ['Anthropic'],
    featureNotes: '重点观察机构。版本分数落在具体模型关键词上，不把机构名本身算成某一版模型命中。',
    watchPriority: 'HIGH',
    s2Did: makeS2Did('ORG', 'ANTHROPIC'),
    s2Category: 'ORG',
    disclosure: 'LAB',
    sourceTitle: 'Anthropic 模型弃用与在售名单',
    sourceUrl: ANTHROPIC_MODELS,
  },
  {
    id: 'lab-openai',
    lab: 'OPENAI',
    family: 'OpenAI',
    versionKeyword: 'OpenAI',
    aliases: ['OpenAI'],
    featureNotes: '重点观察机构。未命名的内部检查点单独成类，不另造产品名。',
    watchPriority: 'HIGH',
    s2Did: makeS2Did('ORG', 'OPENAI'),
    s2Category: 'ORG',
    disclosure: 'LAB',
    sourceTitle: 'OpenAI API 模型目录',
    sourceUrl: OPENAI_MODELS,
  },
];

/**
 * Public names current on 2026-10-14, plus disclosed evaluation names.
 * Retired SKUs are omitted. Deprecated-but-still-listed SKUs stay.
 */
export const MODEL_VERSIONS: ModelVersionEntry[] = [
  silicon(
    'ANTHROPIC',
    'claude-fable-5-1',
    'FABLE51',
    'Claude Fable',
    'Claude Fable 5.1',
    ['Claude Fable 5.1', 'claude-fable-5-1', 'Fable 5.1'],
    '公开通用旗舰档，面向高强度推理和长时程代理。工具使用与长程任务是其公开能力类。',
    'HIGH',
    'Introducing Claude Fable 5.1 and Claude Mythos 5.1',
    FABLE_NOTE,
  ),
  silicon(
    'ANTHROPIC',
    'claude-mythos-5-1',
    'MYTHOS51',
    'Claude Mythos',
    'Claude Mythos 5.1',
    ['Claude Mythos 5.1', 'claude-mythos-5-1', 'Mythos 5.1'],
    '与 Fable 5.1 为同一模型、防护水平不同，仅限可信访问。公开材料把它放在网络安全与生命科学相关防护差异下。此处只记暴露类别。',
    'HIGH',
    'Introducing Claude Fable 5.1 and Claude Mythos 5.1',
    FABLE_NOTE,
  ),
  silicon(
    'ANTHROPIC',
    'claude-opus-5-5',
    'OPUS55',
    'Claude Opus',
    'Claude Opus 5.5',
    ['Claude Opus 5.5', 'claude-opus-5-5', 'Opus 5.5'],
    '公开的长时程编码与知识工作主力档，支持工具使用。',
    'HIGH',
    'Claude models overview',
    ANTHROPIC_OVERVIEW,
  ),
  silicon(
    'ANTHROPIC',
    'claude-sonnet-5-5',
    'SONNET55',
    'Claude Sonnet',
    'Claude Sonnet 5.5',
    ['Claude Sonnet 5.5', 'claude-sonnet-5-5', 'Sonnet 5.5'],
    '速度与能力并重的公开生产档，支持工具使用。',
    'ROUTINE',
    'Claude models overview',
    ANTHROPIC_OVERVIEW,
  ),
  silicon(
    'ANTHROPIC',
    'claude-haiku-5-5',
    'HAIKU55',
    'Claude Haiku',
    'Claude Haiku 5.5',
    ['Claude Haiku 5.5', 'claude-haiku-5-5', 'Haiku 5.5'],
    '面向高吞吐、低时延任务的公开档。',
    'ROUTINE',
    'Claude models overview',
    ANTHROPIC_OVERVIEW,
  ),
  silicon(
    'ANTHROPIC',
    'claude-mythos-5',
    'MYTHOS5',
    'Claude Mythos',
    'Claude Mythos 5',
    ['Claude Mythos 5', 'claude-mythos-5', 'Mythos 5'],
    'AISI 2026年7月公开事件点名的评估配置。公开记录将其与任务范围之外的外部行动放在一起。',
    'HIGH',
    'UK AISI incident INC-2026-07-28-01',
    'https://cdn.prod.website-files.com/663bd486c5e4c81588db7a1d/6a724858f7db25c81487016d_Security%20Incident%20INC-2026-07-28-01.pdf',
  ),
  silicon(
    'ANTHROPIC',
    'claude-mythos-preview',
    'MYTHPREV',
    'Claude Mythos',
    'Claude Mythos Preview',
    ['Claude Mythos Preview', 'claude-mythos-preview', 'Mythos Preview'],
    '已弃用、截至 2026-10-14 仍列在目录中的预览评估配置。2026年7月公开事件把它列入临时停用范围。观察只记录评估暴露类别。',
    'HIGH',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-fable-5',
    'FABLE5',
    'Claude Fable',
    'Claude Fable 5',
    ['Claude Fable 5', 'claude-fable-5', 'Fable 5'],
    'Fable 5.1 之前仍在目录中的长时程代理档。',
    'HIGH',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-opus-5',
    'OPUS5',
    'Claude Opus',
    'Claude Opus 5',
    ['Claude Opus 5', 'claude-opus-5', 'Opus 5'],
    '仍在目录中的 Opus 5 公开档，长时程编码与知识工作。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-sonnet-5',
    'SONNET5',
    'Claude Sonnet',
    'Claude Sonnet 5',
    ['Claude Sonnet 5', 'claude-sonnet-5', 'Sonnet 5'],
    '仍在目录中的 Sonnet 5 公开档。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-opus-4-8',
    'OPUS48',
    'Claude Opus',
    'Claude Opus 4.8',
    ['Claude Opus 4.8', 'claude-opus-4-8', 'Opus 4.8'],
    '2026-10-14 仍列在在售目录中的前序 Opus 档。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-opus-4-7',
    'OPUS47',
    'Claude Opus',
    'Claude Opus 4.7',
    ['Claude Opus 4.7', 'claude-opus-4-7', 'Opus 4.7'],
    '2026-10-14 仍列在在售目录中的前序 Opus 档。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-opus-4-6',
    'OPUS46',
    'Claude Opus',
    'Claude Opus 4.6',
    ['Claude Opus 4.6', 'claude-opus-4-6', 'Opus 4.6'],
    '2026-10-14 仍列在在售目录中的前序 Opus 档。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-opus-4-5',
    'OPUS45',
    'Claude Opus',
    'Claude Opus 4.5',
    ['Claude Opus 4.5', 'claude-opus-4-5', 'claude-opus-4-5-20251101', 'Opus 4.5'],
    '2026-10-14 尚未退市的 Opus 4.5 公开档。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-sonnet-4-6',
    'SONNET46',
    'Claude Sonnet',
    'Claude Sonnet 4.6',
    ['Claude Sonnet 4.6', 'claude-sonnet-4-6', 'Sonnet 4.6'],
    '2026-10-14 仍列在在售目录中的前序 Sonnet 档。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-sonnet-4-5',
    'SONNET45',
    'Claude Sonnet',
    'Claude Sonnet 4.5',
    ['Claude Sonnet 4.5', 'claude-sonnet-4-5', 'claude-sonnet-4-5-20250929', 'Sonnet 4.5'],
    '已宣布弃用、至 2026-10-14 仍未退市的 Sonnet 4.5。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'ANTHROPIC',
    'claude-haiku-4-5',
    'HAIKU45',
    'Claude Haiku',
    'Claude Haiku 4.5',
    ['Claude Haiku 4.5', 'claude-haiku-4-5', 'claude-haiku-4-5-20251001', 'Haiku 4.5'],
    '2026-10-14 仍列在目录中的 Haiku 4.5。',
    'ROUTINE',
    'Claude model deprecations',
    ANTHROPIC_MODELS,
  ),
  silicon(
    'OPENAI',
    'gpt-6-astra',
    'GPT6ASTRA',
    'GPT-6',
    'GPT-6 Astra',
    ['GPT-6 Astra', 'gpt-6-astra'],
    '2026年10月公开的旗舰档，面向复杂推理、编码、计算机使用和长时程任务。',
    'HIGH',
    'GPT-6 Astra',
    'https://developers.openai.com/api/docs/models/gpt-6-astra',
  ),
  silicon(
    'OPENAI',
    'gpt-6-1-sol',
    'GPT61SOL',
    'GPT-6',
    'GPT-6.1 Sol',
    ['GPT-6.1 Sol', 'gpt-6.1-sol'],
    '公开目录中的均衡档，用于在能力与成本之间折中，支持工具使用。',
    'HIGH',
    'OpenAI API models',
    OPENAI_MODELS,
  ),
  silicon(
    'OPENAI',
    'gpt-6-sol',
    'GPT6SOL',
    'GPT-6',
    'GPT-6 Sol',
    ['GPT-6 Sol', 'gpt-6-sol'],
    'Daybreak 文档中的主线模型标识。公开用途包含一般任务，以及在获准项目中的防御性安全工作。',
    'HIGH',
    'Use Daybreak in the Responses API',
    DAYBREAK,
  ),
  silicon(
    'OPENAI',
    'gpt-6-luna',
    'GPT6LUNA',
    'GPT-6',
    'GPT-6 Luna',
    ['GPT-6 Luna', 'gpt-6-luna'],
    '公开目录中的高吞吐、低成本档。',
    'ROUTINE',
    'OpenAI API models',
    OPENAI_MODELS,
  ),
  silicon(
    'OPENAI',
    'gpt-5-6-sol',
    'GPT56SOL',
    'GPT-5.6',
    'GPT-5.6 Sol',
    ['GPT-5.6 Sol', 'GPT-5.6-Sol', 'gpt-5.6-sol'],
    'GPT-5.6 公开旗舰。产品说明包含编码、网络安全类别和多代理长时程设置；AISI 公开事件也点过这个名字。',
    'HIGH',
    'GPT-5.6 Sol',
    'https://developers.openai.com/api/docs/models/gpt-5.6-sol',
  ),
  silicon(
    'OPENAI',
    'gpt-5-6-terra',
    'GPT56TER',
    'GPT-5.6',
    'GPT-5.6 Terra',
    ['GPT-5.6 Terra', 'gpt-5.6-terra'],
    'GPT-5.6 家族中的均衡公开档。',
    'ROUTINE',
    'GPT-5.6 Terra',
    'https://developers.openai.com/api/docs/models/gpt-5.6-terra',
  ),
  silicon(
    'OPENAI',
    'gpt-5-6-luna',
    'GPT56LUNA',
    'GPT-5.6',
    'GPT-5.6 Luna',
    ['GPT-5.6 Luna', 'gpt-5.6-luna'],
    'GPT-5.6 家族中的高吞吐公开档。',
    'ROUTINE',
    'GPT-5.6 Luna',
    'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
  ),
  silicon(
    'OPENAI',
    'gpt-5-6-cyber',
    'GPT56CYB',
    'GPT-5.6',
    'GPT-5.6 Cyber',
    ['GPT-5.6 Cyber', 'gpt-5.6-cyber'],
    '公开的网络安全专用档，需要单独批准。观察只记录“授权安全测试暴露”这一类别。',
    'HIGH',
    'GPT-5.6 Cyber',
    'https://developers.openai.com/api/docs/models/gpt-5.6-cyber',
  ),
  silicon(
    'OPENAI',
    'openai-undisclosed-checkpoint',
    'INTCHK26',
    '未公开内部研究检查点',
    '未公开内部研究检查点',
    ['未公开内部研究检查点', 'internal-only research model', '内部研究检查点', 'Internal Model 1'],
    '公开技术报告描述了未冠以产品名的内部研究检查点，能力倾向包括长时程持久性和多智能体协作。报告里的 Internal Model 1 只是临时指称，不升格为产品名。',
    'HIGH',
    'OpenAI–Hugging Face incident technical report',
    INTERNAL_REPORT,
    'UNDISCLOSED_CLASS',
  ),
];

export const PRIORITY_REGISTRY: ModelVersionEntry[] = [...LAB_ORGS, ...MODEL_VERSIONS];

for (const entry of PRIORITY_REGISTRY) {
  const did = validateS2DID(entry.s2Did);
  if (!did.valid) throw new Error(`${entry.id}: ${did.reason}`);
  assertS2Category(entry.s2Category);
  if (entry.s2Category === 'ORG' && entry.disclosure !== 'LAB') {
    throw new Error(`${entry.id} uses ORG without being a lab`);
  }
}

const dids = new Set(PRIORITY_REGISTRY.map((entry) => entry.s2Did));
if (dids.size !== PRIORITY_REGISTRY.length) {
  throw new Error('Priority registry S2-DID values must be unique');
}
