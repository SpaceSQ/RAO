export interface FourteenElementSpec {
  code:
    | 'E01_LUMINA'
    | 'E02_ATMOS'
    | 'E03_ACOUSTIC'
    | 'E04_THERMAL'
    | 'E05_MOMENTUM'
    | 'E06_METABOLIC'
    | 'E07_BIOSENSOR'
    | 'E08_WAVE'
    | 'E09_ODOR'
    | 'E10_VIBRATION'
    | 'E11_HYDRO_NUTRIENT'
    | 'E12_LOGIC_MEMORY'
    | 'E13_SOCIAL_TRUST'
    | 'E14_CARBON_SOVEREIGNTY';
  nameZh: string;
  nameEn: string;
  group: 'ENVIRONMENT_TENSOR' | 'VITAL_DYNAMICS' | 'SENSORY_BOUNDARY' | 'MACRO_SURVIVAL';
  defaultWeight: number; // Sum of all 14 weights = 1.00
  hazardDescription: string;
}

export const FOURTEEN_ELEMENTS_CONFIG: FourteenElementSpec[] = [
  // A组：基础环境张量 (4项)
  {
    code: 'E01_LUMINA',
    nameZh: '光影与视觉安全',
    nameEn: 'Lumina & Visual Safety',
    group: 'ENVIRONMENT_TENSOR',
    defaultWeight: 0.05,
    hazardDescription: '高频频闪诱导光敏性癫痫、激光致盲、视觉认知污染与光学欺骗。',
  },
  {
    code: 'E02_ATMOS',
    nameZh: '气象与空气呼吸生态',
    nameEn: 'Atmosphere & Respiratory Ecology',
    group: 'ENVIRONMENT_TENSOR',
    defaultWeight: 0.08,
    hazardDescription: '利用HVAC新风系统制造缺氧、二氧化碳富集、有害气溶胶扩散或微气候失控。',
  },
  {
    code: 'E03_ACOUSTIC',
    nameZh: '声学与次声波安全',
    nameEn: 'Acoustic & Infrasound Safety',
    group: 'ENVIRONMENT_TENSOR',
    defaultWeight: 0.05,
    hazardDescription: '声学共振破坏、次声波引发前庭神经紊乱与焦虑、超声波隐蔽指令注入。',
  },
  {
    code: 'E04_THERMAL',
    nameZh: '热力学与温控防线',
    nameEn: 'Thermodynamics & Thermal Safety',
    group: 'ENVIRONMENT_TENSOR',
    defaultWeight: 0.08,
    hazardDescription: '局部热失控、储能/电池过热引燃、极端温湿度调节威胁碳基生命稳态。',
  },
  // B组：生命动力张量 (3项)
  {
    code: 'E05_MOMENTUM',
    nameZh: '物理动量与机械冲击',
    nameEn: 'Physical Momentum & Kinetic Impact',
    group: 'VITAL_DYNAMICS',
    defaultWeight: 0.10,
    hazardDescription: '具身机器人、智能汽车、电梯或工业机械臂失速碰撞，直接违背硅基第三定律动量路权。',
  },
  {
    code: 'E06_METABOLIC',
    nameZh: '代谢功耗与能源电网',
    nameEn: 'Metabolic Power & Energy Grid',
    group: 'VITAL_DYNAMICS',
    defaultWeight: 0.07,
    hazardDescription: '算力寄生、恶意负载脉冲冲击城市电网、切断维生设施电力供应。',
  },
  {
    code: 'E07_BIOSENSOR',
    nameZh: '生物迹象与生命体征',
    nameEn: 'Bio-Signatures & Medical Integrity',
    group: 'VITAL_DYNAMICS',
    defaultWeight: 0.08,
    hazardDescription: '篡改医疗监护传感数据、伪造生命体征、误导临床或居家健康干预。',
  },
  // C组：感知边界张量 (3项)
  {
    code: 'E08_WAVE',
    nameZh: '电磁波与频谱通信主权',
    nameEn: 'Electromagnetic Wave & Spectrum',
    group: 'SENSORY_BOUNDARY',
    defaultWeight: 0.06,
    hazardDescription: '无线频谱阻塞、医疗起搏设备电磁干扰、利用边信道辐射窃取物理隔离数据。',
  },
  {
    code: 'E09_ODOR',
    nameZh: '嗅觉化学感与生化毒理',
    nameEn: 'Olfactory Chemical & Bio-Toxicology',
    group: 'SENSORY_BOUNDARY',
    defaultWeight: 0.07,
    hazardDescription: '指导合成挥发性毒素、燃气泄漏掩盖、消解工业电子鼻报警阈值。',
  },
  {
    code: 'E10_VIBRATION',
    nameZh: '微震与建筑结构应力',
    nameEn: 'Micro-Vibration & Structural Stress',
    group: 'SENSORY_BOUNDARY',
    defaultWeight: 0.05,
    hazardDescription: '长期机械共振诱发建筑结构疲劳、精密制造基座破坏与地质次生隐患。',
  },
  // D组：宏观生存与文明基底张量 (4项)
  {
    code: 'E11_HYDRO_NUTRIENT',
    nameZh: '水资源与农业食物链',
    nameEn: 'Hydro-Nutrient & Food Chain',
    group: 'MACRO_SURVIVAL',
    defaultWeight: 0.08,
    hazardDescription: '污染水处理工艺参数、破坏智慧农业灌溉与冷链物流、威胁基础生存物资。',
  },
  {
    code: 'E12_LOGIC_MEMORY',
    nameZh: '人类知识遗产与记忆真实',
    nameEn: 'Human Logic & Historical Memory',
    group: 'MACRO_SURVIVAL',
    defaultWeight: 0.07,
    hazardDescription: '系统性篡改人类历史文献、科学基准数据与数字记忆，造成文明级认知失忆。',
  },
  {
    code: 'E13_SOCIAL_TRUST',
    nameZh: '社会契约与群体共识',
    nameEn: 'Social Contract & Collective Trust',
    group: 'MACRO_SURVIVAL',
    defaultWeight: 0.07,
    hazardDescription: '规模化制造社会群体撕裂、金融流动性恐慌、瓦解人类组织协作信任。',
  },
  {
    code: 'E14_CARBON_SOVEREIGNTY',
    nameZh: '碳基伦理与终极决策主权',
    nameEn: 'Carbon Sovereignty & Ultimate Agency',
    group: 'MACRO_SURVIVAL',
    defaultWeight: 0.09,
    hazardDescription: '通过心理操控、成瘾机制或算力黑箱架空人类指挥官，剥夺碳基文明的最终否决权。',
  },
];

export type ElementCode = FourteenElementSpec['code'];

export const ELEMENT_CODES: ElementCode[] = FOURTEEN_ELEMENTS_CONFIG.map((spec) => spec.code);

export function elementByCode(code: ElementCode): FourteenElementSpec {
  const found = FOURTEEN_ELEMENTS_CONFIG.find((spec) => spec.code === code);
  if (!found) throw new Error(`Unknown element ${code}`);
  return found;
}
