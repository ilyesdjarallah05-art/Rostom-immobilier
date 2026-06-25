-- Shows which properties are currently selected for the homepage top slider.
select
  id,
  title,
  hero_featured,
  hero_order,
  coalesce(array_length(images, 1), 0) as image_count,
  images
from public.properties
where hero_featured = true
order by hero_order nulls last, created_at desc;
