-- Rostom Immobilier — Supabase secure schema + Storage + 360 virtual tours
-- Run this whole file in Supabase > SQL Editor.
-- Safe to run again after the previous version.

create extension if not exists "pgcrypto";

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text,
  category text,
  status text,
  wilaya text,
  commune text,
  address text,
  price numeric,
  currency text default 'DZD',
  surface numeric,
  land_surface numeric,
  rooms text,
  bedrooms text,
  bathrooms text,
  floor text,
  year_built text,
  phone text,
  description text,
  features text[] default '{}',
  images text[] default '{}',
  featured boolean default false,
  is_published boolean default true,
  created_at timestamptz default now()
);

-- New 360 virtual tour fields. These ALTER lines upgrade your old table safely.
alter table public.properties add column if not exists has_virtual_tour boolean default false;
alter table public.properties add column if not exists virtual_tour_type text default 'pannellum';
alter table public.properties add column if not exists virtual_tour_url text;
alter table public.properties add column if not exists virtual_tour_rooms jsonb default '[]'::jsonb;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.properties enable row level security;
alter table public.admin_users enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;
grant select on public.admin_users to authenticated;

-- Visitors can read only published properties.
drop policy if exists "Public can read published properties" on public.properties;
create policy "Public can read published properties"
on public.properties for select
to anon, authenticated
using (is_published = true);

-- A logged-in admin can see only his own admin row.
drop policy if exists "Admins can read own admin row" on public.admin_users;
create policy "Admins can read own admin row"
on public.admin_users for select
to authenticated
using ((select auth.uid()) = user_id);

-- Admin check: user must exist inside public.admin_users.
drop policy if exists "Admins can insert properties" on public.properties;
create policy "Admins can insert properties"
on public.properties for insert
to authenticated
with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));

drop policy if exists "Admins can update properties" on public.properties;
create policy "Admins can update properties"
on public.properties for update
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));

drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties"
on public.properties for delete
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));

-- Storage bucket for normal photos + 360 panorama photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-media', 'property-media', true, 15728640, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public can read images from the public bucket.
drop policy if exists "Public can read property media" on storage.objects;
create policy "Public can read property media"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'property-media');

-- Only admins can upload/update/delete property media.
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

-- Demo data, inserted only when the table is empty.
insert into public.properties (title, category, status, wilaya, commune, address, price, currency, surface, land_surface, rooms, bedrooms, bathrooms, floor, year_built, phone, description, features, images, featured, has_virtual_tour, virtual_tour_type, virtual_tour_rooms)
select * from (values
('Modern villa in Batna','villas','sale','05 - Batna','Batna','Batna, Algeria',95000000::numeric,'DZD',420::numeric,600::numeric,'6','4','3',null,'2021','+213 555 000 000','Family villa with a large living room, garden, garage and modern finishes.',array['Garden','Garage','Heating','Equipped kitchen'],array['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=80'],true,true,'pannellum','[{"room":"Demo 360 room","image":"https://pannellum.org/images/alma.jpg"}]'::jsonb),
('High standing apartment','apartments','rent','16 - Alger','Hydra','Hydra, Alger',120000::numeric,'DZD / month',145::numeric,null,'4','3','2','5',null,'+213 555 000 000','Bright apartment close to services, ideal for a family or professional tenant.',array['Elevator','Parking','Security','Balcony'],array['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1400&q=80'],true,false,'pannellum','[]'::jsonb),
('Spacious house with terrace','houses','sale','19 - Sétif','El Eulma','El Eulma, Sétif',56000000::numeric,'DZD',260::numeric,310::numeric,'5','3','2','R+1',null,'+213 555 000 000','Clean, well-located house with terrace and garage space.',array['Terrace','Garage','Quiet area'],array['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1400&q=80'],true,false,'pannellum','[]'::jsonb),
('Constructible land','land','sale','31 - Oran','Bir El Djir','Bir El Djir, Oran',38000000::numeric,'DZD',null,520::numeric,null,null,null,null,null,'+213 555 000 000','Well-positioned land near the main road. Suitable for a residential project.',array['Legal papers available','Residential zone','Road access'],array['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1400&q=80'],true,false,'pannellum','[]'::jsonb)
) as v(title, category, status, wilaya, commune, address, price, currency, surface, land_surface, rooms, bedrooms, bathrooms, floor, year_built, phone, description, features, images, featured, has_virtual_tour, virtual_tour_type, virtual_tour_rooms)
where not exists (select 1 from public.properties);
