// Word timings from ANY voiceover file (ElevenLabs web download works): runs whisper.cpp locally, free.
// Usage:  npm run align -- meo-test            (reads public/episodes/meo-test/voice.mp3)
//         npm run align -- meo-test voice2.mp3
import {installWhisperCpp, downloadWhisperModel, transcribe, toCaptions} from '@remotion/install-whisper-cpp';
import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ep = process.argv[2];
const file = process.argv[3] ?? 'voice.mp3';
if (!ep) {
  console.error('Usage: npm run align -- <episode-folder> [voice-file]');
  process.exit(1);
}
const dir = path.join('public', 'episodes', ep);
const input = path.join(dir, file);
if (!fs.existsSync(input)) {
  console.error('Missing audio file: ' + input);
  process.exit(1);
}
const VERSION = '1.5.5';
const MODEL = 'medium.en'; // ~1.5GB once; use 'small.en' for a faster, slightly less precise pass
const whisperPath = path.join(process.cwd(), 'whisper.cpp');

await installWhisperCpp({to: whisperPath, version: VERSION});
await downloadWhisperModel({model: MODEL, folder: whisperPath});

const wav = path.join(dir, '_voice16k.wav');
execSync(`npx remotion ffmpeg -y -i "${input}" -ar 16000 -ac 1 -c:a pcm_s16le "${wav}"`, {stdio: 'inherit'});

const out = await transcribe({
  inputPath: wav, whisperPath, whisperCppVersion: VERSION, model: MODEL,
  tokenLevelTimestamps: true, splitOnWord: true,
});
const {captions} = toCaptions({whisperCppOutput: out});
const words = captions
  .map((c) => ({text: c.text.trim(), start: +(c.startMs / 1000).toFixed(3), end: +(c.endMs / 1000).toFixed(3)}))
  .filter((w) => w.text);
fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(words, null, 1));
fs.unlinkSync(wav);
console.log(`words.json written: ${words.length} words, last at ${words.at(-1)?.end}s`);
console.log('Now set "audio": "' + file + '" and "words": "words.json" in episode.json');
