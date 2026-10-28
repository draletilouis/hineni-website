// One set of line icons for the whole site (24px grid, 1.5px stroke, round joins), in place of
// text glyphs like → ✕ ★. Inherit the text colour; size with CSS (.i is 1.15em, inline with text).
const PATHS = {
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  close: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5.5v13l10-6.5z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dash: 'M6 12h12',
  grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  sight: 'M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z',
  noPhoto: 'M3 3l18 18M9 5h6l1.5 2.5H20v10M17 20H4V7.5h3.5M10 10.5a3 3 0 0 0 4 4',
  // the mega menu's
  wave: 'M2 10c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5 0M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5 0',
  crater: 'M2 17c3 0 4-6 10-6s7 6 10 6M7 17c1.5-2 3-3 5-3s3.5 1 5 3',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  chat: 'M4 5h16v11H9l-5 4z',
  pen: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  boat: 'M3 15h18l-2.5 4h-13zM6 15V9h8l3 6M10 9V5',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  paw: 'M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM19 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 12c-3 0-5 4-5 6s2 2 5 2 5 0 5-2-2-6-5-6Z',
  leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};

export function icon(name, { cls = 'i' } = {}) {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name] || PATHS.pin}"/></svg>`;
}
