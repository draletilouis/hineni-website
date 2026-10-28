// Every piece of wording the admin portal can change ("Words & details"), and where it lands on the page.
// The ids are stored in the live site file (site.json → text): keep them stable.
//   kind   text | long (a paragraph) | email | phone | switch ("1" on, "0" off)
//   get()  the wording as the site ships;  set(v)  applies the portal's version
import { brand, itineraries, experiences, stories, faqs, about, game } from './content.js';

export function textFields() {
  const out = [];
  const add = (group, id, label, obj, prop, extra = {}) => out.push({
    group, id, label, kind: 'text', max: 160,
    get: () => obj[prop] ?? '',
    set: (v) => { obj[prop] = v; },
    ...extra,
  });

  // contact details: every WhatsApp button, mailto link and the footer use these
  add('Contact details', 'brand.email', 'Email for enquiries', brand, 'email', { kind: 'email', max: 120 });
  add('Contact details', 'brand.whatsapp', 'WhatsApp number', brand, 'whatsapp', {
    kind: 'phone', max: 20, hint: 'Country code and number, digits only: 256700000000',
    set: (v) => { brand.whatsapp = v.replace(/\D/g, ''); },
  });
  add('Contact details', 'brand.phone', 'Phone number, as it should read', brand, 'phone', { max: 40 });
  add('Contact details', 'brand.base', 'Where you are based', brand, 'base', { max: 80 });

  add('Front page', 'brand.offer', 'The line under the photos', brand, 'offer', { kind: 'long', max: 240 });

  itineraries.forEach((it) => {
    const g = `Trip: ${it.name} ${it.em}`;
    add(g, `trip.${it.id}.name`, 'Name (first part)', it, 'name', { max: 60 });
    add(g, `trip.${it.id}.em`, 'Name (in italics)', it, 'em', { max: 60 });
    add(g, `trip.${it.id}.price`, 'Price', it, 'price', {
      max: 60, hint: 'For example "From USD 480 per person". Leave empty to show "Quote within 24 hours".',
      get: () => it.price || '', set: (v) => { it.price = v || null; },
    });
    add(g, `trip.${it.id}.days`, 'Length', it, 'days', { max: 40 });
    add(g, `trip.${it.id}.season`, 'Best season', it, 'season', { max: 80 });
    add(g, `trip.${it.id}.route`, 'Route', it, 'route', { max: 120 });
    add(g, `trip.${it.id}.blurb`, 'Description', it, 'blurb', { kind: 'long', max: 400 });
  });

  stories.forEach((s, i) => {
    const g = 'Guest stories';
    add(g, `story.${i}.show`, `Story ${i + 1}: show on the website`, s, 'sample', {
      kind: 'switch', hint: 'Turn on once it holds a real guest\'s words.',
      get: () => (s.sample ? '0' : '1'), set: (v) => { s.sample = v !== '1'; },
    });
    add(g, `story.${i}.name`, `Story ${i + 1}: guest's name`, s, 'name', { max: 60 });
    add(g, `story.${i}.trip`, `Story ${i + 1}: trip and month`, s, 'trip', { max: 60 });
    add(g, `story.${i}.fear`, `Story ${i + 1}: what they worried about`, s, 'fear', { kind: 'long', max: 240 });
    add(g, `story.${i}.moment`, `Story ${i + 1}: the moment it stopped mattering`, s, 'moment', { kind: 'long', max: 320 });
  });

  faqs.forEach((f, i) => {
    const g = 'Questions';
    add(g, `faq.${i}.show`, `Question ${i + 1}: show on the website`, f, 'hidden', {
      kind: 'switch', get: () => (f.hidden ? '0' : '1'), set: (v) => { f.hidden = v !== '1'; },
    });
    add(g, `faq.${i}.q`, `Question ${i + 1}`, f, 'q', { max: 160 });
    add(g, `faq.${i}.a`, `Answer ${i + 1}`, f, 'a', { kind: 'long', max: 800 });
  });

  experiences.forEach((e) => {
    const g = 'Experiences';
    add(g, `exp.${e.id}.title`, `${e.title}: name`, e, 'title', { max: 60 });
    add(g, `exp.${e.id}.feel`, `${e.title}: line in italics`, e, 'feel', { max: 60 });
    add(g, `exp.${e.id}.text`, `${e.title}: description`, e, 'text', { kind: 'long', max: 320 });
  });

  game.forEach((w, i) => {
    const g = 'Wildlife';
    add(g, `wild.${i}.word`, `Sighting ${i + 1}: animal`, w, 'word', { max: 40 });
    add(g, `wild.${i}.note`, `Sighting ${i + 1}: what happened`, w, 'note', { max: 160 });
    add(g, `wild.${i}.place`, `Sighting ${i + 1}: where`, w, 'place', { max: 80 });
  });

  add('Who we are', 'about.title', 'Heading (first part)', about, 'title', { max: 60 });
  add('Who we are', 'about.em', 'Heading (in italics)', about, 'em', { max: 60 });
  about.text.forEach((_, i) => add('Who we are', `about.text.${i}`, `Paragraph ${i + 1}`, about.text, i, { kind: 'long', max: 800 }));

  return out;
}
