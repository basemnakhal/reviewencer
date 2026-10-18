-- ============================================================
-- Move legacy_businesses (11k rows) into the new businesses table
-- ============================================================

-- 1. Categories that had no home in the new taxonomy
insert into categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order)
select lm.id, v.slug, v.name_en, v.name_ar, v.icon_token, v.sort_order
from (values
  ('shopping-home',    'shopping-malls', 'Shopping malls',         'مراكز التسوق', 'building-store', 15),
  ('finance-services', 'real-estate',    'Real estate & property', 'العقارات',     'home',           4)
) as v(life_moment, slug, name_en, name_ar, icon_token, sort_order)
join life_moments lm on lm.slug = v.life_moment
on conflict (slug) do nothing;

-- 2. Copy businesses, keeping ids so anything keyed on them still lines up.
--    Legacy taglines look like "<Category label> in <address>"; the address part
--    is extracted and its last " - " segment identifies the emirate.
with legacy_category_map (legacy_id, new_slug) as (values
  ('banking',         'banks'),
  ('car-dealers',     'car-dealers'),
  ('delivery',        'delivery-rideshare'),
  ('dental',          'dental'),
  ('ecommerce',       'marketplaces'),
  ('entertainment',   'theme-parks'),
  ('gyms',            'sports-fitness'),
  ('healthcare',      'general-clinics'),
  ('hotels',          'hotels'),
  ('kids-activities', 'tutoring'),
  ('kids-play',       'family-entertainment'),
  ('malls',           'shopping-malls'),
  ('nurseries',       'nurseries'),
  ('realestate',      'real-estate'),
  ('restaurants',     'restaurants'),
  ('ride',            'delivery-rideshare'),
  ('salons',          'salons-spas'),
  ('schools',         'schools'),
  ('spas',            'salons-spas'),
  ('telecom',         'telecom')
)
insert into businesses (id, slug, name_en, category_id, logo_url, address, emirate_id, verified, source, created_at)
select
  lb.id,
  lb.slug,
  lb.name,
  c.id,
  case when lb.logo_emoji like 'http%' then lb.logo_emoji end,
  nullif(regexp_replace(lb.tagline, '^' || lc.label || ' in ', ''), 'the UAE'),
  e.id,
  lb.verified,
  'legacy_import',
  lb.created_at
from legacy_businesses lb
join legacy_categories lc  on lc.id = lb.category_id
join legacy_category_map m on m.legacy_id = lb.category_id
join categories c          on c.slug = m.new_slug
left join emirates e on e.code = case trim(regexp_replace(lb.tagline, '^.* - ', ''))
  when 'Dubai'     then 'DXB' when 'دبي'      then 'DXB'
  when 'Abu Dhabi' then 'AUH' when 'أبو ظبي'  then 'AUH'
  when 'Sharjah'   then 'SHJ' when 'الشارقة' then 'SHJ'
end
on conflict (id) do nothing;
