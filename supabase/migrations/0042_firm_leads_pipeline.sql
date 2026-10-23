-- Firm leads pipeline, contact fields, and pipeline status.
--
-- Adds phone, full_name, and pipeline_status to public.firm_clients so firms can
-- capture phone numbers on intake, track leads through consultation stages, and
-- graduate leads to signed clients.

alter table public.firm_clients
  add column if not exists phone text,
  add column if not exists full_name text,
  add column if not exists pipeline_status text not null default 'new_lead';

alter table public.firm_clients
  add constraint firm_clients_pipeline_status_check
  check (pipeline_status in (
    'new_lead',
    'contacted',
    'consultation_scheduled',
    'consultation_completed',
    'contract_sent',
    'contract_signed',
    'archived'
  ));

create index if not exists firm_clients_pipeline_idx
  on public.firm_clients(firm_id, pipeline_status, created_at desc);
