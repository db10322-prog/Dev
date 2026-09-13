-- Supabase 스키마. Supabase 프로젝트의 SQL Editor에서 그대로 실행.
-- 역할: (1) 클라우드 배포(Vercel) 모드의 분석 결과 캐시  (2) 매체 성향 테이블 동기화  (3) 정확도 검증 결과 보관

create extension if not exists pgcrypto;

-- 1) 분석 결과 캐시 (core/cache.js 의 CACHE_BACKEND=supabase 백엔드가 사용)
create table if not exists analysis_cache (
  url_hash text primary key,
  url text not null,
  report jsonb not null,
  cached_at timestamptz not null default now()
);
create index if not exists analysis_cache_cached_at_idx on analysis_cache (cached_at desc);

-- 2) 매체 성향 테이블 (data/outlet-bias.json 을 이 테이블로 동기화해두면
--    클라우드 모드에서 파일 대신 DB를 읽도록 core/agents/outletBias.js 를 확장할 수 있음. 기본값은 여전히 로컬 JSON.)
create table if not exists outlet_bias (
  domain text primary key,
  name text,
  direction text not null check (direction in ('진보', '중도진보', '중도', '중도보수', '보수', '미분류')),
  source text
);

-- 3) 정확도 검증(T-9) 결과 보관 — eval/run.js 결과를 로컬 md 대신 여기에도 남기고 싶을 때 사용(선택)
create table if not exists eval_results (
  id text primary key,
  run_at timestamptz not null default now(),
  expected_verdict text,
  actual_verdict text,
  expected_direction text,
  actual_direction text,
  correct boolean
);

-- RLS: 이 프로젝트는 서버(Vercel 서버리스, service role 키)만 쓰고 브라우저에서 직접 쓰지 않으므로
-- 기본은 RLS 활성화 + anon 키는 전부 차단. 필요해지면 정책을 추가.
alter table analysis_cache enable row level security;
alter table outlet_bias enable row level security;
alter table eval_results enable row level security;
-- service role 키는 RLS를 우회하므로 별도 정책 없이도 서버에서는 정상 동작함.
