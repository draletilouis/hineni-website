// Every spot on the page that shows one chosen photo or clip, so the admin portal can swap it.
// The ids are stored in the live site file (site.json → slots): keep them stable.
// `kind` is 'photo' (the default) or 'video'; `shape` is the photo that suits the spot (wide / tall);
// `fields` are captions that belong to the photo.
import { heroReel, itineraries, experiences, about, customTrip, stories, game, manifestoPhotos, quote, film } from './content.js';

export function photoSlots() {
  const out = [];
  const add = (group, id, label, obj, prop, extra = {}) =>
    out.push({ group, id, label, obj, kind: 'photo', get: () => obj[prop], set: (key) => { obj[prop] = key; }, ...extra });
  const clip = (group, id, label, obj, prop) => add(group, id, label, obj, prop, { kind: 'video' });
  const heroText = [{ name: 'title', label: 'Place' }, { name: 'place', label: 'Line under it' }];

  heroReel.slides.wide.forEach((s, i) => add('Hero slideshow on computers', `hero.wide.${i}`, `Slide ${i + 1}`, s, 'photo', { shape: 'wide', fields: heroText }));
  heroReel.slides.tall.forEach((s, i) => add('Hero slideshow on phones', `hero.tall.${i}`, `Slide ${i + 1}`, s, 'photo', { shape: 'tall', fields: heroText }));
  heroReel.faces.forEach((_, i) => add('Hero trust card', `hero.face.${i}`, `Face ${i + 1}`, heroReel.faces, i));
  add('Hero trust card', 'hero.trust', 'Group photo', heroReel, 'trustPhoto');
  itineraries.forEach((it) => {
    add('Trips', `trip.${it.id}.cover`, `${it.name} ${it.em}: card`, it, 'cover');
    it.days_.forEach((d) => add('Trips', `trip.${it.id}.day.${d.n}`, `${it.name} ${it.em}: day ${Number(d.n)}`, d, 'photo'));
  });
  add('Trips', 'trip.custom.cover', 'Make it yours: card', customTrip, 'photo');
  experiences.forEach((e) => add('Experiences', `exp.${e.id}`, e.title, e, 'photo'));
  experiences.forEach((e) => { if (e.video) clip('Experience clips', `exp.${e.id}.clip`, e.title, e, 'video'); });
  game.forEach((w, i) => {
    if (w.key) clip('Wildlife', `wild.${i}.clip`, `${w.word}: clip`, w, 'key');
    else add('Wildlife', `wild.${i}.photo`, `${w.word}: photo`, w, 'photo');
  });
  manifestoPhotos.forEach((_, i) => add('The idea', `idea.${i}`, `Photo in the words ${i + 1}`, manifestoPhotos, i, { shape: 'wide' }));
  add('Big quote', 'quote.photo', 'Background photo', quote, 'photo', { shape: 'wide' });
  stories.forEach((s, i) => add('Guest stories', `story.${i}.photo`, `Story ${i + 1}`, s, 'photo'));
  add('Who we are', 'about', 'Group portrait', about, 'photo');
  clip('The film', 'film', 'The film ("Watch the film")', film, 'key');
  return out;
}
