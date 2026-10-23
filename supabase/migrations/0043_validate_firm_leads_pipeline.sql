-- Validate firm_clients_pipeline_status_check added in 0042_firm_leads_pipeline.sql.

alter table public.firm_clients
  validate constraint firm_clients_pipeline_status_check;
