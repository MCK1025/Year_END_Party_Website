alter table public.event_public_state drop constraint event_public_state_phase_check;
alter table public.event_public_state add constraint event_public_state_phase_check
  check(phase in ('PRE_SURVEY','WAITING','RECAP','WHO_AM_I','TASTES','AWARDS','END','COMPLETED'));

-- Approvals reference the original survey. Employee clients never read this table.
create table private.card_reviews (
  employee_id uuid primary key references public.surveys(employee_id) on delete cascade,
  question_keys text[] not null check(cardinality(question_keys) between 1 and 30),
  reviewed_at timestamptz not null default now()
);
alter table private.card_reviews enable row level security;
revoke all on private.card_reviews from public,anon,authenticated;
create trigger history_barrier after insert or update or delete on private.card_reviews
  for each statement execute function private.content_history_barrier();

create function private.invalidate_card_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='surveys' then
    if old.answers is distinct from new.answers or old.consent is distinct from new.consent
      or old.excluded is distinct from new.excluded then
      delete from private.card_reviews where employee_id=old.employee_id;
    end if;
  else
    delete from private.card_reviews where old.id=any(question_keys);
  end if;
  return null;
end; $$;
create trigger invalidate_card_review after update on public.surveys
  for each row execute function private.invalidate_card_review();
create trigger invalidate_card_review after update or delete on public.questions
  for each row execute function private.invalidate_card_review();

alter function private.command(uuid,jsonb) rename to command_before_completion;
create function private.command(p_actor uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; s public.event_public_state; result jsonb; cmd text:=p->>'command';
begin
  select * into cfg from private.settings where id for update;
  if not private.admin(p_actor) or (cfg.require_admin_mfa and coalesce(p->>'_aal','')<>'aal2') then
    raise exception '관리자 권한이 필요합니다.' using errcode='42501';
  end if;
  if coalesce((p->>'rehearsal')::boolean,false) then
    if cmd='complete_event' or p->>'phase'='COMPLETED' then
      raise exception '자유 관람은 공식 행사 종료에서 시작해주세요.';
    end if;
    return private.command_before_completion(p_actor,p);
  end if;
  select * into s from public.event_public_state where id for update;
  if (p->>'revision')::int is distinct from s.revision then
    raise exception '다른 조작이 반영되었습니다. 새로고침 후 다시 진행해주세요.' using errcode='PT409';
  end if;
  if s.phase='COMPLETED' and cmd not in ('tree_open','tree_close') then
    raise exception '자유 관람이 시작되어 공식 진행을 변경할 수 없습니다.' using errcode='PT409';
  end if;
  if cmd='complete_event' then
    if not cfg.enabled or cfg.started_at is null or not public.content_open() then
      raise exception '행사를 시작하고 설정한 시작 시각이 지나면 종료할 수 있습니다.';
    end if;
    if s.phase not in ('AWARDS','END') or s.paused then
      raise exception '시상식 또는 엔딩 진행을 마친 뒤 종료해주세요.';
    end if;
    if not coalesce((p->>'reviewed')::boolean,false) then
      raise exception '이야기 트리 전체 글을 검수한 뒤 공개해주세요.';
    end if;
    delete from public.forest_tree_notes where id is not null;
    insert into public.forest_tree_notes select id,kind,body,day from public.forest_posts;
    update public.event_public_state set phase='COMPLETED',paused=false,tree_open=true,
      payload=jsonb_build_object('message',cfg.ending),revision=revision+1,updated_at=now() where id;
    select to_jsonb(t) into result from public.event_public_state t where id;
    insert into private.audit(admin_id,action,before_state,after_state)
      values(p_actor,'command:complete_event',to_jsonb(s),result);
    return result;
  end if;
  if p->>'phase'='COMPLETED' then
    raise exception '행사 종료 및 자유 관람 시작 버튼을 이용해주세요.';
  end if;
  return private.command_before_completion(p_actor,p);
end; $$;

-- Reuse the service-role-only gateway and keep raw survey RLS unchanged.
alter function public.portal(uuid,text,jsonb) rename to portal_before_completion;
revoke all on function public.portal_before_completion(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.portal(p_actor uuid,p_action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg private.settings; s public.event_public_state; result jsonb; keys text[]; survey public.surveys;
begin
  if p_action in ('taste_cards','review_card') then
    select * into cfg from private.settings where id for share;
    if p_action='taste_cards' then
      select * into s from public.event_public_state where id for share;
      if not cfg.enabled or not public.content_open() or s.phase<>'COMPLETED' or not exists(
        select 1 from private.sessions se join private.employees e on e.id=se.employee_id
        where se.auth_user_id=p_actor and e.active
      ) then
        raise exception '직원 인증 후 행사 종료부터 취향 카드를 볼 수 있습니다.' using errcode='42501';
      end if;
      select coalesce(jsonb_agg(card order by name,department,id),'[]') into result from (
        select e.id,e.name,e.department,
          jsonb_build_object('id',e.id,'name',e.name,'department',e.department,'answers',a.items) card
        from private.employees e
        join public.surveys v on v.employee_id=e.id and v.consent
        join private.card_reviews r on r.employee_id=e.id
        cross join lateral (
          select jsonb_agg(jsonb_build_object('id',q.id,'question',q.prompt,'answer',v.answers->>q.id)
            order by q.sort_order,q.id) items
          from public.questions q where q.active and q.id=any(r.question_keys)
            and not (q.id=any(v.excluded)) and jsonb_typeof(v.answers->q.id)='string'
            and length(btrim(v.answers->>q.id))>0
        ) a where e.active and a.items is not null
      ) cards;
      return jsonb_build_object('revision',s.revision,'cards',result);
    end if;
    if not private.admin(p_actor) or (cfg.require_admin_mfa and coalesce(p->>'_aal','')<>'aal2') then
      raise exception '관리자 권한이 필요합니다.' using errcode='42501';
    end if;
    select * into s from public.event_public_state where id for update;
    if (p->>'revision')::int is distinct from s.revision then
      raise exception '답변 또는 공개 상태가 바뀌었습니다. 새로고침 후 다시 검수해주세요.' using errcode='PT409';
    end if;
    if jsonb_typeof(p->'question_keys') is distinct from 'array' then
      raise exception '공개할 질문을 확인해주세요.' using errcode='22023';
    end if;
    select array_agg(distinct k) into keys from jsonb_array_elements_text(p->'question_keys') k;
    keys:=coalesce(keys,'{}');
    if cardinality(keys)>30 then raise exception '공개할 질문을 확인해주세요.'; end if;
    select * into survey from public.surveys where employee_id=(p->>'employee_id')::uuid for share;
    if cardinality(keys)>0 then
      if survey.employee_id is null or not survey.consent or not exists(
        select 1 from private.employees where id=survey.employee_id and active
      ) then raise exception '공개에 동의한 활성 직원의 답변만 승인할 수 있습니다.'; end if;
      if exists(select 1 from unnest(keys) k where k=any(survey.excluded) or not exists(
        select 1 from public.questions q where q.id=k and q.active
          and jsonb_typeof(survey.answers->k)='string' and length(btrim(survey.answers->>k))>0
      )) then raise exception '공개 제외 또는 비어 있는 답변은 승인할 수 없습니다.'; end if;
      insert into private.card_reviews(employee_id,question_keys) values(survey.employee_id,keys)
        on conflict(employee_id) do update set question_keys=excluded.question_keys,reviewed_at=now();
    else
      delete from private.card_reviews where employee_id=(p->>'employee_id')::uuid;
    end if;
    insert into private.audit(admin_id,action) values(p_actor,'review_card');
    return '{"ok":true}';
  end if;
  result:=public.portal_before_completion(p_actor,p_action,p);
  if p_action='dashboard' then
    result:=result||jsonb_build_object('card_reviews',coalesce(
      (select jsonb_agg(jsonb_build_object('employee_id',employee_id,'question_keys',question_keys)) from private.card_reviews),'[]'));
  end if;
  return result;
end; $$;
revoke all on function public.portal(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal(uuid,text,jsonb) to service_role;
revoke all on all functions in schema private from public,anon,authenticated;
-- Administrative edits revoke affected content without reopening the finished show.
do $migration$
declare target regprocedure; definition text; original text := $old$update public.event_public_state set phase='WAITING',payload='{}',paused=false,revision=revision+1,updated_at=now() where id;$old$;
begin
  foreach target in array array['private.admin_content(uuid,text,jsonb)'::regprocedure,'private.employee_deleted()'::regprocedure] loop
    definition := replace(pg_get_functiondef(target), E'\r\n', E'\n');
    if strpos(definition, original)=0 then raise exception 'Unexpected definition for %',target; end if;
    execute replace(definition,original,$new$update public.event_public_state set
      phase=case when phase='COMPLETED' then 'COMPLETED' else 'WAITING' end,
      payload=case when phase='COMPLETED' then payload else '{}'::jsonb end,
      paused=false,revision=revision+1,updated_at=now() where id;$new$);
  end loop;
end;
$migration$;
