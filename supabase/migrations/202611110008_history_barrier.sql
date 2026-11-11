-- Content changes invalidate the last command even when its content is no longer on screen.
-- Existing invalidation triggers clear/recompute the current payload; this barrier also
-- prevents undo from resurrecting an older audit snapshot after approval/consent changes.
create function private.content_history_barrier() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.event_public_state set revision=revision+1,updated_at=now() where id;
  return null;
end; $$;
revoke all on function private.content_history_barrier() from public,anon,authenticated;
create trigger history_barrier after insert or update or delete on public.surveys
  for each statement execute function private.content_history_barrier();
create trigger history_barrier after insert or update or delete on public.questions
  for each statement execute function private.content_history_barrier();
create trigger history_barrier after insert or update or delete on public.nominations
  for each statement execute function private.content_history_barrier();
create trigger history_barrier after insert or update or delete on private.employees
  for each statement execute function private.content_history_barrier();
create trigger history_barrier after insert or update or delete on private.rounds
  for each statement execute function private.content_history_barrier();
create trigger history_barrier after insert or update or delete on private.tastes
  for each statement execute function private.content_history_barrier();
create trigger history_barrier after insert or update or delete on private.reason_reviews
  for each statement execute function private.content_history_barrier();
