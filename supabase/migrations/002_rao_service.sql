-- Service archive for RAO.qianjia.com.
-- One pre-seeded operator. No self-service accounts.
-- Daily runs are the retrospective timeline. Actuation stays NONE.

create table rao_operator_account (
  username text primary key check (username = 'rao-admin'),
  role text not null default 'SYSTEM_ADMIN' check (role = 'SYSTEM_ADMIN'),
  note text not null,
  created_at timestamptz not null default now()
);

insert into rao_operator_account (username, note)
values (
  'rao-admin',
  '唯一系统管理员。没有自助注册。口令只放在运行环境，不写入页面或迁移脚本。'
);

create table rao_daily_runs (
  window_label text primary key check (char_length(window_label) = 10),
  generated_at timestamptz not null,
  mean_security_score numeric(5,2) not null,
  mean_tti numeric(5,2) not null,
  analysis_reader text not null check (analysis_reader in ('BUILTIN', 'DEEPSEEK', 'DEEPSEEK_FALLBACK')),
  actuation text not null default 'NONE' check (actuation = 'NONE'),
  report_markdown text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
