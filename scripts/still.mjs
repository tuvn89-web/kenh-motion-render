// Quick preview frame: npm run still -- meo-test 300   -> out/meo-test-300.png
import {execSync} from 'node:child_process';
import fs from 'node:fs';

const [ep = 'meo-test', frame = '0', ...rest] = process.argv.slice(2);
fs.mkdirSync('out', {recursive: true});
fs.writeFileSync('out/_props.json', JSON.stringify({episode: ep}));
execSync(`npx remotion still Episode "out/${ep}-${frame}.png" --frame=${frame} --props=out/_props.json ${rest.join(' ')}`, {stdio: 'inherit'});
