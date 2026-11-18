-- Reuse the same strict server deadline for existing stories. Ownership checks,
-- anonymous reads, moderation and the new-post deadline remain unchanged.
alter table private.settings add column forest_edit_open boolean not null default false;
create function private.reset_story_edit_window() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.started_at is distinct from old.started_at then new.forest_edit_open:=false; end if;
  return new;
end; $$;
create trigger reset_story_edit_window before update on private.settings
for each row execute function private.reset_story_edit_window();
revoke all on function private.reset_story_edit_window() from public,anon,authenticated;

do $migration$
declare change record; definition text;
begin
  for change in select * from (values
    ('private.forest_action_before_tree(uuid,text,jsonb)'::regprocedure,
     $old$if p_action in ('forest_post','forest_edit') and cfg.started_at is not null then$old$,
     $new$if (p_action='forest_post' and cfg.started_at is not null)
    or (p_action='forest_edit' and cfg.started_at is not null and
      (not cfg.forest_edit_open or not private.response_window(cfg.started_at,cfg.event_start_at,now()))) then$new$),
    ('private.forest_action(uuid,text,jsonb)'::regprocedure,
     $old$if cfg.started_at is not null then raise exception '행사가 시작되어 삭제가 마감되었습니다.'$old$,
     $new$if cfg.started_at is not null and (not cfg.forest_edit_open or not private.response_window(cfg.started_at,cfg.event_start_at,now())) then raise exception '행사가 시작되어 삭제가 마감되었습니다.'$new$),
    ('public.portal_before_tree(uuid,text,jsonb)'::regprocedure,
     $old$if p_action='settings' then
    update public.event_public_state set revision=revision+1,updated_at=now() where id;$old$,
     $new$if p_action='settings' then
    update private.settings set forest_edit_open=cfg.started_at is not null
      and coalesce((p->>'event_start_at')::timestamptz>now(),false) where id;
    if cfg.started_at is not null and (p->>'event_start_at')::timestamptz>now() then
      delete from public.forest_tree_notes where id is not null;
      update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false where id;
    end if;
    update public.event_public_state set revision=revision+1,updated_at=now() where id;$new$),
    ('public.portal_before_tree(uuid,text,jsonb)'::regprocedure,
     $old$result:=jsonb_set(result,'{settings,started_at}',coalesce((select to_jsonb(started_at) from private.settings where id),'null'));$old$,
     $new$result:=jsonb_set(result,'{settings,started_at}',coalesce((select to_jsonb(started_at) from private.settings where id),'null'));
    result:=jsonb_set(result,'{settings,forest_edit_open}',(select to_jsonb(forest_edit_open) from private.settings where id));$new$),
    ('private.notify_response_settings()'::regprocedure,
     $old$row(old.event_start_at,old.started_at,old.survey_open,old.nomination_open,old.enabled)$old$,
     $new$row(old.event_start_at,old.started_at,old.survey_open,old.nomination_open,old.enabled,old.forest_edit_open)$new$),
    ('private.notify_response_settings()'::regprocedure,
     $old$row(new.event_start_at,new.started_at,new.survey_open,new.nomination_open,new.enabled)$old$,
     $new$row(new.event_start_at,new.started_at,new.survey_open,new.nomination_open,new.enabled,new.forest_edit_open)$new$)
  ) as edits(target,old_text,new_text) loop
    definition:=replace(pg_get_functiondef(change.target),E'\r\n',E'\n');
    if strpos(definition,change.old_text)=0 then raise exception 'Unexpected function definition for %',change.target; end if;
    execute replace(definition,change.old_text,change.new_text);
  end loop;
end;
$migration$;
