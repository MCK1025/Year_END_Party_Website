alter function private.command(uuid,jsonb) rename to command_before_restart;
create function private.command(p_actor uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; s public.event_public_state; result jsonb;
begin
  if p->>'command' is distinct from 'restart_event' then
    return private.command_before_restart(p_actor,p);
  end if;
  select * into cfg from private.settings where id for update;
  if not private.admin(p_actor) or (cfg.require_admin_mfa and coalesce(p->>'_aal','')<>'aal2') then
    raise exception '관리자 권한이 필요합니다.' using errcode='42501';
  end if;
  if coalesce((p->>'rehearsal')::boolean,false) then
    raise exception '한 사람 리허설은 연습 초기화를 이용해주세요.';
  end if;
  if cfg.started_at is null then raise exception '아직 시작하지 않은 행사입니다.'; end if;
  select * into s from public.event_public_state where id for update;
  if (p->>'revision')::int is distinct from s.revision then
    raise exception '다른 조작이 반영되었습니다. 새로고침 후 다시 진행해주세요.' using errcode='PT409';
  end if;
  delete from public.forest_tree_notes where id is not null;
  update public.event_public_state set phase='WAITING',payload='{}',paused=false,tree_open=false,
    revision=revision+1,updated_at=now() where id;
  select to_jsonb(t) into result from public.event_public_state t where id;
  -- A restart is a boundary: undo must not restore the previous completed show.
  insert into private.audit(admin_id,action,before_state,after_state)
    values(p_actor,'restart_event',to_jsonb(s),result);
  return result;
end; $$;
revoke all on function private.command(uuid,jsonb) from public,anon,authenticated;
