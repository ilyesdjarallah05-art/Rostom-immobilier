-- Use this only if the homepage still shows old slider properties.
-- It clears every old top-slider selection. Then select your 3 properties again from the admin page.
update public.properties
set hero_featured = false,
    hero_order = null;
