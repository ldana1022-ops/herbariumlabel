create or replace function private.can_access_print_log(_user_id uuid, _specimen_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.herbarium_specimens s
    where s.id = _specimen_id
      and private.can_view_specimen(_user_id, s.id, s.visibility, s.created_by)
  )
$$;

revoke all on function private.can_access_print_log(uuid, uuid) from public, anon, authenticated;

create or replace function private.print_set_printed_by()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.printed_by := coalesce(auth.uid(), new.printed_by);
  return new;
end;
$$;

drop trigger if exists print_set_printed_by_trigger on public.specimen_prints;
create trigger print_set_printed_by_trigger
before insert on public.specimen_prints
for each row execute function private.print_set_printed_by();

drop policy if exists "Read print log" on public.specimen_prints;
drop policy if exists "Record prints" on public.specimen_prints;
drop policy if exists "Update print log" on public.specimen_prints;

create policy "Read print log for accessible specimens"
on public.specimen_prints
for select
to authenticated
using (
  private.is_super_admin(auth.uid())
  or printed_by = auth.uid()
  or private.can_access_print_log(auth.uid(), specimen_id)
);

create policy "Record prints for accessible specimens"
on public.specimen_prints
for insert
to authenticated
with check (
  (printed_by is null or printed_by = auth.uid())
  and private.can_access_print_log(auth.uid(), specimen_id)
);

create policy "Update prints for accessible specimens"
on public.specimen_prints
for update
to authenticated
using (
  private.is_super_admin(auth.uid())
  or private.can_access_print_log(auth.uid(), specimen_id)
)
with check (
  private.is_super_admin(auth.uid())
  or private.can_access_print_log(auth.uid(), specimen_id)
);