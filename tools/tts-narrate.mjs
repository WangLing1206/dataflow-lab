/* =============================================================
   tools/tts-narrate.mjs · 生成解说音轨
   默认 provider = "http"：调用在线语音接口（百度翻译 TTS）合成 MP3，
   再用 ffmpeg 统一成 22050Hz 单声道 WAV；离线时可回退 provider = "sapi"（Windows 内置语音）。

   1) 读取 tools/narration.json 的分段文本
   2) 逐段合成 → WAV
   3) 按 gap 间隔拼接成 docs/video/narration.wav
   4) 输出每段时长到 docs/video/narration-dur.json（供录屏脚本对齐节奏）

   用法：node tools/tts-narrate.mjs [--provider http|sapi]
   ============================================================= */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VDIR = path.join(ROOT, 'docs', 'video');
const TMP = path.join(VDIR, '.tts');
const OUT = path.join(VDIR, 'narration.wav');
const DUR = path.join(VDIR, 'narration-dur.json');
fs.mkdirSync(TMP, { recursive: true });

const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'narration.json'), 'utf8'));
const provider = argOf('provider', cfg.provider || 'http');

/* ---------- ffmpeg 定位 ---------- */
function findFF() {
  const cands = [
    process.env.FFMPEG,
    path.join(process.env.APPDATA || '', 'Python/Python313/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'),
  ].filter(Boolean);
  for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch (e) { /* ignore */ } }
  try {
    const p = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim().split(/\r?\n/).pop();
    if (p && fs.existsSync(p)) return p;
  } catch (e) { /* ignore */ }
  return 'ffmpeg';
}
const FF = findFF();

/* ---------- WAV 工具 ---------- */
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('不是 WAV: ' + file);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: b.readUInt16LE(pos + 8), channels: b.readUInt16LE(pos + 10),
        sampleRate: b.readUInt32LE(pos + 12), byteRate: b.readUInt32LE(pos + 16),
        blockAlign: b.readUInt16LE(pos + 20), bits: b.readUInt16LE(pos + 22),
      };
    } else if (id === 'data') data = b.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV 解析失败: ' + file);
  return { fmt, data };
}
function writeWav(file, fmt, chunks) {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const buf = Buffer.alloc(44 + len);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + len, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(fmt.audioFormat, 20); buf.writeUInt16LE(fmt.channels, 22);
  buf.writeUInt32LE(fmt.sampleRate, 24); buf.writeUInt32LE(fmt.byteRate, 28);
  buf.writeUInt16LE(fmt.blockAlign, 32); buf.writeUInt16LE(fmt.bits, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(len, 40);
  let off = 44; chunks.forEach((c) => { c.copy(buf, off); off += c.length; });
  fs.writeFileSync(file, buf);
}
const silence = (fmt, sec) => {
  const n = Math.max(0, Math.round(sec * fmt.byteRate));
  return Buffer.alloc(n - (n % fmt.blockAlign));
};

/* ---------- 合成 ---------- */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function synthHTTP(text, lang, spd, file) {
  const url = `https://fanyi.baidu.com/gettts?lan=${lang}&text=${encodeURIComponent(text)}&spd=${spd}&source=web`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://fanyi.baidu.com/' } });
      const b = Buffer.from(await r.arrayBuffer());
      if (r.ok && b.length > 1000 && b.subarray(0, 3).toString('ascii') !== '{"e') {
        fs.writeFileSync(file, b);
        return true;
      }
    } catch (e) { /* retry */ }
    await new Promise((s) => setTimeout(s, 800));
  }
  return false;
}

function synthSAPI(list) {
  fs.writeFileSync(path.join(TMP, 'segments.json'), JSON.stringify(list.map((s) => ({
    file: path.basename(s.wav), voice: s.voice, rate: s.rate, text: s.text,
  })), null, 1), 'utf8');
  execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', path.join(ROOT, 'tools', 'tts-sapi.ps1'), '-Dir', TMP], { encoding: 'utf8' });
}

async function main() {
  console.log(`provider = ${provider}   ffmpeg = ${FF}`);
  const list = cfg.segments.map((s, i) => ({
    id: s.id,
    text: s.text,
    lang: s.voice === 'en' ? 'en' : 'zh',
    spd: s.voice === 'en' ? (cfg.spdEN || 3) : (cfg.spdZH || 4),
    voice: s.voice === 'en' ? cfg.voiceEN : cfg.voiceZH,
    rate: s.voice === 'en' ? cfg.rateEN : cfg.rateZH,
    wav: path.join(TMP, `seg${String(i).padStart(2, '0')}.wav`),
    mp3: path.join(TMP, `seg${String(i).padStart(2, '0')}.mp3`),
  }));

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (provider === 'http') {
      const ok = await synthHTTP(s.text, s.lang, s.spd, s.mp3);
      if (ok) {
        execFileSync(FF, ['-y', '-loglevel', 'error', '-i', s.mp3, '-ar', '22050', '-ac', '1', s.wav], { stdio: 'ignore' });
        // 在线语音只有女声（性别参数被忽略），用 -3 半音移调处理成男声质感（时长不变）
        const pitch = s.lang === 'en' ? (cfg.pitchEN || 1) : (cfg.pitchZH || 1);
        if (pitch && Math.abs(pitch - 1) > 0.01) {
          const tmp = s.wav + '.raw.wav';
          fs.renameSync(s.wav, tmp);
          execFileSync(FF, ['-y', '-loglevel', 'error', '-i', tmp, '-af',
            `asetrate=22050*${pitch},atempo=${(1 / pitch).toFixed(4)},aresample=22050`, s.wav], { stdio: 'ignore' });
          fs.unlinkSync(tmp);
        }
      }
      if (!ok || !fs.existsSync(s.wav)) {
        console.log(`  ! ${s.id} 在线合成失败，回退内置语音`);
        synthSAPI([s]);
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  if (provider === 'sapi') synthSAPI(list);

  /* 拼接 */
  const gap = cfg.gap == null ? 0.9 : cfg.gap;
  let fmtRef = null;
  const parts = [], durs = [];
  let t = 0;
  list.forEach((s, i) => {
    if (!fs.existsSync(s.wav)) throw new Error('缺少音频：' + s.wav);
    const w = readWav(s.wav);
    if (!fmtRef) fmtRef = w.fmt;
    const dur = w.data.length / w.fmt.byteRate;
    if (i > 0) { parts.push(silence(fmtRef, gap)); t += gap; }
    parts.push(w.data);
    durs.push({ id: s.id, start: Number(t.toFixed(3)), dur: Number(dur.toFixed(3)) });
    t += dur;
    console.log(`  ${path.basename(s.wav)}  ${dur.toFixed(2)}s  @${t.toFixed(1)}s`);
  });

  writeWav(OUT, fmtRef, parts);
  fs.writeFileSync(DUR, JSON.stringify({ total: Number(t.toFixed(3)), segments: durs }, null, 1), 'utf8');
  console.log(`\n音轨：${OUT}`);
  console.log(`总时长：${t.toFixed(1)}s（${(t / 60).toFixed(2)} 分钟）  平均语速 ${(cfg.segments.reduce((a, s) => a + s.text.length, 0) / t).toFixed(2)} 字/秒`);
}

main().catch((e) => { console.error(e); process.exit(1); });
