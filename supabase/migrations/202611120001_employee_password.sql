-- Birthday passwords stay private; active employees must have distinct YYMMDD values.
alter table private.employees add column login_key text;
update private.employees set login_key=to_char(dob,'YYMMDD'),
  code_hash=extensions.crypt(to_char(dob,'YYMMDD'),extensions.gen_salt('bf',10));
alter table private.employees alter column login_key set not null;
create unique index employee_birthday_unique on private.employees(login_key) where active;

create function private.birthday_password() returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.login_key:=to_char(new.dob,'YYMMDD');
  if tg_op='INSERT' or new.dob is distinct from old.dob then
    new.code_hash:=extensions.crypt(new.login_key,extensions.gen_salt('bf',10));
  end if;
  return new;
end; $$;
revoke all on function private.birthday_password() from public,anon,authenticated;
create trigger birthday_password before insert or update on private.employees
  for each row execute function private.birthday_password();

drop function public.verify_employee(uuid,text,date,text,text,text);
create function public.verify_employee(p_actor uuid,p_password text,p_identity text,p_network text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.employees; failures integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_network,0));
  perform pg_advisory_xact_lock(hashtextextended(p_identity,1));
  if p_password !~ '^[0-9]{6}$' or not exists(select 1 from auth.users where id=p_actor and is_anonymous) then
    return jsonb_build_object('ok',false);
  end if;
  select count(*) into failures from private.login_attempts where not success and
    identity_key=p_identity and created_at>now()-interval '15 minutes';
  if failures>=5 or (select count(*) from private.login_attempts where network_key=p_network
    and not success and created_at>now()-interval '15 minutes')>=150 then
    return jsonb_build_object('ok',false,'retry_after',900);
  end if;
  select * into e from private.employees where login_key=p_password and active
    and code_hash=extensions.crypt(p_password,code_hash);
  insert into private.login_attempts(identity_key,network_key,success) values(p_identity,p_network,e.id is not null);
  if e.id is null or not (select enabled from private.settings) then
    perform pg_sleep(0.25); return jsonb_build_object('ok',false);
  end if;
  if exists(select 1 from private.sessions where auth_user_id=p_actor and employee_id<>e.id) then
    return jsonb_build_object('ok',false);
  end if;
  insert into private.sessions(auth_user_id,employee_id) values(p_actor,e.id)
    on conflict(auth_user_id) do update set verified_at=now(),last_seen=now();
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.verify_employee(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.verify_employee(uuid,text,text,text) to service_role;

-- Prevent deleted employees from remaining in published or undo/rehearsal snapshots.
create function private.employee_deleted() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from private.settings where id for update;
  update public.event_public_state set phase='WAITING',payload='{}',paused=false,revision=revision+1,updated_at=now() where id;
  update private.tastes set results='[]',approved=false where id is not null;
  delete from private.rehearsals where admin_id is not null;
  update private.audit set before_state=null,after_state=null where id is not null;
  return old;
end; $$;
revoke all on function private.employee_deleted() from public,anon,authenticated;
create trigger employee_deleted before delete on private.employees
  for each row execute function private.employee_deleted();

create function private.manage_employees(p_actor uuid,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row jsonb; eid uuid;
begin
  perform 1 from private.settings where id for update;
  case p_action
  when 'create_employee','import' then
    for row in select * from jsonb_array_elements(case when p_action='import' then p->'employees' else jsonb_build_array(p) end) loop
      eid:=null;
      if p_action='import' then
        select id into eid from private.employees where employee_no=row->>'employee_no';
      end if;
      if eid is null then
        insert into private.employees(employee_no,name,department,dob,code_hash)
          values(row->>'employee_no',row->>'name',row->>'department',(row->>'date_of_birth')::date,'') returning id into eid;
      else
        update private.employees set name=row->>'name',department=row->>'department',dob=(row->>'date_of_birth')::date where id=eid;
      end if;
      insert into public.employee_directory(id,name,department,active) select id,name,department,active from private.employees where id=eid
        on conflict(id) do update set name=excluded.name,department=excluded.department,active=excluded.active;
    end loop;
  when 'delete_employee' then
    delete from private.employees where id=(p->>'id')::uuid;
    if not found then raise exception '직원을 찾을 수 없습니다.'; end if;
  when 'employee' then
    return private.admin_employees(p_actor,p_action,p);
  else raise exception '지원하지 않는 직원 동작';
  end case;
  insert into private.audit(admin_id,action) values(p_actor,p_action);
  return '{"ok":true,"issued":[]}';
exception when unique_violation then
  raise exception '사번 또는 생년월일 6자리가 중복됩니다. 다른 직원의 정보와 겹치는지 확인해주세요.';
end; $$;
revoke all on function private.manage_employees(uuid,text,jsonb) from public,anon,authenticated;

alter function public.portal(uuid,text,jsonb) rename to portal_legacy;
revoke all on function public.portal_legacy(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.portal(p_actor uuid,p_action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_action in ('create_employee','delete_employee','import','employee','reset_code') then
    if not private.admin(p_actor) or ((select require_admin_mfa from private.settings) and coalesce(p->>'_aal','')<>'aal2') then
      raise exception '관리자 권한이 필요합니다.' using errcode='42501';
    end if;
    return private.manage_employees(p_actor,p_action,p);
  end if;
  return public.portal_legacy(p_actor,p_action,p);
end; $$;
revoke all on function public.portal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal(uuid,text,jsonb) to service_role;
