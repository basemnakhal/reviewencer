-- Reviewencer seed data (UAE B2C businesses)
-- Run AFTER schema.sql:  psql "$SUPABASE_DB_URL" -f supabase/seed.sql

-- Categories
insert into public.categories (id, label, emoji, tint) values
  ('banking',    'Banking',       '🏦', 'from-indigo-500 to-blue-600'),
  ('ecommerce',  'E-commerce',    '🛒', 'from-amber-500 to-orange-600'),
  ('delivery',   'Food delivery', '🛵', 'from-rose-500 to-pink-600'),
  ('telecom',    'Telecom',       '📡', 'from-emerald-500 to-teal-600'),
  ('ride',       'Ride-hailing',  '🚖', 'from-yellow-500 to-amber-600'),
  ('realestate', 'Real estate',   '🏠', 'from-purple-500 to-fuchsia-600')
on conflict (id) do nothing;

-- Businesses
insert into public.businesses (slug, name, category_id, tagline, logo_emoji, brand_color, verified) values
  ('enbd',           'Emirates NBD',        'banking',    'UAE retail banking giant',         '🏦', '#9c1c2c', true),
  ('adcb',           'ADCB',                'banking',    'Abu Dhabi Commercial Bank',        '🏦', '#003366', true),
  ('mashreq',        'Mashreq Neo',         'banking',    'Digital-first bank',               '💎', '#ff6600', true),
  ('fab',            'First Abu Dhabi Bank','banking',    'FAB — UAE''s largest bank',        '🏛️', '#001f5b', true),
  ('amazonae',       'Amazon.ae',           'ecommerce',  'Online shopping in the UAE',       '📦', '#ff9900', true),
  ('noon',           'Noon',                'ecommerce',  'Middle East e-commerce',           '🟡', '#feee00', true),
  ('carrefour',      'Carrefour UAE',       'ecommerce',  'Hypermarket online',               '🛒', '#1c4e9a', true),
  ('talabat',        'Talabat',             'delivery',   'Food and grocery delivery',        '🛵', '#ff5a00', true),
  ('deliveroo',      'Deliveroo UAE',       'delivery',   'Premium food delivery',            '🦘', '#00ccbc', true),
  ('careemnow',      'Careem Food',         'delivery',   'Part of the Careem super-app',     '🟢', '#0bb072', true),
  ('etisalat',       'Etisalat by e&',      'telecom',    'UAE''s largest telecom',           '📡', '#76232f', true),
  ('du',             'du',                  'telecom',    'Mobile, home internet, TV',        '📶', '#00569d', true),
  ('careem',         'Careem',              'ride',       'Region''s super-app',              '🚖', '#0bb072', true),
  ('uber',           'Uber UAE',            'ride',       'Ride-sharing platform',            '🚗', '#000000', true),
  ('bayut',          'Bayut',               'realestate', 'Property listings UAE',            '🏠', '#962c54', true),
  ('propertyfinder', 'Property Finder',     'realestate', 'Find homes in the UAE',            '🔑', '#ef4444', true)
on conflict (slug) do nothing;

-- Reviews (all seeded as 'published' for demo; real signups flow through moderation)
with b as (select id, slug from public.businesses)
insert into public.reviews (business_id, rating, text, tags, moderation_status, published_at)
select b.id, r.rating, r.text, r.tags, 'published'::moderation_status, now()
from (values
  ('enbd', 4, 'Got my car finance through ENBD in 4 days. App is great, but the branch visit for documents was a hassle. Rate was competitive at 2.49%.', array['mortgage','car loan','digital']),
  ('enbd', 5, 'Best car loan experience I had in the UAE. Relationship manager was responsive on WhatsApp. Approved AED 120k in 48 hours.', array['mortgage','car loan','customer service']),
  ('enbd', 2, 'Hidden fees on my credit card. Took 6 calls to reverse a wrong charge. Disappointing for such a big bank.', array['fees','credit card','complaints']),
  ('enbd', 5, 'Home mortgage approved smoothly. They beat ADCB on the rate by 0.3%.', array['mortgage','home loan','approval']),

  ('adcb', 3, 'Car loan took almost 10 days. The rate was okay (2.79%) but they kept asking for additional documents.', array['car loan','wait time']),
  ('adcb', 4, 'The ADCB app is honestly the best banking app in UAE. Fast transfers and bill payments work flawlessly.', array['app','digital','transfers']),
  ('adcb', 5, 'Refinanced my mortgage with ADCB and saved AED 800/month. The advisor was patient and explained everything.', array['mortgage','customer service']),

  ('mashreq', 5, 'Opened account from my couch in 7 minutes. No paperwork, no branch visit. This is what banking should feel like.', array['digital','onboarding','app']),
  ('mashreq', 4, 'Got pre-approved for car loan via the app. Final approval was same day. Rate slightly higher than ENBD though.', array['car loan','fast']),
  ('mashreq', 2, 'Chat support is slow. Took 2 days to resolve a simple statement request.', array['support','chat']),

  ('fab', 4, 'Mortgage process was thorough. They offered the lowest rate on home loan (3.99% fixed for 3 years).', array['mortgage','home loan']),
  ('fab', 3, 'Car loan rate at 3.2% was higher than competitors. Service was professional but slow.', array['car loan','rate']),

  ('amazonae', 5, 'Prime in Dubai is a game changer. Same-day delivery on most items, easy returns. My household basically runs on Amazon now.', array['delivery','fast','prime']),
  ('amazonae', 2, 'Refund took 3 weeks for a defective item. Customer service kept transferring me. Frustrating.', array['returns','customer service','refund']),
  ('amazonae', 4, 'Best selection of electronics. Prices are usually 5-10% cheaper than Sharaf DG. Just wish they sold more groceries.', array['selection','price']),
  ('amazonae', 5, 'Honestly the most reliable e-commerce in UAE. Tracking is accurate to the minute.', array['delivery','app']),

  ('noon', 3, 'Yellow Friday sales are great but quality control is hit or miss. Got a perfume that looked off once.', array['delivery','noonfood','sale']),
  ('noon', 5, 'NoonMinutes for groceries is brilliant. 15-min delivery actually works in JLT.', array['delivery','price','grocery']),
  ('noon', 2, 'Return process is painful. They tried to charge me a restocking fee for a damaged product.', array['returns','customer service']),

  ('carrefour', 4, 'Best grocery app in UAE. Substitutions are reasonable and fresh produce is actually fresh.', array['grocery','delivery','fresh']),
  ('carrefour', 5, 'Scheduled delivery slots always on time. MyClub points are real savings.', array['scheduled delivery','reliable']),

  ('talabat', 4, 'Widest restaurant selection by far. Delivery is usually under 35 mins in Downtown. Talabat Pro pays for itself.', array['food','delivery time','restaurants']),
  ('talabat', 2, 'Order arrived 1 hour late and cold. Support gave me a 10 AED voucher. Not great.', array['support','refund']),
  ('talabat', 5, 'tMart 20-min grocery delivery is genuinely impressive. Use it 3x a week.', array['grocery','tmart','fast']),
  ('talabat', 3, 'Service fees keep creeping up. Total order cost is now 30% more than dine-in.', array['fees','price']),

  ('deliveroo', 5, 'Better restaurant curation than Talabat. Plus subscription is worth it if you order 3+ times/week.', array['restaurants','quality','riders']),
  ('deliveroo', 3, 'Coverage in Sharjah and Ajman is poor. Great in Dubai Marina though.', array['coverage','area']),
  ('deliveroo', 4, 'ETA is the most accurate of any delivery app. Riders actually follow instructions.', array['delivery time','accurate']),

  ('careemnow', 3, 'Convenient because it''s in the same app as my rides. But restaurant selection is smaller than Talabat.', array['app','super app','convenience']),
  ('careemnow', 4, 'Promo codes are aggressive. Got 50% off my first 5 orders.', array['promotions','price']),

  ('etisalat', 4, '5G coverage is excellent across Dubai and AD. Speeds consistently above 400 Mbps.', array['network','5g','coverage']),
  ('etisalat', 2, 'Billing disputes are a nightmare. Got charged for a roaming pack I never activated.', array['billing','support']),
  ('etisalat', 3, 'eLife installation took 2 weeks. Once installed, fiber is rock solid.', array['home internet','installation']),

  ('du', 4, 'Better value plans than Etisalat. Got unlimited 5G for AED 200 less per month.', array['plans','value','data']),
  ('du', 3, 'Network is decent but indoor coverage in older buildings is patchy.', array['coverage','indoor']),

  ('careem', 5, 'Captains are professional and the app rarely fails. Wait times in JBR under 4 mins.', array['captains','reliable','app']),
  ('careem', 3, 'Surge pricing during rush hour is brutal. 2.5x is common around 7pm.', array['surge','price']),

  ('uber', 4, 'UberX usually 10-15% cheaper than Careem for same route. App is clean.', array['price','uberx']),
  ('uber', 2, 'Too many cancellations late at night. Drivers prefer cash trips.', array['drivers','cancellations']),

  ('bayut', 4, 'Most accurate listings in Dubai. TruCheck verified properties save a lot of agent calls.', array['listings','search','filters']),
  ('bayut', 3, 'Still get spam calls from agents days after browsing. Need stricter agent moderation.', array['agents','spam']),

  ('propertyfinder', 4, 'Property data and price trends are very useful. Helped me negotiate AED 15k off rent.', array['search','market data']),
  ('propertyfinder', 3, 'Lots of duplicate listings. Same flat appears 4 times under different agents.', array['listings','duplicates'])
) as r(slug, rating, text, tags)
join b on b.slug = r.slug;

-- Pre-computed AI summaries so the UI has content before the first summary job runs
insert into public.ai_summaries (business_id, headline, pros, cons, themes, sentiment, review_count, avg_rating, generated_by)
select b.id, s.headline, s.pros, s.cons, s.themes::jsonb, s.sentiment,
       (select count(*) from public.reviews r where r.business_id = b.id and r.moderation_status = 'published'),
       (select round(avg(rating)::numeric, 1) from public.reviews r where r.business_id = b.id and r.moderation_status = 'published'),
       'seed'
from (values
  ('enbd',           'A trusted choice for car & home loans, with friction at the credit-card desk.', array['Competitive auto-loan rates (2.49–2.79%)','Responsive relationship managers','Strong mobile app'], array['Branch visits still required for some flows','Credit-card fee disputes are common'], '[{"label":"Car & home loans","score":88},{"label":"Mobile banking","score":80},{"label":"Credit cards","score":42},{"label":"Customer support","score":65}]', 78),
  ('adcb',           'Best-in-class app and great for refinancing, slower on new car loans.', array['Top-rated mobile app','Excellent mortgage refinancing','Patient advisors'], array['Car-loan approval can take 7–10 days','Repeat document requests'], '[{"label":"Mobile app","score":90},{"label":"Mortgage","score":82},{"label":"Car loans","score":60}]', 74),
  ('mashreq',        'Fastest digital onboarding in the UAE; chat support lags.', array['7-minute account opening','Same-day car-loan decisions','Fully app-based'], array['Slow chat support','Slightly higher loan rates'], '[{"label":"Digital onboarding","score":95},{"label":"Auto loans","score":72},{"label":"Support speed","score":48}]', 71),
  ('fab',            'Lowest mortgage rates, but car loans cost more than rivals.', array['Best home-loan rates (3.99% fixed)','Professional service'], array['Car-loan rates above market','Process can feel slow'], '[{"label":"Mortgage","score":86},{"label":"Car loans","score":55}]', 70),
  ('amazonae',       'The most reliable e-commerce in the UAE — until you need a refund.', array['Same-day Prime delivery','Massive electronics selection','Accurate tracking'], array['Refund cycles can stretch to 3 weeks','Limited grocery range'], '[{"label":"Delivery speed","score":92},{"label":"Selection","score":88},{"label":"Returns & refunds","score":55}]', 80),
  ('noon',           'Great deals and 15-min grocery, but quality control is inconsistent.', array['NoonMinutes 15-min delivery','Aggressive sales (Yellow Friday)','Strong UAE-local catalog'], array['Authenticity concerns on some items','Painful return process'], '[{"label":"Grocery (NoonMinutes)","score":84},{"label":"Pricing","score":78},{"label":"Returns","score":45}]', 64),
  ('carrefour',      'The UAE''s most reliable online grocery experience.', array['Fresh produce arrives fresh','Punctual scheduled slots','MyClub points feel meaningful'], array['Limited non-grocery selection'], '[{"label":"Grocery delivery","score":92},{"label":"Reliability","score":90}]', 86),
  ('talabat',        'Widest restaurant selection in the UAE, but service fees are climbing.', array['Largest restaurant network','tMart 20-min grocery','Talabat Pro saves money'], array['Rising service & delivery fees','Refund handling is weak'], '[{"label":"Restaurant variety","score":94},{"label":"Speed","score":78},{"label":"Fees","score":48}]', 72),
  ('deliveroo',      'Premium curation and the most accurate ETAs — best for Dubai foodies.', array['Curated higher-quality restaurants','Most accurate delivery ETAs','Plus subscription is good value'], array['Weak coverage outside Dubai'], '[{"label":"Restaurant quality","score":90},{"label":"Delivery accuracy","score":88},{"label":"Coverage","score":55}]', 81),
  ('careemnow',      'Convenient inside the Careem super-app, smaller selection than Talabat.', array['Bundled in Careem app','Strong promo codes for new users'], array['Fewer restaurants than rivals'], '[{"label":"Convenience","score":80},{"label":"Promotions","score":78},{"label":"Restaurant variety","score":55}]', 66),
  ('etisalat',       'Best 5G coverage in the country, weakest billing experience.', array['Excellent 5G speeds (>400 Mbps)','Fiber is rock-solid once installed'], array['Billing disputes are hard to resolve','Slow eLife installation'], '[{"label":"Network coverage","score":90},{"label":"Home internet","score":75},{"label":"Billing & support","score":42}]', 65),
  ('du',             'Better value plans than Etisalat, indoor coverage is the trade-off.', array['Cheaper unlimited 5G plans','Easier customer-service interactions'], array['Patchy indoor coverage in older buildings'], '[{"label":"Value","score":84},{"label":"Network","score":66}]', 68),
  ('careem',         'Most reliable ride-hailing in the UAE, with pricey peak hours.', array['Professional captains','Short wait times (~4 min)'], array['Heavy surge pricing in rush hour'], '[{"label":"Reliability","score":88},{"label":"Driver quality","score":84},{"label":"Pricing","score":60}]', 78),
  ('uber',           'Cheaper rides, but cancellations climb after midnight.', array['UberX 10–15% cheaper than Careem','Clean, simple app'], array['Late-night driver cancellations'], '[{"label":"Pricing","score":82},{"label":"Driver availability","score":55}]', 64),
  ('bayut',          'Most accurate property listings in Dubai — TruCheck saves time.', array['Verified TruCheck listings','Accurate property photos & data'], array['Persistent agent spam calls'], '[{"label":"Listing accuracy","score":86},{"label":"Agent moderation","score":55}]', 74),
  ('propertyfinder', 'Strongest market-data tools, hurt by duplicate listings.', array['Detailed price-trend data','Helps with negotiation'], array['Duplicate listings clutter results'], '[{"label":"Market data","score":84},{"label":"Listing quality","score":60}]', 70)
) as s(slug, headline, pros, cons, themes, sentiment)
join public.businesses b on b.slug = s.slug
on conflict (business_id) do update set
  headline     = excluded.headline,
  pros         = excluded.pros,
  cons         = excluded.cons,
  themes       = excluded.themes,
  sentiment    = excluded.sentiment,
  review_count = excluded.review_count,
  avg_rating   = excluded.avg_rating,
  generated_by = excluded.generated_by,
  generated_at = now(),
  stale        = false;
