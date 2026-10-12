import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const FF = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim().split(/\r?\n/).pop();
const text = '最小值就是这样被一步一步比较出来的，而不是直接给出的。';
const url = 'https://fanyi.baidu.com/gettts?lan=zh&text=' + encodeURIComponent(text) + '&spd=6&source=web';
const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://fanyi.baidu.com/' } });
fs.writeFileSync('src.mp3', Buffer.from(await r.arrayBuffer()));
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', 'src.mp3', '-ar', '22050', '-ac', '1', 'src.wav'], { stdio: 'ignore' });

function dur(f) {
  const w = fs.readFileSync(f); let pos = 12, br = 0, dl = 0;
  while (pos + 8 <= w.length) {
    const id = w.toString('ascii', pos, pos + 4), size = w.readUInt32LE(pos + 4);
    if (id === 'fmt ') br = w.readUInt32LE(pos + 16);
    if (id === 'data') dl = size;
    pos += 8 + size + (size % 2);
  }
  return dl / br;
}
for (const p of [1.0, 0.90, 0.84, 0.79]) {
  const out = `pitch-${p}.wav`;
  if (p === 1.0) fs.copyFileSync('src.wav', out);
  else execFileSync(FF, ['-y', '-loglevel', 'error', '-i', 'src.wav', '-af',
    `asetrate=22050*${p},atempo=${(1 / p).toFixed(4)},aresample=22050`, out], { stdio: 'ignore' });
  console.log(`pitch=${p}: ${(fs.statSync(out).size / 1024).toFixed(0)}KB, ${dur(out).toFixed(2)}s (原 ${dur('src.wav').toFixed(2)}s)`);
}
console.log('（pitch 越小声音越低沉；0.84 ≈ 下移 3 个半音）');
