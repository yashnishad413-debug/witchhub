-- Run this once in Supabase: SQL Editor, New query, paste, Run.
create table if not exists public.admins(user_id uuid primary key references auth.users on delete cascade);
create table if not exists public.site_content(id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.inbox(id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('request','message')), payload jsonb not null, created_at timestamptz not null default now());
alter table public.admins enable row level security;
alter table public.site_content enable row level security;
alter table public.inbox enable row level security;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admins where user_id=auth.uid()) $$;
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins for select to authenticated using (user_id=auth.uid());
drop policy if exists "anyone reads site" on public.site_content;
create policy "anyone reads site" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "admin writes site" on public.site_content;
create policy "admin writes site" on public.site_content for insert to authenticated with check (public.is_admin());
drop policy if exists "admin updates site" on public.site_content;
create policy "admin updates site" on public.site_content for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "anyone sends to inbox" on public.inbox;
create policy "anyone sends to inbox" on public.inbox for insert to anon, authenticated with check (pg_column_size(payload) < 9000);
drop policy if exists "admin reads inbox" on public.inbox;
create policy "admin reads inbox" on public.inbox for select to authenticated using (public.is_admin());
-- After you create your own user (Authentication, Users, Add user), make it the admin:
-- insert into public.admins(user_id) select id from auth.users where email = 'YOUR-EMAIL';

-- ===== Part 2: client requests, replies and status (run this too) =====
create table if not exists public.requests(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, data jsonb not null, status int not null default 0, created_at timestamptz not null default now());
create table if not exists public.messages(id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests on delete cascade, from_admin boolean not null default false, text text not null check (char_length(text) <= 1000), created_at timestamptz not null default now());
alter table public.requests enable row level security;
alter table public.messages enable row level security;
drop policy if exists "see own or all if admin" on public.requests;
create policy "see own or all if admin" on public.requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "clients create own" on public.requests;
create policy "clients create own" on public.requests for insert to authenticated with check (user_id = auth.uid() and status = 0 and pg_column_size(data) < 9000);
drop policy if exists "admin changes status" on public.requests;
create policy "admin changes status" on public.requests for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "read messages of visible requests" on public.messages;
create policy "read messages of visible requests" on public.messages for select to authenticated using (exists (select 1 from public.requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())));
drop policy if exists "send messages" on public.messages;
create policy "send messages" on public.messages for insert to authenticated with check ((from_admin = false and exists (select 1 from public.requests r where r.id = request_id and r.user_id = auth.uid())) or (from_admin = true and public.is_admin()));
drop policy if exists "admin deletes requests" on public.requests;
create policy "admin deletes requests" on public.requests for delete to authenticated using (public.is_admin());

-- ===== Part 3: picture uploads (run this too) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('site-images','site-images',true,5242880,array['image/png','image/jpeg','image/webp','image/gif']) on conflict (id) do update set public = true;
drop policy if exists "admin uploads site images" on storage.objects;
create policy "admin uploads site images" on storage.objects for insert to authenticated with check (bucket_id = 'site-images' and public.is_admin());
drop policy if exists "admin updates site images" on storage.objects;
create policy "admin updates site images" on storage.objects for update to authenticated using (bucket_id = 'site-images' and public.is_admin());
drop policy if exists "admin deletes site images" on storage.objects;
create policy "admin deletes site images" on storage.objects for delete to authenticated using (bucket_id = 'site-images' and public.is_admin());
