/* =============================================================
   tools/tts-narrate.mjs · 生成解说音轨
   1) 读取 tools/narration.json 的分段文本
   2) 调用 Windows 内置语音（SAPI）离线合成每段 WAV
   3) 按 gap 间隔拼接成完整音轨 narration.wav
   4) 输出每段时长到 narration-dur.json（供录屏脚本对齐节奏）
   用法：node tools/tts-narrate.mjs
   ============================================================= */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'docs', 'video', '.tts');
const OUT = path.join(ROOT, 'docs', 'video', 'narration.wav');
const DUR = path.join(ROOT, 'docs', 'video', 'narration-dur.json');

fs.mkdirSync(TMP, { recursive: true });

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'narration.json'), 'utf8'));
const segs = cfg.segments.map((s, i) => ({
  file: `seg${String(i).padStart(2, '0')}.wav`,
  voice: s.voice === 'en' ? cfg.voiceEN : cfg.voiceZH,
  rate: s.voice === 'en' ? cfg.rateEN : cfg.rateZH,
  text: s.text,
}));
fs.writeFileSync(path.join(TMP, 'segments.json'), JSON.stringify(segs, null, 1), 'utf8');

console.log(`合成 ${segs.length} 段解说…`);
execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', path.join(ROOT, 'tools', 'tts-sapi.ps1'), '-Dir', TMP], { encoding: 'utf8' });

/* ---------- WAV 读写 ---------- */
function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('不是 WAV: ' + file);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: b.readUInt16LE(pos + 8),
        channels: b.readUInt16LE(pos + 10),
        sampleRate: b.readUInt32LE(pos + 12),
        byteRate: b.readUInt32LE(pos + 16),
        blockAlign: b.readUInt16LE(pos + 20),
        bits: b.readUInt16LE(pos + 22),
      };
    } else if (id === 'data') {
      data = b.subarray(pos + 8, pos + 8 + size);
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV 解析失败: ' + file);
  return { fmt, data };
}
function writeWav(file, fmt, chunks) {
  const dataLen = chunks.reduce((s, c) => s + c.length, 0);
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(fmt.audioFormat, 20);
  buf.writeUInt16LE(fmt.channels, 22);
  buf.writeUInt32LE(fmt.sampleRate, 24);
  buf.writeUInt32LE(fmt.byteRate, 28);
  buf.writeUInt16LE(fmt.blockAlign, 32);
  buf.writeUInt16LE(fmt.bits, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataLen, 40);
  let off = 44;
  chunks.forEach((c) => { c.copy(buf, off); off += c.length; });
  fs.writeFileSync(file, buf);
}
function silence(fmt, seconds) {
  const n = Math.max(0, Math.round(seconds * fmt.byteRate));
  return Buffer.alloc(n - (n % fmt.blockAlign));
}

/* ---------- 拼接 ---------- */
const gap = cfg.gap == null ? 0.9 : cfg.gap;
let fmtRef = null;
const parts = [];
const durs = [];
let t = 0;
segs.forEach((s, i) => {
  const w = readWav(path.join(TMP, s.file));
  if (!fmtRef) fmtRef = w.fmt;
  const duration = w.data.length / w.fmt.byteRate;
  if (i > 0) { parts.push(silence(fmtRef, gap)); t += gap; }
  parts.push(w.data);
  const item = { id: cfg.segments[i].id, start: Number(t.toFixed(3)), dur: Number(duration.toFixed(3)) };
  durs.push(item);
  t += duration;
  console.log(`  ${s.file}  ${duration.toFixed(2)}s  @${t.toFixed(1)}s  ${cfg.segments[i].text.slice(0, 18)}…`);
});

writeWav(OUT, fmtRef, parts);
fs.writeFileSync(DUR, JSON.stringify({ total: Number(t.toFixed(3)), segments: durs }, null, 1), 'utf8');
console.log(`\n音轨：${OUT}`);
console.log(`总时长：${t.toFixed(1)}s（${(t / 60).toFixed(1)} 分钟）  采样率 ${fmtRef.sampleRate}Hz / ${fmtRef.channels}ch`);
console.log(`每段时长：${DUR}`);
