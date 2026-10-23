-- Firm required documents (openspec change add-client-document-vault-tab).
--
-- Adds required_documents to public.firms to store a firm-wide list of
-- required immigration document slots. Defaults to null until the lawyer saves
-- their firm setup.

alter table public.firms
  add column required_documents jsonb default null;

alter table public.firms
  add constraint firms_required_documents_is_array
  check (required_documents is null or jsonb_typeof(required_documents) = 'array');
