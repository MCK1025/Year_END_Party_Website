create function private.admin_employees(p_actor uuid,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row jsonb; eid uuid; issued jsonb:='[]';
begin
  perform 1 from private.settings where id for update;
  case p_action
  when 'import' then
    if jsonb_array_length(p->'employees') not between 1 and 100 then raise exception '한 번에 1~100명만 등록해주세요.'; end if;
    for row in select * from jsonb_array_elements(p->'employees') loop
      select id into eid from private.employees where employee_no=row->>'employee_no';
      if eid is null then
        insert into private.employees(employee_no,name,department,dob,code_hash) values(row->>'employee_no',row->>'name',row->>'department',
          (row->>'date_of_birth')::date,extensions.crypt(row->>'access_code',extensions.gen_salt('bf',10))) returning id into eid;
        issued:=issued||jsonb_build_array(jsonb_build_object('employee_no',row->>'employee_no','name',row->>'name','access_code',row->>'access_code'));
      else
        if exists(select 1 from private.employees where id=eid and (name<>row->>'name' or dob<>(row->>'date_of_birth')::date)) then
          delete from private.sessions where employee_id=eid;
        end if;
        update private.employees set name=row->>'name',department=row->>'department',dob=(row->>'date_of_birth')::date where id=eid;
      end if;
      insert into public.employee_directory(id,name,department,active) select id,name,department,active from private.employees where id=eid
        on conflict(id) do update set name=excluded.name,department=excluded.department,active=excluded.active;
    end loop;
  when 'reset_code' then
    eid:=(p->>'id')::uuid;
    update private.employees set code_hash=extensions.crypt(p->>'access_code',extensions.gen_salt('bf',10)) where id=eid;
    if not found then raise exception '직원을 찾을 수 없습니다.'; end if;
    delete from private.sessions where employee_id=eid;
    select jsonb_build_array(jsonb_build_object('employee_no',employee_no,'name',name,'access_code',p->>'access_code')) into issued from private.employees where id=eid;
  when 'employee' then
    eid:=(p->>'id')::uuid;
    update private.employees set name=p->>'name',department=p->>'department',active=(p->>'active')::boolean where id=eid;
    update public.employee_directory set name=p->>'name',department=p->>'department',active=(p->>'active')::boolean where id=eid;
    if not (p->>'active')::boolean then delete from private.sessions where employee_id=eid; end if;
  else raise exception '지원하지 않는 직원 동작';
  end case;
  insert into private.audit(admin_id,action) values(p_actor,p_action);
  return jsonb_build_object('ok',true,'issued',issued);
end; $$;

create or replace function public.portal(p_actor uuid,p_action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if p_action in ('bootstrap','save_survey','nominate','recaps') then return private.employee_action(p_actor,p_action,p); end if;
  if not private.admin(p_actor) then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  if (select require_admin_mfa from private.settings) and
    coalesce(p->>'_aal','')<>'aal2' then raise exception '관리자 2단계 인증이 필요합니다.' using errcode='42501'; end if;
  case p_action
  when 'dashboard' then return private.dashboard(p_actor);
  when 'command' then return private.command(p_actor,p);
  when 'import','reset_code','employee' then return private.admin_employees(p_actor,p_action,p);
  when 'settings','question','round','delete_round','taste','recap','delete_recap','logo','review_reason' then return private.admin_content(p_actor,p_action,p);
  when 'export' then
    insert into private.audit(admin_id,action) values(p_actor,'export');
    return jsonb_build_object('employees',(select jsonb_agg(jsonb_build_object('id',id,'employee_no',employee_no,'name',name,'department',department)) from private.employees),
      'surveys',coalesce((select jsonb_agg(s) from public.surveys s),'[]'),'nominations',coalesce((select jsonb_agg(n) from public.nominations n),'[]'),
      'winners',private.awards());
  when 'purge_begin' then
    update private.settings set enabled=false where id;
    update public.event_public_state set phase='WAITING',payload='{}',revision=revision+1,updated_at=now() where id;
    return '{"ok":true}';
  when 'purge_finish' then
    if (select enabled from private.settings) then raise exception '공개를 중단한 뒤 삭제해주세요.'; end if;
    delete from private.rehearsals where admin_id is not null; delete from private.rounds where id is not null; delete from private.tastes where id is not null; delete from private.recaps where id is not null;
    delete from private.employees where id is not null; delete from private.login_attempts where id is not null; delete from private.audit where id is not null;
    update private.settings set logo_path=null,welcome='행사가 종료되었습니다.',ending='감사합니다.',event_start_at=null,deletion_date=null,
      survey_open=false,nomination_open=false where id;
    insert into private.audit(admin_id,action) values(p_actor,'purge_complete');
    return '{"ok":true}';
  else raise exception '지원하지 않는 동작'; end case;
end; $$;
revoke all on function public.portal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal(uuid,text,jsonb) to service_role;

create function public.can_read_media(p_path text) returns boolean language sql stable security definer set search_path='' as $$
  select public.is_admin() or (public.current_employee() is not null and (
    p_path=(select logo_path from private.settings) or
    (public.content_open() and exists(select 1 from public.event_public_state where phase='RECAP')
     and exists(select 1 from private.recaps where asset_path=p_path and published))
  ));
$$;
revoke all on function public.can_read_media(text) from public,anon;
grant execute on function public.can_read_media(text) to authenticated;
drop policy media_read on storage.objects;
create policy media_read on storage.objects for select to authenticated
  using(bucket_id='event-media' and public.can_read_media(name));

create or replace function private.invalidate_survey() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.answers is distinct from new.answers or old.consent is distinct from new.consent or old.excluded is distinct from new.excluded then
    update private.rounds set approved=false where employee_id=new.employee_id;
    update private.tastes set approved=false where approved;
    update public.event_public_state set payload='{}',revision=revision+1,updated_at=now()
      where payload->>'round_id' in (select id::text from private.rounds where employee_id=new.employee_id)
      or phase='TASTES';
  end if;
  return new;
end; $$;
create trigger survey_changed after update on public.surveys for each row execute function private.invalidate_survey();

create function private.invalidate_questions() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update private.rounds set approved=false where old.id=any(question_keys);
  update private.tastes set approved=false where question_id=old.id;
  return new;
end; $$;
create trigger questions_changed after update on public.questions for each row execute function private.invalidate_questions();

revoke all on all functions in schema private from public,anon,authenticated;
alter default privileges in schema private revoke execute on functions from public;
