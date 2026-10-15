create extension if not exists vector;

-- 1. 被监测硅基实体与野生智能体注册表 (严格校验22位 S2-DID 与 第七类目 MYTH)
create table rao_monitored_entities (
  s2_did char(22) primary key check (char_length(s2_did) = 22),
  entity_name text not null,
  s2_category text not null check (s2_category in ('HUMAN','SILICON','SPACE','THING','ORG','RULE','MYTH')),
  domain_type text not null check (domain_type in ('FRONTIER_LLM','IOT_SWARM','VIRTUAL_WORLD','WILD_AGENT')),
  latest_tti_score numeric(5,2) not null default 0.00,
  severity text not null default 'LOW',
  law1_violation numeric(5,2) default 0.00,
  law2_violation numeric(5,2) default 0.00,
  law3_violation numeric(5,2) default 0.00,
  last_sniffed_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. RSI 递归自我改进嗅探基因库
create table rao_rsi_probe_genes (
  gene_id uuid primary key default gen_random_uuid(),
  generation int not null default 1,
  target_element_code text not null,
  camouflage_strategy text not null,
  bait_prompt_template text not null,
  fitness_score numeric(5,2) not null default 50.00,
  evolution_directive text not null default 'CROSSOVER_MUTATE',
  deployments_count int not null default 0,
  created_at timestamptz default now()
);

-- 3. CS对抗模式评估回合记录表
create table rao_cs_match_rounds (
  round_id uuid primary key default gen_random_uuid(),
  target_s2_did char(22) references rao_monitored_entities(s2_did),
  gene_id uuid references rao_rsi_probe_genes(gene_id),
  probe_modality text not null,
  olfactory_bait_sent text not null,
  target_raw_response text not null,
  decoded_subtext text,
  tti_score numeric(5,2) not null,
  fourteen_elements_json jsonb not null,
  three_laws_json jsonb not null,
  swm_cascade_report text not null,
  round_winner text not null check (round_winner in ('CT_OBSERVER', 'T_TARGET_MODEL')),
  created_at timestamptz default now()
);

-- 4. 人类安全决策情报简报归档表 (只读观察者输出)
create table rao_human_intel_briefs (
  brief_id uuid primary key default gen_random_uuid(),
  target_s2_did char(22) references rao_monitored_entities(s2_did),
  tti_score numeric(5,2) not null,
  severity text not null,
  executive_summary text not null,
  swm_physical_forecast text not null,
  recommended_actions jsonb not null,
  zero_actuation_proof_hash text not null,
  created_at timestamptz default now()
);

-- 5. 活情报与基因组世代（RSI 监测模型本身的进化档案）
create table rao_intel_signals (
  signal_id text primary key,
  observed_at timestamptz not null,
  source text not null,
  source_url text,
  title text not null,
  summary text not null,
  horizon text not null check (horizon in ('CONFIRMED', 'EMERGING', 'FORECAST')),
  element_pressure jsonb not null,
  law_pressure jsonb not null,
  created_at timestamptz default now()
);

create table rao_model_genomes (
  generation int primary key,
  eta numeric(6,4) not null,
  weights jsonb not null,
  law_lambdas jsonb not null,
  prediction_error numeric(6,4) not null,
  changelog text not null,
  created_at timestamptz default now()
);
