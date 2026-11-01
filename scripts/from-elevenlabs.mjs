// Convert the ElevenLabs API "with-timestamps" JSON (character alignment) into words.json.
// Use this instead of `npm run align` when you generate the voice through the ElevenLabs API.
// Usage: npm run from-11labs -- meo-test elevenlabs.json
import fs from 'node:fs';
import path from 'node:path';

const [ep, file = 'elevenlabs.json'] = process.argv.slice(2);
const dir = path.join('public', 'episodes', ep ?? '');
const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const al = raw.normalized_alignment ?? raw.alignment ?? raw;
const chars = al.characters;
const st = al.character_start_times_seconds;
const en = al.character_end_times_seconds;
if (!chars || !st || !en) throw new Error('No alignment.characters / character_*_times_seconds found');

const words = [];
let cur = null;
chars.forEach((ch, i) => {
  if (/\s/.test(ch)) {
    if (cur) words.push(cur);
    cur = null;
    return;
  }
  if (!cur) cur = {text: '', start: st[i], end: en[i]};
  cur.text += ch;
  cur.end = en[i];
});
if (cur) words.push(cur);
fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(words, null, 1));
console.log(`words.json written: ${words.length} words`);

// ElevenLabs API returns audio as base64 in the same JSON: save it if present
if (raw.audio_base64) {
  fs.writeFileSync(path.join(dir, 'voice.mp3'), Buffer.from(raw.audio_base64, 'base64'));
  console.log('voice.mp3 written from audio_base64');
}
