-- profiles.school_name becomes nullable: repeat exam takers and general users
-- may skip school entry.
--
-- ROLLBACK (run manually, in this order):
--   alter table public.profiles drop constraint profiles_school_link_requires_name;
--   alter table public.profiles drop constraint profiles_school_requires_student_type;
--   alter table public.profiles alter column school_name set not null;
--   -- The last statement FAILS if any row has school_name = null. Fill in or
--   -- delete those rows first.

alter table public.profiles
  alter column school_name drop not null;

-- The existing check profiles_school_name_check (trimmed, 1..50 chars) is kept
-- as is: a null school_name passes it.

-- Middle/high school students must have a school name. Other student types may
-- leave it null or set it. Legacy rows (student_type is null) are not constrained.
alter table public.profiles
  add constraint profiles_school_requires_student_type
  check (
    student_type is null
    or student_type in ('repeat_exam_taker', 'general')
    or school_name is not null
  );

-- school_code / school_kind come from the NEIS search, so they need a school
-- name. A school name without them is allowed (manual entry).
alter table public.profiles
  add constraint profiles_school_link_requires_name
  check (
    school_name is not null
    or (school_code is null and school_kind is null)
  );
