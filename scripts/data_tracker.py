"""
Business data tracker -> docs/Reviewencer-data-tracker.xlsx

Per category: how many businesses the live database has and which data they're missing,
plus what SerpAPI discovery (data/serp/<run>/) has found so far. Re-run after every
discovery batch or import:

    python scripts/data_tracker.py

Status / Target / Notes typed into the existing workbook are kept on regeneration.
Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (public, read-only data)
and SERPAPI_KEY (only for the free "searches left" lookup) from .env.local.
"""
import glob
import json
import os
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime

from openpyxl import Workbook, load_workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'Reviewencer-data-tracker.xlsx')
SERP_DIR = os.path.join(ROOT, 'data', 'serp')
STATUSES = ['Not started', 'Pilot', 'Discovering', 'Discovered', 'Imported', 'Live', 'Excluded']


def load_env():
    env = {}
    with open(os.path.join(ROOT, '.env.local'), encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.lstrip().startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env


ENV = load_env()
BASE = ENV['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1/'
KEY = ENV['NEXT_PUBLIC_SUPABASE_ANON_KEY']


def rest(path, rng=None):
    req = urllib.request.Request(BASE + path, headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    if rng:
        req.add_header('Range', rng)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def fetch_all(path, page=1000):
    rows, start = [], 0
    while True:
        batch = rest(path, f'{start}-{start + page - 1}')
        rows += batch
        if len(batch) < page:
            return rows
        start += page


# ---------- live database ----------
categories = rest('categories?select=id,slug,name_en,sort_order,life_moment:life_moments(name_en,sort_order)')
categories.sort(key=lambda c: (c['life_moment']['sort_order'], c['sort_order'], c['name_en']))
businesses = fetch_all('businesses?select=id,category_id,address,emirate_id,logo_url,website,phone,lat,google_place_id,name_ar,source&order=id')
reviews = fetch_all('reviews?select=business_id&moderation_status=eq.published')

DB_FIELDS = [  # (header, test)
    ('With address', lambda b: bool(b['address'])),
    ('With emirate', lambda b: bool(b['emirate_id'])),
    ('With logo', lambda b: bool(b['logo_url'])),
    ('With website', lambda b: bool(b['website'])),
    ('With phone', lambda b: bool(b['phone'])),
    ('With map location', lambda b: b['lat'] is not None),
    ('With Google ID', lambda b: bool(b['google_place_id'])),
    ('With Arabic name', lambda b: bool(b['name_ar'])),
]
db = defaultdict(lambda: [0] * (1 + len(DB_FIELDS)))
cat_of_business = {}
for b in businesses:
    row = db[b['category_id']]
    row[0] += 1
    for i, (_, test) in enumerate(DB_FIELDS, 1):
        row[i] += test(b)
    cat_of_business[b['id']] = b['category_id']
review_count = defaultdict(int)
for r in reviews:
    review_count[cat_of_business.get(r['business_id'])] += 1

# ---------- SerpAPI discovery ----------
SERP_FIELDS = [
    ('With website', lambda p: bool(p.get('website'))),
    ('With phone', lambda p: bool(p.get('phone'))),
    ('With hours', lambda p: bool(p.get('operating_hours') or p.get('hours'))),
    ('With map location', lambda p: bool(p.get('gps_coordinates'))),
    ('30+ Google reviews', lambda p: (p.get('reviews') or 0) >= 30),
]
serp_searches = defaultdict(int)
serp_places = defaultdict(dict)  # slug -> place_id -> place (deduped across runs)
runs = []
for run_dir in sorted(glob.glob(os.path.join(SERP_DIR, '*'))):
    files = [f for f in glob.glob(os.path.join(run_dir, '*__p*.json'))]
    if not files:
        continue
    spent, found, mtimes = 0, set(), []
    for f in files:
        data = json.load(open(f, encoding='utf-8'))
        slug = os.path.basename(f).split('__')[0]
        if 'search_metadata' in data:  # a real (paid) search, not a "no next page" placeholder
            spent += 1
            serp_searches[slug] += 1
            mtimes.append(os.path.getmtime(f))
        for p in data.get('local_results', []):
            pid = p.get('place_id') or p.get('data_id')
            serp_places[slug].setdefault(pid, p)
            found.add(pid)
    runs.append((os.path.basename(run_dir), datetime.fromtimestamp(max(mtimes)).strftime('%Y-%m-%d') if mtimes else '', spent, len(found)))

searches_left = None
if ENV.get('SERPAPI_KEY'):
    try:  # account lookup is free — it does not use a search
        with urllib.request.urlopen('https://serpapi.com/account.json?api_key=' + urllib.parse.quote(ENV['SERPAPI_KEY']), timeout=30) as r:
            searches_left = json.load(r).get('total_searches_left')
    except Exception as e:  # noqa: BLE001 — tracker still builds without it
        print('SerpAPI account lookup failed:', e)

# ---------- keep the user's inputs from the previous workbook ----------
kept = {}
if os.path.exists(OUT):
    old = load_workbook(OUT)
    if 'Tracker' in old.sheetnames:
        ws_old = old['Tracker']
        hdr = {ws_old.cell(5, c).value: c for c in range(1, ws_old.max_column + 1)}
        if {'Slug', 'Status', 'Target # businesses', 'Notes'} <= hdr.keys():
            for r in range(6, ws_old.max_row + 1):
                slug = ws_old.cell(r, hdr['Slug']).value
                if slug and slug != 'TOTAL':
                    kept[slug] = tuple(ws_old.cell(r, hdr[h]).value for h in ('Status', 'Target # businesses', 'Notes'))

# ---------- workbook ----------
F = 'Arial'
font = lambda **k: Font(name=F, size=k.pop('size', 10), **k)  # noqa: E731
NAVY, BLUE_IN = '1F2A5A', '0000FF'
fill = lambda hex_: PatternFill('solid', start_color=hex_, end_color=hex_)  # noqa: E731
thin = Side(style='thin', color='D0D5E2')
box = Border(left=thin, right=thin, top=thin, bottom=thin)
center = Alignment(horizontal='center', vertical='center', wrap_text=True)

wb = Workbook()
ws = wb.active
ws.title = 'Tracker'

cols = (['Life moment', 'Category', 'Slug', 'Businesses in DB'] + [h for h, _ in DB_FIELDS]
        + ['DB data completeness', 'Published reviews', 'Searches spent', 'Places found']
        + [h for h, _ in SERP_FIELDS] + ['Discovery data completeness', 'Status', 'Target # businesses', 'Gap vs target', 'Notes'])
C = {h: get_column_letter(i + 1) for i, h in enumerate(cols)}
# Two columns share a label in different sections — address them by position.
db_cols = [get_column_letter(5 + i) for i in range(len(DB_FIELDS))]                 # E..L
serp_first = cols.index('Places found') + 2
serp_cols = [get_column_letter(serp_first + i) for i in range(len(SERP_FIELDS))]  # R..V
c_db, c_dbpct, c_rev = 'D', get_column_letter(5 + len(DB_FIELDS)), get_column_letter(6 + len(DB_FIELDS))
c_spent, c_found = get_column_letter(7 + len(DB_FIELDS)), get_column_letter(8 + len(DB_FIELDS))
c_serppct = get_column_letter(serp_first + len(SERP_FIELDS))
c_status, c_target, c_gap, c_notes = [get_column_letter(serp_first + len(SERP_FIELDS) + i) for i in range(1, 5)]

ws['A1'] = 'Reviewencer — business data tracker'
ws['A1'].font = font(size=14, bold=True, color=NAVY)
ws['A2'] = (f'Generated {datetime.now():%Y-%m-%d %H:%M} from the live database ({len(businesses):,} businesses) '
            f'and SerpAPI discovery runs in data/serp/. Refresh: python scripts/data_tracker.py')
ws['A2'].font = font(italic=True, color='6B7280')

groups = [('Category', 'A', 'C', 'E8EBF5'), ('Current database (live)', 'D', c_rev, 'DCE8FB'),
          ('SerpAPI discovery', c_spent, c_serppct, 'E6F4EA'), ('Plan (you edit these)', c_status, c_notes, 'FFF4CC')]
for label, a, b, color in groups:
    ws.merge_cells(f'{a}4:{b}4')
    cell = ws[f'{a}4']
    cell.value, cell.font, cell.fill, cell.alignment = label, font(bold=True, color=NAVY), fill(color), center
    for col in range(ws[f'{a}4'].column, ws[f'{b}4'].column + 1):
        ws.cell(5, col).fill = fill(color)
for i, h in enumerate(cols, 1):
    c = ws.cell(5, i, h)
    c.font, c.alignment, c.border = font(bold=True, color=NAVY), center, box
ws.row_dimensions[5].height = 42

first = 6
for n, cat in enumerate(categories):
    r = first + n
    d = db[cat['id']]
    places = serp_places.get(cat['slug'], {})
    status, target, notes = kept.get(cat['slug'], (None, None, None))
    if not status:
        status = 'Pilot' if places else 'Not started'
    values = ([cat['life_moment']['name_en'], cat['name_en'], cat['slug'], d[0]] + d[1:]
              + [f'=IFERROR(SUM({db_cols[0]}{r}:{db_cols[-1]}{r})/({len(DB_FIELDS)}*{c_db}{r}),0)', review_count[cat['id']],
                 serp_searches.get(cat['slug'], 0), len(places)]
              + [sum(1 for p in places.values() if test(p)) for _, test in SERP_FIELDS]
              + [f'=IFERROR(SUM({serp_cols[0]}{r}:{serp_cols[-1]}{r})/({len(SERP_FIELDS)}*{c_found}{r}),0)',
                 status, target, f'=IF({c_target}{r}="","",{c_target}{r}-{c_found}{r})', notes])
    for i, v in enumerate(values, 1):
        c = ws.cell(r, i, v)
        c.font, c.border = font(), box
    for col in (c_status, c_target, c_notes):
        ws[f'{col}{r}'].fill = fill('FFF4CC')
        ws[f'{col}{r}'].font = font(color=BLUE_IN)
last = first + len(categories) - 1

tot = last + 1
ws.cell(tot, 1, 'TOTAL').font = font(bold=True)
ws.cell(tot, 3, 'TOTAL').font = font(bold=True, color='9CA3AF')
for col in [c_db] + db_cols + [c_rev, c_spent, c_found] + serp_cols + [c_target]:
    ws[f'{col}{tot}'] = f'=SUM({col}{first}:{col}{last})'
ws[f'{c_dbpct}{tot}'] = f'=IFERROR(SUM({db_cols[0]}{tot}:{db_cols[-1]}{tot})/({len(DB_FIELDS)}*{c_db}{tot}),0)'
ws[f'{c_serppct}{tot}'] = f'=IFERROR(SUM({serp_cols[0]}{tot}:{serp_cols[-1]}{tot})/({len(SERP_FIELDS)}*{c_found}{tot}),0)'
ws[f'{c_gap}{tot}'] = f'=IF({c_target}{tot}=0,"",{c_target}{tot}-{c_found}{tot})'
for i in range(1, len(cols) + 1):
    c = ws.cell(tot, i)
    c.font, c.border, c.fill = font(bold=True), Border(top=Side(style='medium', color=NAVY)), fill('F3F4F6')

for r in range(first, tot + 1):
    for col in [c_db] + db_cols + [c_rev, c_spent, c_found] + serp_cols + [c_target, c_gap]:
        ws[f'{col}{r}'].number_format = '#,##0;-#,##0;"-"'
        ws[f'{col}{r}'].alignment = Alignment(horizontal='right')
    for col in (c_dbpct, c_serppct):
        ws[f'{col}{r}'].number_format = '0%;-0%;"-"'
        ws[f'{col}{r}'].alignment = Alignment(horizontal='center')
for col in (c_dbpct, c_serppct):
    ws.conditional_formatting.add(f'{col}{first}:{col}{last}', ColorScaleRule(
        start_type='num', start_value=0, start_color='F8D7DA', mid_type='num', mid_value=0.5,
        mid_color='FFF4CC', end_type='num', end_value=1, end_color='D4EDDA'))

dv = DataValidation(type='list', formula1='"' + ','.join(STATUSES) + '"', allow_blank=True)
ws.add_data_validation(dv)
dv.add(f'{c_status}{first}:{c_status}{last}')

ws[f'{c_dbpct}5'].comment = Comment(f'Share of the {len(DB_FIELDS)} data fields (address … Arabic name) filled, across this category\'s businesses.', 'tracker')
ws[f'{c_serppct}5'].comment = Comment(f'Share of the {len(SERP_FIELDS)} discovery fields (website … 30+ reviews) present, across places found.', 'tracker')
ws[f'{c_found}5'].comment = Comment('Unique Google places found by SerpAPI for this category (deduplicated by Google place ID). Not yet in the database.', 'tracker')
ws[f'{c_gap}5'].comment = Comment('Target minus places found. Blank until you set a target.', 'tracker')

widths = {'A': 20, 'B': 30, 'C': 20}
for i in range(1, len(cols) + 1):
    L = get_column_letter(i)
    ws.column_dimensions[L].width = widths.get(L, 11)
ws.column_dimensions[c_status].width = 14
ws.column_dimensions[c_notes].width = 40
ws.freeze_panes = 'D6'
ws.auto_filter.ref = f'A5:{c_notes}{last}'

# ---------- Summary ----------
sm = wb.create_sheet('Summary')
sm['A1'] = 'Summary'
sm['A1'].font = font(size=14, bold=True, color=NAVY)
T = lambda col: f"=Tracker!{col}{tot}"  # noqa: E731
rows = [
    ('Current database', None, None),
    ('Businesses in database', T(c_db), '#,##0'),
    ('…of which legacy (old scraped list, to be replaced)', sum(1 for b in businesses if b['source'] == 'legacy_import'), '#,##0'),
    ('DB data completeness', T(c_dbpct), '0%'),
    ('Published reviews', T(c_rev), '#,##0'),
    ('Categories with businesses', f'=COUNTIF(Tracker!{c_db}{first}:{c_db}{last},">0")', '#,##0'),
    (None, None, None),
    ('SerpAPI discovery', None, None),
    ('Places found (not yet imported)', T(c_found), '#,##0'),
    ('Discovery data completeness', T(c_serppct), '0%'),
    ('Categories with discovery started', f'=COUNTIF(Tracker!{c_found}{first}:{c_found}{last},">0")', '#,##0'),
    (None, None, None),
    ('SerpAPI budget', None, None),
    ('Monthly searches on plan', 5000, '#,##0'),
    ('Searches spent (all runs in data/serp/)', T(c_spent), '#,##0'),
    ('Searches left this month (SerpAPI account)', searches_left, '#,##0'),
]
r = 3
for label, val, fmt in rows:
    if label is None:
        r += 1
        continue
    a = sm.cell(r, 1, label)
    if val is None and fmt is None:
        a.font = font(bold=True, color=NAVY)
        a.fill = fill('E8EBF5')
        sm.cell(r, 2).fill = fill('E8EBF5')
    else:
        a.font = font()
        b = sm.cell(r, 2, val)
        b.number_format = fmt or 'General'
        b.font = font(color=BLUE_IN) if isinstance(val, (int, float)) else font()
    r += 1
notes = {
    'Monthly searches on plan': 'From Basem: SerpAPI Developer plan, 5,000 searches/month. Edit if the plan changes.',
    'Searches left this month (SerpAPI account)': f'Read from the SerpAPI account page at {datetime.now():%Y-%m-%d %H:%M} (free lookup). Refreshes when the tracker is regenerated.',
    '…of which legacy (old scraped list, to be replaced)': 'Businesses with source = legacy_import, counted when the tracker was generated.',
}
for row in sm.iter_rows(min_row=3, max_col=2):
    if row[0].value in notes:
        row[1].comment = Comment(notes[row[0].value], 'tracker')
sm.column_dimensions['A'].width = 46
sm.column_dimensions['B'].width = 14

# ---------- SerpAPI runs ----------
rs = wb.create_sheet('SerpAPI runs')
for i, h in enumerate(['Run', 'Last search date', 'Searches spent', 'Unique places found'], 1):
    c = rs.cell(1, i, h)
    c.font, c.fill, c.border, c.alignment = font(bold=True, color=NAVY), fill('E6F4EA'), box, center
for n, (name, date, spent, found) in enumerate(runs, 2):
    for i, v in enumerate((name, date, spent, found), 1):
        rs.cell(n, i, v).font = font()
end = max(len(runs) + 1, 2)
rs.cell(end + 1, 1, 'TOTAL').font = font(bold=True)
rs.cell(end + 1, 3, f'=SUM(C2:C{end})').font = font(bold=True)
rs.cell(end + 1, 4, f'=SUM(D2:D{end})').font = font(bold=True)
rs.cell(end + 2, 1, 'Unique places per run; the Tracker deduplicates across runs, so its total can be lower.').font = font(italic=True, color='6B7280')
for L, w in zip('ABCD', (24, 16, 15, 20)):
    rs.column_dimensions[L].width = w

# ---------- Legend ----------
lg = wb.create_sheet('Legend')
lines = [
    ('How to read this tracker', True),
    ('Tracker: one row per category in the app (life moment → category). Grey/blue/green/yellow header bands group the columns.', False),
    ('Current database (live): businesses currently in the app and how many have each piece of data. "-" means zero.', False),
    ('SerpAPI discovery: businesses found on Google Maps via SerpAPI, saved locally and NOT yet imported into the app.', False),
    ('Completeness %: share of data fields filled. Red = mostly missing, yellow = half, green = complete.', False),
    ('', False),
    ('What you can edit', True),
    ('Only the yellow cells in the "Plan" columns: Status (drop-down), Target # businesses, Notes. They are kept when the tracker is refreshed.', False),
    ('Example: Status = Discovered, Target # businesses = 400, Notes = "Skip food courts; include cloud kitchens?"', False),
    ('Summary → "Monthly searches on plan" (blue) is the SerpAPI plan size — change it if the plan changes.', False),
    ('', False),
    ('How to refresh', True),
    ('Ask Claude to "refresh the data tracker", or run: python scripts/data_tracker.py (in the reviewencer folder).', False),
    ('', False),
    ('Notes', True),
    ('All 11,039 businesses currently in the database are the legacy scraped list (source = legacy_import), due to be replaced by the rebuild.', False),
    ('Google ratings/review counts are used only to filter and rank discovery results; they are never shown as Reviewencer ratings.', False),
]
for i, (text, bold) in enumerate(lines, 1):
    c = lg.cell(i, 1, text)
    c.font = font(bold=bold, color=NAVY if bold else '111827', size=12 if bold else 10)
lg.column_dimensions['A'].width = 130

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)
print(f'Wrote {OUT}: {len(categories)} categories, {len(businesses):,} businesses, '
      f'{sum(len(v) for v in serp_places.values()):,} discovered places, searches left: {searches_left}')
