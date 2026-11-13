alter table public.event_public_state add column tree_open boolean not null default false;
create table public.forest_tree_notes (
  id bigint primary key references public.forest_posts on delete cascade,
  kind text not null, body text not null, day date not null
);
alter table public.forest_tree_notes enable row level security;
revoke all on public.forest_tree_notes from public,anon,authenticated;
grant select on public.forest_tree_notes to authenticated;
create policy tree_notes_read on public.forest_tree_notes for select to authenticated using(
  public.is_admin() or (public.current_employee() is not null and public.content_open()
    and exists(select 1 from public.event_public_state where id and tree_open))
);
create function public.owns_forest_post(p_id bigint) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.forest_owners where post_id=p_id and employee_id=public.current_employee());
$$;
revoke all on function public.owns_forest_post(bigint) from public,anon;
grant execute on function public.owns_forest_post(bigint) to authenticated;
drop policy forest_read on public.forest_posts;
create policy forest_read on public.forest_posts for select to authenticated
  using(public.is_admin() or public.owns_forest_post(id));

alter function private.forest_action(uuid,text,jsonb) rename to forest_action_before_tree;
create function private.forest_action(p_actor uuid,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; eid uuid; is_admin boolean:=private.admin(p_actor); notes jsonb; total integer;
begin
  select * into cfg from private.settings where id for share;
  select e.id into eid from private.sessions s join private.employees e on e.id=s.employee_id
    where s.auth_user_id=p_actor and e.active;
  if is_admin and cfg.require_admin_mfa and coalesce(p->>'_aal','')<>'aal2' then
    raise exception '관리자 2단계 인증이 필요합니다.' using errcode='42501';
  end if;
  if not is_admin and (eid is null or not cfg.enabled) then
    raise exception '직원 인증이 필요합니다.' using errcode='42501';
  end if;
  if p_action='forest_list' and not is_admin then
    raise exception '전체 글은 관리자가 트리를 공개한 뒤 확인할 수 있습니다.' using errcode='42501';
  end if;
  if p_action='forest_delete' and not is_admin then
    if cfg.started_at is not null then raise exception '행사가 시작되어 삭제가 마감되었습니다.' using errcode='42501'; end if;
    delete from public.forest_posts f where f.id=(p->>'id')::bigint and exists(
      select 1 from private.forest_owners o where o.post_id=f.id and o.employee_id=eid);
    if not found then raise exception '내가 작성한 글만 삭제할 수 있습니다.' using errcode='42501'; end if;
    return '{"ok":true}';
  end if;
  if p_action='forest_tree' then
    if not is_admin and (not public.content_open() or not exists(select 1 from public.event_public_state where id and tree_open)) then
      raise exception '아직 마음 트리 공개 전입니다.' using errcode='42501';
    end if;
    if is_admin then
      select count(*) into total from public.forest_posts;
      select coalesce(jsonb_agg(t order by id desc),'[]') into notes from
        (select * from public.forest_posts where p->>'before' is null or id<(p->>'before')::bigint order by id desc limit 12) t;
    else
      select count(*) into total from public.forest_tree_notes;
      select coalesce(jsonb_agg(t order by id desc),'[]') into notes from
        (select * from public.forest_tree_notes where p->>'before' is null or id<(p->>'before')::bigint order by id desc limit 12) t;
    end if;
    return jsonb_build_object('notes',notes,'total',total);
  end if;
  return private.forest_action_before_tree(p_actor,p_action,p);
end; $$;

alter function private.command(uuid,jsonb) rename to command_before_tree;
create function private.command(p_actor uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; s jsonb; result jsonb; cmd text:=p->>'command';
begin
  select * into cfg from private.settings where id for update;
  if coalesce((p->>'rehearsal')::boolean,false) then return private.command_before_tree(p_actor,p); end if;
  if cmd in ('tree_open','tree_close') then
    select to_jsonb(t) into s from public.event_public_state t where id for update;
    if (p->>'revision')::int is distinct from (s->>'revision')::int then
      raise exception '다른 조작이 반영되었습니다. 새로고침 후 다시 진행해주세요.' using errcode='PT409';
    end if;
    if cmd='tree_open' then
      if not cfg.enabled or cfg.started_at is null or not public.content_open() then
        raise exception '행사 시작과 행사일 오후 6시 이후에 공개할 수 있습니다.';
      end if;
      if (s->>'paused')::boolean then raise exception '먼저 일시 정지를 해제해주세요.'; end if;
      if not coalesce((p->>'reviewed')::boolean,false) then raise exception '전체 글을 검수한 뒤 공개해주세요.'; end if;
      delete from public.forest_tree_notes where id is not null;
      insert into public.forest_tree_notes select id,kind,body,day from public.forest_posts;
    else delete from public.forest_tree_notes where id is not null;
    end if;
    update public.event_public_state set tree_open=(cmd='tree_open'),revision=revision+1,updated_at=now() where id;
    select to_jsonb(t) into result from public.event_public_state t where id;
    insert into private.audit(admin_id,action,before_state,after_state) values(p_actor,'command:'||cmd,s,result);
    return result;
  end if;
  if cmd not in ('pause','resume') then
    update public.event_public_state set tree_open=false where id and tree_open;
    delete from public.forest_tree_notes where id is not null;
  end if;
  return private.command_before_tree(p_actor,p);
end; $$;

create function private.close_tree_on_settings() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not new.enabled or old.event_start_at is distinct from new.event_start_at then
    update public.event_public_state set tree_open=false,revision=revision+1,updated_at=now() where id and tree_open;
    delete from public.forest_tree_notes where id is not null;
  end if;
  return new;
end; $$;
create trigger close_tree_settings after update on private.settings for each row execute function private.close_tree_on_settings();
create function private.forest_deleted() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.event_public_state set revision=revision+1,updated_at=now() where id and tree_open;
  return old;
end; $$;
create trigger forest_deleted after delete on public.forest_posts for each row execute function private.forest_deleted();

alter function public.portal(uuid,text,jsonb) rename to portal_before_tree;
revoke all on function public.portal_before_tree(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.portal(p_actor uuid,p_action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_action='nominate' and coalesce(char_length(btrim(p->>'reason')),0) not between 10 and 300 then
    raise exception '추천 이유를 10자 이상 300자 이하로 작성해주세요.' using errcode='22023';
  end if;
  if p_action='forest_tree' then return private.forest_action(p_actor,p_action,p); end if;
  return public.portal_before_tree(p_actor,p_action,p);
end; $$;
revoke all on function public.portal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal(uuid,text,jsonb) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
