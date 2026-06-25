-- After you create an admin user in Supabase Authentication > Users,
-- copy the user's UUID and replace PUT_ADMIN_USER_UUID_HERE.
-- Then run this file in SQL Editor.

insert into public.admin_users (user_id)
values ('PUT_ADMIN_USER_UUID_HERE')
on conflict (user_id) do nothing;
