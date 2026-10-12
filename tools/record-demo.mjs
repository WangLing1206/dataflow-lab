/* =============================================================
   tools/record-demo.mjs · 自动录制演示视频（与解说音轨对齐）
   1) 先执行 node tools/tts-narrate.mjs 生成 narration.wav + narration-dur.json
   2) 本脚本按每段的起始时间调度画面动作，保证"说到哪、演到哪"
   3) 输出静音视频 + record-meta.json（音画对齐偏移 lead）
   4) 再执行 node tools/mux-video.mjs 合成带配音的 MP4
   用法：node tools/record-demo.mjs --url http://127.0.0.1:8123/index.html --out docs/video
   ============================================================= */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPlaywright() {
  const cands = [
    process.env.PLAYWRIGHT_PATH,
    'playwright',
    'playwright-core',
    path.join(process.env.APPDATA || '', 'npm/node_modules/@playwright/cli/node_modules/playwright'),
    path.join(process.env.LOCALAPPDATA || '', 'npm-cache/_npx/705bc6b22212b352/node_modules/playwright'),
  ].filter(Boolean);
  for (const c of cands) {
    try { return require(c); } catch (e) { /* try next */ }
  }
  throw new Error('未找到 playwright，请设置 PLAYWRIGHT_PATH 指向 playwright 包目录');
}

const args = {};
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true;
});
const URL_ = args.url || 'http://127.0.0.1:8123/index.html';
const OUT = path.resolve(ROOT, args.out || 'docs/video');
fs.mkdirSync(OUT, { recursive: true });

/* 解说时间轴 + 字幕文本（字幕 = 配音原文，保证两者一致） */
const narr = JSON.parse(fs.readFileSync(path.join(OUT, 'narration-dur.json'), 'utf8'));
const SEG = {};
narr.segments.forEach((s) => { SEG[s.id] = s; });
const NARR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'narration.json'), 'utf8'));
const TEXT = {};
NARR.segments.forEach((s) => { TEXT[s.id] = s.text; });

const pw = loadPlaywright();
const chromium = pw.chromium;

const CAND_BROWSERS = [
  process.env.CHROMIUM_PATH,
  process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe',
  process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
  process.env.LOCALAPPDATA + '\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe',
].filter(Boolean);
const exe = CAND_BROWSERS.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const context = await browser.newContext({
  viewport: { width: 1600, height: 950 },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1280, height: 760 } },
});
const page = await context.newPage();
const REC_START = Date.now();       // 录像起点（用于音画对齐）

/* ---------------- 虚拟光标 + 字幕 ---------------- */
async function injectOverlay() {
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    Object.assign(cursor.style, {
      position: 'fixed', left: '0px', top: '0px', width: '20px', height: '20px', borderRadius: '50%',
      background: 'rgba(79,110,247,.28)', border: '2px solid #4f6ef7',
      boxShadow: '0 0 16px rgba(79,110,247,.85)', pointerEvents: 'none', zIndex: '99999',
      transform: 'translate(-50%,-50%)', transition: 'left .05s linear, top .05s linear',
    });
    document.body.appendChild(cursor);
    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      Object.assign(r.style, {
        position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '12px', height: '12px',
        borderRadius: '50%', border: '2px solid #f5a524', transform: 'translate(-50%,-50%)',
        pointerEvents: 'none', zIndex: '99998', opacity: '1', transition: 'all .55s cubic-bezier(.16,1,.3,1)',
      });
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.width = '74px'; r.style.height = '74px'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 700);
    }, true);

    const cap = document.createElement('div');
    cap.id = '__cap';
    Object.assign(cap.style, {
      position: 'fixed', left: '50%', bottom: '54px', transform: 'translateX(-50%)',
      maxWidth: '940px', padding: '9px 18px', borderRadius: '14px',
      background: 'rgba(18,22,31,.88)', border: '1px solid rgba(79,110,247,.5)',
      color: '#f4f6f9', font: '600 15px/1.55 "PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      letterSpacing: '.2px', boxShadow: '0 12px 30px rgba(0,0,0,.35)', backdropFilter: 'blur(6px)',
      pointerEvents: 'none', zIndex: '99997', opacity: '0', transition: 'opacity .45s ease',
      textAlign: 'center', whiteSpace: 'normal', lineHeight: '1.55',
    });
    document.body.appendChild(cap);
    window.__cap = (t) => {
      cap.textContent = t;
      cap.style.opacity = '1';
      clearTimeout(window.__capT);
      window.__capT = setTimeout(() => { cap.style.opacity = '0'; }, 30000);
    };
  });
}

/* ---------------- 基础动作 ---------------- */
const wait = (ms) => page.waitForTimeout(ms);
const caption = (t) => page.evaluate((x) => window.__cap(x), t);
const loc = (sel) => page.locator(sel);

async function moveTo(l) {
  const box = await l.first().boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
  await wait(180);
  return true;
}
async function clickLoc(l) { await moveTo(l); await l.first().click(); }
async function addOp(name) { await clickLoc(page.locator('.op-item', { hasText: name }).first()); }
async function playOnce(seconds) { await clickLoc(loc('#btnPlay')); await wait(seconds * 1000); }
async function chart(type) {
  const b = page.locator(`.chart-tab[data-type="${type}"]`);
  if (await b.count()) await clickLoc(b);
  await wait(1300);
}

/* ---------------- 时间轴调度 ---------------- */
let T0 = 0;
async function at(id, fn, off) {
  const target = (SEG[id].start + (off || 0)) * 1000;
  const d = target - (Date.now() - T0);
  if (d > 0) await page.waitForTimeout(d);
  if (fn) await fn();
}
const stamp = (label) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${label}`);

/* ================= 开录 ================= */
await page.goto(URL_, { waitUntil: 'networkidle' });
await wait(1200);
await injectOverlay();
T0 = Date.now();
await page.mouse.move(760, 420, { steps: 20 });

/* 镜头 1 · 开场（s1） */
await at('s1', async () => {
  caption(TEXT.s1);
  await moveTo(loc('#datasetSelect'));
  await wait(1500);
  await moveTo(loc('.op-library'));
  await wait(2000);
  await moveTo(loc('#chartBox'));
});
stamp('镜头1');

/* 镜头 2 · 去除极值（s2a / s2b / s2c） */
await at('s2a', async () => {
  caption(TEXT.s2a);
  await addOp('去除极值');
  await wait(600);
}, -1.4);
await at('s2a', async () => {
  await clickLoc(loc('#btnRunAll'));
  await page.mouse.move(1180, 320, { steps: 14 });
});
await at('s2b', async () => {
  caption(TEXT.s2b);
  await clickLoc(loc('.spd[data-speed="0.5"]'));
  await clickLoc(loc('#btnFirst'));
  await clickLoc(loc('#btnRunAll'));
  await page.mouse.move(1180, 260, { steps: 14 });
});
await at('s2c', async () => {
  caption(TEXT.s2c);
  await clickLoc(loc('#btnFirst'));
  await clickLoc(loc('#btnRunAll'));
  await page.mouse.move(760, 400, { steps: 12 });
});
stamp('镜头2');

/* 镜头 3 · 清洗（s3） */
await at('s3', async () => {
  caption(TEXT.s3);
  await clickLoc(loc('.spd[data-speed="1"]'));
  await addOp('缺失值处理');
  await wait(500);
  await clickLoc(loc('#btnPlay'));
  await wait(7000);
  await addOp('去除重复');
  await wait(400);
  await clickLoc(loc('#btnPlay'));
  await wait(5000);
});
stamp('镜头3');

/* 镜头 4 · 派生列 + 排序（s4） */
await at('s4', async () => {
  caption(TEXT.s4);
  await addOp('新增计算列');
  await wait(400);
  await clickLoc(loc('#btnPlay'));
  await wait(6000);
  await addOp('排序');
  await wait(400);
  await clickLoc(loc('#btnPlay'));
  await wait(5000);
});
stamp('镜头4');

/* 镜头 5 · 分组聚合（s5） */
await at('s5', async () => {
  caption(TEXT.s5);
  await addOp('分组聚合');
  await wait(400);
  await clickLoc(loc('#btnPlay'));
  await wait(8000);
  await chart('bar');
});
stamp('镜头5');

/* 镜头 6 · 分析级图表（s6） */
await at('s6', async () => {
  caption(TEXT.s6);
  await clickLoc(loc('#btnFirst'));
  await wait(1500);
  await chart('missmap');
  await wait(2000);
  await chart('profile');
  await wait(2000);
  await moveTo(loc('#datasetSelect'));
  await page.selectOption('#datasetSelect', 'iris');
  await wait(1200);
  await chart('splom');
});
stamp('镜头6');

/* 镜头 7 · 刷选联动（s7） */
await at('s7', async () => {
  caption(TEXT.s7);
  await chart('hist');
  const marks = page.locator('#chartBox .mark');
  if (await marks.count() > 2) { await moveTo(marks.nth(2)); await marks.nth(2).click({ force: true }); }
  await wait(2500);
  await page.mouse.move(500, 520, { steps: 12 });
});
stamp('镜头7');

/* 镜头 8 · 中英双语（s8zh + s8en） */
await at('s8zh', async () => { caption(TEXT.s8zh); });
await at('s8en', async () => {
  caption(TEXT.s8en);
  await clickLoc(loc('#langSeg button[data-lang="en"]'));
  await wait(2600);
  await chart('splom');
});
stamp('镜头8');

/* 镜头 9 · 主题（s9） */
await at('s9', async () => {
  caption(TEXT.s9);
  await clickLoc(loc('#langSeg button[data-lang="zh"]'));
  await wait(1200);
  await clickLoc(loc('#btnTheme'));
});
stamp('镜头9');

/* 镜头 10 · 自动演示（s10 + s10b） */
await at('s10', async () => {
  caption(TEXT.s10);
  await moveTo(loc('#datasetSelect'));
  await page.selectOption('#datasetSelect', 'scoring');
  await wait(1200);
  await clickLoc(loc('.spd[data-speed="2"]'));
  await clickLoc(loc('#btnDemo'));
});
await at('s10b', async () => {
  caption(TEXT.s10b);
  await page.mouse.move(1180, 300, { steps: 12 });
});
stamp('镜头10');

/* 镜头 11 · 导入导出（s11） */
await at('s11', async () => {
  caption(TEXT.s11);
  await clickLoc(loc('#btnPaste'));
  await wait(900);
  await page.fill('#pasteArea', '城市,最高温,最低温,降水\n北京,31,19,12\n上海,29,22,38\n广州,33,26,55\n成都,27,18,9');
  await wait(1200);
  await clickLoc(loc('#btnPasteOk'));
  await wait(2600);
  await clickLoc(loc('#btnExport'));
});
stamp('镜头11');

/* 镜头 12 · 结尾（s12） */
await at('s12', async () => {
  caption(TEXT.s12);
  await moveTo(loc('#datasetSelect'));
  await page.selectOption('#datasetSelect', 'students');
  await wait(1400);
  await clickLoc(loc('#btnTheme'));
  await wait(900);
  await clickLoc(loc('.spd[data-speed="1"]'));
  await addOp('去除极值');
  await wait(500);
  await clickLoc(loc('#btnRunAll'));
  await page.mouse.move(800, 480, { steps: 10 });
});
stamp('镜头12');

/* 收尾：等解说结束后多留 3 秒 */
const tail = (narr.total * 1000 + 3000) - (Date.now() - T0);
if (tail > 0) await page.waitForTimeout(tail);
stamp('录制结束');

const meta = { lead: Number(((T0 - REC_START) / 1000).toFixed(2)), audio: narr.total };
fs.writeFileSync(path.join(OUT, 'record-meta.json'), JSON.stringify(meta, null, 1));
console.log('音画对齐偏移 lead =', meta.lead, 's；解说总长 =', meta.audio, 's');

await context.close();
await browser.close();

const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm'));
console.log('静音视频输出：' + OUT);
files.forEach((f) => console.log('  - ' + f + '  ' + (fs.statSync(path.join(OUT, f)).size / 1048576).toFixed(1) + ' MB'));
