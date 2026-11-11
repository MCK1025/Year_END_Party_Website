create function private.taste_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.event_public_state set payload='{}',revision=revision+1,updated_at=now()
    where phase='TASTES' and payload->>'taste_id'=coalesce(new.id,old.id)::text;
  return null;
end; $$;
create trigger taste_changed after update or delete on private.tastes for each row execute function private.taste_changed();
create function private.award_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.event_public_state set payload=jsonb_build_object('winners',private.awards()),revision=revision+1,updated_at=now()
    where phase='AWARDS';
  return null;
end; $$;
create trigger reason_changed after insert or update or delete on private.reason_reviews for each statement execute function private.award_changed();
create trigger nomination_changed after insert or update or delete on public.nominations for each statement execute function private.award_changed();
revoke all on function private.taste_changed(),private.award_changed() from public,anon,authenticated;
