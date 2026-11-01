// Render MỘT đoạn của video trên máy GitHub (gọi từ .github/workflows/render-cloud.yml).
// Chạy trong thư mục project (file được chép vào đó để dùng node_modules của project).
// Biến môi trường: JOB_FILE (đường dẫn file việc .json), PART (số đoạn, từ 0), OUT_DIR (nơi ghi part-XX.mp4).
import {bundle} from '@remotion/bundler';
import {ensureBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const job = JSON.parse(fs.readFileSync(process.env.JOB_FILE, 'utf8'));
const part = Number(process.env.PART);
const parts = Number(job.parts || 8);
const outDir = process.env.OUT_DIR || 'out/_ci';
fs.mkdirSync(outDir, {recursive: true});

const inputProps = job.props || {};
const t0 = Date.now();
await ensureBrowser();
const serveUrl = await bundle({entryPoint: path.resolve(job.entry || 'src/index.ts')});
const timeoutInMilliseconds = job.timeout ?? 30000;   // trạm máy tính bảng đặt 120 s (máy ARM tải ảnh chậm)
const composition = await selectComposition({serveUrl, id: job.composition, inputProps, timeoutInMilliseconds});
const total = job.frames ? Math.min(job.frames, composition.durationInFrames) : composition.durationInFrames;
const size = Math.ceil(total / parts);
const start = part * size;
const end = Math.min(total, start + size) - 1;
if (start > end) {
  console.log(`Đoạn ${part}: không còn khung nào (tổng ${total}) — bỏ qua.`);
  process.exit(0);
}
const file = path.join(outDir, `part-${String(part).padStart(2, '0')}.mp4`);
console.log(`Đoạn ${part + 1}/${parts}: khung ${start}–${end} / ${total}, ${os.cpus().length} nhân`);
let last = -1;
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  codec: 'h264',
  outputLocation: file,
  frameRange: [start, end],
  muted: true,
  crf: job.crf ?? 19,
  x264Preset: job.preset || 'veryfast',
  imageFormat: 'jpeg',
  jpegQuality: job.jpegQuality ?? 92,
  scale: job.scale ?? 1,
  concurrency: job.concurrency || os.cpus().length,
  timeoutInMilliseconds,
  chromiumOptions: {gl: job.gl || 'swangle'},
  onProgress: ({progress}) => {
    const p = Math.floor(progress * 10);
    if (p !== last) { last = p; console.log(`  ${p * 10}%  (${Math.round((Date.now() - t0) / 1000)} s)`); }
  },
});
console.log(`Xong ${file} sau ${Math.round((Date.now() - t0) / 1000)} s`);
