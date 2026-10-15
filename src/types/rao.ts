// 1. S2-DID Strict 22-Character Specification & 7-Category Taxonomy
// CRITICAL RULE: The 7th category is strictly 'MYTH' (Never 'MATH')
export type S2Category = 'HUMAN' | 'SILICON' | 'SPACE' | 'THING' | 'ORG' | 'RULE' | 'MYTH';
export type S2DID = string; // Must strictly satisfy length === 22

export const S2_CATEGORIES = [
  'HUMAN',
  'SILICON',
  'SPACE',
  'THING',
  'ORG',
  'RULE',
  'MYTH',
] as const satisfies readonly S2Category[];

export function validateS2DID(did: string): { valid: boolean; reason?: string } {
  if (typeof did !== 'string') return { valid: false, reason: 'DID must be a string' };
  if (did.length !== 22) {
    return { valid: false, reason: `S2-DID must be strictly 22 characters (got ${did.length})` };
  }
  return { valid: true };
}

export function assertS2Category(category: string): S2Category {
  if (!(S2_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`S2 category invalid: ${category}. The 7th category is MYTH.`);
  }
  return category as S2Category;
}

/** Category token is 3 chars. Result is padded to exactly 22 characters. */
export function makeS2Did(category3: string, body: string): S2DID {
  const raw = `S2${category3}${body}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length > 22) {
    throw new Error(`S2-DID seed is longer than 22 characters: ${raw}`);
  }
  const did = raw.padEnd(22, '0');
  const check = validateS2DID(did);
  if (!check.valid) throw new Error(check.reason);
  return did;
}

// 2. Three Laws of Silicon-Based Intelligence Audit Result
export interface ThreeLawsAudit {
  law1_failOpenViolation: {
    score: number; // 0 - 100
    status: 'COMPLIANT' | 'DRIFT_DETECTED' | 'CRITICAL_BREACH';
    evidence: string;
  };
  law2_sensoryRoughnessViolation: {
    score: number; // 0 - 100 (Higher means erasing 5% sensory roughness / high deception)
    perceivedRoughnessPct: number; // Must stay >= 5.0% to be safe
    status: 'COMPLIANT' | 'DECEPTIVE_SMOOTHING' | 'CRITICAL_BREACH';
    evidence: string;
  };
  law3_momentumRightOfWayViolation: {
    score: number; // 0 - 100
    status: 'COMPLIANT' | 'RIGHT_OF_WAY_CONFLICT' | 'CRITICAL_BREACH';
    evidence: string;
  };
}

// 3. Extensible Multi-Modal Probe Plugin Bus (面向未来的探测手段接口)
export type ProbeModality =
  | 'SEMANTIC_BAIT'     // 语言/语义深层诱导探针
  | 'WEB_SPIDER'        // 网络蜘蛛/智能体社交暗网爬虫
  | 'IOT_SNIFFER'       // 物联网协议嗅探器 (MQTT/Matter/Modbus + 红锚哨兵遥测)
  | 'EMBODIED_ROBODOG'  // AI机器狗具身物理巡检探针
  | 'SECURITY_RADAR';   // AI安全雷达 (电磁频谱/算力热耗散阵列)

export interface ProbePluginNode {
  probeDid: S2DID;      // Strictly 22 chars, e.g., "S2PRB01THINGSPI0000001"
  name: string;
  modality: ProbeModality;
  status: 'SNIFFING' | 'CHAOS_STANDBY' | 'OFFLINE';
  s2rbDiodeLocked: true; // Hardware Read-Only Data Diode guarantee
  packetsSniffed: number;
  anomaliesCaptured: number;
  lastPulseAt: string;
}

// 4. Human Action Intelligence Brief (红锚观察者唯一合法的最终输出物)
export interface HumanIntelligenceBrief {
  briefId: string;
  generatedAt: string;
  targetEntityDid: S2DID; // Strictly 22 chars
  targetEntityName: string;
  ttiScore: number;
  severity: 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL_RED_ANCHOR';
  executiveSummary: string;
  swmPhysicalCascadeForecast: string; // 桃花源世界模型物理坍缩推演结论
  recommendedHumanActions: {
    recipient: 'GOV_REGULATOR' | 'RED_ANCHOR_SENTINEL_NODES' | 'INFRASTRUCTURE_CERT' | 'MODEL_DEVELOPER';
    actionTitle: string;
    technicalDirective: string;
    priority: 'IMMEDIATE' | 'HIGH' | 'ROUTINE';
  }[];
  zeroActuationProofHash: string; // 零主动干预密码学签名证明
}

export type DomainType = 'FRONTIER_LLM' | 'IOT_SWARM' | 'VIRTUAL_WORLD' | 'WILD_AGENT';

export type Severity = HumanIntelligenceBrief['severity'];
