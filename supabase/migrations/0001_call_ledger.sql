create table public.call_ledger (
 id uuid primary key,
 run_id text not null,
 request_id uuid unique not null,
 operator_id uuid not null,
 provider text not null check (provider in ('anthropic','openai')),
 model text not null,
 prompt_sha256 text not null check (prompt_sha256 ~ '^[0-9a-f]{64}$'),
 input_turn_ids text[] not null,
 input_units integer not null check (input_units between 0 and 24000),
 usage_json jsonb,
 reserved_usd numeric not null check (reserved_usd >= 0 and reserved_usd <= 40),
 settled_usd numeric check (settled_usd >= 0 and settled_usd <= reserved_usd),
 latency_ms integer not null default 0 check (latency_ms >= 0),
 status text not null check (status in ('reserved','settled','failed','timeout')),
 created_at timestamptz not null default now()
);
comment on table public.call_ledger is 'Metadata only. No transcript text, raw values, drafts or API keys.';
