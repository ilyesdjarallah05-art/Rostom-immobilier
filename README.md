# Rostom Immobilier

Minimal real estate website for Algeria with English, French and Arabic.

This version adds:

- Supabase database connection
- Supabase Storage file uploads
- normal property photos
- optional 360 panorama photos
- Pannellum 360 virtual tour viewer
- admin delete for published listings
- admin edit for published listings
- 360 room + hotspot builder
- clickable estate thumbnails
- fullscreen photo gallery with desktop arrows and phone swipe

## Open the site

Use a local server, not only double-clicking the file. Best easy way:

```txt
VS Code → Extensions → Live Server → Open index.html with Live Server
```

## Admin page

Open:

```txt
admin/index.html
```

Admin code:

```txt
Rostom2026
```

Then login with your Supabase admin email and password.

## Important: run the SQL upgrade

Since you already created the admin email, do this now:

1. Open Supabase.
2. Go to SQL Editor.
3. Run this full file again:

```txt
database/supabase-schema.sql
```

It is safe to run again. It adds:

- 360 virtual tour columns
- `property-media` Storage bucket
- upload policies for admin users
- public read for property images

If you only want the new upgrade and not the full file, run:

```txt
database/add-virtual-tours-storage.sql
```

## Admin user

If you already ran `database/add-admin-user.sql`, you do not need to do it again.

If uploads are blocked, check that your admin UUID exists in:

```txt
public.admin_users
```

## How to add or edit a property

In the admin page:

1. Go to `All publications`.
2. Click `Edit` on any property.
3. Change text, price, photos, 360 rooms, or hotspots.
4. Click `Save changes`.

For a new property, use the same form and click `Publish property`.

## How to add a property with 360 tour and hotspots

In the admin page:

1. Fill normal property information.
2. Upload normal photos in `Photos`.
3. Optional: upload 360 panorama photos in `360 panorama photos`.
4. Write room names line by line:

```txt
Salon
Kitchen
Bedroom
Terrace
```

5. In `360 rooms & hotspots builder`, click `Edit hotspots` on a room.
6. Click inside the 360 viewer to choose the hotspot position.
7. Write the hotspot label, choose the target room, then click `Add hotspot`.

The first room name matches the first 360 photo, second name matches second photo, etc.

## 360 photo rule

Use equirectangular panorama images, usually 2:1 ratio.

Example:

```txt
6000x3000
4096x2048
3000x1500
```

Normal phone photos are not real 360 photos. They will upload, but the tour will look wrong.

## Files changed for this version

```txt
admin/index.html
pages/property.html
script.js
style.css
supabase-api.js
supabase-config.js
database/supabase-schema.sql
database/add-virtual-tours-storage.sql
i18n.js
data.js
```

## Security note

The key inside `supabase-config.js` is a public frontend key. That is normal.

Never put a `service_role` key or `secret` key inside website files.


## Fix included in this version

The previous package had a malformed Supabase anon key inside `supabase-config.js`, which caused:

```txt
401 Invalid API key
```

This version corrects the key and adds clearer error messages.

After replacing the folder, do this:

1. Close the old tab.
2. Open the project again with VS Code Live Server.
3. Hard refresh: `Ctrl + F5`.
4. Login again in `admin/index.html` using your admin code, email and password.

If image upload still fails:

- Use JPG / PNG / WEBP.
- Keep each image under 15 MB, or increase `file_size_limit` in `database/supabase-schema.sql` and run it again.
- If the console mentions `requests.js`, test in a normal browser window or disable extensions.

## Estate page gallery

On each property page:

- Click a small photo to make it the main photo.
- Click the main photo to open fullscreen.
- On desktop, use left/right arrows or keyboard arrows.
- On phone, swipe left/right.
