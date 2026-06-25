-- Rostom Immobilier — quick upgrade only: Storage + 360 tour fields
-- Use this if you already ran the old schema and only want the new fields.

alter table public.properties add column if not exists has_virtual_tour boolean default false;
alter table public.properties add column if not exists virtual_tour_type text default 'pannellum';
alter table public.properties add column if not exists virtual_tour_url text;
alter table public.properties add column if not exists virtual_tour_rooms jsonb default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-media', 'property-media', true, 15728640, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read property media" on storage.objects;
create policy "Public can read property media"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'property-media');

drop policy if exists "Admins can upload property media" on storage.objects;
create policy "Admins can upload property media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-media'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

drop policy if exists "Admins can update property media" on storage.objects;
create policy "Admins can update property media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'property-media'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
)
with check (
  bucket_id = 'property-media'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

drop policy if exists "Admins can delete property media" on storage.objects;
create policy "Admins can delete property media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'property-media'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);
