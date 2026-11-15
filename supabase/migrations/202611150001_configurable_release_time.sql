-- Retain the current gateway, permission checks and schedule-change triggers.
-- Only remove the fixed clock restriction and update the two rejection messages.
do $migration$
declare
  change record;
  definition text;
begin
  for change in select * from (values
    ('private.admin_content(uuid,text,jsonb)'::regprocedure,
     $old$    if p->>'event_start_at' is not null and to_char((p->>'event_start_at')::timestamptz at time zone 'Asia/Seoul','HH24:MI:SS')<>'18:00:00'
      then raise exception '공개 시각은 한국시간 오후 6시로 설정해주세요.'; end if;$old$, ''),
    ('private.command_before_edit_lock(uuid,jsonb)'::regprocedure,
     '행사일 오후 6시 이후에 공개할 수 있습니다.', '설정한 행사 시작 시각 이후에 공개할 수 있습니다. 설정·내보내기에서 일정을 확인해주세요.'),
    ('private.command(uuid,jsonb)'::regprocedure,
     '행사 시작과 행사일 오후 6시 이후에 공개할 수 있습니다.', '행사를 시작하고 설정한 시작 시각이 지나면 공개할 수 있습니다.')
  ) as edits(target, old_text, new_text)
  loop
    definition := replace(pg_get_functiondef(change.target), E'\r\n', E'\n');
    change.old_text := replace(change.old_text, E'\r\n', E'\n');
    if strpos(definition, change.old_text) = 0 then
      raise exception 'Unexpected function definition for %', change.target;
    end if;
    execute replace(definition, change.old_text, change.new_text);
  end loop;
end;
$migration$;
