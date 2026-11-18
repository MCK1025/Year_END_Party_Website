-- Creation uses the same reopened window as editing. Authentication, anonymous
-- ownership and the existing per-employee daily quota remain in the handler.
do $migration$
declare definition text; original text:=$old$if (p_action='forest_post' and cfg.started_at is not null)
    or (p_action='forest_edit' and cfg.started_at is not null and
      (not cfg.forest_edit_open or not private.response_window(cfg.started_at,cfg.event_start_at,now()))) then$old$;
begin
  definition:=replace(pg_get_functiondef('private.forest_action_before_tree(uuid,text,jsonb)'::regprocedure),E'\r\n',E'\n');
  if strpos(definition,original)=0 then raise exception 'Unexpected story creation guard'; end if;
  execute replace(definition,original,$new$if p_action in ('forest_post','forest_edit') and cfg.started_at is not null
    and (not cfg.forest_edit_open or not private.response_window(cfg.started_at,cfg.event_start_at,now())) then$new$);
end;
$migration$;
