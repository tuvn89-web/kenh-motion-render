import {Config} from '@remotion/cli/config';
import fs from 'node:fs';
// Container Linux của Claude dùng Chromium của Playwright; trên laptop (Windows) Remotion tự dùng trình duyệt của nó.
const PW = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
if (process.platform === 'linux' && fs.existsSync(PW)) Config.setBrowserExecutable(PW);
Config.setCrf(18);
