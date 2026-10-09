/* =============================================================
   app.js · 应用主控：状态、播放控制、面板联动
   ============================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const D = global.DF;
  const { $, el, toast, fmt, makeToken } = U;

  const app = {
    state: { base: null, steps: [] },
    viewIndex: 0,
    selectedStep: -1,
    view: null,
    animator: null,
    token: null,
    playing: false,
    speed: 1,
    instant: false,
    runningIndex: -1,
    datasetId: null,
    chartCol: null,
  };

  /* ---------------- 初始化 ---------------- */
  function init() {
    app.view = new global.TableView($('#tableScroll'));
    app.animator = new global.Animator(app.view, {
      say: onSay,
      hud: onHud,
      progress: (p) => { $('#narrProgress').style.width = (p * 100).toFixed(1) + '%'; },
    });

    const sel = $('#datasetSelect');
    global.DATASETS.forEach((d) => sel.appendChild(el('option', { value: d.id, text: d.name })));
    sel.addEventListener('change', () => loadDataset(sel.value));

    $('#btnRunAll').addEventListener('click', () => playFrom(0));
    $('#btnStepOnce').addEventListener('click', () => { if (app.viewIndex < app.state.steps.length) runStep(app.viewIndex); });
    $('#btnClearOps').addEventListener('click', () => {
      app.state.steps = [];
      app.viewIndex = 0;
      renderAll(true);
      toast('已清空流水线步骤');
    });
    $('#btnReload').addEventListener('click', () => loadDataset(app.datasetId));
    $('#btnDemo').addEventListener('click', startDemo);

    $('#btnPlay').addEventListener('click', () => (app.playing ? pause() : playFrom(app.viewIndex)));
    $('#btnPrevStep').addEventListener('click', () => goto(Math.max(0, app.viewIndex - 1)));
    $('#btnNextStep').addEventListener('click', () => runStep(app.viewIndex));
    $('#btnFirst').addEventListener('click', () => goto(0));
    $('#btnLast').addEventListener('click', () => goto(app.state.steps.length));

    $('#speedGroup').addEventListener('click', (e) => {
      const b = e.target.closest('.spd');
      if (!b) return;
      app.speed = Number(b.dataset.speed);
      U.$$('#speedGroup .spd').forEach((x) => x.classList.toggle('is-on', x === b));
    });
    $('#chkInstant').addEventListener('change', (e) => { app.instant = e.target.checked; });

    $('#chartPick').addEventListener('change', (e) => { app.chartCol = e.target.value; updateChart(); });
    $('#btnCopyCode').addEventListener('click', () => {
      const txt = $('#codeBox').textContent;
      navigator.clipboard && navigator.clipboard.writeText(txt).then(() => toast('代码已复制'), () => toast('复制失败'));
    });

    $('#btnHelp').addEventListener('click', () => { $('#helpModal').hidden = false; });
    document.querySelectorAll('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) m.hidden = true; });
    });

    document.addEventListener('keydown', (e) => {
      if (/input|textarea|select/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); app.playing ? pause() : playFrom(app.viewIndex); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); runStep(app.viewIndex); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goto(Math.max(0, app.viewIndex - 1)); }
      else if (e.key.toLowerCase() === 'r') playFrom(0);
    });

    window.addEventListener('resize', () => { clearTimeout(app._rt); app._rt = setTimeout(updateChart, 220); });

    global.Importer.bind(app);
    loadDataset(global.DATASETS[0].id);
  }

  /* ---------------- 数据 ---------------- */
  function loadDataset(id) {
    const ds = global.DATASETS.find((d) => d.id === id) || global.DATASETS[0];
    app.datasetId = ds.id;
    $('#datasetSelect').value = ds.id;
    $('#dsDesc').textContent = ds.desc;
    const df = D.DataFrame.fromCSV(ds.csv, { name: ds.name });
    app.state = { base: df, steps: [] };
    app.viewIndex = 0;
    app.selectedStep = -1;
    app.chartCol = null;
    renderAll(true);
    onSay({ badge: '就绪', title: `已载入「${ds.name}」：${df.length} 行 × ${df.columns.length} 列`, sub: '点击「运行全部」开始可视化演示，或从左侧操作库自己搭建流水线' });
  }

  function loadData(df, msg) {
    app.state = { base: df, steps: [] };
    app.viewIndex = 0;
    app.selectedStep = -1;
    app.chartCol = null;
    renderAll(true);
    if (msg) toast(msg, 2600);
    onSay({ badge: '就绪', title: msg || '数据已载入', sub: '数据集已替换，流水线已重置' });
  }
  app.loadData = loadData;

  /* ---------------- 流水线编辑 ---------------- */
  app.currentDf = () => global.Pipe.dfAt(app.state, app.viewIndex);

  app.addStep = function (opId) {
    const df = global.Pipe.dfAt(app.state, app.state.steps.length);
    const params = global.Pipe.defaultsFor(opId, df);
    app.state.steps.push({ id: 's' + Math.random().toString(36).slice(2, 8), op: opId, params, enabled: true });
    global.Pipe.computeFrom(app.state, app.state.steps.length - 1);
    // 停在「新步骤之前」的状态，方便单步观看这一新步骤
    app.selectedStep = app.state.steps.length - 1;
    app.viewIndex = app.state.steps.length - 1;
    renderAll(true);
    const op = global.OPS[opId];
    toast(`已加入「${op.name}」：点 ▶ 单步观看，或「运行全部」从头演示`);
  };

  app.removeStep = function (i) {
    app.state.steps.splice(i, 1);
    global.Pipe.computeFrom(app.state, Math.max(0, i));
    app.viewIndex = Math.min(app.viewIndex, app.state.steps.length);
    app.selectedStep = Math.min(app.selectedStep, app.state.steps.length - 1);
    renderAll(true);
  };

  app.moveStep = function (i, dir) {
    const j = i + dir;
    if (j < 0 || j >= app.state.steps.length) return;
    const s = app.state.steps;
    [s[i], s[j]] = [s[j], s[i]];
    global.Pipe.computeFrom(app.state, Math.min(i, j));
    renderAll(true);
  };

  app.onParamsChanged = function (i) {
    global.Pipe.computeFrom(app.state, i);
    app.viewIndex = Math.min(app.viewIndex, i + 1);
    renderAll(true);
  };

  app.selectStep = function (i) { goto(i + 1); };
  app.goto = goto;

  /* ---------------- 播放控制 ---------------- */
  function stop() {
    if (app.token) app.token.cancel();
    app.playing = false;
    app.runningIndex = -1;
    $('#btnPlay').textContent = '▶';
    $('#hud').hidden = true;
  }
  function pause() { stop(); renderChrome(); toast('已暂停'); }

  function goto(k) {
    stop();
    app.viewIndex = U.clamp(k, 0, app.state.steps.length);
    app.selectedStep = app.viewIndex - 1;
    app.view.setData(app.currentDf(), { silent: false });
    app.view.resetStates();
    renderChrome();
    const df = app.currentDf();
    onSay({
      badge: app.viewIndex === 0 ? '原始' : '第 ' + app.viewIndex + ' 步',
      title: app.viewIndex === 0
        ? `原始数据：${df.length} 行 × ${df.columns.length} 列`
        : `已跳到第 ${app.viewIndex} 步的结果：${df.length} 行 × ${df.columns.length} 列`,
      sub: app.viewIndex === 0 ? '点击「运行全部」观看完整的处理过程' : '回退到任意步骤，或继续运行后续步骤',
    });
  }

  async function runStep(i) {
    if (i >= app.state.steps.length) return;
    const step = app.state.steps[i];
    stop();
    const before = global.Pipe.dfAt(app.state, i);
    app.view.setData(before, { silent: true });
    app.view.resetStates();
    app.viewIndex = i;
    app.runningIndex = i;
    app.selectedStep = i;
    renderChrome();

    app.token = makeToken();
    app.playing = true;
    $('#btnPlay').textContent = '❚❚';
    try {
      await app.animator.play(step.result, { speed: app.speed, token: app.token, instant: app.instant });
    } catch (e) {
      if (!(e && e.cancelled)) throw e;
      return false;
    }
    app.playing = false;
    app.runningIndex = -1;
    app.viewIndex = i + 1;
    $('#btnPlay').textContent = '▶';
    $('#hud').hidden = true;
    renderChrome();
    return true;
  }

  async function playFrom(start) {
    if (!app.state.steps.length) { toast('流水线为空：先从左侧操作库添加步骤，或点击「自动演示」'); return; }
    stop();
    if (start === 0) {
      app.viewIndex = 0;
      app.view.setData(app.state.base, { silent: true });
      renderChrome();
    }
    for (let i = start; i < app.state.steps.length; i++) {
      const ok = await runStep(i);
      if (!ok) return;
      await U.sleep(260 / app.speed);
    }
    const df = app.currentDf();
    onSay({ badge: '完成', title: `全部 ${app.state.steps.length} 步执行完毕`, sub: `最终结果：${df.length} 行 × ${df.columns.length} 列，可点击「导出」保存处理后的数据` });
  }

  async function startDemo() {
    const ds = global.DATASETS.find((d) => d.id === app.datasetId);
    stop();
    global.Pipe.buildFromDemo(app.state, (ds && ds.demo) || global.DATASETS[0].demo);
    app.viewIndex = 0;
    app.selectedStep = -1;
    renderAll(true);
    toast('自动演示开始：观察每一步的处理逻辑', 2400);
    await U.sleep(320);
    playFrom(0);
  }

  /* ---------------- 渲染 ---------------- */
  function renderChrome() {
    global.Pipe.renderOpLibrary(app);
    global.Pipe.renderPipeline(app);
    renderTrack();
    updatePanels();
  }

  function renderAll(renderTable) {
    if (renderTable) {
      app.view.setData(app.currentDf(), { silent: false });
      app.view.resetStates();
    }
    renderChrome();
  }

  function renderTrack() {
    const box = $('#stepTrack');
    box.innerHTML = '';
    const n = app.state.steps.length;
    for (let i = 0; i <= n; i++) {
      const seg = el('div', {
        class: 'track-seg' + (i < app.viewIndex ? ' done' : '') + (i === app.viewIndex ? ' cur' : ''),
        title: i === 0 ? '原始数据' : `步骤 ${i}：${global.OPS[app.state.steps[i - 1].op].name}`,
        onclick: () => goto(i),
      });
      box.appendChild(seg);
    }
  }

  function onSay(o) {
    $('#narrBadge').textContent = o.badge || '运行';
    $('#narrBadge').className = 'narration-badge' + (o.badge === '完成' ? ' ok' : (o.badge === '删除' || o.badge === '核心' ? ' run' : ''));
    $('#narrTitle').textContent = o.title || '';
    $('#narrSub').textContent = o.sub || '';
  }

  function onHud(show, data) {
    const hud = $('#hud');
    if (!show) { hud.hidden = true; return; }
    hud.hidden = false;
    if (!data) return;
    const box = $('#hudRows');
    box.innerHTML = '';
    if (data.total !== undefined) box.appendChild(hudRow('扫描进度', `${data.count} / ${data.total}`));
    (data.rows || []).forEach((r) => box.appendChild(hudRow(r.label, r.value, r.cls)));
  }

  function hudRow(label, value, cls) {
    return el('div', { class: 'hud-row' }, [
      el('span', { text: label }),
      el('b', { class: cls || '', text: String(value) }),
    ]);
  }

  /* ---------------- 面板 ---------------- */
  function updatePanels() {
    const df = app.currentDf();
    const base = app.state.base;
    const prev = app.viewIndex > 0 ? global.Pipe.dfAt(app.state, app.viewIndex - 1) : base;

    // 左侧数据源信息
    $('#dsShape').textContent = `${base.length} 行 × ${base.columns.length} 列`;
    $('#dsStats').innerHTML = '';
    const nmiss = base.totalMissing();
    $('#dsStats').appendChild(miniStat(String(base.length), '总行数'));
    $('#dsStats').appendChild(miniStat(String(base.columns.length), '列数'));
    $('#dsStats').appendChild(miniStat(String(base.numericColumns().length), '数值列'));
    $('#dsStats').appendChild(miniStat(String(nmiss), '缺失单元格'));

    // KPI
    $('#stageLabel').textContent = app.viewIndex === 0 ? '原始' : `第 ${app.viewIndex} 步`;
    const kpi = $('#kpiGrid');
    kpi.innerHTML = '';
    kpi.appendChild(kpiBox('行数', df.length, df.length - prev.length, true));
    kpi.appendChild(kpiBox('列数', df.columns.length, df.columns.length - prev.columns.length, true));
    kpi.appendChild(kpiBox('缺失值', df.totalMissing(), df.totalMissing() - prev.totalMissing(), false));
    kpi.appendChild(kpiBox('数值列', df.numericColumns().length, df.numericColumns().length - prev.numericColumns().length, true));

    // 图表
    updateChart();
    // 描述统计
    updateDescribe(df);
    // 代码
    updateCode();
    // 变化
    updateDiff(df, prev);
  }

  function miniStat(v, label) {
    return el('div', { class: 'mini-stat' }, [el('b', { text: v }), el('span', { text: label })]);
  }

  function kpiBox(label, v, delta, upIsGood) {
    const cls = delta === 0 ? '' : ((delta > 0) === !!upIsGood ? ' up' : ' down');
    const d = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${delta})`;
    return el('div', { class: 'kpi' + cls }, [
      el('b', { text: String(v) }),
      el('span', { text: label + d }),
    ]);
  }

  function updateChart() {
    const df = app.currentDf();
    const pick = $('#chartPick');
    const names = df.names();
    if (pick.dataset.sig !== names.join('|')) {
      pick.innerHTML = '';
      names.forEach((n) => pick.appendChild(el('option', { value: n, text: n + (df.typeOf(n) === 'number' ? '（数值）' : '') })));
      pick.dataset.sig = names.join('|');
    }
    let col = app.chartCol && names.includes(app.chartCol) ? app.chartCol : defaultChartCol(df);
    app.chartCol = col;
    pick.value = col;
    global.Charts.render($('#chartBox'), df, col, $('#chartLegend'));
  }

  /** 选一个最有信息量的默认作图字段（跳过 id 类字段） */
  function defaultChartCol(df) {
    const nums = df.numericColumns();
    const idLike = /(^|_|\b)(id|ID|学号|编号|序号|index|no)$/;
    const cand = nums.filter((n) => !idLike.test(n));
    const list = cand.length ? cand : nums;
    if (!list.length) return df.names()[0];
    // 优先方差更大的列（分布更有看头）
    let best = list[0], bestV = -1;
    list.forEach((c) => {
      const v = D.Stats.std(df.values(c));
      if (v > bestV) { bestV = v; best = c; }
    });
    return best;
  }

  function updateDescribe(df) {    const box = $('#describeBox');
    const d = D.describe(df);
    if (!d) { box.innerHTML = '<p class="muted small">当前数据没有数值列。</p>'; return; }
    const t = el('table', { class: 'desc-table' });
    const thead = el('thead', {}, [el('tr', {}, [el('th', { text: '统计' })].concat(d.columns.map((c) => el('th', { text: c }))))]);
    t.appendChild(thead);
    const tb = el('tbody');
    d.rows.forEach((r) => {
      tb.appendChild(el('tr', {}, [el('td', { text: r.stat })].concat(d.columns.map((c) => el('td', { text: r[c] === null ? '–' : fmt(r[c]) })))));
    });
    t.appendChild(tb);
    box.innerHTML = '';
    box.appendChild(t);
  }

  function updateCode() {
    const lines = ['import pandas as pd', `df = pd.read_csv('${app.datasetId || 'data'}.csv')   # 或 pd.DataFrame(...)`];
    const upto = app.viewIndex;
    for (let i = 0; i < Math.min(upto, app.state.steps.length); i++) {
      const s = app.state.steps[i];
      lines.push('');
      lines.push(`# 步骤 ${i + 1} · ${global.OPS[s.op].name}`);
      lines.push(String(s.code || ''));
    }
    $('#codeBox').innerHTML = highlight(lines.join('\n'));
  }

  function updateDiff(df, prev) {
    const box = $('#diffBox');
    box.innerHTML = '';
    if (app.viewIndex === 0) {
      box.appendChild(el('p', { class: 'muted small', text: '当前展示的是原始数据，运行步骤后可查看每一步的变化量。' }));
      return;
    }
    const step = app.state.steps[app.viewIndex - 1];
    const rows = [
      ['步骤', global.OPS[step.op].name, ''],
      ['行数', `${prev.length} → ${df.length}`, df.length - prev.length],
      ['列数', `${prev.columns.length} → ${df.columns.length}`, df.columns.length - prev.columns.length],
      ['缺失值', `${prev.totalMissing()} → ${df.totalMissing()}`, df.totalMissing() - prev.totalMissing()],
    ];
    rows.forEach((r) => {
      let cls = '';
      if (typeof r[2] === 'number' && r[2] !== 0) cls = r[2] < 0 ? 'good' : 'bad';
      const delta = typeof r[2] === 'number' && r[2] !== 0 ? `（${r[2] > 0 ? '+' : ''}${r[2]}）` : '';
      box.appendChild(el('div', { class: 'diff-row' }, [
        el('span', { class: 'lbl', text: r[0] }),
        el('span', { class: 'val ' + cls, text: r[1] + delta }),
      ]));
    });
  }

  function highlight(code) {
    return U.escapeHtml(code)
      .replace(/(&#39;[^&]*?&#39;|'[^']*')/g, '<span class="str">$1</span>')
      .replace(/(#[^\n]*)/g, '<span class="cm">$1</span>')
      .replace(/\b(import|as|df|pd)\b/g, '<span class="kw">$1</span>')
      .replace(/([a-zA-Z_][a-zA-Z0-9_]*)\(/g, '<span class="fn">$1</span>(');
  }

  document.addEventListener('DOMContentLoaded', init);
  global.APP = app;
})(window);
