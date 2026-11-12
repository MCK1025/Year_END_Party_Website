-- A stale organizer revision is an application conflict, not a retryable
-- serialization failure. PostgREST retries 40001 repeatedly inside one request.
do $$
declare definition text;
begin
  select pg_get_functiondef('private.command(uuid,jsonb)'::regprocedure) into definition;
  execute replace(definition, 'errcode=''40001''', 'errcode=''PT409''');
end; $$;
