alter table private.rounds drop constraint rounds_question_keys_check;
alter table private.rounds drop constraint rounds_hints_check;
alter table private.rounds add constraint rounds_question_keys_check check(cardinality(question_keys) between 1 and 6);
alter table private.rounds add constraint rounds_hints_check check(cardinality(hints) between 1 and 6);

-- Question text is published only alongside its released answer prefix.
do $migration$
declare definition text; original text:=$old$body:=jsonb_set(body,'{hints}',to_jsonb(r.hints[1:hints_count]));$old$;
begin
  definition:=replace(pg_get_functiondef('private.progress(jsonb,text,jsonb)'::regprocedure),E'\r\n',E'\n');
  if strpos(definition,original)=0 then raise exception 'Unexpected hint publication definition'; end if;
  execute replace(definition,original,$new$body:=jsonb_set(body,'{hints}',to_jsonb(r.hints[1:hints_count]));
      body:=jsonb_set(body,'{hint_questions}',(select jsonb_agg(q.prompt order by k.n)
        from unnest(r.question_keys[1:hints_count]) with ordinality k(id,n)
        join public.questions q on q.id=k.id));$new$);
end;
$migration$;
