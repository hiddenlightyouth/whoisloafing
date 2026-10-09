-- WhoIsLoafing 데이터베이스 스키마
-- Supabase 대시보드의 SQL Editor에 붙여 넣고 한 번 실행해요.

-- 채팅방. 한 줄이 채팅 하나예요.
create table if not exists public.chats (
  id uuid primary key,
  repo_url text not null,
  -- 채팅을 만든 브라우저만 이어서 쓸 수 있게 확인하는 값의 해시 (원래 값은 저장하지 않아요)
  owner_key_hash text not null,
  -- 화면에 올라간 말풍선을 순서대로 담은 배열
  messages jsonb not null default '[]'::jsonb,
  -- 공유한 시각. 값이 있으면 누구나 열람할 수 있고, 더 이상 이어서 작업할 수 없어요.
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_created_at_idx on public.chats (created_at desc);

-- AI 호출 기록. Claude를 한 번 부를 때마다 한 줄이 쌓여요. (실패한 호출도 남겨요)
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid,
  -- 호출 목적: repo_summary, contributor_profile, narration
  purpose text not null,
  -- 누구 또는 무엇에 대한 호출인지 (참여자 이름, 해설 주제 등)
  label text,
  model text not null,
  status text not null check (status in ('ok', 'error')),
  error text,
  system_prompt text not null,
  user_prompt text not null,
  response text,
  input_tokens integer,
  output_tokens integer,
  thinking_tokens integer,
  total_tokens integer,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_chat_id_idx on public.ai_usage (chat_id);
create index if not exists ai_usage_created_at_idx on public.ai_usage (created_at desc);

-- 서버(service role 키)만 읽고 쓸 수 있게 해요. 정책을 하나도 두지 않아서 브라우저에서는 접근할 수 없어요.
alter table public.chats enable row level security;
alter table public.ai_usage enable row level security;

-- 날짜별, 목적별 토큰 사용량을 한눈에 보는 뷰
create or replace view public.ai_usage_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at) as day,
  purpose,
  model,
  count(*) as calls,
  count(*) filter (where status = 'error') as failed_calls,
  coalesce(sum(input_tokens), 0) as input_tokens,
  coalesce(sum(output_tokens), 0) as output_tokens,
  coalesce(sum(thinking_tokens), 0) as thinking_tokens,
  coalesce(sum(total_tokens), 0) as total_tokens
from public.ai_usage
group by 1, 2, 3
order by 1 desc, 2, 3;
