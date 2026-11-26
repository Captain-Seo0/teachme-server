-- profiles: link a profile to a NEIS school.
-- Both columns are nullable: users who can't find their school in the search
-- results enter school_name by hand, leaving school_code / school_kind null.

alter table public.profiles
  add column school_code text,
  add column school_kind text;

-- Lookup for the "우리 학교" feed. Partial: manual-entry rows have no code.
create index profiles_school_code_idx
  on public.profiles (school_code)
  where school_code is not null;
