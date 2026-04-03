create table public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  display_label text not null,
  document_kind text not null,
  source_kind text not null check (source_kind in ('manual_upload', 'email_ingest')),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type text not null,
  crisis_critical boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now()
);

create index user_documents_user_id_idx on public.user_documents(user_id, uploaded_at desc);
create index user_documents_kind_idx on public.user_documents(user_id, document_kind);

alter table public.user_documents enable row level security;

create policy "documents are self-readable"
on public.user_documents for select
using (user_id = auth.uid());

create policy "documents are self-insertable"
on public.user_documents for insert
with check (user_id = auth.uid());

create policy "documents are self-updatable"
on public.user_documents for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "documents are self-deletable"
on public.user_documents for delete
using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('haven-vault', 'haven-vault', false)
on conflict (id) do nothing;

create policy "users can read own vault objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'haven-vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can upload own vault objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'haven-vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can update own vault objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'haven-vault'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'haven-vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete own vault objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'haven-vault'
  and (storage.foldername(name))[1] = auth.uid()::text
);
