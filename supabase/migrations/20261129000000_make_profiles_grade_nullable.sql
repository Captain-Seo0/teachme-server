-- profiles.grade becomes nullable: repeat exam takers and general users have no grade.
--
-- ROLLBACK (run manually, in this order):
--   alter table public.profiles drop constraint profiles_grade_requires_student_type;
--   alter table public.profiles alter column grade set not null;
--   -- The last statement FAILS if any row has grade = null. Fix or delete those
--   -- rows first (e.g. repeat_exam_taker / general users have no grade to restore).

alter table public.profiles
  alter column grade drop not null;

-- The existing check profiles_grade_check (grade between 1 and 3) is kept as is:
-- a null grade passes a check constraint.

-- grade is required for middle/high school students and must be null otherwise.
-- Legacy rows (student_type is null) are not constrained.
alter table public.profiles
  add constraint profiles_grade_requires_student_type
  check (
    student_type is null
    or (student_type in ('middle_school', 'high_school') and grade is not null)
    or (student_type in ('repeat_exam_taker', 'general') and grade is null)
  );
