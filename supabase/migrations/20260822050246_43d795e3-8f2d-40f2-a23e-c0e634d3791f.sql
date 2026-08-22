revoke all on public.herbarium_specimens from public;
revoke all on public.herbarium_specimens from anon;
grant select on public.herbarium_specimens to anon;
grant select, insert, update, delete on public.herbarium_specimens to authenticated;
grant all on public.herbarium_specimens to service_role;