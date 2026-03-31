-- 036-seah-org-sync-tables.sql
-- 세아웍스 인사 스냅샷 테이블 (조직/직원 분리)
-- 정책:
-- - 실서비스 로직은 users 유지
-- - 세아웍스 API는 배치/크론으로 하루 1회 동기화
-- - 식별자: 이메일(lower(email)) 단일 고유키

create table if not exists public.seah_org_units (
  org_code text primary key,
  org_name text not null,
  parent_org_code text null,
  is_active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seah_employees (
  employee_id uuid primary key default gen_random_uuid(),
  email text not null,
  name text null,
  org_code text null references public.seah_org_units(org_code),
  status_code text null,
  emp_no text null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 이메일은 소문자 정규화 + 단일 고유키
alter table public.seah_employees
  drop constraint if exists seah_employees_email_lower_chk;
alter table public.seah_employees
  add constraint seah_employees_email_lower_chk check (email = lower(email));

create unique index if not exists seah_employees_email_key
  on public.seah_employees (email);

create index if not exists seah_employees_org_code_idx
  on public.seah_employees (org_code);

create index if not exists seah_employees_status_code_idx
  on public.seah_employees (status_code);

create index if not exists seah_org_units_parent_org_code_idx
  on public.seah_org_units (parent_org_code);

-- updated_at 자동 갱신 트리거
drop trigger if exists set_seah_org_units_updated_at on public.seah_org_units;
create trigger set_seah_org_units_updated_at
before update on public.seah_org_units
for each row execute function public.update_updated_at_column();

drop trigger if exists set_seah_employees_updated_at on public.seah_employees;
create trigger set_seah_employees_updated_at
before update on public.seah_employees
for each row execute function public.update_updated_at_column();

alter table public.seah_org_units enable row level security;
alter table public.seah_employees enable row level security;

-- 읽기: 로그인 사용자 허용 (조회/조인 용도)
drop policy if exists "Authenticated users can read seah_org_units" on public.seah_org_units;
create policy "Authenticated users can read seah_org_units"
  on public.seah_org_units
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read seah_employees" on public.seah_employees;
create policy "Authenticated users can read seah_employees"
  on public.seah_employees
  for select
  to authenticated
  using (true);

