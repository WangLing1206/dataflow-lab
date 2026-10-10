/* =============================================================
   tools/record-demo.mjs · 自动录制演示视频
   —— 按 docs/视频讲解稿.md 的分镜自动操作网站、烧入字幕并录屏
   用法：
     python -m http.server 8123
     node tools/record-demo.mjs --url http://127.0.0.1:8123/index.html --out docs/video
   可用环境变量 PLAYWRIGHT_PATH 指定 playwright 入口（默认从常见位置探测）
   ============================================================= */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

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
const OUT = args.out || 'docs/video';
fs.mkdirSync(OUT, { recursive: true });

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

/* ---------------- 注入虚拟光标 + 字幕 ---------------- */
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
      requestAnimationFrame(() => {
        r.style.width = '74px'; r.style.height = '74px'; r.style.opacity = '0';
      });
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
      window.__capT = setTimeout(() => { cap.style.opacity = '0'; }, 45000);
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
  await wait(200);
  return true;
}
async function clickLoc(l) {
  await moveTo(l);
  await l.first().click();
}
async function addOp(name) {
  await clickLoc(page.locator('.op-item', { hasText: name }).first());
  await wait(700);
}
async function playOnce(seconds) {
  await clickLoc(loc('#btnPlay'));
  await wait(seconds * 1000);
}
async function chart(type) {
  const b = page.locator(`.chart-tab[data-type="${type}"]`);
  if (await b.count()) await clickLoc(b);
  await wait(1400);
}

/* ---------------- 分镜 ---------------- */
const t0 = Date.now();
const stamp = (label) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`);

await page.goto(URL_, { waitUntil: 'networkidle' });
await wait(1200);
await injectOverlay();
await page.mouse.move(760, 420, { steps: 20 });
await wait(600);

/* 镜头 1 · 开场 */
caption('中英双语 · 明暗主题 · 28 个 pandas 操作 · 14 种图表，每一步都演给你看');
stamp('镜头1 开场');
await wait(1600);
await moveTo(loc('#datasetSelect'));
await wait(1200);
await moveTo(loc('.op-library'));
await wait(1600);
caption('左侧是 28 个 pandas 操作；右侧是图表与自动洞察，图表会跟着分析走');
await wait(5000);

/* 镜头 2 · 去除极值（核心：图形化的寻找逻辑） */
caption('去除极值：表格探查针扫描，图表同时画出「当前最小/最大」的轨迹');
stamp('镜头2 去除极值');
await addOp('去除极值');
await wait(2400);
await clickLoc(loc('#btnRunAll'));
await page.mouse.move(1180, 300, { steps: 16 });
await wait(400);
caption('蓝线是「当前最小」的下降轨迹，红线是「当前最大」的上升轨迹 —— 最值是这样被找到的');
await wait(3100);
caption('扫描结束 → 极值行被标记、逐行删除，图表里的柱子也跟着掉落');
await wait(5200);
stamp('镜头2 完成');

/* 镜头 3 · 缺失值 + 去重（图形参与过程） */
caption('缺失值与重复行：逐格标红定位 → 均值滚入填充 / 重复指纹标黄删除');
stamp('镜头3 清洗');
await addOp('缺失值处理');
await wait(2000);
await playOnce(9);
await addOp('去除重复');
await wait(1600);
await playOnce(8);

/* 镜头 4 · 派生列 + 排序 */
caption('新增计算列从右侧滑入 · 排序是整表平滑重排');
stamp('镜头4 派生列');
await addOp('新增计算列');
await wait(1600);
await playOnce(7);
await addOp('排序');
await wait(1400);
await playOnce(7);

/* 镜头 5 · 分组聚合 + 图表联动 */
caption('分组聚合：同组上色 → 聚拢 → 坍缩成汇总行');
stamp('镜头5 分组聚合');
await addOp('分组聚合');
await wait(1400);
await clickLoc(loc('#btnPlay'));
await wait(3300);
caption('同组上色后聚拢，再逐组坍缩成一行汇总');
await wait(8500);
caption('图表自动联动成「按班级的汇总柱状图」，并给出自动洞察');
await wait(3000);
await chart('bar');
await wait(2200);
stamp('镜头5 完成');

/* 镜头 6 · 图形化数据质量与多变量关系 */
caption('用图形做数据分析：缺失值热力图 / 数据画像 / 散点矩阵 / 处理前后对比');
stamp('镜头6 分析级图表');
await clickLoc(loc('#btnFirst'));
await wait(2000);
await chart('missmap');
await wait(2200);
caption('缺失值热力图：一眼看出缺失集中在哪一列、是否成片');
await wait(3200);
await chart('profile');
await wait(2200);
caption('数据画像：每列的类型、缺失率、基数与分布迷你图');
await wait(3200);
await moveTo(loc('#datasetSelect'));
await page.selectOption('#datasetSelect', 'iris');
await wait(1500);
await chart('splom');
await wait(2400);
caption('散点矩阵：下三角是相关系数，一眼找到强相关的变量对');
await wait(3400);
stamp('镜头6 完成');

/* 镜头 7 · 图 ⇄ 表 刷选联动 + 表内微可视化 */
caption('点击图形可以直接选中并定位到对应数据行（图表 ⇄ 表格刷选）');
stamp('镜头7 联动');
await chart('hist');
await wait(1600);
const dots = page.locator('#chartBox .mark');
if (await dots.count() > 2) {
  const target = dots.nth(2);
  await moveTo(target);
  await target.click({ force: true });
  await wait(2600);
}
caption('表头有分布迷你图，单元格底部有数据条 —— 不用读数字也能比较大小');
await wait(4200);
stamp('镜头7 完成');

/* 镜头 8 · 中英双语 */
caption('一键切换中英文：界面、操作名、参数、解说、数据全部同步');
stamp('镜头8 语言');
await clickLoc(loc('#langSeg button[data-lang="en"]'));
await wait(2400);
caption('English mode: every label, operation, narration and even the data is translated');
await wait(3600);
await clickLoc(loc('#langSeg button[data-lang="zh"]'));
await wait(1600);

/* 镜头 9 · 明暗主题 */
caption('明 / 暗主题一键切换，现代简约配色');
stamp('镜头9 主题');
await clickLoc(loc('#btnTheme'));
await wait(2600);
await chart('hist');
await wait(1800);
await clickLoc(loc('#btnTheme'));
await wait(1400);

/* 镜头 10 · 自动演示 */
caption('一键「自动演示」：完整跑一遍真实分析流程');
stamp('镜头10 自动演示');
await moveTo(loc('#datasetSelect'));
await page.selectOption('#datasetSelect', 'scoring');
await wait(1500);
await clickLoc(loc('#btnDemo'));
await wait(8000);
caption('填充缺失 → 去重 → 去极值 → 计算均分 → 排序，右侧统计与图表同步刷新');
await wait(18000);
caption('每一步都逐步演示，而不是直接给出结果');
await wait(20000);
stamp('镜头10 完成');

/* 镜头 11 · 导入导出 */
caption('可以粘贴 / 导入自己的 CSV·JSON，处理结果一键导出');
stamp('镜头11 导入导出');
await clickLoc(loc('#btnPaste'));
await wait(1200);
await page.fill('#pasteArea', '城市,最高温,最低温,降水\n北京,31,19,12\n上海,29,22,38\n广州,33,26,55\n成都,27,18,9');
await wait(1600);
await clickLoc(loc('#btnPasteOk'));
await wait(3600);
await clickLoc(loc('#btnExport'));
await wait(2400);

/* 镜头 12 · 收尾 */
caption('28 个 pandas 操作 · 14 种图表 · 自动洞察 · 中英双语 · 明暗主题 · 零依赖零构建');
stamp('镜头12 收尾');
await moveTo(loc('#datasetSelect'));
await page.selectOption('#datasetSelect', 'students');
await wait(1600);
await addOp('去除极值');
await wait(1200);
await clickLoc(loc('#btnRunAll'));
await wait(8500);
await page.mouse.move(800, 480, { steps: 10 });
await wait(3000);
stamp('录制结束');

await context.close();
await browser.close();

const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm'));
console.log('视频输出目录：' + path.resolve(OUT));
files.forEach((f) => console.log('  - ' + f + '  ' + (fs.statSync(path.join(OUT, f)).size / 1048576).toFixed(1) + ' MB'));
