-- Firm intake questions (customizable lawyer intake).
--
-- Adds intake_questions to public.firms to store a firm-wide list of
-- client intake questions (preset fields + custom questions). Defaults to
-- null, which falls back to the standard Haven intake question set until
-- the lawyer saves a custom setup.

alter table public.firms
  add column intake_questions jsonb default null;

alter table public.firms
  add constraint firms_intake_questions_is_array
  check (intake_questions is null or jsonb_typeof(intake_questions) = 'array');
