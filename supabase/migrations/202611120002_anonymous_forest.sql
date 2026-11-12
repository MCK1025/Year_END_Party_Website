-- No author/user/employee identifier or precise timestamp is stored with a post.
create table public.forest_posts (
  id bigint generated always as identity primary key,
  kind text not null check(kind in ('wish','thanks','regret')),
  body text not null check(length(trim(body)) between 1 and 2000),
  day date not null default (now() at time zone 'Asia/Seoul')::date
);
alter table public.forest_posts enable row level security;
revoke all on public.forest_posts from public,anon,authenticated;
grant select on public.forest_posts to authenticated;
create policy forest_read on public.forest_posts for select to authenticated
  using(public.is_admin() or public.current_employee() is not null);
create table private.forest_limits (
  employee_id uuid not null references private.employees on delete cascade,
  day date not null,
  total integer not null default 0 check(total between 0 and 10),
  primary key(employee_id,day)
);
alter table private.forest_limits enable row level security;
revoke all on private.forest_limits from public,anon,authenticated;

create function private.forest_action(p_actor uuid,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eid uuid; cfg private.settings; today date:=(now() at time zone 'Asia/Seoul')::date; n integer;
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
  case p_action
  when 'forest_list' then
    return coalesce((select jsonb_agg(t order by id desc) from
      (select * from public.forest_posts where p->>'before' is null or id<(p->>'before')::bigint order by id desc limit 20) t),'[]');
  when 'forest_post' then
    if eid is null then raise exception '직원 인증이 필요합니다.' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(eid::text,12));
    insert into private.forest_limits(employee_id,day,total) values(eid,today,0) on conflict do nothing;
    select total into n from private.forest_limits where employee_id=eid and day=today for update;
    if n>=10 then raise exception '오늘은 열 번의 마음을 남겼어요. 내일 다시 들러주세요.'; end if;
    insert into public.forest_posts(kind,body) values(p->>'kind',trim(p->>'body'));
    update private.forest_limits set total=total+1 where employee_id=eid and day=today;
    delete from private.forest_limits where day<today;
  when 'forest_delete' then
    if not private.admin(p_actor) then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
    delete from public.forest_posts where id=(p->>'id')::bigint;
    insert into private.audit(admin_id,action) values(p_actor,'forest_delete');
  else raise exception '지원하지 않는 대나무숲 동작';
  end case;
  return '{"ok":true}';
end; $$;
revoke all on function private.forest_action(uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.portal(p_actor uuid,p_action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_action in ('forest_list','forest_post','forest_delete') then return private.forest_action(p_actor,p_action,p); end if;
  if p_action in ('create_employee','delete_employee','import','employee','reset_code') then
    if not private.admin(p_actor) or ((select require_admin_mfa from private.settings) and coalesce(p->>'_aal','')<>'aal2') then
      raise exception '관리자 권한이 필요합니다.' using errcode='42501';
    end if;
    return private.manage_employees(p_actor,p_action,p);
  end if;
  if p_action='purge_finish' then
    -- The legacy gateway below authorizes before erasing posts/counters.
    perform public.portal_legacy(p_actor,p_action,p);
    delete from public.forest_posts where id is not null;
    delete from private.forest_limits where employee_id is not null;
    return '{"ok":true}';
  end if;
  return public.portal_legacy(p_actor,p_action,p);
end; $$;
revoke all on function public.portal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal(uuid,text,jsonb) to service_role;
