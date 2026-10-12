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

/* 解说时间轴 */
const narr = JSON.parse(fs.readFileSync(path.join(OUT, 'narration-dur.json'), 'utf8'));
const SEG = {};
narr.segments.forEach((s) => { SEG[s.id] = s; });

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
      position: 'fixed', left: '50%', bottom: '58px', transform: 'translateX(-50%)',
      maxWidth: '960px', padding: '10px 20px', borderRadius: '999px',
      background: 'rgba(18,22,31,.9)', border: '1px solid rgba(79,110,247,.5)',
      color: '#f4f6f9', font: '600 16px/1.5 "PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      letterSpacing: '.3px', boxShadow: '0 12px 30px rgba(0,0,0,.35)', backdropFilter: 'blur(6px)',
      pointerEvents: 'none', zIndex: '99997', opacity: '0', transition: 'opacity .45s ease',
      textAlign: 'center', whiteSpace: 'nowrap',
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

/* 镜头 1 · 开场（s1 23s） */
await at('s1', async () => {
  caption('DataFlow Lab · 把 pandas 的每一步处理演出来，用图形做数据分析');
  await moveTo(loc('#datasetSelect'));
  await wait(1500);
  await moveTo(loc('.op-library'));
  await wait(1800);
  caption('左侧 28 个操作 · 中间动画表格 · 右侧 14 种图表与自动洞察');
  await wait(3000);
  await moveTo(loc('#chartBox'));
});
stamp('镜头1');

/* 镜头 2 · 去除极值（s2a / s2b / s2c ≈ 33s） */
await at('s2a', async () => {
  await addOp('去除极值');
  await wait(600);
  caption('去除极值：去掉一个最高分、一个最低分');
}, -1.4);
await at('s2a', async () => {
  await clickLoc(loc('#btnRunAll'));
  await page.mouse.move(1180, 320, { steps: 14 });
});
await at('s2b', async () => {
  caption('红线 = 当前最大值的上升轨迹，蓝线 = 当前最小值的下降轨迹');
  await clickLoc(loc('.spd[data-speed="0.5"]'));
  await clickLoc(loc('#btnFirst'));
  await clickLoc(loc('#btnRunAll'));
  await page.mouse.move(1180, 260, { steps: 14 });
});
await at('s2c', async () => {
  caption('扫描结束 → 极值行被标记并逐行删除');
  await clickLoc(loc('#btnFirst'));
  await clickLoc(loc('#btnRunAll'));
  await page.mouse.move(760, 400, { steps: 12 });
});
stamp('镜头2');

/* 镜头 3 · 清洗（s3 16s） */
await at('s3', async () => {
  await clickLoc(loc('.spd[data-speed="1"]'));
  caption('缺失值标红 → 均值填充 · 重复行标黄 → 删除');
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

/* 镜头 4 · 派生列 + 排序（s4 13s） */
await at('s4', async () => {
  caption('新增计算列 · 排序（FLIP 平滑重排）');
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

/* 镜头 5 · 分组聚合（s5 13s） */
await at('s5', async () => {
  caption('分组聚合：上色 → 聚拢 → 坍缩成汇总行');
  await addOp('分组聚合');
  await wait(400);
  await clickLoc(loc('#btnPlay'));
  await wait(8000);
  await chart('bar');
});
stamp('镜头5');

/* 镜头 6 · 分析级图表（s6 17.6s） */
await at('s6', async () => {
  await clickLoc(loc('#btnFirst'));
  await wait(1500);
  caption('14 种图表：缺失值热力图 / 数据画像 / 散点矩阵');
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

/* 镜头 7 · 刷选联动（s7 14.7s） */
await at('s7', async () => {
  caption('点击图形 → 选中并定位到对应数据行（图表 ⇄ 表格）');
  await chart('hist');
  const marks = page.locator('#chartBox .mark');
  if (await marks.count() > 2) { await moveTo(marks.nth(2)); await marks.nth(2).click({ force: true }); }
  await wait(2500);
  caption('表头分布迷你图 · 单元格数据条');
  await page.mouse.move(500, 520, { steps: 12 });
});
stamp('镜头7');

/* 镜头 8 · 中英双语（s8zh 11.5s + s8en 10s） */
await at('s8zh', async () => { caption('一键切换中英文 · 界面、操作、解说、数据全部同步'); });
await at('s8en', async () => {
  caption('English mode: every label, operation and narration is translated');
  await clickLoc(loc('#langSeg button[data-lang="en"]'));
  await wait(2600);
  await chart('splom');
});
stamp('镜头8');

/* 镜头 9 · 主题（s9 8.4s） */
await at('s9', async () => {
  await clickLoc(loc('#langSeg button[data-lang="zh"]'));
  await wait(1200);
  caption('明 / 暗主题一键切换 · 现代简约配色');
  await clickLoc(loc('#btnTheme'));
});
stamp('镜头9');

/* 镜头 10 · 自动演示（s10 12.8s + s10b 10s） */
await at('s10', async () => {
  caption('一键「自动演示」：完整跑一遍分析流程');
  await moveTo(loc('#datasetSelect'));
  await page.selectOption('#datasetSelect', 'scoring');
  await wait(1200);
  await clickLoc(loc('.spd[data-speed="2"]'));
  await clickLoc(loc('#btnDemo'));
});
await at('s10b', async () => {
  caption('填充缺失 → 去重 → 去极值 → 计算均分 → 排序');
  await page.mouse.move(1180, 300, { steps: 12 });
});
stamp('镜头10');

/* 镜头 11 · 导入导出（s11 9.3s） */
await at('s11', async () => {
  caption('粘贴 / 导入自己的 CSV·JSON，结果一键导出');
  await clickLoc(loc('#btnPaste'));
  await wait(900);
  await page.fill('#pasteArea', '城市,最高温,最低温,降水\n北京,31,19,12\n上海,29,22,38\n广州,33,26,55\n成都,27,18,9');
  await wait(1200);
  await clickLoc(loc('#btnPasteOk'));
  await wait(2600);
  await clickLoc(loc('#btnExport'));
});
stamp('镜头11');

/* 镜头 12 · 结尾（s12 19s） */
await at('s12', async () => {
  caption('零依赖零构建 · 每个操作返回一条「动画剧本」');
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
