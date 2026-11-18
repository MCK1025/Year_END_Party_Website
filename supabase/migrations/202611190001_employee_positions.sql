-- The organizer edited department in the public directory to contain job titles.
-- Reconcile that display field only; keep identity, credentials and approvals intact.
create function private.sync_employee_position() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_schema='public' then
    update private.employees set department=new.department where id=new.id and department is distinct from new.department;
  else
    update public.employee_directory set department=new.department where id=new.id and department is distinct from new.department;
  end if;
  return null;
end; $$;
revoke all on function private.sync_employee_position() from public,anon,authenticated;
create trigger sync_employee_position after update of department on public.employee_directory
for each row when(old.department is distinct from new.department) execute function private.sync_employee_position();
create trigger sync_employee_position after update of department on private.employees
for each row when(old.department is distinct from new.department) execute function private.sync_employee_position();
update private.employees e set department=d.department from public.employee_directory d
where e.id=d.id and e.department is distinct from d.department;
