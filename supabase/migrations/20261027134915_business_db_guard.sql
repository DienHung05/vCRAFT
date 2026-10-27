-- ADR-15: CSDL nghiệp vụ (MikroORM) chạy trên Postgres của Supabase, schema public.
-- Backend kết nối bằng vai trò postgres (chủ bảng, bỏ qua RLS). Data API (PostgREST) không được chạm vào bảng nghiệp vụ:
--   1. anon/authenticated không được cấp quyền mặc định trên bảng, sequence, hàm mới trong public;
--   2. mọi bảng mới trong public tự bật RLS (không policy = chặn hết), kể cả bảng do migration MikroORM tạo.

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- Hàm security definer đặt ở schema không phơi ra Data API
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      execute format('alter table if exists %s enable row level security', cmd.object_identity);
    end if;
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function private.rls_auto_enable();
