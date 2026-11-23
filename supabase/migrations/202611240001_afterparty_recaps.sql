-- The same published album is readable during the live recap and after the event.
create function private.recap_open() returns boolean
language sql stable set search_path='' as $$
  select public.content_open() and exists (
    select 1 from public.event_public_state where id and phase in ('RECAP','COMPLETED')
  );
$$;
revoke all on function private.recap_open() from public,anon,authenticated;

-- Keep the existing employee authentication and other actions intact.
do $migration$
declare
  definition text := pg_get_functiondef('private.employee_action(uuid,text,jsonb)'::regprocedure);
  previous text := $condition$cfg.event_start_at is null or now()<cfg.event_start_at or
      not exists(select 1 from public.event_public_state where phase='RECAP')$condition$;
begin
  if strpos(definition,previous)=0 then raise exception 'Unexpected employee recap guard'; end if;
  execute replace(definition,previous,'not private.recap_open()');
end $migration$;

create or replace function public.can_read_media(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.is_admin() or (public.current_employee() is not null and (
    p_path=(select logo_path from private.settings) or
    (private.recap_open() and exists(select 1 from private.recaps r where r.published and
      (r.asset_path=p_path or r.album->>'cover_path'=p_path or
       (r.album->'slides') @> jsonb_build_array(jsonb_build_object('asset_path',p_path)))))
  ));
$$;

create or replace function private.recap_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.event_public_state set revision=revision+1,updated_at=now() where phase in ('RECAP','COMPLETED');
  return null;
end $$;
