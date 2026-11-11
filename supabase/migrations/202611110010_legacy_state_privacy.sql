-- Retain a previous prototype's rows, while closing its public hint endpoint.
-- This table is not used by the application and may not exist in a new project.
do $$
begin
  if to_regclass('public.game_state') is not null then
    revoke select on public.game_state from public,anon,authenticated;
    if exists(select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='game_state') then
      alter publication supabase_realtime drop table public.game_state;
    end if;
  end if;
end; $$;
