-- Ownership stays private; public posts and administrative responses contain no author fields.
create table private.forest_owners (
  post_id bigint primary key references public.forest_posts on delete cascade,
  employee_id uuid not null references private.employees on delete cascade
);
create index forest_owners_employee on private.forest_owners(employee_id,post_id desc);
alter table private.forest_owners enable row level security;
revoke all on private.forest_owners from public,anon,authenticated;

alter table private.settings add column started_at timestamptz;
alter table public.event_public_state add column editing_locked boolean not null default false;
update private.settings set started_at=now(),survey_open=false,nomination_open=false
where id and exists(select 1 from public.event_public_state where phase not in ('WAITING','PRE_SURVEY'));
update public.event_public_state set editing_locked=(select started_at is not null from private.settings);

create function private.sync_edit_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.editing_locked:=(select started_at is not null from private.settings where id);
  return new;
end; $$;
create trigger sync_edit_lock before update on public.event_public_state
for each row execute function private.sync_edit_lock();

alter function private.command(uuid,jsonb) rename to command_before_edit_lock;
create function private.command(p_actor uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; s jsonb; result jsonb;
begin
  select * into cfg from private.settings where id for update;
  if coalesce((p->>'rehearsal')::boolean,false) then
    return private.command_before_edit_lock(p_actor,p);
  end if;
  if p->>'command'='start_event' then
    if not cfg.enabled then raise exception '행사가 비활성화되어 있습니다.'; end if;
    select to_jsonb(t) into s from public.event_public_state t where id for update;
    if (p->>'revision')::int is distinct from (s->>'revision')::int then
      raise exception '다른 조작이 반영되었습니다. 새로고침 후 다시 진행해주세요.' using errcode='PT409';
    end if;
    if cfg.started_at is not null then raise exception '이미 행사가 시작되었습니다.'; end if;
    update private.settings set started_at=now(),survey_open=false,nomination_open=false where id;
    update public.event_public_state set revision=revision+1,updated_at=now() where id;
    select to_jsonb(t) into result from public.event_public_state t where id;
    insert into private.audit(admin_id,action,before_state,after_state)
      values(p_actor,'command:start_event',s,result);
    return result;
  end if;
  -- Older clients also close submissions on their first successful content transition.
  if p->>'command'='phase' and p->>'phase' not in ('WAITING','PRE_SURVEY') and cfg.started_at is null then
    update private.settings set started_at=now(),survey_open=false,nomination_open=false where id;
  end if;
  perform private.command_before_edit_lock(p_actor,p);
  return (select to_jsonb(t) from public.event_public_state t where id);
end; $$;

create or replace function private.forest_action(p_actor uuid,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eid uuid; cfg private.settings; today date:=(now() at time zone 'Asia/Seoul')::date;
  n integer; post bigint;
begin
  select * into cfg from private.settings where id for share;
  select e.id into eid from private.sessions s join private.employees e on e.id=s.employee_id
    where s.auth_user_id=p_actor and e.active;
  if not private.admin(p_actor) and (eid is null or not cfg.enabled) then
    raise exception '직원 인증이 필요합니다.' using errcode='42501';
  end if;
  if private.admin(p_actor) and cfg.require_admin_mfa and coalesce(p->>'_aal','')<>'aal2' then
    raise exception '관리자 2단계 인증이 필요합니다.' using errcode='42501';
  end if;
  if p_action in ('forest_post','forest_edit') and cfg.started_at is not null then
    raise exception '행사가 시작되어 작성과 수정이 마감되었습니다.' using errcode='42501';
  end if;
  case p_action
  when 'forest_list' then
    return coalesce((select jsonb_agg(t order by id desc) from
      (select * from public.forest_posts where p->>'before' is null or id<(p->>'before')::bigint order by id desc limit 20) t),'[]');
  when 'forest_mine' then
    if eid is null then raise exception '직원 인증이 필요합니다.' using errcode='42501'; end if;
    return coalesce((select jsonb_agg(t order by id desc) from
      (select f.* from public.forest_posts f join private.forest_owners o on o.post_id=f.id
       where o.employee_id=eid and (p->>'before' is null or f.id<(p->>'before')::bigint)
       order by f.id desc limit 20) t),'[]');
  when 'forest_post' then
    if eid is null then raise exception '직원 인증이 필요합니다.' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(eid::text,12));
    insert into private.forest_limits(employee_id,day,total) values(eid,today,0) on conflict do nothing;
    select total into n from private.forest_limits where employee_id=eid and day=today for update;
    if n>=10 then raise exception '오늘은 열 번의 마음을 남겼어요. 내일 다시 들러주세요.'; end if;
    insert into public.forest_posts(kind,body) values(p->>'kind',trim(p->>'body')) returning id into post;
    insert into private.forest_owners values(post,eid);
    update private.forest_limits set total=total+1 where employee_id=eid and day=today;
    delete from private.forest_limits where day<today;
  when 'forest_edit' then
    if eid is null then raise exception '직원 인증이 필요합니다.' using errcode='42501'; end if;
    update public.forest_posts f set kind=p->>'kind',body=trim(p->>'body')
      where f.id=(p->>'id')::bigint and exists(
        select 1 from private.forest_owners o where o.post_id=f.id and o.employee_id=eid);
    if not found then raise exception '내가 작성한 글만 수정할 수 있습니다.' using errcode='42501'; end if;
  when 'forest_delete' then
    if not private.admin(p_actor) then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
    delete from public.forest_posts where id=(p->>'id')::bigint;
    insert into private.audit(admin_id,action) values(p_actor,'forest_delete');
  else raise exception '지원하지 않는 대나무숲 동작';
  end case;
  return '{"ok":true}';
end; $$;

create or replace function public.portal(p_actor uuid,p_action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; result jsonb;
begin
  if p_action in ('forest_list','forest_mine','forest_post','forest_edit','forest_delete') then
    return private.forest_action(p_actor,p_action,p);
  end if;
  if p_action in ('save_survey','nominate') then
    select * into cfg from private.settings where id for share;
    if cfg.started_at is not null then
      raise exception '행사가 시작되어 작성과 수정이 마감되었습니다.' using errcode='42501';
    end if;
  end if;
  if p_action='settings' then
    select * into cfg from private.settings where id for update;
    if cfg.started_at is not null and ((p->>'survey_open')::boolean or (p->>'nomination_open')::boolean) then
      raise exception '행사 시작 후에는 응답을 다시 열 수 없습니다.' using errcode='42501';
    end if;
  end if;
  if p_action in ('create_employee','delete_employee','import','employee','reset_code') then
    if not private.admin(p_actor) or ((select require_admin_mfa from private.settings) and coalesce(p->>'_aal','')<>'aal2') then
      raise exception '관리자 권한이 필요합니다.' using errcode='42501';
    end if;
    return private.manage_employees(p_actor,p_action,p);
  end if;
  if p_action='purge_finish' then
    perform public.portal_legacy(p_actor,p_action,p);
    delete from public.forest_posts where id is not null;
    delete from private.forest_limits where employee_id is not null;
    return '{"ok":true}';
  end if;
  result:=public.portal_legacy(p_actor,p_action,p);
  if p_action='bootstrap' then
    result:=jsonb_set(result,'{settings,started_at}',coalesce((select to_jsonb(started_at) from private.settings where id),'null'));
  end if;
  return result;
end; $$;
revoke all on function public.portal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal(uuid,text,jsonb) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
