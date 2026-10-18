const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://emlugufvlypbkyudforz.supabase.co',
  'sb_publishable_HzeoAsSKJGrpT7TxoW7t6w_0zRKmvGm'
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
  'fab': 'bankfab.com', 'adcb': 'adcb.com', 'mashreq': 'mashreqbank.com',
  'adib': 'adib.ae', 'dib': 'dib.ae', 'rakbank': 'rakbank.ae',
  'cbd': 'cbd.ae', 'hsbc': 'hsbc.ae', 'du': 'du.ae',
  'etisalat': 'eand.com', 'emirates': 'emirates.com',
  'flydubai': 'flydubai.com', 'air arabia': 'airarabia.com',
  'etihad': 'etihad.com', 'aster': 'asterhospitals.ae',
  'mediclinic': 'mediclinic.ae', 'nmc': 'nmc.ae',
  'fitness first': 'fitnessfirst.ae', 'gold': 'goldsgym.com',
  'gymnation': 'gymnation.ae', 'warehouse gym': 'warehousegym.ae',
  'f45': 'f45training.com', 'barrys': 'barrys.com',
  'dubai mall': 'thedubaimall.com', 'mall of the emirates': 'malloftheemirates.com',
  'ibn battuta': 'ibnbattutamall.com', 'festival city': 'dubaifestivalcitymall.com',
  'global village': 'globalvillage.ae', 'ski dubai': 'skidxb.com',
  'img worlds': 'imgworlds.com', 'kidzania': 'kidzania.ae',
  'property finder': 'propertyfinder.ae', 'bayut': 'bayut.com',
  'dubizzle': 'dubizzle.com', 'emaar': 'emaar.com', 'damac': 'damacproperties.com',
  'justlife': 'justlife.com', 'servicemarket': 'servicemarket.com',
  'adnoc': 'adnocdistribution.ae', 'enoc': 'enoc.com',
  'mcdonalds': 'mcdonalds.com', 'mcdonald': 'mcdonalds.com',
  'kfc': 'kfc.com', 'burger king': 'burgerking.com',
  'pizza hut': 'pizzahut.com', 'subway': 'subway.com', 'starbucks': 'starbucks.com',
  'costa': 'costacoffee.com', 'tim hortons': 'timhortons.com',
  'shake shack': 'shakeshack.com', 'nandos': 'nandos.com',
  'life pharmacy': 'lifepharmacy.com', 'boots': 'bootsretail.ae',
}

function deriveDomain(name) {
  const lower = name.toLowerCase()
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    if (lower.includes(key)) return domain
  }
  const first = lower.split(/[\s,|()\-&]/)[0].replace(/[^a-z0-9]/g, '')
  return first + '.com'
}

async function checkLogo(domain) {
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`, { redirect: 'follow' })
    return res.ok ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256` : null
  } catch {
    return null
  }
}

async function run() {
  const { data: businesses } = await supabase.from('businesses').select('id, name, logo_emoji')
  const needsLogo = businesses.filter(b => !b.logo_emoji?.startsWith('http'))
  console.log(`Checking ${needsLogo.length} businesses...`)

  const updates = []
  const missing = []

  for (let i = 0; i < needsLogo.length; i += 10) {
    const chunk = needsLogo.slice(i, i + 10)
    await Promise.all(chunk.map(async (b) => {
      const domain = deriveDomain(b.name)
      const url = await checkLogo(domain)
      if (url) updates.push({ id: b.id, url })
      else missing.push(b.name)
    }))
    if ((i + 10) % 50 === 0) process.stdout.write(`\r${Math.min(i + 10, needsLogo.length)}/${needsLogo.length}`)
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nFound: ${updates.length} | Missing: ${missing.length}`)

  const values = updates.map(u => `('${u.id}', '${u.url}')`).join(',\n  ')
  const sql = `UPDATE businesses AS b
SET logo_emoji = v.url
FROM (VALUES
  ${values}
) AS v(id, url)
WHERE b.id = v.id::uuid;`

  fs.writeFileSync('scripts/favicon_update.sql', sql)
  fs.writeFileSync('scripts/missing_logos.json', JSON.stringify(missing, null, 2))
  console.log(`SQL saved to scripts/favicon_update.sql (${Math.round(sql.length/1024)}KB)`)
  console.log('Missing list saved to scripts/missing_logos.json')
}

run().catch(console.error)
