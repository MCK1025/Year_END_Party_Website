create function private.release_open(p_start timestamptz,p_clock timestamptz) returns boolean
language sql immutable set search_path='' as $$ select coalesce(p_clock>=p_start,false); $$;
revoke all on function private.release_open(timestamptz,timestamptz) from public;
create or replace function public.content_open() returns boolean language sql stable security definer set search_path='' as $$
  select enabled and private.release_open(event_start_at,now()) from private.settings;
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select private.admin(auth.uid()) and (not (select require_admin_mfa from private.settings)
    or coalesce(auth.jwt()->>'aal','')='aal2');
$$;

create or replace function private.invalidate_questions() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update private.rounds set approved=false where old.id=any(question_keys);
  update private.tastes set approved=false where question_id=old.id;
  update public.event_public_state set payload='{}',revision=revision+1,updated_at=now()
    where payload->>'round_id' in(select id::text from private.rounds where old.id=any(question_keys)) or phase='TASTES';
  return new;
end; $$;
create function private.employee_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.name is distinct from new.name or old.dob is distinct from new.dob or not new.active then
    delete from private.sessions where employee_id=new.id;
  end if;
  if old.active is distinct from new.active then
    update private.rounds set approved=false where employee_id=new.id;
    update private.tastes set approved=false where approved;
    update public.event_public_state set payload='{}',revision=revision+1,updated_at=now()
      where payload->>'round_id' in(select id::text from private.rounds where employee_id=new.id)
        or phase in ('TASTES','AWARDS');
  end if;
  return new;
end; $$;
revoke all on function private.employee_changed() from public;
create trigger employee_changed after update on private.employees for each row execute function private.employee_changed();

-- A public state revision also invalidates stale admin commands after content edits.
create function private.recap_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.event_public_state set revision=revision+1,updated_at=now() where phase='RECAP';
  return null;
end; $$;
revoke all on function private.recap_changed() from public;
create trigger recap_changed after insert or update or delete on private.recaps for each statement execute function private.recap_changed();

-- Only these dedicated objects are readable through Realtime/Data API.
alter table private.admins enable row level security;
alter table private.employees enable row level security;
alter table private.sessions enable row level security;
alter table private.settings enable row level security;
alter table private.login_attempts enable row level security;
alter table private.rounds enable row level security;
alter table private.tastes enable row level security;
alter table private.recaps enable row level security;
alter table private.reason_reviews enable row level security;
alter table private.rehearsals enable row level security;
alter table private.audit enable row level security;
