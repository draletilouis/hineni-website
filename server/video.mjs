// Turns any uploaded clip into what every browser plays: H.264 video (8-bit) and AAC sound in an MP4 that
// starts before it has fully downloaded, at most 1920 px on its long side, plus a lighter 960 px copy for
// phones. Phones record HEVC, HDR or old MPEG-4 that Chrome and Android can't decode (they show a blank
// frame), at tens of megabytes a minute; this keeps every clip playable and small. Needs ffmpeg: the Docker
// image installs it, and locally the copy in tools/ is used (or set FFMPEG to its path).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCAL = path.join(ROOT, 'tools/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
const FFMPEG = process.env.FFMPEG || (fs.existsSync(LOCAL) ? LOCAL : 'ffmpeg');

// resolves with ffmpeg's log (stderr); rejects with it attached
const run = (args) => new Promise((resolve, reject) => {
  execFile(FFMPEG, args, { maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
    if (err) reject(Object.assign(err, { log: String(stderr || '') })); else resolve(String(stderr || ''));
  });
});

let available;
export const canConvert = async () => (available ??= run(['-hide_banner', '-version']).then(() => true, () => false));

// size, length and colour of a clip, from what ffmpeg prints about it (it exits with an error when there's no output)
export async function probe(file) {
  let log = '';
  try { log = await run(['-hide_banner', '-i', file]); } catch (e) { log = e.log; }
  const video = log.match(/Stream #[^\n]*Video:[^\n]*/)?.[0] || '';
  const dims = video.match(/, (\d{2,5})x(\d{2,5})[ ,]/);
  const d = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
  // phones store portrait clips as landscape plus a rotation flag
  const turned = /rotate\s*:\s*-?(90|270)|rotation of -?(90|270)/.test(log);
  const [w, h] = dims ? [+dims[1], +dims[2]] : [0, 0];
  return {
    video: !!video,
    w: turned ? h : w,
    h: turned ? w : h,
    dur: d ? Math.round((+d[1] * 3600 + +d[2] * 60 + +d[3]) * 10) / 10 : 0,
    hdr: /arib-std-b67|smpte2084|bt2020/.test(video),
  };
}

// HDR (iPhone HLG / Dolby Vision) mapped to ordinary colours, or it plays washed out
const TONEMAP = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,';
const fit = (side) => `scale=w='min(${side},iw)':h='min(${side},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`;
const COPIES = [
  { suffix: '', side: 1920, crf: 23, max: '5M' },    // big screens
  { suffix: '-sm', side: 960, crf: 26, max: '1.8M' }, // phones
];

async function encode(src, out, copy, tonemap) {
  const part = `${out}.part.mp4`;
  await run([
    '-y', '-hide_banner', '-loglevel', 'error', '-i', src,
    '-map', '0:v:0', '-map', '0:a:0?', '-vf', (tonemap ? TONEMAP : '') + fit(copy.side),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(copy.crf), '-maxrate', copy.max, '-bufsize', `${parseFloat(copy.max) * 2}M`,
    '-profile:v', 'high', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', part,
  ]);
  await fsp.rename(part, out);
}

// <base>.mp4 and <base>-sm.mp4 from any clip; returns the result's size and length
export async function toWeb(src, base) {
  const info = await probe(src);
  if (!info.video) throw new Error('no video track');
  for (const copy of COPIES) {
    const out = `${base}${copy.suffix}.mp4`;
    try { await encode(src, out, copy, info.hdr); } catch (e) {
      if (!info.hdr) throw e;
      await encode(src, out, copy, false); // this ffmpeg can't tone-map: plain conversion
    }
  }
  const done = await probe(`${base}.mp4`);
  return { w: done.w, h: done.h, dur: done.dur || info.dur };
}

// a frame a second in (or a third of the way into a short clip), as a PNG for sharp to turn into the poster
export async function frame(file, png, dur = 3) {
  await run(['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(Math.min(1, dur / 3)), '-i', file, '-frames:v', '1', png]);
}

// one conversion at a time: they're heavy, and a queue keeps the server answering everyone else
let queue = Promise.resolve();
export const oneAtATime = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
