// What search engines and link previews read, built on the server from the site's content as published
// (src/data/*.js plus the portal's changes in site.json), so it always matches the page:
//   - head: canonical URL, Open Graph / X card tags, verification tags (from env), and JSON-LD structured
//     data (a TravelAgency, its trips, the questions)
//   - the trips and questions as plain HTML inside their containers, for crawlers and previews that don't
//     run JavaScript; the page's script replaces them with the designed versions
//   - robots.txt and sitemap.xml (the page, and its photos for image search)
import { brand, itineraries, faqs } from '../src/data/content.js';
import { textFields } from '../src/data/fields.js';

export const SITE_URL = (process.env.SITE_URL || 'https://hinenisafaris.com').replace(/\/+$/, '');
const NAME = 'Hineni Safaris';

// the shipped wording, by field id; the portal's version wins (site.text)
const defaults = Object.fromEntries(textFields().map((f) => [f.id, f.get()]));
const words = (site) => (id) => (typeof site.text?.[id] === 'string' ? site.text[id] : defaults[id] ?? '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// "From USD 480 per person" → a number and currency for the structured data; anything else is left out
function priceOf(text) {
  const m = String(text).match(/(USD|US\$|\$|UGX|EUR|€|GBP|£)\s?([\d,.]+)|([\d,.]+)\s?(USD|UGX|EUR|GBP)/i);
  if (!m) return null;
  const cur = (m[1] || m[4]).toUpperCase().replace('US$', 'USD').replace('$', 'USD').replace('€', 'EUR').replace('£', 'GBP');
  const value = Number((m[2] || m[3]).replace(/,/g, ''));
  return value > 0 ? { price: value, priceCurrency: cur } : null;
}

function content(site) {
  const t = words(site);
  const trips = itineraries.map((it) => ({
    id: it.id,
    name: `${t(`trip.${it.id}.name`)} ${t(`trip.${it.id}.em`)}`.trim(),
    blurb: t(`trip.${it.id}.blurb`),
    days: t(`trip.${it.id}.days`),
    season: t(`trip.${it.id}.season`),
    route: t(`trip.${it.id}.route`),
    price: t(`trip.${it.id}.price`),
  }));
  const questions = faqs.map((f, i) => ({ q: t(`faq.${i}.q`), a: t(`faq.${i}.a`), show: t(`faq.${i}.show`) !== '0' })).filter((f) => f.show && f.q);
  return {
    offer: t('brand.offer'), email: t('brand.email'), phone: t('brand.phone'), whatsapp: t('brand.whatsapp').replace(/\D/g, ''),
    base: t('brand.base') || brand.base, trips, questions,
  };
}

export function seoHead(site) {
  const c = content(site);
  const org = `${SITE_URL}/#org`;
  const graph = [
    {
      '@type': 'TravelAgency', '@id': org, name: NAME, alternateName: brand.name, url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.png`, image: `${SITE_URL}/og.jpg`, description: c.offer,
      email: c.email || undefined, telephone: c.phone || undefined,
      address: { '@type': 'PostalAddress', addressLocality: c.base.split(',')[0].trim(), addressCountry: 'UG' },
      areaServed: { '@type': 'Country', name: 'Uganda' },
      sameAs: c.whatsapp ? [`https://wa.me/${c.whatsapp}`] : undefined,
    },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: NAME, publisher: { '@id': org }, inLanguage: 'en' },
    ...c.trips.map((tr) => {
      const p = priceOf(tr.price);
      return {
        '@type': 'TouristTrip', name: tr.name, description: tr.blurb, url: `${SITE_URL}/#trips`,
        touristType: 'Small groups', provider: { '@id': org },
        offers: p ? { '@type': 'Offer', ...p, availability: 'https://schema.org/InStock', url: `${SITE_URL}/#enquire` } : undefined,
      };
    }),
    ...(c.questions.length ? [{
      '@type': 'FAQPage', '@id': `${SITE_URL}/#faq`,
      mainEntity: c.questions.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }] : []),
  ];
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  const title = `${NAME}: small-group safaris and hikes in Uganda`;
  const verify = [
    process.env.GOOGLE_SITE_VERIFICATION && `<meta name="google-site-verification" content="${esc(process.env.GOOGLE_SITE_VERIFICATION)}" />`,
    process.env.BING_SITE_VERIFICATION && `<meta name="msvalidate.01" content="${esc(process.env.BING_SITE_VERIFICATION)}" />`,
  ].filter(Boolean).join('');
  return `<link rel="canonical" href="${SITE_URL}/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${NAME}" />
  <meta property="og:url" content="${SITE_URL}/" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(c.offer)}" />
  <meta property="og:image" content="${SITE_URL}/og.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Elephants at the water's edge on a Hineni safari in Uganda" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(c.offer)}" />
  <meta name="twitter:image" content="${SITE_URL}/og.jpg" />
  ${verify}<script type="application/ld+json">${ld}</script>`;
}

// the trips and questions as plain HTML, in the containers the page's script fills
export function seoBody(page, site) {
  const c = content(site);
  const trips = c.trips.map((tr) => `<article class="trip-card"><h3>${esc(tr.name)}</h3><p>${esc(tr.blurb)}</p><p>${esc([tr.days, tr.route, tr.season, tr.price].filter(Boolean).join('. '))}</p></article>`).join('');
  const questions = c.questions.map((f) => `<details class="faq"><summary><span>${esc(f.q)}</span></summary><p>${esc(f.a)}</p></details>`).join('');
  return page
    .replace('<div class="trips__grid" id="tripsGrid"></div>', `<div class="trips__grid" id="tripsGrid">${trips}</div>`)
    .replace('<div class="faqs__list" id="faqList"></div>', `<div class="faqs__list" id="faqList">${questions}</div>`);
}

export const robots = () => `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;

// one page, with its photos for image search (the site's own, plus uploads still on the site)
export function sitemap(site, shippedPhotos) {
  const hidden = new Set(site.hidden || []);
  const keys = [...Object.keys(shippedPhotos), ...Object.keys(site.photos || {})].filter((k) => !hidden.has(k)).slice(0, 1000);
  const img = (k) => `<image:image><image:loc>${SITE_URL}/${k.startsWith('u-') ? 'uploads' : 'media'}/${k}-1600.webp</image:loc></image:image>`;
  const lastmod = new Date(site.updated || Date.now()).toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${SITE_URL}/</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority>${keys.map(img).join('')}</url>
</urlset>
`;
}
