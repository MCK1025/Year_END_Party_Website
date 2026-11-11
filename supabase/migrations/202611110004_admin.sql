create function private.dashboard(p_actor uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
  'settings',(select to_jsonb(s) from private.settings s),
  'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'employee_no',e.employee_no,'name',e.name,'department',e.department,'active',e.active,
    'online',exists(select 1 from private.sessions s where s.employee_id=e.id and s.last_seen>now()-interval '90 seconds'))) from private.employees e),'[]'),
  'surveys',coalesce((select jsonb_agg(s) from public.surveys s),'[]'),
  'nominations',coalesce((select jsonb_agg(n) from public.nominations n),'[]'),
  'reviews',coalesce((select jsonb_agg(r) from private.reason_reviews r),'[]'),
  'questions',coalesce((select jsonb_agg(q order by sort_order) from public.questions q),'[]'),
  'rounds',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('eligible',private.round_eligible(r)) order by sort_order,id) from private.rounds r),'[]'),
  'tastes',coalesce((select jsonb_agg(t) from private.tastes t),'[]'),
  'recaps',coalesce((select jsonb_agg(r order by sort_order) from private.recaps r),'[]'),
  'winners',private.awards(),
  'state',(select to_jsonb(s) from public.event_public_state s),
  'rehearsal',(select state from private.rehearsals where admin_id=p_actor),
  'logs',coalesce((select jsonb_agg(l) from (select id,action,created_at from private.audit order by id desc limit 30) l),'[]')
 ); $$;

create function private.admin_content(p_actor uuid,p_action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.rounds; path text; question public.questions; results jsonb; cfg private.settings;
begin
  select * into cfg from private.settings where id for update;
  case p_action
  when 'settings' then
    if p->>'event_start_at' is not null and to_char((p->>'event_start_at')::timestamptz at time zone 'Asia/Seoul','HH24:MI:SS')<>'18:00:00'
      then raise exception '공개 시각은 한국시간 오후 6시로 설정해주세요.'; end if;
    update private.settings set event_start_at=(p->>'event_start_at')::timestamptz,deletion_date=(p->>'deletion_date')::date,
      survey_open=(p->>'survey_open')::boolean,nomination_open=(p->>'nomination_open')::boolean,enabled=(p->>'enabled')::boolean,
      welcome=p->>'welcome',ending=p->>'ending' where id;
    if (p->>'event_start_at')::timestamptz is distinct from cfg.event_start_at or not (p->>'enabled')::boolean then
      update public.event_public_state set phase='WAITING',payload='{}',paused=false,revision=revision+1,updated_at=now() where id;
    end if;
  when 'question' then
    insert into public.questions(id,prompt,choices,sort_order,active) values(p->>'id',p->>'prompt',
      array(select jsonb_array_elements_text(p->'choices')),(p->>'sort_order')::int,(p->>'active')::boolean)
      on conflict(id) do update set prompt=excluded.prompt,choices=excluded.choices,sort_order=excluded.sort_order,active=excluded.active;
  when 'round' then
    r.id:=coalesce((p->>'id')::uuid,gen_random_uuid()); r.employee_id:=(p->>'employee_id')::uuid;
    r.question_keys:=array(select jsonb_array_elements_text(p->'question_keys'));
    r.hints:=array(select jsonb_array_elements_text(p->'hints')); r.approved:=(p->>'approved')::boolean; r.sort_order:=(p->>'sort_order')::int;
    if not private.round_eligible(r) then raise exception '공개에 동의한 문항만 출제할 수 있습니다.'; end if;
    if exists(select 1 from unnest(r.hints) h where length(trim(h)) not between 1 and 500) then raise exception '힌트는 1~500자입니다.'; end if;
    if exists(select 1 from public.event_public_state where payload->>'round_id'=r.id::text) then raise exception '진행 중인 문제는 대기실로 돌아간 후 수정해주세요.'; end if;
    insert into private.rounds values(r.*) on conflict(id) do update set employee_id=excluded.employee_id,question_keys=excluded.question_keys,
      hints=excluded.hints,approved=excluded.approved,sort_order=excluded.sort_order;
  when 'delete_round' then
    if exists(select 1 from public.event_public_state where payload->>'round_id'=p->>'id') then raise exception '진행 중인 문제입니다.'; end if;
    delete from private.rounds where id=(p->>'id')::uuid;
  when 'taste' then
    select * into question from public.questions where id=p->>'question_id' and active;
    if question.id is null then raise exception '질문을 선택해주세요.'; end if;
    if p->'results' is null or p->'results'='null' then
      select coalesce(jsonb_agg(jsonb_build_object('label',label,'count',n) order by n desc,label),'[]') into results from (
        select trim(s.answers->>question.id) label,count(*)::int n from public.surveys s
        join private.employees e on e.id=s.employee_id and e.active
        where s.consent and not question.id=any(s.excluded) and length(trim(s.answers->>question.id))>0
        group by trim(s.answers->>question.id)
      ) t;
    else results:=p->'results'; end if;
    if jsonb_typeof(results)<>'array' or jsonb_array_length(results)>50 then raise exception '통계 형식 오류'; end if;
    insert into private.tastes(id,question_id,prompt,results,approved) values(coalesce((p->>'id')::uuid,gen_random_uuid()),question.id,p->>'prompt',results,(p->>'approved')::boolean)
      on conflict(id) do update set question_id=excluded.question_id,prompt=excluded.prompt,results=excluded.results,approved=excluded.approved;
  when 'recap' then
    path:=p->>'asset_path';
    if path is not null and not exists(select 1 from storage.objects where bucket_id='event-media' and name=path) then raise exception '사진 업로드를 먼저 완료해주세요.'; end if;
    insert into private.recaps(id,caption,asset_path,published,sort_order) values(coalesce((p->>'id')::uuid,gen_random_uuid()),p->>'caption',path,(p->>'published')::boolean,(p->>'sort_order')::int)
      on conflict(id) do update set caption=excluded.caption,asset_path=excluded.asset_path,published=excluded.published,sort_order=excluded.sort_order;
  when 'delete_recap' then delete from private.recaps where id=(p->>'id')::uuid;
  when 'logo' then
    path:=p->>'asset_path';
    if path is not null and not exists(select 1 from storage.objects where bucket_id='event-media' and name=path) then raise exception '사진 업로드를 먼저 완료해주세요.'; end if;
    update private.settings set logo_path=path where id;
  when 'review_reason' then
    insert into private.reason_reviews(voter_id,public_text,approved) values((p->>'voter_id')::uuid,p->>'public_text',(p->>'approved')::boolean)
      on conflict(voter_id) do update set public_text=excluded.public_text,approved=excluded.approved;
  else raise exception '지원하지 않는 콘텐츠 동작';
  end case;
  insert into private.audit(admin_id,action) values(p_actor,p_action);
  return '{"ok":true}';
end; $$;
