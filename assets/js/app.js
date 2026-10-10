/* =============================================================
   app.js · 应用主控：状态、播放控制、面板联动、主题与语言
   ============================================================= */
(function (global) {
  'use strict';
  const U = global.U;
  const D = global.DF;
  const I = global.I18n;
  const { $, $$, el, toast, fmt, makeToken } = U;

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
    chartType: 'auto',
    chartX: null,
    chartY: null,
  };

  /* ---------------- 初始化 ---------------- */
  function init() {
    applyStaticI18n();
    initTheme();
    initLang();

    app.view = new global.TableView($('#tableScroll'), {
      onRowHover: (id) => global.Charts.hot($('#chartBox'), id),   // 行 → 图
      onRowClick: (id) => { app.view.selectRows([id]); },
    });
    app.animator = new global.Animator(app.view, {
      say: onSay,
      hud: onHud,
      chart: (phase, data) => chartLive(phase, data),
      progress: (p) => { $('#narrProgress').style.width = (p * 100).toFixed(1) + '%'; },
    });

    const sel = $('#datasetSelect');
    global.DATASETS.forEach((d) => sel.appendChild(el('option', { value: d.id, text: Datasets.name(d) })));
    sel.addEventListener('change', () => loadDataset(sel.value));

    $('#btnRunAll').addEventListener('click', () => playFrom(0));
    $('#btnStepOnce').addEventListener('click', () => { if (app.viewIndex < app.state.steps.length) runStep(app.viewIndex); });
    $('#btnClearOps').addEventListener('click', () => {
      app.state.steps = [];
      app.viewIndex = 0;
      app.selectedStep = -1;
      renderAll(true);
      toast(I.t('msg.cleared'));
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
      $$('#speedGroup .spd').forEach((x) => x.classList.toggle('is-on', x === b));
    });
    $('#chkInstant').addEventListener('change', (e) => { app.instant = e.target.checked; });

    $('#chartTabs').addEventListener('click', (e) => {
      const b = e.target.closest('.chart-tab');
      if (!b) return;
      app.chartType = b.dataset.type;
      updateChart();
    });
    $('#chartX').addEventListener('change', (e) => { app.chartX = e.target.value; updateChart(); });
    $('#chartY').addEventListener('change', (e) => { app.chartY = e.target.value; updateChart(); });

    $('#btnCopyCode').addEventListener('click', () => {
      const txt = $('#codeBox').textContent;
      navigator.clipboard && navigator.clipboard.writeText(txt).then(() => toast(I.t('msg.copied')), () => toast(I.t('msg.copyFail')));
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

  /* ---------------- 主题 / 语言 ---------------- */
  function initTheme() {
    const saved = localStorage.getItem('dfl-theme');
    const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (sys ? 'dark' : 'light'), true);
    $('#btnTheme').addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }
  function setTheme(t, silent) {
    document.documentElement.dataset.theme = t;
    $('#btnTheme').textContent = t === 'dark' ? '☾' : '☀';
    localStorage.setItem('dfl-theme', t);
    if (!silent) {
      toast(I.t('msg.themeSwitched', { theme: I.t('theme.' + t) }));
      setTimeout(() => { updateChart(); }, 60);
    }
  }

  function initLang() {
    const saved = localStorage.getItem('dfl-lang');
    if (saved && saved !== I.lang) I.set(saved);
    I.onChange(() => { applyStaticI18n(); rebuildForLang(); });
    $('#langSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-lang]');
      if (!b) return;
      I.set(b.dataset.lang);
      localStorage.setItem('dfl-lang', b.dataset.lang);
      $$('#langSeg button').forEach((x) => x.classList.toggle('is-on', x === b));
      toast(I.t('msg.langSwitched'));
    });
    $$('#langSeg button').forEach((x) => x.classList.toggle('is-on', x.dataset.lang === I.lang));
  }

  /** 静态文案（data-i18n / data-i18n-html） */
  function applyStaticI18n() {
    $$('[data-i18n]').forEach((n) => { n.textContent = I.t(n.dataset.i18n); });
    $$('[data-i18n-html]').forEach((n) => { n.innerHTML = I.t(n.dataset.i18nHtml); });
    // 数据集下拉与说明
    const sel = $('#datasetSelect');
    if (sel) {
      Array.from(sel.options).forEach((o) => {
        const ds = global.DATASETS.find((d) => d.id === o.value);
        if (ds) o.textContent = Datasets.name(ds);
      });
    }
    const ds = Datasets.get(app.datasetId);
    if (ds && app.datasetId) $('#dsDesc').textContent = Datasets.desc(ds);
    $('#pasteArea').placeholder = I.t('paste.ph');
    document.title = I.t('app.title') + ' · ' + I.t('app.subtitle').split(' · ')[0];
  }

  /** 语言切换后：用新语言重建基础数据并重算流水线（步骤参数用列 key，天然跨语言） */
  function rebuildForLang() {
    if (!app.datasetId) return;
    const ds = Datasets.get(app.datasetId);
    app.state.base = Datasets.build(ds, I.lang);
    global.Pipe.computeFrom(app.state, 0);
    app.viewIndex = U.clamp(app.viewIndex, 0, app.state.steps.length);
    app.chartX = null; app.chartY = null;
    renderAll(true);
    const df = app.currentDf();
    onSay({
      badge: I.t('ui.badgeReady'),
      title: I.t('ui.readyTip'),
      sub: I.t('ui.readySub'),
    });
    void df;
  }

  /* ---------------- 数据 ---------------- */
  function loadDataset(id) {
    const ds = Datasets.get(id);
    app.datasetId = ds.id;
    $('#datasetSelect').value = ds.id;
    $('#dsDesc').textContent = Datasets.desc(ds);
    const df = Datasets.build(ds, I.lang);
    app.state = { base: df, steps: [] };
    app.viewIndex = 0;
    app.selectedStep = -1;
    app.chartX = null; app.chartY = null; app.chartType = 'auto';
    renderAll(true);
    onSay({
      badge: I.t('ui.badgeReady'),
      title: `${I.t('ui.readyTip')}：${I.t('ds.' + ds.id + '.name')} · ${I.t('ui.shape', { r: df.length, c: df.columns.length })}`,
      sub: I.t('ui.readySub'),
    });
  }

  function loadData(df, msg) {
    app.state = { base: df, steps: [] };
    app.viewIndex = 0;
    app.selectedStep = -1;
    app.chartX = null; app.chartY = null;
    renderAll(true);
    if (msg) toast(msg, 2600);
    onSay({ badge: I.t('ui.badgeReady'), title: msg || I.t('msg.loaded'), sub: I.t('msg.loadedSub') });
  }
  app.loadData = loadData;

  /* ---------------- 流水线编辑 ---------------- */
  app.currentDf = () => global.Pipe.dfAt(app.state, app.viewIndex);

  app.addStep = function (opId) {
    const df = global.Pipe.dfAt(app.state, app.state.steps.length);
    const params = global.Pipe.defaultsFor(opId, df);
    app.state.steps.push({ id: 's' + Math.random().toString(36).slice(2, 8), op: opId, params, enabled: true });
    global.Pipe.computeFrom(app.state, app.state.steps.length - 1);
    app.selectedStep = app.state.steps.length - 1;
    app.viewIndex = app.state.steps.length - 1;
    renderAll(true);
    const op = global.OPS[opId];
    toast(I.t('msg.addStep', { name: op.name }));
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
  function pause() { stop(); renderChrome(); toast(I.t('msg.paused')); }

  function goto(k) {
    stop();
    app.viewIndex = U.clamp(k, 0, app.state.steps.length);
    app.selectedStep = app.viewIndex - 1;
    app.view.setData(app.currentDf(), { silent: false });
    app.view.resetStates();
    renderChrome();
    const df = app.currentDf();
    if (app.viewIndex === 0) {
      onSay({ badge: I.t('ui.badgeRaw'), title: `${I.t('ui.sourceNode')}：${I.t('ui.shape', { r: df.length, c: df.columns.length })}`, sub: I.t('ui.readySub') });
    } else {
      onSay({
        badge: I.t('ui.badgeStep', { n: app.viewIndex }),
        title: I.t('ui.shape', { r: df.length, c: df.columns.length }),
        sub: global.OPS[app.state.steps[app.viewIndex - 1].op].name,
      });
    }
  }

  async function runStep(i) {
    if (i >= app.state.steps.length) return false;
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
    if (!app.state.steps.length) { toast(I.t('msg.emptyPipe')); return; }
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
    onSay({
      badge: I.t('ui.badgeDone'),
      title: I.t('ui.allDone', { n: app.state.steps.length }),
      sub: I.t('ui.allDoneSub', { shape: I.t('ui.shape', { r: df.length, c: df.columns.length }) }),
    });
  }

  async function startDemo() {
    const ds = Datasets.get(app.datasetId);
    stop();
    global.Pipe.buildFromDemo(app.state, ds.demo);
    app.viewIndex = 0;
    app.selectedStep = -1;
    renderAll(true);
    toast(I.t('msg.demoStart'), 2400);
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
        title: i === 0 ? I.t('ui.sourceNode') : `${I.t('ui.stepOf', { n: i })}：${global.OPS[app.state.steps[i - 1].op].name}`,
        onclick: () => goto(i),
      });
      box.appendChild(seg);
    }
  }

  function onSay(o) {
    const b = $('#narrBadge');
    b.textContent = o.badge || I.t('ui.badgeRun');
    b.className = 'narration-badge' + (/完成|done/i.test(o.badge || '') ? ' ok' : /运行|删除|核心|run|drop|core/i.test(o.badge || '') ? ' run' : '');
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
    if (data.total !== undefined) box.appendChild(hudRow(I.t('hud.progress'), `${data.count} / ${data.total}`));
    (data.rows || []).forEach((r) => box.appendChild(hudRow(r.label, r.value, r.cls)));
  }
  function hudRow(label, value, cls) {
    return el('div', { class: 'hud-row' }, [el('span', { text: label }), el('b', { class: cls || '', text: String(value) })]);
  }

  /* ---------------- 面板 ---------------- */
  function updatePanels() {
    const df = app.currentDf();
    const base = app.state.base;
    const prev = app.viewIndex > 0 ? global.Pipe.dfAt(app.state, app.viewIndex - 1) : base;

    $('#dsShape').textContent = I.t('ui.shape', { r: base.length, c: base.columns.length });
    const dst = $('#dsStats');
    dst.innerHTML = '';
    dst.appendChild(miniStat(String(base.length), I.t('ui.totalRows')));
    dst.appendChild(miniStat(String(base.columns.length), I.t('ui.cols')));
    dst.appendChild(miniStat(String(base.numericColumns().length), I.t('ui.numCols')));
    dst.appendChild(miniStat(String(base.totalMissing()), I.t('ui.missing')));

    $('#stageLabel').textContent = app.viewIndex === 0 ? I.t('ui.stageRaw') : I.t('ui.stageStep', { n: app.viewIndex });
    const kpi = $('#kpiGrid');
    kpi.innerHTML = '';
    kpi.appendChild(kpiBox(I.t('ui.rows'), df.length, df.length - prev.length, true));
    kpi.appendChild(kpiBox(I.t('ui.colCount'), df.columns.length, df.columns.length - prev.columns.length, true));
    kpi.appendChild(kpiBox(I.t('ui.missingVal'), df.totalMissing(), df.totalMissing() - prev.totalMissing(), false));
    kpi.appendChild(kpiBox(I.t('ui.numCols'), df.numericColumns().length, df.numericColumns().length - prev.numericColumns().length, true));

    updateChart();
    updateDescribe(df);
    updateCode();
    updateDiff(df, prev);
  }

  function miniStat(v, label) { return el('div', { class: 'mini-stat' }, [el('b', { text: v }), el('span', { text: label })]); }
  function kpiBox(label, v, delta, upIsGood) {
    const cls = delta === 0 ? '' : ((delta > 0) === !!upIsGood ? ' up' : ' down');
    const d = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${delta})`;
    return el('div', { class: 'kpi' + cls }, [el('b', { text: String(v) }), el('span', { text: label + d })]);
  }

  /* ---------------- 图表 ---------------- */
  function updateChart() {
    const df = app.currentDf();
    if (!df) return;
    const keys = df.keys();
    const tabs = $('#chartTabs');
    // 第 0 步（原始数据）没有"处理前"，此时不提供前后对比图
    const prev = app.viewIndex > 0 ? global.Pipe.dfAt(app.state, app.viewIndex - 1) : null;
    const avail = global.Charts.available(df, { prev });
    const rec = global.Charts.recommend(df);
    const sig = avail.join(',') + '|' + app.chartType + '|' + I.lang + '|' + rec;
    if (tabs.dataset.sig !== sig) {
      tabs.innerHTML = '';
      global.Charts.GROUPS.forEach((g) => {
        const list = avail.filter((t) => global.Charts.GROUP_OF[t] === g);
        if (!list.length) return;
        tabs.appendChild(el('span', { class: 'chart-group', text: global.Charts.groupName(g) }));
        list.forEach((t) => {
          tabs.appendChild(el('button', {
            class: 'chart-tab' + (t === app.chartType ? ' is-on' : '') + (t === rec ? ' is-rec' : ''),
            'data-type': t,
            title: t === rec ? I.t('chart.recommend') : global.Charts.typeName(t),
            text: (t === rec ? '★ ' : '') + global.Charts.typeName(t),
          }));
        });
      });
      tabs.dataset.sig = sig;
    }
    if (avail.indexOf(app.chartType) < 0) app.chartType = 'auto';

    ['chartX', 'chartY'].forEach((id) => {
      const s = $('#' + id);
      const sig2 = keys.join('|');
      if (s.dataset.sig !== sig2) {
        s.innerHTML = '';
        keys.forEach((k) => s.appendChild(el('option', { value: k, text: df.nameOf(k) })));
        s.dataset.sig = sig2;
      }
    });
    // 与分析联动：优先展示「当前步骤正在处理的那一列」
    const idx = app.runningIndex >= 0 ? app.runningIndex : app.selectedStep;
    const step = idx >= 0 ? app.state.steps[idx] : (app.viewIndex > 0 ? app.state.steps[app.viewIndex - 1] : null);
    let hint = null;
    if (step && step.params) {
      const p = step.params;
      hint = p.col || p.yKey || (Array.isArray(p.valueCols) ? p.valueCols[0] : null) || null;
      if (hint && !df.has(hint)) hint = null;
    }
    const rx = global.Charts.resolve({
      type: app.chartType,
      xKey: app.chartX || (step && step.params ? (step.params.by || step.params.index || step.params.key || null) : null),
      yKey: app.chartY || hint,
    }, df);
    if ($('#chartX').value !== String(rx.x || '')) $('#chartX').value = rx.x || '';
    if ($('#chartY').value !== String(rx.y || '')) $('#chartY').value = rx.y || '';
    $('#chartX').title = I.t('chart.x'); $('#chartY').title = I.t('chart.y');

    // 矩阵型图表给更高的画布，保证可读性
    $('#chartBox').classList.toggle('is-tall', ['splom', 'corr', 'missmap', 'profile', 'histmulti'].indexOf(rx.type) >= 0);
    global.Charts.render(
      $('#chartBox'), df,
      { type: app.chartType, xKey: rx.x, yKey: rx.y },
      $('#chartLegend'),
      { prev, onSelect: onChartSelect }
    );
    updateInsight(df, { yKey: rx.y });
  }

  /** 点击图形 → 选中并定位到对应数据行（刷选联动） */
  function onChartSelect(ids, label) {
    const n = app.view.selectRows(ids);
    toast(I.t('msg.brush', { n, label: label || '' }), 1800);
  }

  /** 图下自动洞察：用图形读出来的结论 */
  function updateInsight(df, opts) {
    const box = $('#chartInsight');
    if (!box) return;
    const list = global.Charts.insight(df, opts);
    box.innerHTML = '';
    if (!list.length) return;
    box.appendChild(el('span', { class: 'insight-tag', text: '💡 ' + I.t('chart.insight') }));
    list.forEach((s) => box.appendChild(el('span', { class: 'insight-item', text: s })));
  }

  /** 动画过程驱动图表：扫描生长 / 删除掉落 / 填充补值 */
  function chartLive(phase, data) {
    if (!app.state.base) return;
    const df = app.currentDf();
    let viewDf = df;
    let live = null;
    if (phase === 'scan') {
      live = data;
    } else if (phase === 'drop') {
      const set = new Set((data.ids || []).map(String));
      try {
        viewDf = new D.DataFrame(df.rows.filter((r) => !set.has(String(r._id))), df.columns, Object.assign({}, df.meta));
      } catch (e) { viewDf = df; }
    }
    if (phase !== 'drop') app.view.clearSelection && app.view.clearSelection();
    const prev = app.viewIndex > 0 ? global.Pipe.dfAt(app.state, app.viewIndex - 1) : null;
    const rx = global.Charts.resolve({ type: app.chartType, xKey: app.chartX, yKey: app.chartY }, viewDf);
    global.Charts.render($('#chartBox'), viewDf, { type: app.chartType, xKey: rx.x, yKey: rx.y }, $('#chartLegend'), { prev, live, onSelect: onChartSelect });
  }
  app.chartLive = chartLive;

  function updateDescribe(df) {
    const box = $('#describeBox');
    const d = D.describe(df);
    if (!d) { box.innerHTML = '<p class="muted small">' + I.t('ui.noNumeric') + '</p>'; return; }
    const t = el('table', { class: 'desc-table' });
    t.appendChild(el('thead', {}, [el('tr', {}, [el('th', { text: I.t('c.stat') })].concat(d.columns.map((k) => el('th', { text: df.nameOf(k) }))))]));
    const tb = el('tbody');
    d.rows.forEach((r) => {
      tb.appendChild(el('tr', {}, [el('td', { text: r.stat })].concat(d.columns.map((k) => el('td', { text: r[k] === null ? '–' : fmt(r[k]) })))));
    });
    t.appendChild(tb);
    box.innerHTML = '';
    box.appendChild(t);
  }

  function updateCode() {
    const lines = ['import pandas as pd', `df = pd.read_csv('${app.datasetId || 'data'}.csv')   # ${I.t('c.or')} pd.DataFrame(...)`];
    const upto = app.viewIndex;
    for (let i = 0; i < Math.min(upto, app.state.steps.length); i++) {
      const s = app.state.steps[i];
      lines.push('');
      lines.push(`# ${I.t('ui.stepOf', { n: i + 1 })} · ${global.OPS[s.op].name}`);
      lines.push(String(s.code || ''));
    }
    $('#codeBox').innerHTML = highlight(lines.join('\n'));
  }

  function updateDiff(df, prev) {
    const box = $('#diffBox');
    box.innerHTML = '';
    if (app.viewIndex === 0) {
      box.appendChild(el('p', { class: 'muted small', text: I.t('ui.diffHint') }));
      return;
    }
    const step = app.state.steps[app.viewIndex - 1];
    const rows = [
      [global.OPS[step.op].name, '', ''],
      [I.t('ui.rows'), `${prev.length} → ${df.length}`, df.length - prev.length],
      [I.t('ui.colCount'), `${prev.columns.length} → ${df.columns.length}`, df.columns.length - prev.columns.length],
      [I.t('ui.missingVal'), `${prev.totalMissing()} → ${df.totalMissing()}`, df.totalMissing() - prev.totalMissing()],
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
