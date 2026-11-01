// Render one episode to out/<episode>.mp4   Usage: npm run render -- meo-test
import {execSync} from 'node:child_process';
import fs from 'node:fs';

const ep = process.argv[2] ?? 'meo-test';
const extra = process.argv.slice(3).join(' ');
fs.mkdirSync('out', {recursive: true});
fs.writeFileSync('out/_props.json', JSON.stringify({episode: ep}));
const t0 = Date.now();
execSync(`npx remotion render Episode "out/${ep}.mp4" --props=out/_props.json ${extra}`, {stdio: 'inherit'});
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)}s -> out/${ep}.mp4`);
