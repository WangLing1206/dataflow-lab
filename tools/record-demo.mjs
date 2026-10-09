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
      background: 'rgba(53,224,232,.30)', border: '2px solid #35e0e8',
      boxShadow: '0 0 16px rgba(53,224,232,.9)', pointerEvents: 'none', zIndex: '99999',
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
        borderRadius: '50%', border: '2px solid #ffc25c', transform: 'translate(-50%,-50%)',
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
      maxWidth: '900px', padding: '10px 20px', borderRadius: '999px',
      background: 'rgba(6,11,24,.88)', border: '1px solid rgba(53,224,232,.45)',
      color: '#eaf4ff', font: '600 16px/1.5 "PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      letterSpacing: '.3px', boxShadow: '0 12px 30px rgba(0,0,0,.5)', backdropFilter: 'blur(6px)',
      pointerEvents: 'none', zIndex: '99997', opacity: '0', transition: 'opacity .45s ease',
      textAlign: 'center', whiteSpace: 'nowrap',
    });
    document.body.appendChild(cap);
    window.__cap = (t) => {
      cap.textContent = t;
      cap.style.opacity = '1';
      clearTimeout(window.__capT);
      window.__capT = setTimeout(() => { cap.style.opacity = '0'; }, 40000);
    };
  });
}

/* ---------------- 基础动作 ---------------- */
const wait = (ms) => page.waitForTimeout(ms);
const caption = (t) => page.evaluate((x) => window.__cap(x), t);

async function moveTo(locator) {
  const box = await locator.first().boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
  await wait(200);
  return true;
}
async function clickLoc(locator) {
  await moveTo(locator);
  await locator.first().click();
}
const loc = (sel) => page.locator(sel);

async function opItem(name) {
  return page.locator('.op-item', { hasText: name }).first();
}
async function addOp(name) {
  await clickLoc(await opItem(name));
  await wait(700);
}
async function playOnce(seconds) {
  await clickLoc(loc('#btnPlay'));
  await wait(seconds * 1000);
}

/* ---------------- 分镜 ---------------- */
const t0 = Date.now();
const stamp = (label) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`);

await page.goto(URL_, { waitUntil: 'networkidle' });
await wait(1200);
await injectOverlay();
await page.mouse.move(760, 420, { steps: 20 });
await wait(600);

// 镜头 1：开场
caption('pandas 一行代码就出结果，却看不到中间发生了什么');
stamp('镜头1 开场');
await wait(1500);
await moveTo(loc('#datasetSelect'));
await wait(1200);
await moveTo(loc('.op-library'));
await wait(1000);
await moveTo(loc('.brand-text'));
await wait(9000);

// 镜头 2：去除极值（核心）
caption('去除极值：先扫全列找最大值最小值，再标记、删除');
stamp('镜头2 添加去除极值');
await addOp('去除极值');
await wait(2500);
await clickLoc(loc('#btnRunAll'));
await wait(1000);
await page.mouse.move(1180, 480, { steps: 14 });
await wait(4200);
await caption('扫描中：蓝色 = 当前最小，红色 = 当前最大，标记会随扫描移动');
await wait(5200);
await caption('扫描结束 → 极值行被标记，随后逐行删除，其余行自然上移');
await wait(5200);
stamp('镜头2 完成');

// 镜头 3：缺失值 + 去重
caption('缺失值：先标红定位，再用均值滚入填充');
stamp('镜头3 缺失值');
await addOp('缺失值处理');
await wait(2200);
await playOnce(9);
caption('重复行：给每行算指纹，重复的标黄后删除');
stamp('镜头3 去重');
await addOp('去除重复');
await wait(1800);
await playOnce(8);

// 镜头 4：新增列 + 排序
caption('新增列从右侧滑入 · 排序是整表平滑重排');
stamp('镜头4 新增列');
await addOp('新增计算列');
await wait(1800);
await playOnce(7);
stamp('镜头4 排序');
await addOp('排序');
await wait(1600);
await playOnce(7);

// 镜头 5：分组聚合
caption('分组上色 → 聚拢 → 坍缩成汇总行');
stamp('镜头5 分组聚合');
await addOp('分组聚合');
await wait(1600);
try {
  const row = page.locator('.step-card.is-active .param-row').filter({ has: page.locator('label:text-is("聚合列")') });
  const sel = row.locator('select');
  await clickLoc(sel);
  await sel.selectOption('总分');
  await wait(900);
} catch (e) { console.log('  (聚合列默认值已可用)'); }
await clickLoc(loc('#btnPlay'));
await wait(3500);
await caption('同组上色后聚拢在一起，然后逐组坍缩成一行汇总');
await wait(9000);
await wait(1800);
stamp('镜头5 完成');

// 镜头 6：节奏控制
caption('暂停 / 单步 / 任意跳转 / 0.5×–4× / 只看结果');
stamp('镜头6 控制');
await clickLoc(loc('#btnFirst'));
await wait(3000);
await clickLoc(loc('#stepTrack .track-seg:nth-child(3)'));
await wait(3000);
await clickLoc(loc('.spd[data-speed="4"]'));
await clickLoc(loc('#btnRunAll'));
await wait(16000);
await clickLoc(loc('#chkInstant'));
await clickLoc(loc('#btnFirst'));
await clickLoc(loc('#btnRunAll'));
await wait(4000);
await clickLoc(loc('#chkInstant'));
await clickLoc(loc('.spd[data-speed="1"]'));
await wait(1200);

// 镜头 7：换数据集 + 自动演示
caption('换个数据集也一样：一键「自动演示」跑完整流程');
stamp('镜头7 比赛评分自动演示');
await moveTo(loc('#datasetSelect'));
await page.selectOption('#datasetSelect', 'scoring');
await wait(1500);
await clickLoc(loc('#btnDemo'));
await wait(9000);
await caption('自动演示：填充缺失 → 去重 → 去极值 → 新增均分 → 排序');
await wait(22000);
await caption('每一步都同样逐步演示，右侧统计与图表同步更新');
await wait(21000);
stamp('镜头7 完成');

// 镜头 8：粘贴导入
caption('粘贴 / 导入 CSV·JSON·TSV，处理结果可导出 CSV');
stamp('镜头8 粘贴导入');
await clickLoc(loc('#btnPaste'));
await wait(1200);
await page.fill('#pasteArea', '城市,最高温,最低温,降水\n北京,31,19,12\n上海,29,22,38\n广州,33,26,55\n成都,27,18,9');
await wait(1800);
await clickLoc(loc('#btnPasteOk'));
await wait(4000);
await clickLoc(loc('#btnExport'));
await wait(2500);

// 镜头 9：回到默认数据集 + 结尾
caption('零依赖零构建 · 自研数据引擎 + 动画剧本架构');
stamp('镜头9 收尾');
await moveTo(loc('#datasetSelect'));
await page.selectOption('#datasetSelect', 'students');
await wait(1800);
await addOp('去除极值');
await wait(1500);
await clickLoc(loc('#btnRunAll'));
await wait(8000);
await page.mouse.move(800, 500, { steps: 10 });
await wait(4000);
stamp('录制结束');

await context.close();
await browser.close();

const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.webm'));
console.log('视频输出目录：' + path.resolve(OUT));
files.forEach((f) => console.log('  - ' + f + '  ' + (fs.statSync(path.join(OUT, f)).size / 1048576).toFixed(1) + ' MB'));
