create or replace function public.verify_employee(p_actor uuid,p_name text,p_dob date,p_code text,p_identity text,p_network text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.employees; failures integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_network,0));
  perform pg_advisory_xact_lock(hashtextextended(p_identity,1));
  if not exists(select 1 from auth.users where id=p_actor and is_anonymous) then
    return jsonb_build_object('ok',false);
  end if;
  select count(*) into failures from private.login_attempts where not success and
    identity_key=p_identity and created_at>now()-interval '15 minutes';
  if failures>=5 or (select count(*) from private.login_attempts where network_key=p_network
    and not success and created_at>now()-interval '15 minutes')>=150 then
    return jsonb_build_object('ok',false,'retry_after',900);
  end if;
  select * into e from private.employees where name=trim(p_name) and dob=p_dob and active
    and code_hash=extensions.crypt(p_code,code_hash) limit 1;
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
revoke all on function public.verify_employee(uuid,text,date,text,text,text) from public,anon,authenticated;
grant execute on function public.verify_employee(uuid,text,date,text,text,text) to service_role;

create or replace function private.employee_action(p_actor uuid,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare eid uuid; cfg private.settings; survey_question public.questions; result jsonb; value text;
begin
  select * into cfg from private.settings where id for share;
  select e.id into eid from private.sessions s join private.employees e on s.employee_id=e.id
    where s.auth_user_id=p_actor and e.active;
  if eid is null or not cfg.enabled then raise exception '직원 인증이 필요합니다.' using errcode='42501'; end if;
  case p_action
  when 'bootstrap' then
    update private.sessions set last_seen=now() where auth_user_id=p_actor;
    select jsonb_build_object(
      'self',(select to_jsonb(d) from public.employee_directory d where id=eid),
      'questions',coalesce((select jsonb_agg(q order by sort_order) from public.questions q where active),'[]'),
      'directory',coalesce((select jsonb_agg(d order by name,department) from public.employee_directory d where active),'[]'),
      'survey',(select to_jsonb(s) from public.surveys s where employee_id=eid),
      'nomination',(select to_jsonb(n) from public.nominations n where voter_id=eid),
      'settings',jsonb_build_object('event_start_at',cfg.event_start_at,'deletion_date',cfg.deletion_date,
        'survey_open',cfg.survey_open,'nomination_open',cfg.nomination_open,'welcome',cfg.welcome,'logo_path',cfg.logo_path),
      'state',(select to_jsonb(s) from public.event_public_state s),
      'server_time',now()
    ) into result;
    return result;
  when 'save_survey' then
    if not cfg.survey_open then raise exception '설문이 마감되었습니다.'; end if;
    if jsonb_typeof(p->'answers')<>'object' or jsonb_typeof(p->'consent')<>'boolean'
      or jsonb_typeof(p->'excluded')<>'array' then raise exception '입력 형식 오류'; end if;
    for survey_question in select * from public.questions where active loop
      value:=trim(p->'answers'->>survey_question.id);
      if value is null or length(value) not between 1 and 500 then raise exception '모든 질문에 500자 이내로 답해주세요.'; end if;
    end loop;
    if exists(select 1 from jsonb_each(p->'answers') a where not exists(select 1 from public.questions where id=a.key))
      or exists(select 1 from jsonb_each(p->'answers') a where jsonb_typeof(a.value)<>'string' or length(a.value#>>'{}')>500)
      then raise exception '설문 형식 오류'; end if;
    insert into public.surveys(employee_id,answers,consent,excluded) values(eid,p->'answers',
      (p->>'consent')::boolean,array(select jsonb_array_elements_text(p->'excluded')))
      on conflict(employee_id) do update set answers=excluded.answers,consent=excluded.consent,
        excluded=excluded.excluded,updated_at=now();
    return '{"ok":true}';
  when 'nominate' then
    if not cfg.nomination_open then raise exception '추천이 마감되었습니다.'; end if;
    if not exists(select 1 from private.employees where id=(p->>'nominee_id')::uuid and active)
      then raise exception '추천 대상을 확인해주세요.'; end if;
    insert into public.nominations(voter_id,nominee_id,reason) values(eid,(p->>'nominee_id')::uuid,coalesce(p->>'reason',''))
      on conflict(voter_id) do update set nominee_id=excluded.nominee_id,reason=excluded.reason,updated_at=now();
    delete from private.reason_reviews where voter_id=eid;
    return '{"ok":true}';
  when 'recaps' then
    if cfg.event_start_at is null or now()<cfg.event_start_at or
      not exists(select 1 from public.event_public_state where phase='RECAP') then raise exception '아직 공개 전입니다.'; end if;
    return coalesce((select jsonb_agg(r order by sort_order) from private.recaps r where published),'[]');
  else raise exception '지원하지 않는 동작';
  end case;
end; $$;

create or replace function private.round_eligible(r private.rounds) returns boolean language sql stable
security definer set search_path='' as $$
  select exists(select 1 from public.surveys s join private.employees e on e.id=s.employee_id
   where s.employee_id=r.employee_id and s.consent and e.active
   and not s.excluded && r.question_keys
   and not exists(select 1 from unnest(r.question_keys) k where
     not exists(select 1 from public.questions q where q.id=k and q.active) or coalesce(length(trim(s.answers->>k)),0)=0));
$$;

create or replace function private.awards() returns jsonb language sql stable security definer set search_path='' as $$
 with votes as (
  select n.nominee_id,count(*)::int as votes from public.nominations n
   join private.employees v on v.id=n.voter_id and v.active
   join private.employees e on e.id=n.nominee_id and e.active
   group by n.nominee_id
 ), winners as (select * from votes where votes=(select max(votes) from votes))
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'department',e.department,'votes',w.votes,
  'reasons',coalesce((select jsonb_agg(r.public_text) from private.reason_reviews r
    join public.nominations n on n.voter_id=r.voter_id
    join private.employees v on v.id=n.voter_id and v.active
    where n.nominee_id=e.id and r.approved and length(r.public_text)>0),'[]')) order by e.name),'[]')
 from winners w join private.employees e on e.id=w.nominee_id;
$$;
