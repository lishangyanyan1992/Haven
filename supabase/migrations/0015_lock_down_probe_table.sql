do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'zz_import_probe'
      and c.relkind = 'r'
  ) then
    execute 'alter table public.zz_import_probe enable row level security';
    execute 'revoke all on table public.zz_import_probe from anon';
    execute 'revoke all on table public.zz_import_probe from authenticated';
    execute 'revoke all on table public.zz_import_probe from public';
  end if;
end
$$;
