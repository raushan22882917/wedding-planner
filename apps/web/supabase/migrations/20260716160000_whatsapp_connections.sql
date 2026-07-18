-- Each MarryMap user owns one private OpenWA session. OpenWA credentials stay
-- in the API service; the browser can never read another user's session id.
create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'openwa' check (provider = 'openwa'),
  session_id uuid not null unique,
  session_name text not null,
  status text not null default 'created',
  phone text,
  push_name text,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.whatsapp_connections to authenticated;
grant all on public.whatsapp_connections to service_role;

alter table public.whatsapp_connections enable row level security;

create policy "own whatsapp connection" on public.whatsapp_connections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger whatsapp_connections_updated_at
  before update on public.whatsapp_connections
  for each row execute function public.set_updated_at();
