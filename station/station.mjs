// TRẠM RENDER v10 — chạy trên Windows của Cậu Cả, dùng GPU thật.
// v10 (31/10/2026): thư mục kenh-motion xếp lại 6 ngăn — trạm nằm ở 3_may\tram\ (jobs\ done\ logs\ _deploy\ status.json ở ngay đây),
//   máy dựng ở 3_may\<máy>\, dữ liệu tập ở 4_tap\<ngách>\<tập>\ (bảng KENH bên dưới). Bố cục cũ (station\ + <kênh>\project) vẫn chạy.
// Canh thư mục jobs\ ; mỗi file <id>.json là một việc render. Kết quả ra done\ .
// Chạy: start-station.bat   (hoặc: node station/station.mjs)
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KM = path.resolve(HERE, '..', '..');                       // D:\kenh-motion khi trạm ở 3_may\tram
const NEW = fs.existsSync(path.join(KM, '3_may')) && path.basename(path.dirname(HERE)) === '3_may';
const ROOT = NEW ? KM : path.resolve(HERE, '..');                 // gốc kenh-motion
const WORK = NEW ? HERE : ROOT;                                  // nơi để jobs, done, logs, _deploy, status.json
// kênh (= máy dựng, ghi trong file việc) → thư mục máy + ngách mặc định; file việc ghi "ngach" thì lấy tập ở 4_tap\<ngach>\
const KENH = {AC_ed: {project: '3_may/ac-ed', tap: '4_tap/pov-tien'}, LS_puppet: {project: '3_may/con-roi', tap: '4_tap/chien-tran'}};
const tapRoot = (kenh, ngach) => (NEW ? path.join(ROOT, ngach ? path.join('4_tap', ngach) : KENH[kenh]?.tap ?? path.join('4_tap', kenh)) : path.join(ROOT, kenh, 'tap'));
// v8: mỗi kênh có project riêng: kenh-motion\<kênh>\project (job ghi "kenh": "AC_ed"); thiếu thì dùng kênh mặc định.
// v9: job "dongbo" (chỉ đồng bộ tập vào kit để xem Studio) · job "ghep" có "audio" (render tiếng cả tập một lần, lót dưới hình đã nối).
const DEFAULT_KENH = 'AC_ed';
const projectOf = (kenh) => {
  const k = kenh ?? DEFAULT_KENH;
  const p = NEW ? path.join(ROOT, KENH[k]?.project ?? path.join('3_may', k)) : path.join(ROOT, k, 'project');
  if (fs.existsSync(p)) return p;
  return path.join(ROOT, 'project'); // bố cục cũ
};
let PROJECT = projectOf(null);
const JOBS = path.join(WORK, 'jobs');
const DONE = path.join(WORK, 'done');
const LOGS = path.join(WORK, 'logs');
for (const d of [JOBS, DONE, LOGS, path.join(JOBS, 'archive')]) fs.mkdirSync(d, {recursive: true});
const IS_WIN = process.platform === 'win32';
let busy = false;
let result_renderSec = 0;
const NPX = IS_WIN ? 'npx.cmd' : 'npx';

let status = {version: 2, state: 'idle', job: null, step: '', progress: 0, started: null, host: os.hostname(), cpus: os.cpus().length, ramGB: Math.round(os.totalmem() / 2 ** 30)};
const writeStatus = () => {
  try {
    fs.writeFileSync(path.join(WORK, 'status.json'), JSON.stringify({...status, heartbeat: new Date().toISOString()}, null, 1));
  } catch {}
};
setInterval(writeStatus, 5000);
writeStatus();

const log = (id, msg) => {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(id ? `(${id}) ${line}` : line);
  if (id) fs.appendFileSync(path.join(LOGS, `${id}.log`), line + '\n');
};

// Cancel a running job: create jobs\<id>.cancel (Tổng Tham Mưu Trưởng does this remotely)
let currentChild = null;
const cancelFile = (id) => path.join(JOBS, `${id}.cancel`);
const killTree = (p) => {
  if (!p) return;
  if (IS_WIN) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], {windowsHide: true});
  else p.kill('SIGKILL');
};
// watchdog: a render that prints nothing for 5 minutes is hung -> kill it, the retry logic takes over
let lastActivity = Date.now();
let stalled = false;
setInterval(() => {
  if (currentChild && Date.now() - lastActivity > 5 * 60 * 1000) {
    console.log('Render bi treo > 5 phut -> dung va thu lai');
    stalled = true;
    lastActivity = Date.now();
    killTree(currentChild);
  }
}, 15000);
setInterval(() => {
  if (status.job && currentChild && fs.existsSync(cancelFile(status.job))) {
    console.log('Huy viec theo yeu cau:', status.job);
    killTree(currentChild);
  }
}, 2000);

const run = (id, args, onLine, raw = false) =>
  new Promise((resolve, reject) => {
    if (fs.existsSync(cancelFile(id))) return reject(new Error('cancelled'));
    const p = raw ? spawn(args[0], args.slice(1), {cwd: PROJECT, windowsHide: true, shell: raw === 'shell' && IS_WIN}) : spawn(NPX, args, {cwd: PROJECT, shell: IS_WIN, windowsHide: true});
    currentChild = p;
    lastActivity = Date.now();
    let lastText = '';
    const feed = (b) => b.toString().split(/\r?\n/).forEach((l) => {
      if (!l.trim()) return;
      if (l !== lastText) lastActivity = Date.now(); // identical repeated progress lines don't count
      lastText = l;
      fs.appendFileSync(path.join(LOGS, `${id}.log`), l + '\n');
      onLine?.(l);
    });
    p.stdout.on('data', feed);
    p.stderr.on('data', feed);
    p.on('close', (code) => {
      currentChild = null;
      if (fs.existsSync(cancelFile(id))) return reject(new Error('cancelled'));
      if (stalled) {
        stalled = false;
        return reject(new Error('stalled'));
      }
      code === 0 ? resolve() : reject(new Error(`exit ${code}: npx ${args.slice(0, 3).join(' ')}`));
    });
  });

const EXTRA = {v: []};
const totalFrames = async (id, comp, propsFile) => {
  let n = 0;
  await run(id, ['remotion', 'compositions', `--props=${propsFile}`, ...(EXTRA.v)], (l) => {
    const m = l.match(new RegExp(`^${comp}\\s+\\d+\\s+\\d+x\\d+\\s+(\\d+)`));
    if (m) n = Number(m[1]);
  });
  return n;
};

// ---- performance sampler: CPU %, RAM, GPU %, VRAM every 2 s -> logs/<id>.perf.csv (for sizing a VPS)
let perfTimer = null;
let lastCpu = os.cpus();
const cpuPct = () => {
  const now = os.cpus();
  let idle = 0, total = 0;
  now.forEach((c, i) => {
    const a = lastCpu[i]?.times ?? c.times;
    const d = (k) => c.times[k] - a[k];
    const t = d('user') + d('nice') + d('sys') + d('idle') + d('irq');
    total += t;
    idle += d('idle');
  });
  lastCpu = now;
  return total ? Math.round((1 - idle / total) * 100) : 0;
};
const gpuStat = () =>
  new Promise((res) => {
    const p = spawn('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,memory.total,name', '--format=csv,noheader,nounits'], {windowsHide: true});
    let out = '';
    p.stdout.on('data', (b) => (out += b));
    p.on('error', () => res(null));
    p.on('close', () => {
      const [u, mu, mt, name] = out.trim().split(',').map((x) => x.trim());
      res(u ? {gpu: Number(u), vram: Number(mu), vramTotal: Number(mt), name} : null);
    });
  });
const startPerf = (id) => {
  const f = path.join(LOGS, `${id}.perf.csv`);
  fs.writeFileSync(f, 'time,step,cpu_pct,ram_used_gb,gpu_pct,vram_mb\n');
  lastCpu = os.cpus();
  perfTimer = setInterval(async () => {
    const g = await gpuStat();
    const ram = ((os.totalmem() - os.freemem()) / 2 ** 30).toFixed(1);
    fs.appendFileSync(f, `${new Date().toISOString()},${status.step},${cpuPct()},${ram},${g?.gpu ?? ''},${g?.vram ?? ''}\n`);
    if (g) status.gpu = g.name;
  }, 2000);
};
const stopPerf = () => perfTimer && clearInterval(perfTimer);

/** Render one job in fresh-browser chunks (avoids Chrome memory build-up), then join + add audio. */
// Kits: map each image's clean name to the file as downloaded (Flow adds "-a_20261024193343" to names).
const indexKits = () => {
  const root = path.join(PROJECT, 'public', 'kits');
  if (!fs.existsSync(root)) return;
  for (const d of fs.readdirSync(root, {withFileTypes: true})) {
    if (!d.isDirectory()) continue;
    const dir = path.join(root, d.name);
    const idx = {};
    for (const f of fs.readdirSync(dir).sort()) {
      const m = f.match(/^(.*?)(-[a-z])?(_\d{14})?\.(jpg|jpeg|png|webp)$/i);
      if (m) idx[m[1]] = f;
    }
    try {
      fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(idx, null, 1));
    } catch {}
  }
};

// Tập: kenh-motion\<kênh>\tap\<tập>\{anh,giong} -> project\public\kits\<tập>\ (chỉ chép file mới/đổi), rồi đánh chỉ mục.
const syncEpisode = (job) => {
  if (!job.tap) return null;
  const ep = path.join(tapRoot(job.kenh ?? DEFAULT_KENH, job.ngach), job.tap);
  const kit = path.join(PROJECT, 'public', 'kits', job.kit ?? job.tap);
  fs.mkdirSync(kit, {recursive: true});
  let n = 0;
  for (const sub of ['anh', 'giong', 'du-lieu']) {
    const d = path.join(ep, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      const a = path.join(d, f);
      const b = path.join(kit, f);
      if (!fs.statSync(a).isFile()) continue;
      if (fs.existsSync(b) && fs.statSync(b).size === fs.statSync(a).size && fs.statSync(b).mtimeMs >= fs.statSync(a).mtimeMs) continue;
      fs.copyFileSync(a, b);
      n++;
    }
  }
  log(job.id, `Đồng bộ tập ${job.tap}: ${n} tệp mới -> kits/${job.kit ?? job.tap}`);
  const out = path.join(ep, 'render');
  fs.mkdirSync(out, {recursive: true});
  return out;
};

const renderJob = async (job) => {
  const epOut = syncEpisode(job);
  indexKits();
  const id = job.id;
  const comp = job.composition ?? 'Episode';
  const scale = job.scale ?? 2; // 2 = 4K from a 1080p composition
  const chunk = job.chunk ?? 240;
  const gl = job.gl ?? (IS_WIN ? 'angle' : 'swiftshader');
  let conc = job.concurrency ?? (scale >= 2 ? 2 : Math.max(1, Math.floor(os.cpus().length / 2)));
  let glNow = gl;
  const work = path.join(DONE, `${id}_parts`);
  fs.mkdirSync(work, {recursive: true});
  const propsFile = path.join(work, 'props.json');
  fs.writeFileSync(propsFile, JSON.stringify(job.props ?? {}));
  status = {...status, state: 'rendering', job: id, step: 'đọc độ dài', progress: 0, started: new Date().toISOString()};
  writeStatus();
  EXTRA.v = job.extraArgs ?? [];
  const n = job.frames ?? (await totalFrames(id, comp, propsFile));
  if (!n) throw new Error('Không đọc được số khung của composition ' + comp);
  log(id, `${comp}: ${n} khung, scale ${scale}, gl ${glNow}, ${conc} luồng, đoạn ${chunk} khung`);
  const extra = job.extraArgs ?? [];
  const common = () => [...extra, `--props=${propsFile}`, `--scale=${scale}`, `--gl=${glNow}`, `--concurrency=${conc}`, '--crf=16', '--image-format=jpeg', '--jpeg-quality=94', '--timeout=120000'];
  const parts = [];
  const tRender = Date.now();
  for (let s = 0; s < n; s += chunk) {
    const e = Math.min(n - 1, s + chunk - 1);
    const out = path.join(work, `v_${String(s).padStart(6, '0')}.mp4`);
    parts.push(out);
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) continue; // resume after a crash
    status.step = `hình ${s}-${e}`;
    // adaptive retry: fewer parallel tabs, then CPU rendering as a last resort
    for (let attempt = 1; ; attempt++) {
      try {
        await run(id, ['remotion', 'render', comp, out, `--frames=${s}-${e}`, '--muted', ...common()], (l) => {
          const m = l.match(/Rendered (\d+)\/(\d+)/);
          if (m) status.progress = Math.round(((s + Number(m[1])) / n) * 95);
        });
        break;
      } catch (err) {
        if (attempt >= 4 || String(err.message).includes('cancelled')) throw err;
        if (conc > 1) conc = Math.max(1, Math.floor(conc / 2));
        else if (glNow !== 'swiftshader') glNow = 'swiftshader';
        log(id, `Đoạn ${s}-${e} lỗi, thử lại (lần ${attempt + 1}) với ${conc} luồng, gl ${glNow}`);
      }
    }
  }
  result_renderSec = (Date.now() - tRender) / 1000;
  status.step = 'tiếng';
  const audio = path.join(work, 'audio.wav');
  let hasAudio = true;
  try {
    await run(id, ['remotion', 'render', comp, audio, '--codec=wav', `--props=${propsFile}`, ...extra]);
  } catch {
    hasAudio = false;
  }
  status.step = 'ghép';
  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(epOut ?? DONE, `${job.out ?? id}.mp4`);
  const ff = ['remotion', 'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (hasAudio) ff.push('-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k');
  ff.push('-c:v', 'copy', '-shortest', '-movflags', '+faststart', final);
  await run(id, ff);
  // contact sheet: 24 evenly spaced frames, laid out by the QASheet composition (no extra tools needed)
  status.step = 'soát hình';
  const sheet = path.join(epOut ?? DONE, `${job.out ?? id}.sheet.jpg`);
  const fps = job.fps ?? 30;
  const dur = n / fps;
  const qaDir = path.join(PROJECT, 'public', '_qa', id);
  fs.mkdirSync(qaDir, {recursive: true});
  // one ffmpeg call: 24 seek-inputs -> 24 thumbnails (was 24 separate calls)
  const ffa = ['remotion', 'ffmpeg', '-y'];
  for (let i = 0; i < 24; i++) ffa.push('-ss', (((i + 0.5) * dur) / 24).toFixed(3), '-i', final);
  for (let i = 0; i < 24; i++) ffa.push('-map', `${i}:v:0`, '-frames:v', '1', '-vf', 'scale=480:270', '-q:v', '3', path.join(qaDir, `f${i}.jpg`));
  await run(id, ffa);
  const qaProps = path.join(work, 'qa.json');
  fs.writeFileSync(qaProps, JSON.stringify({id, n: 24, dur}));
  await run(id, ['remotion', 'still', 'QASheet', sheet, `--props=${qaProps}`, '--image-format=jpeg', ...extra]);
  try {
    fs.rmSync(qaDir, {recursive: true, force: true});
  } catch {}
  const black = null;
  // a folder held open by Explorer/antivirus must not fail a finished render
  if (!job.keepParts) {
    try {
      fs.rmSync(work, {recursive: true, force: true});
    } catch (e) {
      log(id, 'Không xoá được thư mục tạm (bỏ qua): ' + work);
    }
  }
  return {final, sheet, black: black || null, frames: n, seconds: n / fps, renderSec: Math.round(result_renderSec), fps: +(n / result_renderSec).toFixed(2), scale, concurrency: conc, gl: glNow};
};


// ---------- JOB TẢI TÀI NGUYÊN (type: "fetch") ----------
// {"type":"fetch","items":[{"url":"…","to":"assets/models/cat.glb","unzip":false,
//   "license":{"title":"…","author":"…","source":"https://…","license":"CC0-1.0"}}]}
// Chỉ nhận giấy phép dùng thương mại được; mọi file được ghi vào public/assets/LICENSES.json.
const OK_LICENSES = /^(CC0|PD|Public Domain|CC-BY(-SA)?(-[0-9.]+)?|MIT|Pexels|Pixabay|Unsplash)/i;
// Sketchfab: model uid -> licence (from the API, never typed by hand) + temporary download URL.
// Needs a free Sketchfab API token in station\sketchfab-token.txt (Cậu Cả tự dán; không gửi qua chat).
const resolveSketchfab = async (it) => {
  const tokFile = path.join(HERE, 'sketchfab-token.txt');
  if (!fs.existsSync(tokFile)) throw new Error('thiếu station\\sketchfab-token.txt');
  const tok = fs.readFileSync(tokFile, 'utf8').trim();
  const info = await (await fetch(`https://api.sketchfab.com/v3/models/${it.sketchfab}`)).json();
  const label = info.license?.label ?? '';
  if (/NonCommercial|NoDerivs/i.test(label)) throw new Error('giấy phép không dùng được: ' + label);
  const map = {'CC Attribution': 'CC-BY-4.0', 'CC0 Public Domain': 'CC0-1.0', 'CC Attribution-ShareAlike': 'CC-BY-SA-4.0'};
  it.license = {title: info.name, author: info.user?.displayName || info.user?.username, source: info.viewerUrl, license: map[label] ?? label, note: (info.description ?? '').slice(0, 400)};
  const dl = await fetch(`https://api.sketchfab.com/v3/models/${it.sketchfab}/download`, {headers: {Authorization: `Token ${tok}`}});
  if (!dl.ok) throw new Error('Sketchfab download API ' + dl.status + (dl.status === 401 ? ' (token sai?)' : ''));
  const j = await dl.json();
  if (j.glb?.url && !it.preferGltf) {
    it.url = j.glb.url;
    it.to = it.to.replace(/\.zip$/i, '.glb');
    it.unzip = false;
  } else {
    it.url = j.gltf.url;
    it.unzip = true;
  }
};

const fetchJob = async (job) => {
  const PUB = path.join(PROJECT, 'public');
  const ledgerFile = path.join(PUB, 'assets', 'LICENSES.json');
  fs.mkdirSync(path.dirname(ledgerFile), {recursive: true});
  const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : {};
  const got = [];
  const failed = [];
  let i = 0;
  for (const it of job.items ?? []) {
    i++;
    status.step = `tải ${i}/${job.items.length}`;
    status.progress = Math.round((i / job.items.length) * 100);
    writeStatus();
    try {
      if (it.sketchfab) await resolveSketchfab(it); // fills it.url + it.license from the Sketchfab API
      const lic = it.license ?? {};
      if (!OK_LICENSES.test(lic.license ?? '')) throw new Error('giấy phép không cho phép: ' + (lic.license ?? 'không rõ'));
      const dest = path.join(PUB, it.to);
      if (!path.resolve(dest).startsWith(path.resolve(PUB, 'assets'))) throw new Error('đích phải nằm trong public/assets');
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      if (!(it.skipIfExists && fs.existsSync(dest))) {
        const res = await fetch(it.url, {redirect: 'follow', headers: {'User-Agent': 'kenh-motion-station/1.0 (asset fetch; contact: owner)'}});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      }
      let size = fs.statSync(dest).size;
      if (it.unzip) {
        const outDir = dest.replace(/\.zip$/i, '');
        fs.mkdirSync(outDir, {recursive: true});
        await run(job.id, ['tar', '-xf', dest, '-C', outDir], () => {}, true);
      }
      ledger[it.to] = {...lic, url: it.url, fetchedAt: new Date().toISOString(), bytes: size};
      got.push({to: it.to, bytes: size});
      log(job.id, `OK ${it.to} (${(size / 1e6).toFixed(2)} MB)`);
    } catch (e) {
      failed.push({to: it.to, url: it.url, error: String(e.message ?? e)});
      log(job.id, `LỖI ${it.to}: ${e.message ?? e}`);
    }
  }
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1));
  // danh sách tệp con sau giải nén (để Tổng Tham Mưu Trưởng biết tên tệp)
  const listing = [];
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const r = rel + '/' + e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else listing.push(r + ' ' + fs.statSync(path.join(d, e.name)).size);
    }
  };
  for (const g of got) {
    const dir = path.join(PUB, g.to.replace(/\.zip$/i, ''));
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) walk(dir, g.to.replace(/\.zip$/i, ''));
  }
  if (failed.length && !got.length) throw new Error('Không tải được tệp nào: ' + JSON.stringify(failed));
  return {final: ledgerFile, got, failed, listing: listing.slice(0, 400)};
};

// ---------- JOB CẬP NHẬT CODE (type: "deploy") — {"type":"deploy","file":"_deploy/code-<commit>.tgz","kenh":"AC_ed"}
// Gói lấy từ GitHub (repo kenh-motion), giải nén đè vào project của kênh; ghi project\VERSION.txt. Chạy giữa hai lần render nên không giẫm việc đang chạy.
const deployJob = async (job) => {
  const file = path.join(WORK, job.file);
  if (!fs.existsSync(file)) throw new Error('không thấy ' + job.file);
  fs.mkdirSync(PROJECT, {recursive: true});
  await run(job.id, ['tar', '-xzf', file, '-C', PROJECT], () => {}, true);
  const ver = path.join(PROJECT, 'VERSION.txt');
  const txt = fs.existsSync(ver) ? fs.readFileSync(ver, 'utf8').trim() : '?';
  if (job.npm) await run(job.id, ['npm', 'install', '--no-audit', '--no-fund'], () => {}, 'shell');
  return {final: ver, version: txt};
};

// ---------- JOB GHÉP KHÚC (type: "ghep") — {"type":"ghep","kenh":"AC_ed","tap":"T02","kit":"t02","parts":["T02-K01-540p",…],"audio":"T02-AM","out":"T02-540p"}
// Nối các khúc đã render (cùng cỡ, cùng mã hoá) thành một file, không mã hoá lại. Thiếu khúc nào thì báo, không ghép.
const ghepJob = async (job) => {
  const dir = path.join(tapRoot(job.kenh ?? DEFAULT_KENH, job.ngach), job.tap, 'render');
  const files = job.parts.map((p) => path.join(dir, p.endsWith('.mp4') ? p : p + '.mp4'));
  const miss = files.filter((f) => !fs.existsSync(f));
  if (miss.length) throw new Error('thiếu khúc: ' + miss.map((f) => path.basename(f)).join(', '));
  const list = path.join(dir, `${job.out}.list.txt`);
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const final = path.join(dir, `${job.out}.mp4`);
  if (job.audio) {
    // tiếng cả tập render MỘT lần từ composition âm thanh (vd "T02-AM") rồi lót dưới hình đã nối: chỗ nối các khúc không có vết
    syncEpisode(job);
    indexKits();
    const wav = path.join(dir, `${job.out}.audio.wav`);
    status.step = 'tiếng cả tập';
    await run(job.id, ['remotion', 'render', job.audio, wav, '--codec=wav']);
    await run(job.id, ['remotion', 'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', wav, '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final]);
    return {final, parts: files.length, audio: wav};
  }
  await run(job.id, ['remotion', 'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', final]);
  return {final, parts: files.length};
};

// ---------- JOB TRA CỨU (type: "probe") — trạm đọc hộ trang/JSON (API Wikimedia, Poly Pizza…) cho Tổng Tham Mưu Trưởng
const probeJob = async (job) => {
  const out = [];
  for (const u of job.urls ?? []) {
    try {
      const res = await fetch(u, {redirect: 'follow', headers: {'User-Agent': 'kenh-motion-station/1.0 (asset lookup)'}});
      if (job.binary) {
        // preview images for review only (not assets): done/_review/<out>/<n>.<ext>
        const dir = path.join(DONE, '_review', job.out ?? job.id);
        fs.mkdirSync(dir, {recursive: true});
        const ext = (res.headers.get('content-type') ?? '').includes('png') ? 'png' : 'jpg';
        const name = (job.names?.[out.length] ?? String(out.length)) + '.' + ext;
        fs.writeFileSync(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
        out.push({url: u, status: res.status, file: name});
        continue;
      }
      const txt = await res.text();
      out.push({url: u, status: res.status, finalUrl: res.url, text: txt.slice(0, job.max ?? 200000)});
    } catch (e) {
      out.push({url: u, error: String(e.message ?? e)});
    }
  }
  const f = path.join(DONE, `${job.out ?? job.id}.probe.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 1));
  return {final: f, n: out.length};
};

const tick = async () => {
  if (busy) return;
  const files = fs.readdirSync(JOBS).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) {
    if (status.state !== 'idle') {
      status = {...status, state: 'idle', job: null, step: '', progress: 0};
      writeStatus();
    }
    return;
  }
  busy = true;
  const f = files[0];
  const src = path.join(JOBS, f);
  let job;
  try {
    job = JSON.parse(fs.readFileSync(src, 'utf8'));
    job.id = job.id ?? path.basename(f, '.json');
  } catch (e) {
    fs.renameSync(src, path.join(JOBS, 'archive', f + '.bad'));
    busy = false;
    return;
  }
  const t0 = Date.now();
  const result = {id: job.id, ok: false, startedAt: new Date().toISOString()};
  try {
    log(job.id, 'Bắt đầu');
    if (!job.type) startPerf(job.id);
    PROJECT = projectOf(job.kenh);
    log(job.id, 'Project: ' + PROJECT);
    const dongboJob = async (j) => ({final: syncEpisode(j), index: indexKits()}); // chỉ chép anh/giong/du-lieu của tập vào kit (để xem Studio)
    const handler = {fetch: fetchJob, probe: probeJob, deploy: deployJob, ghep: ghepJob, dongbo: dongboJob}[job.type] ?? renderJob;
    Object.assign(result, await handler(job), {ok: true});
    log(job.id, `Xong sau ${((Date.now() - t0) / 60000).toFixed(1)} phút -> ${result.final}`);
  } catch (e) {
    result.error = String(e.message ?? e);
    log(job.id, 'LỖI: ' + result.error);
  }
  stopPerf();
  try {
    if (fs.existsSync(cancelFile(job.id))) fs.renameSync(cancelFile(job.id), path.join(JOBS, 'archive', `${job.id}.cancel`));
  } catch {}
  result.minutes = +((Date.now() - t0) / 60000).toFixed(2);
  fs.writeFileSync(path.join(DONE, `${job.out ?? job.id}.result.json`), JSON.stringify(result, null, 1));
  fs.renameSync(src, path.join(JOBS, 'archive', f));
  status = {...status, state: 'idle', job: null, step: '', progress: 0, last: result};
  writeStatus();
  busy = false;
};

// Laptop có 2 card (Intel + NVIDIA): ép Chrome render chạy trên card rời hiệu năng cao.
const forceDiscreteGpu = () => {
  if (!IS_WIN) return;
  const exe = path.join(PROJECT, 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
  if (!fs.existsSync(exe)) return;
  const p = spawn('reg', ['add', 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences', '/v', exe, '/t', 'REG_SZ', '/d', 'GpuPreference=2;', '/f'], {windowsHide: true});
  p.on('close', (c) => console.log(c === 0 ? 'Da dat Chrome render chay tren GPU NVIDIA (hieu nang cao).' : 'Khong dat duoc uu tien GPU (bo qua).'));
};
forceDiscreteGpu();
// Tự nạp lại khi Tổng Tham Mưu Trưởng cập nhật station.mjs (start-station.bat sẽ bật lại sau 10 giây).
const SELF = fileURLToPath(import.meta.url);
const selfStamp = fs.statSync(SELF).mtimeMs;
setInterval(() => {
  try {
    if (!busy && fs.statSync(SELF).mtimeMs !== selfStamp) {
      console.log('station.mjs da duoc cap nhat -> khoi dong lai...');
      process.exit(0);
    }
  } catch {}
}, 5000);

console.log('TRẠM RENDER kenh-motion đang chạy. Canh thư mục:', JOBS);
console.log('Đừng tắt cửa sổ này (thu nhỏ được). Ctrl+C để dừng.');
setInterval(() => tick().catch((e) => console.error(e)), 4000);
tick();
