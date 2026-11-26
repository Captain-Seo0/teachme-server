-- profiles: one row per user. A row exists = onboarding completed.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Onboarding "study concern" -> first AI student matching:
--
--   study_concern              (UI label)                       -> matched_student
--   -------------------------  -------------------------------  ----------------
--   just_for_fun               다 필요 없고 재미가 최고예요         -> dapdapi   (답답이)
--   cant_explain_terms         용어는 외웠는데 설명이 안 돼요       -> chorongi  (초롱이)
--   confused_causality         개념은 아는데 인과관계가 헷갈려요    -> ttokttogi (똑똑이)
--   trips_on_tricky_questions  응용·함정 문제만 나오면 틀려요       -> kkanjogi  (깐족이)
--
-- The mapping is applied by the app; matched_student can change later.
create type public.study_concern as enum (
  'just_for_fun',
  'cant_explain_terms',
  'confused_causality',
  'trips_on_tricky_questions'
);

create type public.ai_student as enum (
  'dapdapi',
  'chorongi',
  'ttokttogi',
  'kkanjogi'
);

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep updated_at current
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nickname        text not null,
  avatar          text not null,
  school_name     text not null,
  grade           smallint not null,
  study_concern   public.study_concern not null,
  matched_student public.ai_student not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint profiles_nickname_check
    check (nickname = btrim(nickname) and char_length(nickname) between 2 and 20),
  constraint profiles_avatar_check
    check (char_length(avatar) between 1 and 50),
  constraint profiles_school_name_check
    check (school_name = btrim(school_name) and char_length(school_name) between 1 and 50),
  constraint profiles_grade_check
    check (grade between 1 and 3)
);

-- Nicknames are unique, case-insensitive.
create unique index profiles_nickname_lower_key
  on public.profiles (lower(nickname));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: owners can select / insert / update their own row. No delete policy,
-- so deletes are denied (rows are removed only via auth.users cascade).
-- Public profile reads (Teach Tok) will be added in a later migration.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Nickname availability check
-- security definer: callers cannot read other users' rows directly.
-- The caller's own current nickname counts as available (profile edit).
-- ---------------------------------------------------------------------------

create function public.is_nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_nickname is not null
    and btrim(p_nickname) <> ''
    and not exists (
      select 1
      from public.profiles
      where lower(nickname) = lower(btrim(p_nickname))
        and id <> (select auth.uid())
    );
$$;

revoke all on function public.is_nickname_available(text) from public, anon;
grant execute on function public.is_nickname_available(text) to authenticated;
