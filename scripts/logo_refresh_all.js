const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Service key bypasses RLS for all writes
// Run with: SUPABASE_SECRET_KEY=... node scripts/logo_refresh_all.js
if (!process.env.SUPABASE_SECRET_KEY) throw new Error('Set SUPABASE_SECRET_KEY')
const supabase = createClient(
  'https://emlugufvlypbkyudforz.supabase.co',
  process.env.SUPABASE_SECRET_KEY
)

const KNOWN_DOMAINS = {
  'talabat': 'talabat.com', 'deliveroo': 'deliveroo.ae', 'careem': 'careem.com',
  'noon': 'noon.com', 'amazon': 'amazon.ae', 'namshi': 'namshi.com',
  'ounass': 'ounass.ae', 'carrefour': 'carrefouruae.com', 'cafu': 'cafu.com',
  'washmen': 'washmen.com', 'uber': 'uber.com', 'hala': 'halaride.com',
  'zofeur': 'zofeur.com', 'shein': 'shein.com', 'temu': 'temu.com',
  'trendyol': 'trendyol.com', 'centrepoint': 'centrepoint.com',
  'max fashion': 'maxfashion.com', 'sharaf dg': 'sharafdg.com',
  'extra': 'extra.com', 'mumzworld': 'mumzworld.com', 'sivvi': 'sivvi.com',
  'brands for less': 'brandsforless.com', 'virgin megastore': 'virginmegastore.ae',
  'lulu': 'luluhypermarket.com', 'spinneys': 'spinneys.com',
  'waitrose': 'waitrose.ae', 'choithrams': 'choithrams.com',
  'union coop': 'unioncoop.ae', 'al maya': 'almayagroup.com',
  'instashop': 'instashop.ae', 'kibsons': 'kibsons.com',
  'elgrocer': 'elgrocer.com', 'emirates nbd': 'emiratesnbd.com',
  'fab ': 'bankfab.com', 'first abu dhabi': 'bankfab.com',
  'adcb': 'adcb.com', 'mashreq': 'mashreqbank.com',
  'adib': 'adib.ae', 'dubai islamic': 'dib.ae', 'rakbank': 'rakbank.ae',
  'rak bank': 'rakbank.ae', 'cbd': 'cbd.ae', 'hsbc': 'hsbc.ae',
  'du telecom': 'du.ae', ' du ': 'du.ae', 'etisalat': 'eand.com', 'e&': 'eand.com',
  'emirates airline': 'emirates.com', 'flydubai': 'flydubai.com',
  'air arabia': 'airarabia.com', 'etihad': 'etihad.com',
  'aster': 'asterhospitals.ae', 'mediclinic': 'mediclinic.ae', 'nmc': 'nmc.ae',
  'cleveland clinic': 'clevelandclinicabudhabi.ae',
  "king's college": 'kingscollegehospital.ae', 'zulekha': 'zulekha.com',
  'fitness first': 'fitnessfirst.ae', "gold's gym": 'goldsgym.com',
  'gymnation': 'gymnation.ae', 'warehouse gym': 'warehousegym.ae',
  'f45': 'f45training.com', "barry's": 'barrys.com', 'orangetheory': 'orangetheory.com',
  'dubai mall': 'thedubaimall.com', 'mall of the emirates': 'malloftheemirates.com',
  'ibn battuta': 'ibnbattutamall.com', 'festival city': 'dubaifestivalcitymall.com',
  'mirdif city': 'mirdifcitycentre.com', 'yas mall': 'yasmall.ae',
  'burjuman': 'burjuman.com', 'wafi': 'wafi.com',
  'global village': 'globalvillage.ae', 'ski dubai': 'skidxb.com',
  'img worlds': 'imgworlds.com', 'kidzania': 'kidzania.ae',
  'ain dubai': 'aindubai.com', 'motiongate': 'motiongatedubai.com',
  'legoland': 'legoland.ae', 'bollywood parks': 'bollywoodparksdubai.com',
  'property finder': 'propertyfinder.ae', 'bayut': 'bayut.com',
  'dubizzle': 'dubizzle.com', 'emaar': 'emaar.com', 'damac': 'damacproperties.com',
  'nakheel': 'nakheel.com', 'aldar': 'aldar.com',
  'justlife': 'justlife.com', 'servicemarket': 'servicemarket.com',
  'mrusta': 'mrusta.com',
  'adnoc': 'adnocdistribution.ae', 'enoc': 'enoc.com', 'emarat': 'emarat.ae',
  'mcdonald': 'mcdonalds.com', 'kfc': 'kfc.com', 'burger king': 'burgerking.com',
  'pizza hut': 'pizzahut.com', 'subway': 'subway.com', 'starbucks': 'starbucks.com',
  'costa coffee': 'costacoffee.com', 'tim hortons': 'timhortons.com',
  'shake shack': 'shakeshack.com', "nando's": 'nandos.com', 'nandos': 'nandos.com',
  'hardee': 'hardees.com', 'five guys': 'fiveguys.com',
  'cheesecake factory': 'thecheesecakefactory.com', 'applebee': 'applebees.com',
  'texas roadhouse': 'texasroadhouse.com', 'zaatar': 'zaatarwzeit.com',
  'dunkin': 'dunkindonuts.com', 'caribou': 'cariboucoffee.com',
  'life pharmacy': 'lifepharmacy.com', 'boots': 'bootsretail.ae',
  'binsina': 'binsina.com', 'aster pharmacy': 'asterpharmacy.ae',
  'spinneys': 'spinneys.com', 'geant': 'geant.ae',
  'ikea': 'ikea.com', 'zara': 'zara.com', 'h&m': 'hm.com',
  'marks & spencer': 'marksandspencer.com', 'next': 'next.co.uk',
  'gap': 'gap.com', 'mothercare': 'mothercare.com',
  'marriott': 'marriott.com', 'hilton': 'hilton.com', 'hyatt': 'hyatt.com',
  'radisson': 'radissonhotels.com', 'accor': 'accor.com',
  'four seasons': 'fourseasons.com', 'ritz-carlton': 'ritzcarlton.com',
  'intercontinental': 'ihg.com', 'holiday inn': 'ihg.com',
  'rotana': 'rotana.com', 'movenpick': 'movenpick.com', 'novotel': 'novotel.com',
  'ibis': 'ibis.com', 'premier inn': 'premierinn.com',
  'jumeirah': 'jumeirah.com', 'atlantis': 'atlantis.com',
  'address hotel': 'addresshotels.com', 'palazzo versace': 'palazzoversace.ae',
}

function deriveDomain(name) {
  const lower = ' ' + name.toLowerCase() + ' '
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (lower.includes(key)) return domain
  }
  const first = name.toLowerCase().split(/[\s,|()\-&/]/)[0].replace(/[^a-z0-9]/g, '')
  return first + '.com'
}

let clearbitWorks = null // null = untested, true/false after first attempt

async function checkClearbit(domain) {
  if (clearbitWorks === false) return null
  try {
    const res = await fetch(`https://logo.clearbit.com/${domain}`, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    if (clearbitWorks === null) clearbitWorks = res.ok || res.status === 404 // reachable
    return res.ok ? `https://logo.clearbit.com/${domain}` : null
  } catch {
    if (clearbitWorks === null) { clearbitWorks = false; console.log('  Clearbit unreachable — skipping') }
    return null
  }
}

async function checkGoogleFavicon(domain) {
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`, { redirect: 'follow', signal: AbortSignal.timeout(5000) })
    return res.ok ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256` : null
  } catch {
    return null
  }
}

async function fetchAllBusinesses() {
  const pageSize = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('businesses').select('id, name, logo_emoji').range(from, from + pageSize - 1)
    if (error) { console.error('Fetch error:', error.message); break }
    if (!data?.length) break
    all.push(...data)
    process.stdout.write(`\rFetched ${all.length} businesses...`)
    if (data.length < pageSize) break
    from += pageSize
  }
  console.log()
  return all
}

async function run() {
  console.log('Fetching all businesses...')
  const all = await fetchAllBusinesses()
  console.log(`Total businesses: ${all.length}`)

  const needsLogo = all.filter(b => !b.logo_emoji?.startsWith('http'))
  console.log(`Need logos: ${needsLogo.length} | Already have image URL: ${all.length - needsLogo.length}`)

  const updates = []
  const missing = []
  let clearbitHits = 0, googleHits = 0
  const startTime = Date.now()

  for (let i = 0; i < needsLogo.length; i += 10) {
    const chunk = needsLogo.slice(i, i + 10)

    await Promise.all(chunk.map(async (b) => {
      const domain = deriveDomain(b.name)
      let url = await checkClearbit(domain)
      if (url) { clearbitHits++; updates.push({ id: b.id, url }) ; return }
      url = await checkGoogleFavicon(domain)
      if (url) { googleHits++; updates.push({ id: b.id, url }); return }
      missing.push(b.name)
    }))

    await new Promise(r => setTimeout(r, 80))

    if ((i + 10) % 100 === 0 || i + 10 >= needsLogo.length) {
      const done = Math.min(i + 10, needsLogo.length)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      const eta = Math.round((needsLogo.length - done) / (done / elapsed))
      process.stdout.write(`\r[${done}/${needsLogo.length}] Found: ${updates.length} | Missing: ${missing.length} | ETA: ${eta}s  `)
    }
  }

  console.log(`\n\nClearbit: ${clearbitHits} | Google favicons: ${googleHits} | Need serpapi: ${missing.length}`)
  console.log(`Updating ${updates.length} businesses in DB...`)

  // Update in batches of 500 using service key (bypasses RLS)
  let updated = 0
  for (let i = 0; i < updates.length; i += 500) {
    const batch = updates.slice(i, i + 500)
    await Promise.all(batch.map(u =>
      supabase.from('businesses').update({ logo_emoji: u.url }).eq('id', u.id)
    ))
    updated += batch.length
    process.stdout.write(`\rUpdated ${updated}/${updates.length}...`)
  }

  const outDir = path.join(__dirname)
  fs.writeFileSync(path.join(outDir, 'missing_logos.json'), JSON.stringify(missing, null, 2))
  console.log(`\n\nDone! ${updates.length} logos updated in DB.`)
  console.log(`${missing.length} businesses need serpapi — saved to scripts/missing_logos.json`)
}

run().catch(console.error)
