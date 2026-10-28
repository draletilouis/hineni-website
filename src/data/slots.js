// Every spot on the page that shows one chosen photo, so the admin portal can swap it.
// The ids are stored in the live site file (storage/site.json): keep them stable.
// `shape` is the photo that suits the spot (wide / tall); `fields` are captions that belong to the photo.
import { heroReel, itineraries, experiences, about, customTrip } from './content.js';

export function photoSlots() {
  const out = [];
  const add = (group, id, label, obj, prop, extra = {}) =>
    out.push({ group, id, label, obj, get: () => obj[prop], set: (key) => { obj[prop] = key; }, ...extra });
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
  add('Who we are', 'about', 'Group portrait', about, 'photo');
  return out;
}
