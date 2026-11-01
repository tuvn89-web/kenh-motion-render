// Credits for the YouTube description, from the licence ledger (public/assets/LICENSES.json).
// Usage: node tools/credits.mjs src/showcase/ArtDemo.tsx src/showcase/ModelDemo.tsx  > credits.txt
// Lists only assets whose path appears in the given source files (default: every file under src/).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/LICENSES.json'), 'utf8'));
const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = process.argv.slice(2).length ? process.argv.slice(2) : walk(path.join(ROOT, 'src'));
const text = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const used = Object.entries(ledger).filter(([p]) => text.includes(p));
const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, '').trim();
const needsCredit = (l) => /^CC-BY/i.test(l);
const lines = ['Credits'];
const art = used.filter(([p]) => p.startsWith('assets/art/'));
const models = used.filter(([p]) => !p.startsWith('assets/art/'));
if (art.length) {
  lines.push('', 'Artworks (public domain, via Wikimedia Commons):');
  for (const [, l] of art) lines.push(`• ${strip(l.author)} — "${strip(l.title)}" ${l.source}`);
}
if (models.length) {
  lines.push('', '3D models:');
  for (const [, l] of models) lines.push(`• "${strip(l.title)}" by ${strip(l.author)} (${l.license}${needsCredit(l.license) ? ', attribution required' : ''}) ${l.source}`);
}
const bad = used.filter(([, l]) => !/^(CC0|PD|Public Domain|CC-BY|MIT|Pexels|Pixabay|Unsplash)/i.test(l.license ?? ''));
if (bad.length) lines.push('', '!! KIỂM TRA GIẤY PHÉP: ' + bad.map(([p]) => p).join(', '));
console.log(lines.join('\n'));
