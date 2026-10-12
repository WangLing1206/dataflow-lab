/* =============================================================
   tools/mux-video.mjs · 把解说音轨合成到演示视频
   输入：docs/video/<silent>.webm + docs/video/narration.wav + record-meta.json(lead)
   输出：docs/video/DataFlow-Lab-demo.mp4（H.264 + AAC，带中文/英文解说）
   用法：node tools/mux-video.mjs
   （ffmpeg 优先使用 Python imageio-ffmpeg 自带的完整版本；否则退到 PATH 中的 ffmpeg）
   ============================================================= */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VDIR = path.join(ROOT, 'docs', 'video');
const meta = JSON.parse(fs.readFileSync(path.join(VDIR, 'record-meta.json'), 'utf8'));
const silent = fs.readdirSync(VDIR).filter((f) => f.endsWith('.webm') && !f.includes('demo'))[0]
  || fs.readdirSync(VDIR).filter((f) => f.endsWith('.webm'))[0];
if (!silent) throw new Error('找不到静音视频（*.webm）');

/* 定位 ffmpeg */
function findFF() {
  const candidates = [
    process.env.FFMPEG,
    path.join(process.env.APPDATA || '', 'Python/Python313/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'),
  ].filter(Boolean);
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ } }
  try {
    const p = execSync('python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"', { encoding: 'utf8' }).trim().split(/\r?\n/).pop();
    if (p && fs.existsSync(p)) return p;
  } catch (e) { /* ignore */ }
  return 'ffmpeg';
}
const FF = findFF();
const OUT_MP4 = path.join(VDIR, 'DataFlow-Lab-demo.mp4');
const lead = Math.max(0, meta.lead || 0);

console.log('ffmpeg :', FF);
console.log('视频   :', silent, ' 音轨偏移:', lead, 's');

execFileSync(FF, [
  '-y', '-loglevel', 'error',
  '-i', path.join(VDIR, silent),
  '-itsoffset', String(lead),
  '-i', path.join(VDIR, 'narration.wav'),
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
  '-movflags', '+faststart',
  OUT_MP4,
], { stdio: 'inherit' });

console.log('\n完成：' + OUT_MP4 + '  ' + (fs.statSync(OUT_MP4).size / 1048576).toFixed(1) + ' MB');
try { fs.unlinkSync(path.join(VDIR, silent)); console.log('已删除中间文件：' + silent); } catch (e) { /* ignore */ }
