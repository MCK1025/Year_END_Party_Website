create function private.progress(s jsonb,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare phase text:=s->>'phase'; body jsonb:=s->'payload'; r private.rounds;
  hints_count integer; idx integer; next_phase text; taste private.tastes;
begin
  if (s->>'paused')::boolean and p_action not in ('resume','waiting') then raise exception '먼저 일시 정지를 해제해주세요.'; end if;
  case p_action
  when 'pause' then s:=jsonb_set(s,'{paused}','true');
  when 'resume' then s:=jsonb_set(s,'{paused}','false');
  when 'waiting' then s:=s||'{"phase":"WAITING","payload":{},"paused":false}';
  when 'phase' then
    next_phase:=p->>'phase';
    if not ((phase in ('PRE_SURVEY','WAITING') and next_phase='RECAP') or
      (phase='RECAP' and next_phase='WHO_AM_I') or (phase='WHO_AM_I' and next_phase='TASTES') or
      (phase='TASTES' and next_phase='AWARDS') or (phase='AWARDS' and next_phase='END'))
      then raise exception '현재 단계의 다음 순서로만 이동할 수 있습니다.'; end if;
    body:='{}';
    if next_phase='AWARDS' then body:=jsonb_build_object('winners',private.awards()); end if;
    if next_phase='END' then body:=jsonb_build_object('message',(select ending from private.settings)); end if;
    s:=s||jsonb_build_object('phase',next_phase,'payload',body);
  when 'start_person','next_person','restart_person' then
    if phase<>'WHO_AM_I' then raise exception '인물 맞히기 단계에서 진행해주세요.'; end if;
    if p_action='next_person' then
      if body->'person' is null or body->'person'='null' then raise exception '먼저 정답을 공개해주세요.'; end if;
      idx:=coalesce((body->>'round_index')::int,0)+1;
    elsif p_action='restart_person' then idx:=coalesce((body->>'round_index')::int,1);
    else
      select row_number into idx from (
        select id,row_number() over(order by sort_order,id)::int from private.rounds x where approved and private.round_eligible(x)
      ) x where id=(p->>'round_id')::uuid;
    end if;
    if idx is null then raise exception '승인된 인물을 선택해주세요.'; end if;
    select * into r from private.rounds x where approved and private.round_eligible(x) order by sort_order,id offset (idx-1) limit 1;
    if r.id is null then raise exception '다음 인물이 없습니다.'; end if;
    s:=jsonb_set(s,'{payload}',jsonb_build_object('round_id',r.id,'round_index',idx,'hints','[]'::jsonb,'person',null));
  when 'hint','reveal' then
    if phase<>'WHO_AM_I' then raise exception '인물 맞히기 단계에서 진행해주세요.'; end if;
    select * into r from private.rounds where id=(body->>'round_id')::uuid;
    if r.id is null or not r.approved or not private.round_eligible(r) then raise exception '동의 및 검수를 다시 확인해주세요.'; end if;
    if body->'person'<>'null'::jsonb then raise exception '이미 정답을 공개했습니다.'; end if;
    if p_action='hint' then
      hints_count:=jsonb_array_length(body->'hints')+1;
      if hints_count>cardinality(r.hints) then raise exception '모든 힌트를 공개했습니다.'; end if;
      body:=jsonb_set(body,'{hints}',to_jsonb(r.hints[1:hints_count]));
    else
      if jsonb_array_length(body->'hints')=0 then raise exception '힌트를 먼저 공개해주세요.'; end if;
      body:=jsonb_set(body,'{person}',(select jsonb_build_object('name',name,'department',department) from private.employees where id=r.employee_id));
    end if;
    s:=jsonb_set(s,'{payload}',body);
  when 'taste_question','taste_reveal' then
    if phase<>'TASTES' then raise exception '취향 발견 단계에서 진행해주세요.'; end if;
    select * into taste from private.tastes where id=(case when p_action='taste_question' then p->>'taste_id' else body->>'taste_id' end)::uuid and approved;
    if taste.id is null then raise exception '승인된 통계를 선택해주세요.'; end if;
    if p_action='taste_question' then body:=jsonb_build_object('taste_id',taste.id,'question',taste.prompt);
    else body:=body||jsonb_build_object('results',taste.results); end if;
    s:=jsonb_set(s,'{payload}',body);
  else raise exception '지원하지 않는 진행 동작';
  end case;
  return s||jsonb_build_object('revision',(s->>'revision')::int+1,'updated_at',now());
end; $$;

create function private.command(p_actor uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; s jsonb; result jsonb; rehearsal boolean:=coalesce((p->>'rehearsal')::boolean,false);
  cmd text:=p->>'command'; before_s jsonb;
begin
  select * into cfg from private.settings where id for update;
  if rehearsal then
    select state into s from private.rehearsals where admin_id=p_actor for update;
    s:=coalesce(s,'{"phase":"WHO_AM_I","payload":{},"paused":false,"revision":0}');
    if cmd not in ('start_person','hint','reveal','restart_person','waiting','pause','resume') then raise exception '리허설은 인물 한 명만 진행할 수 있습니다.'; end if;
    if cmd='waiting' then s:=s||'{"phase":"WHO_AM_I","payload":{},"paused":false}'; end if;
  else
    select to_jsonb(t) into s from public.event_public_state t where id for update;
    if not cfg.enabled then raise exception '행사가 비활성화되어 있습니다.'; end if;
    if cmd not in ('waiting','pause','resume','undo') and (cfg.event_start_at is null or now()<cfg.event_start_at)
      then raise exception '행사일 오후 6시 이후에 공개할 수 있습니다.'; end if;
    if cmd='phase' and p->>'phase'='AWARDS' and cfg.nomination_open then raise exception '추천을 마감한 뒤 시상식을 공개해주세요.'; end if;
  end if;
  if (p->>'revision')::int is distinct from (s->>'revision')::int then raise exception '다른 조작이 반영되었습니다. 새로고침 후 다시 진행해주세요.' using errcode='40001'; end if;
  before_s:=s;
  if cmd='undo' then
    select before_state into result from private.audit where action like 'command:%' and
      (after_state->>'revision')::int=(s->>'revision')::int order by id desc limit 1;
    if result is null then raise exception '되돌릴 진행이 없습니다.'; end if;
    if result->>'phase' not in ('WAITING','PRE_SURVEY') and (cfg.event_start_at is null or now()<cfg.event_start_at) then raise exception '공개 시각 전입니다.'; end if;
    result:=result||jsonb_build_object('revision',(s->>'revision')::int+1,'updated_at',now());
  elsif rehearsal and cmd='waiting' then result:=s||jsonb_build_object('revision',(s->>'revision')::int+1);
  else result:=private.progress(s,cmd,p); end if;
  if rehearsal then
    insert into private.rehearsals values(p_actor,result) on conflict(admin_id) do update set state=excluded.state;
  else
    update public.event_public_state set phase=result->>'phase',payload=result->'payload',paused=(result->>'paused')::boolean,
      revision=(result->>'revision')::int,updated_at=now() where id;
    insert into private.audit(admin_id,action,before_state,after_state) values(p_actor,'command:'||cmd,before_s,result);
  end if;
  return result;
end; $$;
