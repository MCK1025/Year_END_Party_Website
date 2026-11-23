alter table private.settings add column forest_multiple boolean not null default false;

-- Keep the quota check inside the same per-employee lock as the insert. Two
-- sessions for the same employee share this lock. Pre-existing posts count too.
do $migration$
declare change record; definition text;
begin
  for change in select * from (values
    ('private.forest_action_before_tree(uuid,text,jsonb)'::regprocedure,
     $old$perform pg_advisory_xact_lock(hashtextextended(eid::text,12));$old$,
     $new$perform pg_advisory_xact_lock(hashtextextended(eid::text,12));
    if not cfg.forest_multiple and exists(select 1 from private.forest_owners where employee_id=eid) then
      raise exception '이미 마음을 남겼습니다. 내가 보낸 마음에서 글을 확인해주세요.' using errcode='PT409';
    end if;$new$),
    ('private.employee_action(uuid,text,jsonb)'::regprocedure,
     $old$'survey_open',cfg.survey_open,$old$,
     $new$'forest_multiple',cfg.forest_multiple,'survey_open',cfg.survey_open,$new$),
    -- This branch runs after the gateway's administrator and MFA checks.
    -- Changing the message quota must not run the schedule-reopening action.
    ('public.portal_legacy(uuid,text,jsonb)'::regprocedure,
     $old$when 'dashboard' then return private.dashboard(p_actor);$old$,
     $new$when 'dashboard' then return private.dashboard(p_actor);
  when 'forest_policy' then
    if jsonb_typeof(p->'multiple') is distinct from 'boolean' then
      raise exception '여러 메시지 작성 여부를 선택해주세요.';
    end if;
    update private.settings set forest_multiple=(p->>'multiple')::boolean
      where id and forest_multiple is distinct from (p->>'multiple')::boolean;
    if found then
      update public.event_public_state set settings_revision=settings_revision+1,updated_at=now() where id;
      insert into private.audit(admin_id,action) values(p_actor,'forest_policy');
    end if;
    return '{"ok":true}';$new$)
  ) as edits(target,old_text,new_text) loop
    definition:=replace(pg_get_functiondef(change.target),E'\r\n',E'\n');
    if strpos(definition,change.old_text)=0 then raise exception 'Unexpected definition for %',change.target; end if;
    execute replace(definition,change.old_text,change.new_text);
  end loop;
end;
$migration$;
