-- Universal Visa and Green Card Intake:
-- Convert enum columns in user_profiles to text to support universal statuses,
-- custom write-ins, and expanded green card pathways.

alter table public.user_profiles
  alter column visa_type type text using visa_type::text;

alter table public.user_profiles
  alter column preference_category drop default,
  alter column preference_category type text using preference_category::text,
  alter column preference_category set default 'Not sure';

alter table public.user_profiles
  add column if not exists custom_visa_detail text,
  add column if not exists green_card_pathway text;
