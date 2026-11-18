-- Publication now requires administrator review rather than an employee consent
-- checkbox. Keep legacy consent values; do not manufacture consent or approvals.
do $migration$
declare change record; definition text;
begin
  for change in select * from (values
    ('private.employee_action(uuid,text,jsonb)'::regprocedure,
      $old$jsonb_typeof(p->'consent')<>'boolean'$old$,
      $new$(p ? 'consent' and jsonb_typeof(p->'consent')<>'boolean')$new$),
    ('private.employee_action(uuid,text,jsonb)'::regprocedure,
      $old$(p->>'consent')::boolean,array(select jsonb_array_elements_text(p->'excluded'))$old$,
      $new$coalesce((p->>'consent')::boolean,(select consent from public.surveys where employee_id=eid),false),array(select jsonb_array_elements_text(p->'excluded'))$new$),
    ('private.round_eligible(private.rounds)'::regprocedure,
      $old$s.consent and$old$, $new$$new$),
    ('private.admin_content(uuid,text,jsonb)'::regprocedure,
      $old$where s.consent and not question.id=any(s.excluded)$old$,
      $new$where not question.id=any(s.excluded)$new$),
    ('private.admin_content(uuid,text,jsonb)'::regprocedure,
      $old$공개에 동의한 문항만 출제할 수 있습니다.$old$,
      $new$공개 가능한 문항만 출제할 수 있습니다.$new$),
    ('public.portal(uuid,text,jsonb)'::regprocedure,
      $old$join public.surveys v on v.employee_id=e.id and v.consent$old$,
      $new$join public.surveys v on v.employee_id=e.id$new$),
    ('public.portal(uuid,text,jsonb)'::regprocedure,
      $old$survey.employee_id is null or not survey.consent or not exists($old$,
      $new$survey.employee_id is null or not exists($new$),
    ('public.portal(uuid,text,jsonb)'::regprocedure,
      $old$공개에 동의한 활성 직원의 답변만 승인할 수 있습니다.$old$,
      $new$활성 직원의 저장된 답변만 승인할 수 있습니다.$new$),
    ('public.portal(uuid,text,jsonb)'::regprocedure,
      $old$직원 인증 후 행사 종료부터 취향 카드를 볼 수 있습니다.$old$,
      $new$직원 인증 후 행사 종료부터 혜성식품 인물 카드를 볼 수 있습니다.$new$)
  ) as edits(target,old_text,new_text) loop
    definition:=replace(pg_get_functiondef(change.target),E'\r\n',E'\n');
    if strpos(definition,change.old_text)=0 then raise exception 'Unexpected definition for %',change.target; end if;
    execute replace(definition,change.old_text,change.new_text);
  end loop;
end;
$migration$;
