-- Keep the original start history. Only survey/nomination flags can reopen a
-- response window, and an already-started event must have a future deadline.
create function private.response_window(p_started timestamptz,p_start timestamptz,p_clock timestamptz)
returns boolean language sql immutable set search_path='' as $$
  select p_started is null or coalesce(p_start>p_clock,false);
$$;
revoke all on function private.response_window(timestamptz,timestamptz,timestamptz) from public,anon,authenticated;

do $migration$
declare definition text; change record;
begin
  definition:=replace(pg_get_functiondef('public.portal_before_tree(uuid,text,jsonb)'::regprocedure),E'\r\n',E'\n');
  for change in select * from (values
    ($old$if cfg.started_at is not null then
      raise exception '행사가 시작되어 작성과 수정이 마감되었습니다.'$old$,
     $new$if cfg.started_at is not null and (
      not private.response_window(cfg.started_at,cfg.event_start_at,now())
      or (p_action='save_survey' and not cfg.survey_open)
      or (p_action='nominate' and not cfg.nomination_open)) then
      raise exception '행사가 시작되어 작성과 수정이 마감되었습니다.'$new$),
    ($old$if cfg.started_at is not null and ((p->>'survey_open')::boolean or (p->>'nomination_open')::boolean) then
      raise exception '행사 시작 후에는 응답을 다시 열 수 없습니다.'$old$,
     $new$if not private.response_window(cfg.started_at,(p->>'event_start_at')::timestamptz,now())
      and ((p->>'survey_open')::boolean or (p->>'nomination_open')::boolean) then
      raise exception '응답을 다시 허용하려면 행사 시작 시각을 현재보다 이후로 설정해주세요.'$new$),
    ($old$result:=public.portal_legacy(p_actor,p_action,p);$old$,
     $new$result:=public.portal_legacy(p_actor,p_action,p);
  if p_action='settings' then
    update public.event_public_state set revision=revision+1,updated_at=now() where id;
  end if;$new$)
  ) as edits(old_text,new_text) loop
    if strpos(definition,change.old_text)=0 then raise exception 'Unexpected submission guard definition'; end if;
    definition:=replace(definition,change.old_text,change.new_text);
  end loop;
  execute definition;
end;
$migration$;

do $migration$
declare definition text; original text:=$old$if p->>'command'='phase' and p->>'phase' not in ('WAITING','PRE_SURVEY') and cfg.started_at is null then
    update private.settings set started_at=now(),survey_open=false,nomination_open=false where id;$old$;
begin
  definition:=replace(pg_get_functiondef('private.command_before_tree(uuid,jsonb)'::regprocedure),E'\r\n',E'\n');
  if strpos(definition,original)=0 then raise exception 'Unexpected phase response lock definition'; end if;
  execute replace(definition,original,$new$if p->>'command'='phase' and p->>'phase' not in ('WAITING','PRE_SURVEY')
    and (cfg.started_at is null or cfg.survey_open or cfg.nomination_open) then
    update private.settings set started_at=coalesce(started_at,now()),survey_open=false,nomination_open=false where id;$new$);
end;
$migration$;

alter table public.event_public_state add column settings_revision integer not null default 0;
create function private.notify_response_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if row(old.event_start_at,old.started_at,old.survey_open,old.nomination_open,old.enabled)
    is distinct from row(new.event_start_at,new.started_at,new.survey_open,new.nomination_open,new.enabled) then
    if new.started_at is not null and new.event_start_at>now() and (new.survey_open or new.nomination_open) then
      -- Leaving completed browsing is necessary to make the response pages reachable.
      delete from public.forest_tree_notes where id is not null;
      update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false where id;
    end if;
    -- Commands validate their caller revision after closing flags; only the
    -- settings endpoint advances that revision here, once its save succeeds.
    update public.event_public_state set settings_revision=settings_revision+1,updated_at=now() where id;
  end if;
  return null;
end; $$;
create trigger notify_response_settings after update on private.settings
for each row execute function private.notify_response_settings();
revoke all on function private.notify_response_settings() from public,anon,authenticated;
