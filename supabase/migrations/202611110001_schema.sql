create extension if not exists pgcrypto with schema extensions;
create schema private;
revoke all on schema private from public, anon, authenticated;

create table private.admins (user_id uuid primary key references auth.users on delete cascade);
create table private.settings (
  id boolean primary key default true check(id),
  event_start_at timestamptz,
  deletion_date date,
  survey_open boolean not null default true,
  nomination_open boolean not null default true,
  enabled boolean not null default true,
  require_admin_mfa boolean not null default false,
  logo_path text,
  welcome text not null default '2026년 한 걸음 더 가까워진, 그리고 가까워질 우리',
  ending text not null default '덕분에, 한 걸음 더 가까워졌습니다. 우리의 다음 한 걸음도 함께해요.'
);
insert into private.settings(id) values(true);
create table private.employees (
  id uuid primary key default gen_random_uuid(), employee_no text not null unique,
  name text not null check(length(name) between 1 and 60),
  department text not null check(length(department) between 1 and 100),
  dob date not null, code_hash text not null,
  active boolean not null default true
);
create table private.sessions (
  auth_user_id uuid primary key references auth.users on delete cascade,
  employee_id uuid not null references private.employees on delete cascade,
  verified_at timestamptz not null default now(), last_seen timestamptz not null default now()
);
create index sessions_employee on private.sessions(employee_id);
create table private.login_attempts (
  id bigint generated always as identity primary key, identity_key text not null,
  network_key text not null, success boolean not null default false,
  created_at timestamptz not null default now()
);
create index attempts_identity on private.login_attempts(identity_key,created_at);
create index attempts_network on private.login_attempts(network_key,created_at);
create table public.employee_directory (
  id uuid primary key references private.employees on delete cascade,
  name text not null, department text not null, active boolean not null default true
);
create table public.questions (
  id text primary key check(length(id) between 1 and 40), prompt text not null check(length(prompt) between 1 and 200),
  choices text[] not null default '{}', sort_order integer not null default 0,
  active boolean not null default true
);
insert into public.questions(id,prompt,choices,sort_order) values
 ('food','오늘 가장 먹고 싶은 음식은?',array['한식','고기','회·초밥','양식','중식','기타'],1),
 ('hobby','퇴근 뒤, 나를 가장 나답게 만드는 취미는?',array['운동','게임','독서','영상 감상','요리','기타'],2),
 ('youtube','최근 즐겨보는 유튜브 채널은?', '{}',3),
 ('dream','어릴 적 나의 꿈은?', '{}',4),
 ('surprise','동료들이 아직 모르는 나의 반전은?', '{}',5),
 ('moment','올해, 오래 기억하고 싶은 순간은?', '{}',6);
create table public.surveys (
  employee_id uuid primary key references private.employees on delete cascade,
  answers jsonb not null, consent boolean not null default false,
  excluded text[] not null default '{}', updated_at timestamptz not null default now()
);
create table public.nominations (
  voter_id uuid primary key references private.employees on delete cascade,
  nominee_id uuid not null references private.employees on delete cascade,
  reason text not null default '' check(length(reason)<=300),
  updated_at timestamptz not null default now(), check(voter_id<>nominee_id)
);
create index nominations_nominee on public.nominations(nominee_id);
create table private.reason_reviews (
  voter_id uuid primary key references public.nominations on delete cascade,
  public_text text not null check(length(public_text)<=300), approved boolean not null default false
);
create table private.rounds (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references private.employees on delete cascade,
  question_keys text[] not null check(cardinality(question_keys) between 1 and 3),
  hints text[] not null check(cardinality(hints) between 1 and 3),
  approved boolean not null default false, sort_order integer not null default 0,
  check(cardinality(question_keys)=cardinality(hints))
);
create table private.tastes (
  id uuid primary key default gen_random_uuid(), question_id text not null references public.questions,
  prompt text not null check(length(prompt) between 1 and 200), results jsonb not null,
  approved boolean not null default false
);
create table private.recaps (
  id uuid primary key default gen_random_uuid(), caption text not null check(length(caption) between 1 and 500),
  asset_path text, published boolean not null default false, sort_order integer not null default 0
);
create table public.event_public_state (
  id boolean primary key default true check(id),
  phase text not null default 'WAITING' check(phase in ('PRE_SURVEY','WAITING','RECAP','WHO_AM_I','TASTES','AWARDS','END')),
  payload jsonb not null default '{}', paused boolean not null default false,
  revision integer not null default 0, updated_at timestamptz not null default now()
);
insert into public.event_public_state(id) values(true);
create table private.rehearsals (
  admin_id uuid primary key references auth.users on delete cascade, state jsonb not null
);
create table private.audit (
  id bigint generated always as identity primary key, admin_id uuid references auth.users on delete set null,
  action text not null, before_state jsonb, after_state jsonb, created_at timestamptz not null default now()
);

create function private.admin(p_actor uuid) returns boolean language sql stable security definer
set search_path='' as $$
  select exists(select 1 from private.admins where user_id=p_actor);
$$;
create function public.is_admin() returns boolean language sql stable security definer
set search_path='' as $$ select private.admin(auth.uid()); $$;
create function public.current_employee() returns uuid language sql stable security definer
set search_path='' as $$
  select e.id from private.sessions s join private.employees e on e.id=s.employee_id
  where s.auth_user_id=auth.uid() and e.active and (select enabled from private.settings);
$$;
create function public.content_open() returns boolean language sql stable security definer
set search_path='' as $$
  select enabled and event_start_at is not null and now()>=event_start_at from private.settings;
$$;
revoke all on function public.is_admin(),public.current_employee(),public.content_open() from public;
grant execute on function public.is_admin(),public.current_employee(),public.content_open() to authenticated;

alter table public.employee_directory enable row level security;
alter table public.questions enable row level security;
alter table public.surveys enable row level security;
alter table public.nominations enable row level security;
alter table public.event_public_state enable row level security;
create policy directory_read on public.employee_directory for select to authenticated
  using(public.is_admin() or (public.current_employee() is not null and active));
create policy questions_read on public.questions for select to authenticated
  using(public.is_admin() or (public.current_employee() is not null and active));
create policy survey_read on public.surveys for select to authenticated
  using(public.is_admin() or employee_id=public.current_employee());
create policy nominations_read on public.nominations for select to authenticated
  using(public.is_admin() or voter_id=public.current_employee());
create policy state_read on public.event_public_state for select to authenticated
  using(public.is_admin() or (public.current_employee() is not null and (phase in ('PRE_SURVEY','WAITING') or public.content_open())));
revoke all on public.employee_directory,public.questions,public.surveys,public.nominations,public.event_public_state from anon,authenticated;
grant select on public.employee_directory,public.questions,public.surveys,public.nominations,public.event_public_state to authenticated;
alter publication supabase_realtime add table public.event_public_state;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('event-media','event-media',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy media_read on storage.objects for select to authenticated using(
 bucket_id='event-media' and (public.is_admin() or (public.current_employee() is not null and (
 name=(select s.logo_path from private.settings s) or
 (public.content_open() and exists(select 1 from public.event_public_state where phase='RECAP')
 and exists(select 1 from private.recaps r where r.asset_path=name and r.published))
 )))
);
