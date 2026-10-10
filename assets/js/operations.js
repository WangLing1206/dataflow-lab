/* =============================================================
   operations.js · pandas 风格操作库（28 个操作）
   每个 run(df, params) 返回：
     { df: 结果数据, code: 等价 pandas 代码, trace: 动画剧本 }
   剧本里的 say 事件只存 i18n key + 参数，由播放器按当前语言渲染
   ============================================================= */
(function (global) {
  'use strict';
  const D = global.DF;
  const I = global.I18n;
  const S = D.Stats;
  const U = global.U;
  const { isMissing, toNumber } = D;
  const fmt = U.fmt;

  /* ---------------- 通用小工具 ---------------- */
  const KEYS = (df) => df.keys();
  const NUM = (df) => df.numericColumns();
  const TXT = (df) => df.textColumns();

  const ID_LIKE = /(^|_|\s)(id|学号|编号|序号|index|no)$/i;

  function preferNumCol(df) {
    const nums = NUM(df);
    const cand = nums.filter((k) => !ID_LIKE.test(k));
    return (cand.length ? cand : nums)[0] || KEYS(df)[0] || '';
  }
  function preferCatCol(df) {
    const texts = TXT(df);
    if (!texts.length) return KEYS(df)[0] || '';
    const lim = Math.max(2, Math.min(20, df.length / 2));
    const ideal = Math.sqrt(Math.max(1, df.length));
    const scored = texts
      .map((k) => ({ k, u: df.uniqueValues(k).length }))
      .filter((x) => x.u > 1 && x.u <= lim)
      .map((x) => ({ k: x.k, d: Math.abs(x.u - ideal) }))
      .sort((a, b) => a.d - b.d);
    return scored.length ? scored[0].k : texts[0];
  }
  function preferIdCol(df) {
    const idk = KEYS(df).find((k) => ID_LIKE.test(k));
    return idk || KEYS(df)[KEYS(df).length - 1] || '';
  }

  /** '@total' → { key:'total', name:'总分' / 'total' } */
  function resolveName(v) {
    const s = String(v || '');
    if (s.charAt(0) === '@') return { key: s.slice(1), name: I.t('colname.' + s.slice(1)) };
    return { key: s, name: s };
  }

  /** 由模板生成派生列：key 稳定，name 随语言变化 */
  function tmplCol(tplKey, extra) {
    const key = extra.key;
    const name = I.t(tplKey, extra);
    return { key, name };
  }

  function say(key, args, badge, hold) {
    return { t: 'say', key: 'say.' + key, args: args || {}, badge: badge || 'run', hold: hold || 820 };
  }
  function wait(ms) { return { t: 'wait', ms: ms || 320 }; }
  function settle(mode) { return { t: 'settle', mode: mode || 'render' }; }

  function dupRows(df) { return df.rows.map((r) => Object.assign({}, r)); }
  function dupCols(df) { return df.columns.map((c) => Object.assign({}, c)); }

  function newDF(df, rows, columns) {
    return new D.DataFrame(rows, columns || dupCols(df), Object.assign({}, df.meta));
  }

  function name(df, k) { return df.nameOf(k); }
  function codeCol(df, k) { return name(df, k); }

  /** 扫描事件：items = [{id, v, flag}] */
  function scanEvent(o) {
    return {
      t: 'scan', mode: 'rows', col: o.col, colName: o.colName, items: o.items,
      track: o.track || 'flag', per: o.per, hud: o.hud !== false,
      keepKey: o.keepKey || 'hud.hit', dropKey: o.dropKey || 'hud.out',
    };
  }

  function dropEvent(ids, labelKey, labelArgs) {
    return { t: 'drop', ids, labelKey: labelKey || 'drop.default', labelArgs: labelArgs || {} };
  }
  function fillEvent(cells, per) { return { t: 'fill', cells, per: per || 160 }; }
  function addColEvent(col, cells, formula, per) {
    return { t: 'addcol', col, cells, formula, per: per || 55 };
  }

  /** 通用：派生一个新列（transform / normalize / window / …） */
  function derive(df, o) {
    const rows = dupRows(df);
    const cells = [];
    rows.forEach((r, i) => {
      let v = o.compute(r, i, rows);
      if (v === undefined || v === null || (typeof v === 'number' && !isFinite(v))) v = null;
      r[o.col.key] = v;
      cells.push({ id: r._id, v });
    });
    const columns = dupCols(df).concat([{ key: o.col.key, name: o.col.name, type: o.type || 'number' }]);
    const out = new D.DataFrame(rows, columns, Object.assign({}, df.meta));
    return {
      df: out,
      code: o.code,
      trace: [
        say(o.startKey, o.startArgs, o.badge || 'trans'),
        addColEvent({ key: o.col.key, name: o.col.name, type: o.type || 'number' }, cells, o.formula, o.per),
        say(o.doneKey, o.doneArgs || o.startArgs, 'done'),
        settle('none'),
      ],
    };
  }

  /** 参数定义助手（options 统一为 [{v,l}]） */
  function P(id) {
    return {
      col: (key, df, filterFn, def) => {
        let keys = KEYS(df);
        if (filterFn) keys = keys.filter(filterFn);
        if (!keys.length) keys = KEYS(df);
        return { key, type: 'col', options: keys.map((k) => ({ v: k, l: name(df, k) })), default: def || keys[0] };
      },
      cols: (key, df, filterFn, def) => {
        let keys = KEYS(df);
        if (filterFn) keys = keys.filter(filterFn);
        if (!keys.length) keys = KEYS(df);
        return { key, type: 'cols', options: keys.map((k) => ({ v: k, l: name(df, k) })), default: def || keys.slice() };
      },
      sel: (key, options, def, opId) => ({
        key, type: 'select',
        options: options.map((v) => ({ v, l: I.opt(opId || id, v) })),
        default: def === undefined ? options[0] : def,
      }),
      num: (key, def, min, max) => ({ key, type: 'number', default: def, min, max }),
      text: (key, def) => ({ key, type: 'text', default: def }),
      newname: (key, def) => ({ key, type: 'name', default: def }),
    };
  }

  /* ---------------- 操作集合 ---------------- */
  const OPS = {};
  const ORDER = [];
  function defOp(id, cat, icon, cfg) {
    const op = Object.assign({
      id, cat, icon,
      get name() { return I.t('op.' + id + '.name'); },
      get desc() { return I.t('op.' + id + '.desc'); },
      title(params, df) { return I.t('op.' + id + '.summary', titleArgs(id, params, df)); },
    }, cfg);
    OPS[id] = op;
    ORDER.push(id);
    return op;
  }

  function titleArgs(id, params, df) {
    const n = (k) => (df && df.has(k) ? name(df, k) : k);
    switch (id) {
      case 'view': return { how: I.opt(id, params.how), n: params.n };
      case 'describe': return { k: df ? NUM(df).length : 0 };
      case 'select': case 'dropcol': return { k: (params.cols || []).length };
      case 'rename': return { from: n(params.col), to: resolveName(params.name).name };
      case 'filter': return { col: n(params.col), op: params.op, v: params.value };
      case 'sort': return { col: n(params.col), asc: I.opt(id, params.asc) };
      case 'sample': return { n: params.n, seed: params.seed };
      case 'astype': return { col: n(params.col), to: I.opt(id, params.to) };
      case 'melt': return { k: (params.idCols || []).length };
      case 'dedupe': return { k: (params.cols || []).length, keep: I.opt(id, params.keep) };
      case 'missing': return { strategy: I.opt(id, params.strategy), cols: (params.cols || []).map(n).join('、') };
      case 'outlier': return { mode: I.opt(id, params.mode), col: n(params.col) };
      case 'replace': return { col: n(params.col), from: params.from, to: params.to };
      case 'cleanconst': return { what: I.opt(id, params.what) };
      case 'assign': return { name: resolveName(params.name).name, how: I.opt(id, params.mode), cols: (params.cols || []).map(n).join(' + ') };
      case 'normalize': return { col: n(params.col), how: I.opt(id, params.how) };
      case 'transform': return { how: I.opt(id, params.how), col: n(params.col) };
      case 'strcase': return { how: I.opt(id, params.how), col: n(params.col) };
      case 'datepart': return { col: n(params.col), how: I.opt(id, params.how) };
      case 'rank': return { col: n(params.col), asc: I.opt(id, params.asc) };
      case 'window': return { how: I.opt(id, params.how), col: n(params.col) };
      case 'groupby': return { by: n(params.by), col: n(params.col), how: I.opt(id, params.how) };
      case 'pivot': return { index: n(params.index), columns: n(params.columns) };
      case 'valuecount': return { col: n(params.col) };
      case 'corr': return { k: df ? NUM(df).length : 0 };
      case 'merge': return { key: n(params.key) };
      case 'concat': return { n: params.n };
      default: return {};
    }
  }

  const CATS = ['observe', 'shape', 'clean', 'transform', 'analyze', 'combine'];

  /* ============================ 观察 ============================ */
  defOp('view', 'observe', '🔍', {
    params: (df) => {
      const p = P('view');
      return [p.sel('how', ['head', 'tail', 'sample'], 'head', 'view'), p.num('n', Math.min(8, Math.max(2, df.length)), 1, Math.max(1, df.length))];
    },
    code: (params) => {
      if (params.how === 'head') return `df.head(${params.n})`;
      if (params.how === 'tail') return `df.tail(${params.n})`;
      return `df.sample(${params.n}, random_state=42)`;
    },
    run(df, params) {
      const n = U.clamp(Number(params.n) || 8, 1, df.length);
      let keepIds;
      if (params.how === 'tail') keepIds = new Set(df.rows.slice(-n).map((r) => r._id));
      else if (params.how === 'sample') {
        const rnd = U.mulberry32(42);
        const pool = df.rows.map((r) => r._id);
        for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        keepIds = new Set(pool.slice(0, n));
      } else keepIds = new Set(df.rows.slice(0, n).map((r) => r._id));

      const items = df.rows.map((r) => ({ id: r._id, v: null, flag: keepIds.has(r._id) ? 'pass' : 'drop' }));
      const dropIds = items.filter((x) => x.flag !== 'pass').map((x) => x.id);
      const out = newDF(df, df.rows.filter((r) => keepIds.has(r._id)));
      return {
        df: out,
        code: `df.${params.how}(${params.n})`,
        trace: [
          say('view.start', { how: I.opt('view', params.how), n }, 'run'),
          scanEvent({ col: null, items, per: U.clamp(900 / Math.max(1, df.length), 26, 80), keepKey: 'hud.hit', dropKey: 'hud.out' }),
          dropEvent(dropIds, 'drop.preview'),
          say('view.done', { r: out.length, c: out.columns.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('describe', 'observe', '📊', {
    params: () => [],
    code: () => 'df.describe()',
    run(df, params) {
      const nums = NUM(df);
      const trace = [say('describe.start', { k: nums.length }, 'run')];
      nums.forEach((k) => {
        const st = D.columnStats(df, k);
        trace.push(scanEvent({
          col: k, colName: name(df, k), track: 'read',
          items: df.rows.map((r) => ({ id: r._id, v: r[k], flag: 'pass' })),
          per: U.clamp(700 / Math.max(1, df.length), 12, 34),
        }));
        trace.push(say('describe.col', {
          col: name(df, k), mean: fmt(st.mean), std: fmt(st.std),
          min: fmt(st.min), max: fmt(st.max), miss: st.missing,
        }, 'agg', 620));
      });
      trace.push(say('describe.done', { k: nums.length }, 'done'));
      trace.push(settle('none'));
      return { df: df.clone(), code: 'df.describe()', trace };
    },
  });

  /* ============================ 整理 ============================ */
  defOp('select', 'shape', '🧭', {
    params: (df) => [P('select').cols('cols', df, null, KEYS(df).slice())],
    code: (params, df) => `df = df[[${(params.cols || []).map((k) => `'${codeCol(df, k)}'`).join(', ')}]]`,
    run(df, params) {
      const keep = (params.cols || []).filter((k) => df.has(k));
      const cols = keep.map((k) => df.column(k)).map((c) => Object.assign({}, c));
      const rows = df.rows.map((r) => {
        const o = { _id: r._id };
        keep.forEach((k) => { o[k] = r[k]; });
        return o;
      });
      const removed = KEYS(df).filter((k) => !keep.includes(k));
      return {
        df: new D.DataFrame(rows, cols, Object.assign({}, df.meta)),
        code: `df = df[[${keep.map((k) => `'${name(df, k)}'`).join(', ')}]]`,
        trace: [
          say('select.start', { k: keep.length }, 'run'),
          { t: 'removecol', cols: removed },
          say('select.done', { k: keep.length, d: removed.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('dropcol', 'shape', '🗑', {
    params: (df) => [P('dropcol').cols('cols', df, null, [preferIdCol(df)])],
    code: (params, df) => `df = df.drop(columns=[${(params.cols || []).map((k) => `'${codeCol(df, k)}'`).join(', ')}])`,
    run(df, params) {
      const drop = (params.cols || []).filter((k) => df.has(k));
      const cols = dupCols(df).filter((c) => !drop.includes(c.key));
      const rows = df.rows.map((r) => {
        const o = { _id: r._id };
        cols.forEach((c) => { o[c.key] = r[c.key]; });
        return o;
      });
      return {
        df: new D.DataFrame(rows, cols, Object.assign({}, df.meta)),
        code: `df = df.drop(columns=[${drop.map((k) => `'${name(df, k)}'`).join(', ')}])`,
        trace: [
          say('dropcol.start', { k: drop.length }, 'run'),
          { t: 'removecol', cols: drop },
          say('dropcol.done', { k: drop.length, r: cols.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('rename', 'shape', '✏️', {
    params: (df) => [P('rename').col('col', df, null, preferNumCol(df)), P('rename').newname('name', 'new_name')],
    code: (params, df) => `df = df.rename(columns={'${codeCol(df, params.col)}': '${resolveName(params.name).name}'})`,
    run(df, params) {
      const to = resolveName(params.name).name;
      const cols = dupCols(df).map((c) => (c.key === params.col ? Object.assign({}, c, { name: to }) : c));
      const out = new D.DataFrame(dupRows(df), cols, Object.assign({}, df.meta));
      return {
        df: out,
        code: `df = df.rename(columns={'${name(df, params.col)}': '${to}'})`,
        trace: [
          say('rename.start', { from: name(df, params.col), to }, 'trans'),
          { t: 'rename', from: { key: params.col, name: name(df, params.col) }, to: { key: params.col, name: to } },
          say('rename.done', { to }, 'done'),
          settle('flip'),
        ],
      };
    },
  });

  defOp('filter', 'shape', '🎯', {
    params: (df) => {
      const col = preferNumCol(df);
      const vals = df.typeOf(col) === 'number' ? df.values(col) : [];
      const defVal = vals.length ? String(Number(S.median(vals).toFixed(4))) : (df.uniqueValues(col)[0] || '');
      const p = P('filter');
      return [
        p.col('col', df, null, col),
        p.sel('op', ['>', '>=', '<', '<=', '==', '!=', 'contains', 'isna', 'notna'], '>=', 'filter'),
        p.text('value', defVal),
      ];
    },
    code: (params, df) => {
      const c = `'${codeCol(df, params.col)}'`;
      if (params.op === 'isna') return `df = df[df[${c}].isna()]`;
      if (params.op === 'notna') return `df = df[df[${c}].notna()]`;
      if (params.op === 'contains') return `df = df[df[${c}].astype(str).str.contains('${params.value}')]`;
      return `df = df[df[${c}] ${params.op} ${params.value}]`;
    },
    run(df, params) {
      const col = params.col;
      const isNum = df.typeOf(col) === 'number';
      const raw = String(params.value);
      const target = toNumber(raw);
      const items = [];
      const keepIds = [];
      df.rows.forEach((r) => {
        const v = r[col];
        let pass = false;
        if (params.op === 'isna') pass = isMissing(v);
        else if (params.op === 'notna') pass = !isMissing(v);
        else if (params.op === 'contains') pass = !isMissing(v) && String(v).includes(raw);
        else if (isNum && target !== null && !isMissing(v)) {
          const nv = Number(v);
          pass = params.op === '>' ? nv > target : params.op === '>=' ? nv >= target
            : params.op === '<' ? nv < target : params.op === '<=' ? nv <= target
              : params.op === '==' ? nv === target : nv !== target;
        } else {
          const sv = isMissing(v) ? '' : String(v);
          pass = params.op === '==' ? sv === raw : params.op === '!=' ? sv !== raw
            : params.op === '>' ? sv > raw : params.op === '>=' ? sv >= raw
              : params.op === '<' ? sv < raw : sv <= raw;
        }
        items.push({ id: r._id, v, flag: pass ? 'pass' : 'drop' });
        if (pass) keepIds.push(r._id);
      });
      const dropIds = items.filter((x) => x.flag !== 'pass').map((x) => x.id);
      const out = newDF(df, df.rows.filter((r) => keepIds.includes(r._id)));
      return {
        df: out,
        code: `df = df[df['${name(df, col)}'] ${params.op} ${raw}]`,
        trace: [
          say('filter.start', { col: name(df, col), op: params.op, v: raw }, 'run'),
          scanEvent({ col, colName: name(df, col), items, per: U.clamp(900 / Math.max(1, df.length), 22, 70) }),
          dropEvent(dropIds, 'drop.default'),
          say('filter.done', { k: keepIds.length, d: dropIds.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('sort', 'shape', '🔃', {
    params: (df) => [P('sort').col('col', df, null, preferNumCol(df)), P('sort').sel('asc', ['desc', 'asc'], 'desc', 'sort')],
    code: (params, df) => `df = df.sort_values('${codeCol(df, params.col)}', ascending=${params.asc === 'asc' ? 'True' : 'False'})`,
    run(df, params) {
      const col = params.col;
      const up = params.asc === 'asc';
      const isNum = df.typeOf(col) === 'number';
      const idx = df.rows.map((r, i) => i);
      idx.sort((a, b) => {
        const va = df.rows[a][col], vb = df.rows[b][col];
        if (isMissing(va) && isMissing(vb)) return 0;
        if (isMissing(va)) return 1;
        if (isMissing(vb)) return -1;
        if (isNum) return up ? Number(va) - Number(vb) : Number(vb) - Number(va);
        return up ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
      const rows = idx.map((i) => df.rows[i]);
      const out = newDF(df, rows.map((r) => Object.assign({}, r)));
      const vals = df.values(col);
      const items = df.rows.map((r) => ({ id: r._id, v: r[col], flag: 'pass' }));
      return {
        df: out,
        code: `df = df.sort_values('${name(df, col)}', ascending=${up ? 'True' : 'False'})`,
        trace: [
          say('sort.start', { col: name(df, col), asc: I.opt('sort', params.asc) }, 'run'),
          scanEvent({ col, colName: name(df, col), items, track: 'read', per: U.clamp(800 / Math.max(1, df.length), 18, 40) }),
          say('sort.flip', { n: df.length }, 'run', 520),
          { t: 'reorder', ids: rows.map((r) => r._id) },
          say('sort.done', { col: name(df, col), min: fmt(S.min(vals)), max: fmt(S.max(vals)) }, 'done'),
          settle('flip'),
        ],
      };
    },
  });

  defOp('sample', 'shape', '🎲', {
    params: (df) => {
      const p = P('sample');
      return [p.num('n', Math.max(2, Math.floor(df.length / 2)), 1, Math.max(1, df.length)), p.num('seed', 42, 0, 9999)];
    },
    code: (params) => `df = df.sample(n=${params.n}, random_state=${params.seed})`,
    run(df, params) {
      const n = U.clamp(Number(params.n) || 5, 1, df.length);
      const rnd = U.mulberry32(Number(params.seed) || 42);
      const pool = df.rows.map((r) => r._id);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const keepIds = new Set(pool.slice(0, n));
      const items = df.rows.map((r) => ({ id: r._id, v: null, flag: keepIds.has(r._id) ? 'pass' : 'drop' }));
      const dropIds = items.filter((x) => x.flag !== 'pass').map((x) => x.id);
      const out = newDF(df, df.rows.filter((r) => keepIds.has(r._id)).map((r) => Object.assign({}, r)));
      return {
        df: out,
        code: `df = df.sample(n=${n}, random_state=${params.seed})`,
        trace: [
          say('sample.start', { n, seed: params.seed }, 'run'),
          scanEvent({ col: null, items, per: U.clamp(900 / Math.max(1, df.length), 26, 80) }),
          dropEvent(dropIds, 'drop.preview'),
          say('sample.done', { k: out.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('astype', 'shape', '🔤', {
    params: (df) => [P('astype').col('col', df, null, preferNumCol(df)), P('astype').sel('to', ['number', 'text', 'date'], 'text', 'astype')],
    code: (params, df) => `df['${codeCol(df, params.col)}'] = df['${codeCol(df, params.col)}'].astype('${params.to === 'number' ? 'float' : params.to === 'date' ? 'datetime64' : 'str'}')`,
    run(df, params) {
      const col = params.col;
      const to = params.to;
      const cells = [];
      const rows = dupRows(df);
      rows.forEach((r) => {
        const v = r[col];
        let nv = v;
        if (isMissing(v)) nv = null;
        else if (to === 'number') nv = toNumber(v);
        else if (to === 'text') nv = String(v);
        else nv = String(v);
        r[col] = nv;
        cells.push({ id: r._id, col, v: nv });
      });
      const cols = dupCols(df).map((c) => (c.key === col ? Object.assign({}, c, { type: to === 'date' ? 'date' : to }) : c));
      const out = new D.DataFrame(rows, cols, Object.assign({}, df.meta));
      const items = df.rows.map((r) => ({ id: r._id, v: r[col], flag: 'pass' }));
      return {
        df: out,
        code: `df['${name(df, col)}'] = df['${name(df, col)}'].astype('${to === 'number' ? 'float' : 'str'}')`,
        trace: [
          say('astype.start', { col: name(df, col), to: I.opt('astype', to) }, 'trans'),
          scanEvent({ col, colName: name(df, col), items, track: 'read', per: U.clamp(700 / Math.max(1, df.length), 18, 40) }),
          fillEvent(cells, 120),
          say('astype.done', { col: name(df, col), to: I.opt('astype', to) }, 'done'),
          settle('none'),
        ],
      };
    },
  });

  defOp('melt', 'shape', '🔄', {
    params: (df) => {
      const texts = TXT(df);
      const idDef = texts.length ? [texts[0]] : [KEYS(df)[0]];
      return [P('melt').cols('idCols', df, null, idDef), P('melt').cols('valueCols', df, (k) => df.typeOf(k) === 'number', NUM(df).slice(0, 3))];
    },
    code: (params, df) => `df = df.melt(id_vars=[${(params.idCols || []).map((k) => `'${codeCol(df, k)}'`).join(', ')}], value_vars=[${(params.valueCols || []).map((k) => `'${codeCol(df, k)}'`).join(', ')}])`,
    run(df, params) {
      const ids = (params.idCols || []).filter((k) => df.has(k));
      const vals = (params.valueCols || []).filter((k) => df.has(k));
      const varKey = 'melt_var', valKey = 'melt_val';
      const cols = ids.map((k) => Object.assign({}, df.column(k)))
        .concat([
          { key: varKey, name: I.t('colname.var'), type: 'string' },
          { key: valKey, name: I.t('colname.val'), type: 'number' },
        ]);
      const rows = [];
      df.rows.forEach((r) => {
        vals.forEach((k) => {
          const o = { _id: D.nextId() };
          ids.forEach((ik) => { o[ik] = r[ik]; });
          o[varKey] = name(df, k);
          o[valKey] = r[k];
          rows.push(o);
        });
      });
      const out = new D.DataFrame(rows, cols, Object.assign({}, df.meta));
      return {
        df: out,
        code: `df = df.melt(id_vars=[${ids.map((k) => `'${name(df, k)}'`).join(', ')}], value_vars=[${vals.map((k) => `'${name(df, k)}'`).join(', ')}])`,
        trace: [
          say('melt.start', { k: vals.length }, 'trans'),
          wait(520),
          say('melt.done', { r: out.length, c: out.columns.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  /* ============================ 清洗 ============================ */
  defOp('dedupe', 'clean', '🧬', {
    params: (df) => {
      const cols = KEYS(df).filter((k) => !ID_LIKE.test(k));
      const p = P('dedupe');
      return [p.cols('cols', df, null, cols.length ? cols : KEYS(df)), p.sel('keep', ['first', 'last'], 'first', 'dedupe')];
    },
    code: (params, df) => `df = df.drop_duplicates(subset=[${(params.cols || []).map((k) => `'${codeCol(df, k)}'`).join(', ')}], keep='${params.keep}')`,
    run(df, params) {
      const cols = (params.cols || []).filter((k) => df.has(k));
      const seen = new Map();
      const items = [];
      const dropIds = [];
      df.rows.forEach((r) => {
        const fp = cols.map((k) => (isMissing(r[k]) ? '⌀' : String(r[k]))).join('|');
        if (!seen.has(fp)) { seen.set(fp, r._id); items.push({ id: r._id, v: null, flag: 'pass' }); }
        else {
          items.push({ id: r._id, v: null, flag: 'dup' });
          if (params.keep === 'last') dropIds.push(seen.get(fp));
          seen.set(fp, r._id);
          dropIds.push(r._id);
        }
      });
      const dropSet = new Set(dropIds);
      const out = newDF(df, df.rows.filter((r) => !dropSet.has(r._id)).map((r) => Object.assign({}, r)));
      return {
        df: out,
        code: `df = df.drop_duplicates(subset=[${cols.map((k) => `'${name(df, k)}'`).join(', ')}], keep='${params.keep}')`,
        trace: [
          say('dedupe.start', { k: cols.length }, 'run'),
          scanEvent({ col: null, items, per: U.clamp(900 / Math.max(1, df.length), 26, 80) }),
          say('dedupe.found', { d: dropSet.size, keep: I.opt('dedupe', params.keep) }, 'core'),
          dropEvent(Array.from(dropSet), 'drop.dup'),
          say('dedupe.done', { d: dropSet.size, r: out.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('missing', 'clean', '🩹', {
    params: (df) => {
      const miss = KEYS(df).filter((k) => df.missingCount(k) > 0);
      const p = P('missing');
      return [
        p.sel('strategy', ['fillna', 'dropna'], 'fillna', 'missing'),
        p.cols('cols', df, null, miss.length ? miss : KEYS(df)),
        p.sel('how', ['mean', 'median', 'zero', 'mode', 'ffill', 'bfill', 'interp'], 'mean', 'missing'),
        p.text('value', '0'),
      ];
    },
    code: (params, df) => {
      const cs = (params.cols || []).map((k) => `'${codeCol(df, k)}'`).join(', ');
      if (params.strategy === 'dropna') return `df = df.dropna(subset=[${cs}])`;
      if (params.how === 'ffill') return `df[[${cs}]] = df[[${cs}]].ffill()`;
      if (params.how === 'bfill') return `df[[${cs}]] = df[[${cs}]].bfill()`;
      if (params.how === 'interp') return `df[[${cs}]] = df[[${cs}]].interpolate()`;
      if (params.how === 'zero') return `df[[${cs}]] = df[[${cs}]].fillna(0)`;
      if (params.how === 'mode') return `df[[${cs}]] = df[[${cs}]].fillna(df[[${cs}]].mode().iloc[0])`;
      return `df[[${cs}]] = df[[${cs}]].fillna(df[[${cs}]].${params.how}())`;
    },
    run(df, params) {
      const cols = (params.cols || []).filter((k) => df.has(k));
      const strategy = params.strategy;
      const how = params.how;
      // 1) 扫描缺失
      const missCells = [];
      cols.forEach((k) => df.rows.forEach((r) => { if (isMissing(r[k])) missCells.push({ id: r._id, col: k }); }));
      const trace = [say('missing.start', { cols: cols.map((k) => name(df, k)).join('、') }, 'run')];
      trace.push({
        t: 'scan', mode: 'cells', hud: true, cellItems: missCells,
        per: U.clamp(1200 / Math.max(1, missCells.length), 60, 220),
      });
      trace.push(say('missing.found', { n: missCells.length, strategy: I.opt('missing', strategy) }, 'core', 700));

      if (strategy === 'dropna') {
        const dropIds = Array.from(new Set(missCells.map((c) => c.id)));
        const dropSet = new Set(dropIds);
        const out = newDF(df, df.rows.filter((r) => !dropSet.has(r._id)).map((r) => Object.assign({}, r)));
        trace.push(dropEvent(dropIds, 'drop.missing'));
        trace.push(say('missing.done', { m: out.totalMissing() }, 'done'));
        trace.push(settle('render'));
        return { df: out, code: `df = df.dropna(subset=[${cols.map((k) => `'${name(df, k)}'`).join(', ')}])`, trace };
      }

      // 2) 填充
      const rows = dupRows(df);
      const cells = [];
      const statText = [];
      cols.forEach((k) => {
        const vals = df.values(k);
        let fillV = null;
        if (how === 'mean') fillV = vals.length ? S.mean(vals) : 0;
        else if (how === 'median') fillV = vals.length ? S.median(vals) : 0;
        else if (how === 'zero') fillV = toNumber(params.value);
        else if (how === 'mode') {
          const vc = df.valueCounts(k);
          fillV = vc.length ? toNumber(vc[0][0]) : 0;
          if (fillV === null) fillV = vc.length ? vc[0][0] : '';
        }
        if (how === 'ffill' || how === 'bfill' || how === 'interp') {
          const order = how === 'bfill' ? rows.map((r, i) => i).reverse() : rows.map((r, i) => i);
          let last = null;
          if (how === 'interp') {
            const nums = rows.map((r) => (isMissing(r[k]) ? null : Number(r[k])));
            let prev = null, prevIdx = -1;
            nums.forEach((v, i) => {
              if (v === null) return;
              if (prev !== null && prevIdx >= 0 && i - prevIdx > 1) {
                for (let j = prevIdx + 1; j < i; j++) {
                  nums[j] = prev + (v - prev) * ((j - prevIdx) / (i - prevIdx));
                }
              }
              prev = v; prevIdx = i;
            });
            rows.forEach((r, i) => {
              if (isMissing(r[k])) { r[k] = nums[i] === undefined ? null : nums[i]; cells.push({ id: r._id, col: k, v: r[k] }); }
            });
          } else {
            order.forEach((i) => {
              const r = rows[i];
              if (!isMissing(r[k])) last = r[k];
              else if (last !== null) { r[k] = last; cells.push({ id: r._id, col: k, v: last }); }
            });
          }
        } else {
          rows.forEach((r) => {
            if (isMissing(r[k])) { r[k] = fillV; cells.push({ id: r._id, col: k, v: fillV }); }
          });
        }
        if (how !== 'ffill' && how !== 'bfill' && how !== 'interp') {
          statText.push(`${name(df, k)} = ${fmt(fillV)}`);
        }
      });
      const out = new D.DataFrame(rows, dupCols(df), Object.assign({}, df.meta));
      if (statText.length) {
        trace.push(say('missing.fill', { howname: I.opt('missing', how), v: statText.join('，') }, 'trans', 700));
      }
      trace.push(fillEvent(cells, 170));
      trace.push(say('missing.done', { m: out.totalMissing() }, 'done'));
      trace.push(settle('none'));
      return {
        df: out,
        code: `df[[${cols.map((k) => `'${name(df, k)}'`).join(', ')}]] = df[[${cols.map((k) => `'${name(df, k)}'`).join(', ')}]].fillna(...)`,
        trace,
      };
    },
  });

  defOp('outlier', 'clean', '⚖️', {
    params: (df) => {
      const p = P('outlier');
      return [
        p.sel('mode', ['extreme', 'iqr', 'clip'], 'extreme', 'outlier'),
        p.col('col', df, (k) => df.typeOf(k) === 'number', preferNumCol(df)),
        p.num('n', 1, 1, 10),
      ];
    },
    code: (params, df) => {
      const c = `'${codeCol(df, params.col)}'`;
      if (params.mode === 'extreme') return `df = df.drop(df[${c}].nlargest(${params.n}).index.union(df[${c}].nsmallest(${params.n}).index))`;
      if (params.mode === 'iqr') {
        return `q1, q3 = df[${c}].quantile(.25), df[${c}].quantile(.75)\n` +
          `df = df[(df[${c}] >= q1-1.5*(q3-q1)) & (df[${c}] <= q3+1.5*(q3-q1))]`;
      }
      return `lo, hi = df[${c}].quantile(.05), df[${c}].quantile(.95)\ndf[${c}] = df[${c}].clip(lo, hi)`;
    },
    run(df, params) {
      const col = params.col;
      const mode = params.mode;
      const vals = df.values(col);
      const items = df.rows.map((r) => ({ id: r._id, v: isMissing(r[col]) ? null : Number(r[col]), flag: 'pass' }));

      /* --- 去最大最小 --- */
      if (mode === 'extreme') {
        const n = U.clamp(Number(params.n) || 1, 1, Math.floor(df.length / 2));
        const sorted = df.rows.filter((r) => !isMissing(r[col])).slice()
          .sort((a, b) => Number(a[col]) - Number(b[col]));
        const dropIds = sorted.slice(0, n).concat(sorted.slice(-n)).map((r) => r._id);
        const dropSet = new Set(dropIds);
        const out = newDF(df, df.rows.filter((r) => !dropSet.has(r._id)).map((r) => Object.assign({}, r)));
        const rest = out.values(col);
        return {
          df: out,
          code: `df = df.drop(df['${name(df, col)}'].nlargest(${n}).index.union(df['${name(df, col)}'].nsmallest(${n}).index))`,
          trace: [
            say('outlier.start', { col: name(df, col) }, 'core'),
            { t: 'hud', show: true },
            scanEvent({ col, colName: name(df, col), items, track: 'minmax', per: U.clamp(1100 / Math.max(1, df.length), 26, 110) }),
            say('outlier.found', { min: fmt(S.min(vals)), max: fmt(S.max(vals)) }, 'core', 760),
            { t: 'mark', col, rows: dropIds.map((id) => ({ id, kind: 'row-drop' })) },
            say('outlier.mark', { n: dropSet.size }, 'core', 620),
            dropEvent(dropIds, 'drop.extreme'),
            { t: 'hud', show: false },
            say('outlier.done', { n: dropSet.size, r: out.length, lo: fmt(S.min(rest)), hi: fmt(S.max(rest)) }, 'done'),
            settle('render'),
          ],
        };
      }

      /* --- IQR --- */
      const q1 = S.quantile(vals, 0.25), q3 = S.quantile(vals, 0.75);
      const iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
      const flagItems = df.rows.map((r) => {
        const v = isMissing(r[col]) ? null : Number(r[col]);
        const out2 = v !== null && (v < lo || v > hi);
        return { id: r._id, v, flag: out2 ? 'outlier' : 'pass' };
      });
      if (mode === 'iqr') {
        const dropIds = flagItems.filter((x) => x.flag === 'outlier').map((x) => x.id);
        const dropSet = new Set(dropIds);
        const out = newDF(df, df.rows.filter((r) => !dropSet.has(r._id)).map((r) => Object.assign({}, r)));
        const rest = out.values(col);
        return {
          df: out,
          code: `q1, q3 = df['${name(df, col)}'].quantile(.25), df['${name(df, col)}'].quantile(.75)\n` +
            `df = df[(df['${name(df, col)}'] >= q1-1.5*(q3-q1)) & (df['${name(df, col)}'] <= q3+1.5*(q3-q1))]`,
          trace: [
            say('outlier.start', { col: name(df, col) }, 'core'),
            { t: 'hud', show: true },
            scanEvent({ col, colName: name(df, col), items, track: 'minmax', per: U.clamp(900 / Math.max(1, df.length), 22, 90) }),
            say('outlier.iqr', { q1: fmt(q1), q3: fmt(q3), iqr: fmt(iqr), lo: fmt(lo), hi: fmt(hi) }, 'core', 900),
            scanEvent({ col, colName: name(df, col), items: flagItems, per: U.clamp(900 / Math.max(1, df.length), 22, 80), keepKey: 'hud.hit', dropKey: 'hud.out' }),
            dropEvent(dropIds, 'drop.extreme'),
            { t: 'hud', show: false },
            say('outlier.done', { n: dropSet.size, r: out.length, lo: fmt(S.min(rest)), hi: fmt(S.max(rest)) }, 'done'),
            settle('render'),
          ],
        };
      }

      /* --- clip --- */
      const rows = dupRows(df);
      const cells = [];
      const clo = S.quantile(vals, 0.05), chi = S.quantile(vals, 0.95);
      rows.forEach((r) => {
        const v = isMissing(r[col]) ? null : Number(r[col]);
        if (v === null) return;
        if (v < clo || v > chi) {
          const nv = v < clo ? clo : chi;
          r[col] = nv;
          cells.push({ id: r._id, col, v: nv });
        }
      });
      const out = new D.DataFrame(rows, dupCols(df), Object.assign({}, df.meta));
      return {
        df: out,
        code: `df['${name(df, col)}'] = df['${name(df, col)}'].clip(${fmt(clo)}, ${fmt(chi)})`,
        trace: [
          say('outlier.start', { col: name(df, col) }, 'core'),
          { t: 'hud', show: true },
          scanEvent({ col, colName: name(df, col), items, track: 'minmax', per: U.clamp(900 / Math.max(1, df.length), 22, 90) }),
          say('outlier.clip', { lo: fmt(clo), hi: fmt(chi) }, 'core', 820),
          scanEvent({ col, colName: name(df, col), items: flagItems, per: U.clamp(900 / Math.max(1, df.length), 22, 80) }),
          { t: 'hud', show: false },
          fillEvent(cells, 170),
          say('outlier.done', { n: cells.length, r: out.length, lo: fmt(S.min(out.values(col))), hi: fmt(S.max(out.values(col))) }, 'done'),
          settle('none'),
        ],
      };
    },
  });

  defOp('replace', 'clean', '🔁', {
    params: (df) => {
      const col = preferCatCol(df);
      const v0 = df.uniqueValues(col)[0] || '';
      const p = P('replace');
      return [p.col('col', df, null, col), p.text('from', v0), p.text('to', v0 + '_x')];
    },
    code: (params, df) => `df['${codeCol(df, params.col)}'] = df['${codeCol(df, params.col)}'].replace('${params.from}', '${params.to}')`,
    run(df, params) {
      const col = params.col;
      const items = [];
      const cells = [];
      const rows = dupRows(df);
      rows.forEach((r) => {
        const v = r[col];
        const hit = !isMissing(v) && String(v) === String(params.from);
        items.push({ id: r._id, v, flag: hit ? 'pass' : 'drop' });
        if (hit) { r[col] = params.to; cells.push({ id: r._id, col, v: params.to }); }
      });
      const out = new D.DataFrame(rows, dupCols(df), Object.assign({}, df.meta));
      return {
        df: out,
        code: `df['${name(df, col)}'] = df['${name(df, col)}'].replace('${params.from}', '${params.to}')`,
        trace: [
          say('replace.start', { col: name(df, col), from: params.from, to: params.to }, 'trans'),
          scanEvent({ col, colName: name(df, col), items, per: U.clamp(900 / Math.max(1, df.length), 22, 70) }),
          fillEvent(cells, 150),
          say('replace.done', { n: cells.length }, 'done'),
          settle('none'),
        ],
      };
    },
  });

  defOp('cleanconst', 'clean', '🧹', {
    params: () => [P('cleanconst').sel('what', ['constant', 'empty'], 'constant', 'cleanconst')],
    code: () => '# 删除常数列 / 空列\ncols = [c for c in df.columns if df[c].nunique(dropna=False) <= 1]\ndf = df.drop(columns=cols)',
    run(df, params) {
      const what = params.what;
      const cols = KEYS(df).filter((k) => {
        if (what === 'empty') return df.rows.every((r) => isMissing(r[k]));
        return df.uniqueValues(k).length <= 1;
      });
      const keepCols = dupCols(df).filter((c) => !cols.includes(c.key));
      const rows = df.rows.map((r) => {
        const o = { _id: r._id };
        keepCols.forEach((c) => { o[c.key] = r[c.key]; });
        return o;
      });
      const out = new D.DataFrame(rows, keepCols.length ? keepCols : dupCols(df), Object.assign({}, df.meta));
      return {
        df: out,
        code: 'cols = [c for c in df.columns if df[c].nunique(dropna=False) <= 1]\ndf = df.drop(columns=cols)',
        trace: [
          say('cleanconst.start', { what: I.opt('cleanconst', what) }, 'run'),
          { t: 'removecol', cols },
          say('cleanconst.done', { k: cols.length, r: out.columns.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  /* ============================ 变换 ============================ */
  defOp('assign', 'transform', '➕', {
    params: (df) => {
      const nums = NUM(df).filter((k) => !ID_LIKE.test(k));
      const p = P('assign');
      return [
        p.newname('name', '@total'),
        p.sel('mode', ['sum', 'mean', 'max', 'min', 'count', 'multi'], 'sum', 'assign'),
        p.cols('cols', df, (k) => df.typeOf(k) === 'number', (nums.length ? nums : NUM(df)).slice(0, 3)),
        p.col('a', df, (k) => df.typeOf(k) === 'number', (nums.length ? nums : NUM(df))[0]),
        p.sel('op', ['+', '-', '*', '/'], '+', 'assign'),
        p.col('b', df, (k) => df.typeOf(k) === 'number', (nums.length ? nums : NUM(df))[1] || (nums.length ? nums : NUM(df))[0]),
      ];
    },
    code: (params, df) => {
      const nm = resolveName(params.name).name;
      if (params.mode === 'multi') {
        return `df['${nm}'] = df['${codeCol(df, params.a)}'] ${params.op} df['${codeCol(df, params.b)}']`;
      }
      if (params.mode === 'count') return `df['${nm}'] = df[[${(params.cols || []).map((k) => `'${codeCol(df, k)}'`).join(', ')}]].count(axis=1)`;
      return `df['${nm}'] = df[[${(params.cols || []).map((k) => `'${codeCol(df, k)}'`).join(', ')}]].${params.mode}(axis=1)`;
    },
    run(df, params) {
      const nm = resolveName(params.name);
      const cols = (params.cols || []).filter((k) => df.has(k));
      const mode = params.mode;
      let formula;
      if (mode === 'multi') {
        formula = `${name(df, params.a)} ${params.op} ${name(df, params.b)}`;
      } else if (mode === 'count') {
        formula = `count(${cols.map((k) => name(df, k)).join(', ')})`;
      } else {
        formula = `${I.opt('assign', mode)}(${cols.map((k) => name(df, k)).join(' + ')})`;
      }
      const codeStr = mode === 'multi'
        ? `df['${nm.name}'] = df['${name(df, params.a)}'] ${params.op} df['${name(df, params.b)}']`
        : `df['${nm.name}'] = df[[${cols.map((k) => `'${name(df, k)}'`).join(', ')}]].${mode}(axis=1)`;

      return derive(df, {
        col: nm,
        code: codeStr,
        formula,
        startKey: 'assign.start', doneKey: 'assign.done',
        startArgs: { name: nm.name, formula },
        doneArgs: { name: nm.name, r: df.length },
        compute(r) {
          if (mode === 'multi') {
            const a = toNumber(r[params.a]), b = toNumber(r[params.b]);
            if (a === null || b === null) return null;
            return params.op === '+' ? a + b : params.op === '-' ? a - b : params.op === '*' ? a * b : (b === 0 ? null : a / b);
          }
          if (mode === 'count') return cols.reduce((s, k) => s + (isMissing(r[k]) ? 0 : 1), 0);
          const vs = cols.map((k) => toNumber(r[k])).filter((v) => v !== null);
          if (!vs.length) return null;
          if (mode === 'sum') return S.sum(vs);
          if (mode === 'mean') return S.mean(vs);
          if (mode === 'max') return S.max(vs);
          return S.min(vs);
        },
      });
    },
  });

  defOp('normalize', 'transform', '📐', {
    params: (df) => [P('normalize').col('col', df, (k) => df.typeOf(k) === 'number', preferNumCol(df)), P('normalize').sel('how', ['minmax', 'zscore'], 'minmax', 'normalize')],
    code: (params, df) => (params.how === 'minmax'
      ? `df['${codeCol(df, params.col)}_norm'] = (df['${codeCol(df, params.col)}'] - df['${codeCol(df, params.col)}'].min()) / (df['${codeCol(df, params.col)}'].max() - df['${codeCol(df, params.col)}'].min())`
      : `df['${codeCol(df, params.col)}_z'] = (df['${codeCol(df, params.col)}'] - df['${codeCol(df, params.col)}'].mean()) / df['${codeCol(df, params.col)}'].std()`),
    run(df, params) {
      const col = params.col;
      const how = params.how;
      const vals = df.values(col);
      const outCol = tmplCol(how === 'minmax' ? 'colname.norm' : 'colname.z', { key: col + (how === 'minmax' ? '_norm' : '_z'), col: name(df, col) });
      const items = df.rows.map((r) => ({ id: r._id, v: isMissing(r[col]) ? null : Number(r[col]), flag: 'pass' }));
      const mu = S.mean(vals), sd = S.std(vals), mn = S.min(vals), mx = S.max(vals);
      const formula = how === 'minmax'
        ? `(x - ${fmt(mn)}) / (${fmt(mx)} - ${fmt(mn)})`
        : `(x - ${fmt(mu)}) / ${fmt(sd)}`;
      const d = derive(df, {
        col: outCol,
        code: how === 'minmax'
          ? `df['${name(df, col)}_norm'] = (df['${name(df, col)}'] - df['${name(df, col)}'].min()) / (df['${name(df, col)}'].max() - df['${name(df, col)}'].min())`
          : `df['${name(df, col)}_z'] = (df['${name(df, col)}'] - df['${name(df, col)}'].mean()) / df['${name(df, col)}'].std()`,
        formula,
        startKey: 'normalize.start', doneKey: 'normalize.done',
        startArgs: { col: name(df, col), minmax: how === 'minmax' ? 'min / max' : 'mean / std', statname: how === 'minmax' ? 'min / max' : 'mean / std', v: `${fmt(mn)} / ${fmt(mx)}` },
        doneArgs: { name: outCol.name, lo: '0', hi: '1' },
        compute(r) {
          const v = toNumber(r[col]);
          if (v === null) return null;
          return how === 'minmax' ? (mx === mn ? 0 : (v - mn) / (mx - mn)) : (sd ? (v - mu) / sd : 0);
        },
      });
      // 插一段“先扫极值/均值”的剧本
      d.trace = [
        say('normalize.start', { col: name(df, col), minmax: how === 'minmax' ? 'min / max' : 'mean / std' }, 'core'),
        { t: 'hud', show: true },
        scanEvent({ col, colName: name(df, col), items, track: 'minmax', per: U.clamp(1000 / Math.max(1, df.length), 22, 90) }),
        { t: 'hud', show: false },
        say('normalize.stat', {
          statname: how === 'minmax' ? 'min / max' : `${I.t('c.avg')} / ${I.t('c.std')}`,
          v: how === 'minmax' ? `${fmt(mn)} / ${fmt(mx)}` : `${fmt(mu)} / ${fmt(sd)}`,
        }, 'core', 720),
      ].concat(d.trace.slice(1));
      return d;
    },
  });

  const TRANSFORMS = {
    log: (v) => (v > 0 ? Math.log(v) : null),
    sqrt: (v) => (v >= 0 ? Math.sqrt(v) : null),
    abs: (v) => Math.abs(v),
    round: (v) => Math.round(v),
    square: (v) => v * v,
  };
  defOp('transform', 'transform', '🧮', {
    params: (df) => [P('transform').col('col', df, (k) => df.typeOf(k) === 'number', preferNumCol(df)), P('transform').sel('how', ['log', 'sqrt', 'abs', 'round', 'square'], 'log', 'transform')],
    code: (params, df) => `df['${codeCol(df, params.col)}_${params.how}'] = np.${params.how === 'square' ? 'square' : params.how}(df['${codeCol(df, params.col)}'])`,
    run(df, params) {
      const col = params.col, how = params.how;
      const tpl = { log: 'colname.log', sqrt: 'colname.sqrt', abs: 'colname.abs', round: 'colname.round', square: 'colname.sq' }[how];
      const outCol = tmplCol(tpl, { key: col + '_' + how, col: name(df, col) });
      const formula = how === 'log' ? `log(x)` : how === 'sqrt' ? `√x` : how === 'abs' ? `|x|` : how === 'round' ? `round(x)` : `x²`;
      return derive(df, {
        col: outCol,
        code: `df['${name(df, col)}_${how}'] = np.${how === 'square' ? 'square' : how}(df['${name(df, col)}'])`,
        formula,
        startKey: 'transform.start', doneKey: 'transform.done',
        startArgs: { col: name(df, col), how: I.opt('transform', how), formula },
        doneArgs: { name: outCol.name },
        compute(r) {
          const v = toNumber(r[col]);
          if (v === null) return null;
          const fn = TRANSFORMS[how] || TRANSFORMS.log;
          const nv = fn(v);
          return nv === null ? null : Number(nv.toFixed(4));
        },
      });
    },
  });

  defOp('strcase', 'transform', '🔡', {
    params: (df) => {
      const texts = TXT(df);
      const p = P('strcase');
      return [p.col('col', df, (k) => df.typeOf(k) !== 'number', texts[0] || KEYS(df)[0]), p.sel('how', ['upper', 'lower', 'trim', 'digits', 'len'], 'upper', 'strcase')];
    },
    code: (params, df) => {
      const c = codeCol(df, params.col);
      return params.how === 'len'
        ? `df['${c}_len'] = df['${c}'].astype(str).str.len()`
        : params.how === 'digits'
          ? `df['${c}_digits'] = df['${c}'].astype(str).str.extract(r'(\\d+)')`
          : `df['${c}_x'] = df['${c}'].astype(str).str.${params.how === 'trim' ? 'strip' : params.how}()`;
    },
    run(df, params) {
      const col = params.col, how = params.how;
      const key = col + '_' + (how === 'len' ? 'len' : how === 'digits' ? 'digits' : 'x');
      const outCol = tmplCol(how === 'len' ? 'colname.len' : how === 'digits' ? 'colname.digit' : 'colname.val', { key, col: name(df, col) });
      return derive(df, {
        col: outCol, type: how === 'digits' ? 'number' : (how === 'len' ? 'number' : 'string'),
        code: `df['${name(df, col)}'] = df['${name(df, col)}'].astype(str).str.${how === 'trim' ? 'strip' : how}()`,
        formula: `str.${how}()`,
        startKey: 'strcase.start', doneKey: 'strcase.done',
        startArgs: { col: name(df, col), how: I.opt('strcase', how) },
        doneArgs: { name: outCol.name },
        compute(r) {
          const v = r[col];
          if (isMissing(v)) return null;
          const s = String(v);
          if (how === 'upper') return s.toUpperCase();
          if (how === 'lower') return s.toLowerCase();
          if (how === 'trim') return s.trim();
          if (how === 'len') return s.length;
          const m = s.match(/\d+(\.\d+)?/);
          return m ? Number(m[0]) : null;
        },
      });
    },
  });

  defOp('datepart', 'transform', '📅', {
    params: (df) => {
      const dates = KEYS(df).filter((k) => df.typeOf(k) === 'date' || /^\d{4}-\d{1,2}-\d{1,2}/.test(String(df.rows[0] ? df.rows[0][k] : '')));
      const p = P('datepart');
      return [p.col('col', df, null, dates[0] || KEYS(df)[0]), p.sel('how', ['year', 'month', 'day', 'weekday', 'quarter'], 'month', 'datepart')];
    },
    code: (params, df) => `df['${codeCol(df, params.col)}_${params.how}'] = pd.to_datetime(df['${codeCol(df, params.col)}']).dt.${params.how}`,
    run(df, params) {
      const col = params.col, how = params.how;
      const key = col + '_' + how;
      const outCol = tmplCol('colname.val', { key, col: name(df, col) + '_' + how });
      return derive(df, {
        col: outCol, type: 'number',
        code: `df['${name(df, col)}_${how}'] = pd.to_datetime(df['${name(df, col)}']).dt.${how}`,
        formula: `dt.${how}`,
        startKey: 'datepart.start', doneKey: 'datepart.done',
        startArgs: { col: name(df, col), how: I.opt('datepart', how) },
        doneArgs: { name: outCol.name },
        compute(r) {
          const v = r[col];
          if (isMissing(v)) return null;
          const d = new Date(String(v));
          if (isNaN(d.getTime())) return null;
          if (how === 'year') return d.getFullYear();
          if (how === 'month') return d.getMonth() + 1;
          if (how === 'day') return d.getDate();
          if (how === 'weekday') return d.getDay();
          return Math.floor(d.getMonth() / 3) + 1;
        },
      });
    },
  });

  defOp('rank', 'transform', '🏅', {
    params: (df) => [P('rank').col('col', df, null, preferNumCol(df)), P('rank').sel('asc', ['desc', 'asc'], 'desc', 'rank')],
    code: (params, df) => `df['rank'] = df['${codeCol(df, params.col)}'].rank(ascending=${params.asc === 'asc' ? 'True' : 'False'}, method='min').astype(int)`,
    run(df, params) {
      const col = params.col;
      const up = params.asc === 'asc';
      const isNum = df.typeOf(col) === 'number';
      const order = df.rows.map((r, i) => i).sort((a, b) => {
        const va = df.rows[a][col], vb = df.rows[b][col];
        if (isMissing(va) && isMissing(vb)) return 0;
        if (isMissing(va)) return 1;
        if (isMissing(vb)) return -1;
        return isNum
          ? (up ? Number(va) - Number(vb) : Number(vb) - Number(va))
          : (up ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va)));
      });
      const rankCol = tmplCol('colname.rank', { key: 'rank' });
      const rows = dupRows(df);
      const cells = [];
      order.forEach((idx, i) => {
        rows[idx][rankCol.key] = i + 1;
        cells.push({ id: rows[idx]._id, v: i + 1 });
      });
      const columns = dupCols(df).concat([{ key: rankCol.key, name: rankCol.name, type: 'number' }]);
      const out = new D.DataFrame(rows, columns, Object.assign({}, df.meta));
      const topRow = df.rows[order[0]];
      const items = df.rows.map((r) => ({ id: r._id, v: r[col], flag: 'pass' }));
      return {
        df: out,
        code: `df['rank'] = df['${name(df, col)}'].rank(ascending=${up ? 'True' : 'False'}, method='min').astype(int)`,
        trace: [
          say('rank.start', { col: name(df, col) }, 'run'),
          scanEvent({ col, colName: name(df, col), items, track: 'read', per: U.clamp(800 / Math.max(1, df.length), 18, 40) }),
          say('rank.sort', { col: name(df, col), asc: I.opt('rank', params.asc), n: df.length }, 'run', 540),
          { t: 'reorder', ids: order.map((i) => df.rows[i]._id) },
          say('rank.assign', { n: df.length }, 'trans', 480),
          addColEvent({ key: rankCol.key, name: rankCol.name, type: 'number' }, cells, `rank(${name(df, col)})`, 45),
          say('rank.done', { top: isMissing(topRow ? topRow[col] : null) ? '' : fmt(topRow[col]) }, 'done'),
          settle('flip'),
        ],
      };
    },
  });

  defOp('window', 'transform', '📈', {
    params: (df) => {
      const p = P('window');
      return [
        p.col('col', df, (k) => df.typeOf(k) === 'number', preferNumCol(df)),
        p.sel('how', ['cumsum', 'diff', 'pct', 'roll'], 'cumsum', 'window'),
        p.num('n', 3, 2, 20),
      ];
    },
    code: (params, df) => {
      const c = `'${codeCol(df, params.col)}'`;
      if (params.how === 'cumsum') return `df['${c}_cum'] = df[${c}].cumsum()`;
      if (params.how === 'diff') return `df['${c}_diff'] = df[${c}].diff()`;
      if (params.how === 'pct') return `df['${c}_pct'] = df[${c}].pct_change()`;
      return `df['${c}_ma${params.n}'] = df[${c}].rolling(${params.n}).mean()`;
    },
    run(df, params) {
      const col = params.col, how = params.how;
      const w = U.clamp(Number(params.n) || 3, 2, 20);
      const tpl = { cumsum: 'colname.cum', diff: 'colname.diff', pct: 'colname.pct', roll: 'colname.roll' }[how];
      const outCol = tmplCol(tpl, { key: col + '_' + (how === 'roll' ? 'ma' + w : how), col: name(df, col), n: w });
      const formula = how === 'cumsum' ? 'cumsum(x)' : how === 'diff' ? 'x - x.shift(1)' : how === 'pct' ? '(x - x.shift(1)) / x.shift(1)' : `rolling(${w}).mean()`;
      const prev = [];
      return derive(df, {
        col: outCol,
        code: how === 'cumsum' ? `df['${name(df, col)}_cum'] = df['${name(df, col)}'].cumsum()`
          : how === 'diff' ? `df['${name(df, col)}_diff'] = df['${name(df, col)}'].diff()`
            : how === 'pct' ? `df['${name(df, col)}_pct'] = df['${name(df, col)}'].pct_change()`
              : `df['${name(df, col)}_ma${w}'] = df['${name(df, col)}'].rolling(${w}).mean()`,
        formula,
        startKey: 'window.start', doneKey: 'window.done',
        startArgs: { col: name(df, col), how: I.opt('window', how), formula },
        doneArgs: { name: outCol.name },
        compute(r, i) {
          const v = toNumber(r[col]);
          if (v === null) return null;
          if (how === 'cumsum') {
            const p = i > 0 ? toNumber(df.rows[i - 1][col]) : null;
            prev[i] = (prev[i - 1] || 0) + v;
            return Number(prev[i].toFixed(4));
          }
          if (i === 0) return null;
          const pv = toNumber(df.rows[i - 1][col]);
          if (pv === null) return null;
          if (how === 'diff') return Number((v - pv).toFixed(4));
          if (how === 'pct') return pv === 0 ? null : Number(((v - pv) / pv * 100).toFixed(2));
          if (i < w - 1) return null;
          let s = 0, c2 = 0;
          for (let j = i - w + 1; j <= i; j++) { const x = toNumber(df.rows[j][col]); if (x !== null) { s += x; c2++; } }
          return c2 ? Number((s / c2).toFixed(4)) : null;
        },
      });
    },
  });

  /* ============================ 分析 ============================ */
  defOp('groupby', 'analyze', '🗂️', {
    params: (df) => {
      const p = P('groupby');
      return [
        p.col('by', df, (k) => df.typeOf(k) !== 'number', preferCatCol(df)),
        p.col('col', df, (k) => df.typeOf(k) === 'number', preferNumCol(df)),
        p.sel('how', ['mean', 'sum', 'count', 'max', 'min', 'median'], 'mean', 'groupby'),
      ];
    },
    code: (params, df) => `df = df.groupby('${codeCol(df, params.by)}')['${codeCol(df, params.col)}'].${params.how}().reset_index()`,
    run(df, params) {
      const by = params.by, col = params.col, how = params.how;
      const map = new Map();
      df.rows.forEach((r) => {
        const k = isMissing(r[by]) ? '(缺失)' : String(r[by]);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
      });
      const groups = [];
      let gi = 0;
      map.forEach((rows2, key) => {
        const vals = rows2.map((r) => toNumber(r[col])).filter((v) => v !== null);
        let v = null;
        if (how === 'count') v = rows2.length;
        else if (!vals.length) v = null;
        else if (how === 'mean') v = S.mean(vals);
        else if (how === 'sum') v = S.sum(vals);
        else if (how === 'max') v = S.max(vals);
        else if (how === 'min') v = S.min(vals);
        else v = S.median(vals);
        groups.push({ key, gi: gi++, ids: rows2.map((r) => r._id), n: rows2.length, value: v === null ? 0 : Number(v.toFixed(4)) });
      });
      const aggKey = col + '_' + how;
      const aggName = I.t('colname.' + (how === 'mean' ? 'avg2' : how === 'count' ? 'count' : how), { col: name(df, col) });
      const cntKey = 'group_count';
      const columns = [Object.assign({}, df.column(by)), { key: aggKey, name: aggName, type: 'number' }, { key: cntKey, name: I.t('ui.rows'), type: 'number' }];
      const rows = groups.map((g) => {
        const o = { _id: g.ids[0] };
        o[by] = g.key === '(缺失)' ? null : g.key;
        o[aggKey] = g.value;
        o[cntKey] = g.n;
        return o;
      });
      const out = new D.DataFrame(rows, columns, Object.assign({}, df.meta));
      const orderIds = [];
      groups.forEach((g) => g.ids.forEach((id) => orderIds.push(id)));
      return {
        df: out,
        code: `df = df.groupby('${name(df, by)}')['${name(df, col)}'].${how}().reset_index()`,
        trace: [
          say('groupby.start', { by: name(df, by), k: groups.length }, 'run'),
          { t: 'group', col: by, groups },
          say('groupby.group', { k: groups.length }, 'run', 520),
          { t: 'reorder', ids: orderIds },
          { t: 'agg', how, col: by, groups },
          say('groupby.done', { k: groups.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('pivot', 'analyze', '🧱', {
    params: (df) => {
      const texts = TXT(df);
      const p = P('pivot');
      return [
        p.col('index', df, (k) => df.typeOf(k) !== 'number', texts[0] || KEYS(df)[0]),
        p.col('columns', df, (k) => df.typeOf(k) !== 'number', texts[1] || texts[0] || KEYS(df)[0]),
        p.col('col', df, (k) => df.typeOf(k) === 'number', preferNumCol(df)),
        p.sel('how', ['mean', 'sum', 'count', 'max', 'min'], 'sum', 'pivot'),
      ];
    },
    code: (params, df) => `df = df.pivot_table(index='${codeCol(df, params.index)}', columns='${codeCol(df, params.columns)}', values='${codeCol(df, params.col)}', aggfunc='${params.how}').reset_index()`,
    run(df, params) {
      const ik = params.index, ck = params.columns, vk = params.col, how = params.how;
      const colVals = df.uniqueValues(ck).slice(0, 12);
      const map = new Map();
      df.rows.forEach((r) => {
        const i = isMissing(r[ik]) ? '(缺失)' : String(r[ik]);
        const c = isMissing(r[ck]) ? '(缺失)' : String(r[ck]);
        const k = i + '||' + c;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(toNumber(r[vk]));
      });
      const idxVals = df.uniqueValues(ik).slice(0, 24);
      const columns = [Object.assign({}, df.column(ik))].concat(colVals.map((cv, ci) => ({ key: 'p_' + ci, name: cv, type: 'number' })));
      const rows = idxVals.map((iv) => {
        const o = { _id: D.nextId() };
        o[ik] = iv === '(缺失)' ? null : iv;
        colVals.forEach((cv, ci) => {
          const vs = (map.get(iv + '||' + cv) || []).filter((v) => v !== null);
          let v = null;
          if (how === 'count') v = vs.length;
          else if (!vs.length) v = null;
          else if (how === 'mean') v = S.mean(vs);
          else if (how === 'sum') v = S.sum(vs);
          else if (how === 'max') v = S.max(vs);
          else v = S.min(vs);
          o['p_' + ci] = v;
        });
        return o;
      });
      const out = new D.DataFrame(rows, columns, Object.assign({}, df.meta));
      const items = df.rows.map((r) => ({ id: r._id, v: r[ik], flag: 'pass' }));
      return {
        df: out,
        code: `df = df.pivot_table(index='${name(df, ik)}', columns='${name(df, ck)}', values='${name(df, vk)}', aggfunc='${how}').reset_index()`,
        trace: [
          say('pivot.start', { index: name(df, ik), columns: name(df, ck) }, 'run'),
          scanEvent({ col: ik, colName: name(df, ik), items, track: 'read', per: U.clamp(800 / Math.max(1, df.length), 16, 36) }),
          say('pivot.build', { r: rows.length, c: columns.length, how: I.opt('pivot', how) }, 'agg', 760),
          say('pivot.done', { r: rows.length, c: columns.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('valuecount', 'analyze', '🔢', {
    params: (df) => [P('valuecount').col('col', df, null, preferCatCol(df))],
    code: (params, df) => `df = df['${codeCol(df, params.col)}'].value_counts().rename_axis('${codeCol(df, params.col)}').reset_index(name='count')`,
    run(df, params) {
      const col = params.col;
      const vc = df.valueCounts(col, 20);
      const total = df.length || 1;
      const kVal = 'vc_value', kCnt = 'vc_count', kShare = 'vc_share';
      const columns = [
        { key: kVal, name: name(df, col), type: df.typeOf(col) },
        { key: kCnt, name: I.t('colname.freq'), type: 'number' },
        { key: kShare, name: I.t('colname.percent'), type: 'number' },
      ];
      const rows = vc.map(([v, n]) => {
        const o = { _id: D.nextId() };
        o[kVal] = v === '(缺失)' ? null : v;
        o[kCnt] = n;
        o[kShare] = Number((n / total * 100).toFixed(1));
        return o;
      });
      const out = new D.DataFrame(rows, columns, Object.assign({}, df.meta));
      const items = df.rows.map((r) => ({ id: r._id, v: r[col], flag: 'pass' }));
      return {
        df: out,
        code: `df = df['${name(df, col)}'].value_counts().rename_axis('${name(df, col)}').reset_index(name='count')`,
        trace: [
          say('valuecount.start', { col: name(df, col) }, 'run'),
          scanEvent({ col, colName: name(df, col), items, track: 'read', per: U.clamp(900 / Math.max(1, df.length), 20, 60) }),
          say('valuecount.done', { k: vc.length, top: vc.length ? vc[0][0] : '' }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  defOp('corr', 'analyze', '🧩', {
    params: () => [],
    code: () => 'df.corr(numeric_only=True)',
    run(df) {
      const cm = df.corrMatrix();
      const cols = cm.cols;
      const kA = 'corr_a', kB = 'corr_b', kR = 'corr_r';
      const columns = [
        { key: kA, name: I.t('c.col') + ' A', type: 'string' },
        { key: kB, name: I.t('c.col') + ' B', type: 'string' },
        { key: kR, name: 'r', type: 'number' },
      ];
      const rows = [];
      let best = { a: '', b: '', r: -2 };
      for (let i = 0; i < cols.length; i++) {
        for (let j = i + 1; j < cols.length; j++) {
          const r = Number(cm.matrix[i][j].toFixed(3));
          if (r > best.r) best = { a: name(df, cols[i]), b: name(df, cols[j]), r };
          const o = { _id: D.nextId() };
          o[kA] = name(df, cols[i]); o[kB] = name(df, cols[j]); o[kR] = r;
          rows.push(o);
        }
      }
      const out = new D.DataFrame(rows, columns, Object.assign({}, df.meta));
      const items = df.rows.map((r2) => ({ id: r2._id, v: null, flag: 'pass' }));
      return {
        df: out,
        code: 'df.corr(numeric_only=True)',
        trace: [
          say('corr.start', { k: cols.length }, 'run'),
          scanEvent({ col: null, items, track: 'read', per: U.clamp(600 / Math.max(1, df.length), 12, 30) }),
          say('corr.done', { a: best.a, b: best.b, r: fmt(best.r) }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  /* ============================ 合并 ============================ */
  defOp('merge', 'combine', '🔗', {
    params: (df) => {
      const lu = df.meta && df.meta.lookup ? df.meta.lookup : null;
      const key = lu ? (df.has(lu.cols[0].key) ? lu.cols[0].key : KEYS(df)[0]) : KEYS(df)[0];
      return [P('merge').col('key', df, null, key)];
    },
    code: (params, df, rightName) => `df = df.merge(${rightName || 'right'}, on='${codeCol(df, params.key)}', how='left')`,
    run(df, params) {
      const lu = df.meta && df.meta.lookup ? df.meta.lookup : null;
      if (!lu) throw new Error(I.t('msg.noLookup'));
      const lang = I.lang;
      const right = global.DF.DataFrame.fromColumns(
        lu.cols.map((c) => ({ key: c.key, name: lang === 'en' ? (c.en || c.zh) : (c.zh || c.en) })),
        lang === 'en' ? (lu.rowsEn || lu.rows) : lu.rows,
        { dataset: 'lookup' }
      );
      const key = params.key;
      const rightKey = lu.cols[0].key;
      const index = new Map();
      right.rows.forEach((r) => { index.set(isMissing(r[rightKey]) ? '⌀' : String(r[rightKey]), r); });
      const items = [];
      const cellsByCol = {};
      const rows = dupRows(df);
      const newCols = right.columns.filter((c) => c.key !== rightKey);
      newCols.forEach((c) => { cellsByCol[c.key] = []; });
      rows.forEach((r) => {
        const m = index.get(isMissing(r[key]) ? '⌀' : String(r[key]));
        items.push({ id: r._id, v: r[key], flag: m ? 'pass' : 'drop' });
        newCols.forEach((c) => {
          r[c.key] = m ? m[c.key] : null;
          cellsByCol[c.key].push({ id: r._id, v: r[c.key] });
        });
      });
      const columns = dupCols(df).concat(newCols.map((c) => Object.assign({}, c)));
      const out = new D.DataFrame(rows, columns, Object.assign({}, df.meta));
      const trace = [
        say('merge.start', { key: name(df, key), right: right.columns.length ? name(right, rightKey) : '' }, 'run'),
        scanEvent({ col: key, colName: name(df, key), items, per: U.clamp(1000 / Math.max(1, df.length), 28, 90) }),
      ];
      newCols.forEach((c) => {
        trace.push(addColEvent({ key: c.key, name: c.name, type: c.type }, cellsByCol[c.key], `merge → ${c.name}`, 40));
      });
      trace.push(say('merge.done', { k: newCols.length }, 'done'));
      trace.push(settle('none'));
      return { df: out, code: `df = df.merge(right, on='${name(df, key)}', how='left')`, trace };
    },
  });

  defOp('concat', 'combine', '🧷', {
    params: (df) => {
      const ex = df.meta && df.meta.extra ? df.meta.extra : null;
      const n = ex ? (langRows(ex).length) : 0;
      return [P('concat').num('n', n || 3, 1, 20)];
    },
    code: () => 'df = pd.concat([df, extra], ignore_index=True)',
    run(df, params) {
      const ex = df.meta && df.meta.extra ? df.meta.extra : null;
      if (!ex) throw new Error(I.t('msg.noExtra'));
      const lang = I.lang;
      const raw = (lang === 'en' ? (ex.rowsEn || ex.rows) : ex.rows) || [];
      const n = U.clamp(Number(params.n) || raw.length, 1, raw.length);
      const extra = global.DF.DataFrame.fromColumns(dupCols(df), raw.slice(0, n), Object.assign({}, df.meta));
      const rows = dupRows(df).concat(extra.rows.map((r) => Object.assign({ _id: D.nextId() }, r)));
      const out = new D.DataFrame(rows, dupCols(df), Object.assign({}, df.meta));
      return {
        df: out,
        code: 'df = pd.concat([df, extra], ignore_index=True)',
        trace: [
          say('concat.start', { n }, 'run'),
          wait(460),
          say('concat.done', { r: out.length, c: out.columns.length }, 'done'),
          settle('render'),
        ],
      };
    },
  });

  function langRows(ex) { return (I.lang === 'en' ? (ex.rowsEn || ex.rows) : ex.rows) || []; }

  /* ---------------- 导出 ---------------- */
  OPS.byCat = function () {
    return CATS.map((cat) => [
      cat,
      ORDER.filter((id) => OPS[id].cat === cat),
    ]).filter((x) => x[1].length);
  };
  OPS.catName = function (cat) { return I.t('cat.' + cat); };
  OPS.order = ORDER;

  global.OPS = OPS;
})(window);
