/* =============================================================
   operations.js · pandas 风格操作库
   每个操作 run(df, params) 返回 { df, trace, code, summary }
   trace 是「动画剧本」：由 animator 逐步播放，呈现内部逻辑
   ============================================================= */
(function (global) {
  'use strict';
  const { fmt, mulberry32, clamp } = global.U;
  const D = global.DF;
  const isMissing = D.isMissing;
  const S = D.Stats;

  const num = (v, d) => (v === null || v === undefined ? '–' : fmt(v, d === undefined ? 2 : d));

  /* ---------------- 参数定义小工具 ---------------- */
  const ID_LIKE = /(^|_|\s)(id|学号|编号|序号|index|no)$/i;

  /** 挑一个“像业务指标”的数值列，避免默认落在 id 类字段上 */
  function preferNumCol(df) {
    const nums = df.numericColumns();
    const cand = nums.filter((n) => !ID_LIKE.test(n));
    return (cand.length ? cand : nums)[0] || df.names()[0] || '';
  }

  /** 挑一个类别型字段作为分组列：取值数量接近 √n 者最"适合分组" */
  function preferCatCol(df) {
    const texts = df.textColumns();
    if (!texts.length) return df.names()[0] || '';
    const lim = Math.max(2, Math.min(20, df.length / 2));
    const ideal = Math.sqrt(Math.max(1, df.length));
    const scored = texts
      .map((c) => ({ c, u: df.uniqueValues(c).length }))
      .filter((x) => x.u > 1 && x.u <= lim)
      .map((x) => ({ c: x.c, d: Math.abs(x.u - ideal) }))
      .sort((a, b) => a.d - b.d);
    return scored.length ? scored[0].c : texts[0];
  }

  const P = {
    col: (key, label, df, filterFn, def) => {
      let cols = df.names();
      if (filterFn) cols = cols.filter(filterFn);
      return { key, label, type: 'col', options: cols, default: def || cols[0] || '' };
    },
    cols: (key, label, df, pick) => ({
      key, label, type: 'cols', options: df.names(), default: pick(df),
    }),
    select: (key, label, options, def) => ({ key, label, type: 'select', options, default: def === undefined ? options[0] : def }),
    number: (key, label, def, min, max) => ({ key, label, type: 'number', default: def, min, max }),
    text: (key, label, def) => ({ key, label, type: 'text', default: def }),
  };

  const numericOnly = (df) => df.numericColumns();
  const allCols = (df) => df.names();
  const numOrAll = (df) => (df.numericColumns().length ? df.numericColumns() : df.names());

  /* ---------------- 操作库 ---------------- */
  const OPS = {};

  /* ============ 1. 查看数据 ============ */
  OPS.view = {
    id: 'view', name: '查看数据', icon: '🔍', cat: '观察',
    desc: 'head / tail：先看清楚表结构与量级',
    params: (df) => [
      P.select('mode', '方式', ['head', 'tail', 'sample'], 'head'),
      P.number('n', '行数', Math.min(8, df.length), 1, 200),
    ],
    title: (p) => `查看 ${p.mode}(${p.n})`,
    code: (p) => `df.${p.mode}(${p.n})   # 只看不改，用于观察`,
    run(df, p) {
      const n = clamp(parseInt(p.n, 10) || 8, 1, df.length || 1);
      let sub = df.rows;
      if (p.mode === 'head') sub = df.rows.slice(0, n);
      else if (p.mode === 'tail') sub = df.rows.slice(-n);
      else {
        const rnd = mulberry32(42);
        sub = df.rows.slice().sort(() => rnd() - 0.5).slice(0, n);
      }
      const numCols = df.numericColumns();
      const trace = [
        { t: 'say', badge: '观察', title: `查看数据：df.${p.mode}(${n})`, sub: '先确认字段、类型与量级，再决定清洗策略' },
        { t: 'scan', col: df.names()[0], items: sub.map((r, i) => ({ id: r._id, flag: 'pass' })), per: 70, note: '逐行掠过' },
        {
          t: 'say', badge: '观察',
          title: `共 ${df.length} 行 × ${df.columns.length} 列`,
          sub: `数值列 ${numCols.length} 个：${numCols.slice(0, 6).join('、') || '无'}；缺失单元格 ${df.totalMissing()} 个`,
        },
      ];
      return { df: df.clone(), trace, summary: { unchanged: true } };
    },
  };

  /* ============ 2. 选择列 ============ */
  OPS.select = {
    id: 'select', name: '选择列', icon: '🧩', cat: '整理',
    desc: 'df[[...]] 保留需要的字段',
    params: (df) => [P.cols('cols', '保留列', df, allCols)],
    title: (p) => `保留 ${(p.cols || []).length} 列`,
    code: (p) => `df = df[${JSON.stringify(p.cols || [])}]`,
    run(df, p) {
      const keep = (p.cols || []).filter((c) => df.has(c));
      if (!keep.length) throw new Error('请至少选择一列');
      const ordered = df.names().filter((n) => keep.includes(n));
      const drop = df.names().filter((n) => !keep.includes(n));
      const out = new D.DataFrame(
        df.rows.map((r) => { const o = { _id: r._id }; ordered.forEach((c) => { o[c] = r[c]; }); return o; }),
        df.columns.filter((c) => keep.includes(c.name)),
        Object.assign({}, df.meta)
      );
      const trace = [
        { t: 'say', badge: '整理', title: `选择列：保留 ${ordered.length} 列`, sub: `df = df[[${ordered.map((c) => `'${c}'`).join(', ')}]]` },
        { t: 'removecol', cols: drop },
        { t: 'say', badge: '整理', title: `已丢弃 ${drop.length} 列`, sub: drop.length ? `丢弃：${drop.join('、')}` : '没有需要丢弃的列' },
        { t: 'settle', mode: 'render' },
      ];
      return { df: out, trace, summary: { colsRemoved: drop.length } };
    },
  };

  /* ============ 3. 条件筛选 ============ */
  OPS.filter = {
    id: 'filter', name: '条件筛选', icon: '🎯', cat: '整理',
    desc: '按条件逐行比较，保留命中行',
    params: (df) => {
      const col = preferNumCol(df);
      const vals = df.typeOf(col) === 'number' ? df.values(col) : [];
      const defVal = vals.length ? String(Number(S.median(vals).toFixed(4))) : '80';
      return [
        P.col('col', '列', df, null, col),
        P.select('op', '条件', ['>', '>=', '<', '<=', '==', '!=', '包含', '为空', '不为空'], '>='),
        P.text('value', '值', defVal),
      ];
    },
    title: (p) => `筛选 ${p.col} ${p.op} ${p.op === '包含' || ['>', '>=', '<', '<=', '==', '!='].includes(p.op) ? p.value : ''}`.trim(),
    code: (p) => {
      if (p.op === '为空') return `df = df[df['${p.col}'].isna()]`;
      if (p.op === '不为空') return `df = df[df['${p.col}'].notna()]`;
      if (p.op === '包含') return `df = df[df['${p.col}'].astype(str).str.contains('${p.value}')]`;
      return `df = df[df['${p.col}'] ${p.op} ${isNaN(Number(p.value)) ? `'${p.value}'` : p.value}]`;
    },
    run(df, p) {
      const col = p.col;
      const test = (r) => {
        const v = r[col];
        if (p.op === '为空') return isMissing(v);
        if (p.op === '不为空') return !isMissing(v);
        if (p.op === '包含') return !isMissing(v) && String(v).includes(String(p.value));
        const tv = D.toNumber(p.value);
        const isNumCol = df.typeOf(col) === 'number';
        if (isNumCol && tv !== null) {
          const x = isMissing(v) ? null : D.toNumber(v);
          if (x === null) return false;
          switch (p.op) {
            case '>': return x > tv;
            case '>=': return x >= tv;
            case '<': return x < tv;
            case '<=': return x <= tv;
            case '==': return x === tv;
            case '!=': return x !== tv;
          }
        }
        const s = String(isMissing(v) ? '' : v);
        switch (p.op) {
          case '>': return s > String(p.value);
          case '>=': return s >= String(p.value);
          case '<': return s < String(p.value);
          case '<=': return s <= String(p.value);
          case '==': return s === String(p.value);
          case '!=': return s !== String(p.value);
        }
        return false;
      };
      const items = df.rows.map((r) => ({ id: r._id, flag: test(r) ? 'pass' : 'fail', v: r[col] }));
      const keepIds = items.filter((i) => i.flag === 'pass').map((i) => i.id);
      const dropIds = items.filter((i) => i.flag === 'fail').map((i) => i.id);
      const out = new D.DataFrame(
        df.rows.filter((r) => keepIds.includes(r._id)).map((r) => Object.assign({}, r)),
        df.columns.map((c) => Object.assign({}, c)), Object.assign({}, df.meta)
      );
      const trace = [
        { t: 'say', badge: '筛选', title: `逐行比较：${col} ${p.op} ${p.value}`, sub: '每一行都要与条件做一次比较，命中的留下、未命中的剔除' },
        { t: 'scan', col, items, per: 90, track: 'flag', hud: true, keepLabel: '命中', dropLabel: '未命中' },
        { t: 'say', badge: '筛选', title: `命中 ${keepIds.length} 行，未命中 ${dropIds.length} 行`, sub: '绿色为命中（保留），红色为未命中（剔除）' },
      ];
      if (dropIds.length) trace.push({ t: 'drop', ids: dropIds, label: '未命中条件' });
      trace.push({ t: 'settle', mode: 'render' });
      return { df: out, trace, summary: { rowsRemoved: dropIds.length } };
    },
  };

  /* ============ 4. 排序 ============ */
  OPS.sort = {
    id: 'sort', name: '排序', icon: '🔢', cat: '整理',
    desc: 'sort_values：读取键 → 重排位置',
    params: (df) => [P.col('col', '排序列', df, null, preferNumCol(df)), P.select('asc', '顺序', ['降序', '升序'], '降序')],
    title: (p) => `按 ${p.col} ${p.asc}`,
    code: (p) => `df = df.sort_values('${p.col}', ascending=${p.asc === '升序'})`,
    run(df, p) {
      const asc = p.asc === '升序';
      const items = df.rows.map((r) => ({ id: r._id, v: r[p.col] }));
      const sorted = df.rows.slice().sort((a, b) => {
        const x = a[p.col], y = b[p.col];
        if (isMissing(x) && isMissing(y)) return 0;
        if (isMissing(x)) return 1;
        if (isMissing(y)) return -1;
        if (typeof x === 'number' && typeof y === 'number') return asc ? x - y : y - x;
        return asc ? String(x).localeCompare(String(y), 'zh') : String(y).localeCompare(String(x), 'zh');
      });
      const out = new D.DataFrame(sorted, df.columns.map((c) => Object.assign({}, c)), Object.assign({}, df.meta));
      const top = sorted[0];
      const trace = [
        { t: 'say', badge: '排序', title: `按「${p.col}」${asc ? '升序' : '降序'}排序`, sub: '先读取每行的排序键，再整体重排位置' },
        { t: 'scan', col: p.col, items: items.map((i) => ({ id: i.id, flag: 'pass' })), per: 34, note: '读取排序键' },
        { t: 'reorder', ids: sorted.map((r) => r._id), col: p.col, asc },
        {
          t: 'say', badge: '排序',
          title: `排在最前：${top ? (isMissing(top[p.col]) ? '缺失' : num(top[p.col])) : '–'}`,
          sub: '注意行的位置变化——这就是 sort_values 的效果',
        },
        { t: 'settle', mode: 'flip' },
      ];
      return { df: out, trace, summary: { reordered: true } };
    },
  };

  /* ============ 5. 去重 ============ */
  OPS.dedupe = {
    id: 'dedupe', name: '去除重复', icon: '🧬', cat: '清洗',
    desc: 'drop_duplicates：保留首次/末次出现',
    params: (df) => [
      P.cols('cols', '依据列', df, (d) => {
        // 默认忽略 id 类主键列（学号/编号等），更贴近真实清洗习惯
        const cols = d.names().filter((n) => !ID_LIKE.test(n));
        return cols.length ? cols : d.names();
      }),
      P.select('keep', '保留', ['first', 'last'], 'first'),
    ],
    title: (p) => `去重（按 ${(p.cols || []).length} 列）`,
    code: (p) => `df = df.drop_duplicates(subset=${JSON.stringify(p.cols || [])}, keep='${p.keep}')`,
    run(df, p) {
      const cols = (p.cols || []).filter((c) => df.has(c));
      const seen = new Map();
      const items = [];
      const order = p.keep === 'last' ? df.rows.slice().reverse() : df.rows;
      order.forEach((r) => {
        const key = cols.map((c) => String(isMissing(r[c]) ? '⌀' : r[c])).join('||');
        seen.set(key, (seen.get(key) || 0) + 1);
      });
      const counter = new Map();
      const dupIds = [];
      df.rows.forEach((r) => {
        const key = cols.map((c) => String(isMissing(r[c]) ? '⌀' : r[c])).join('||');
        const total = seen.get(key) || 1;
        const k = counter.get(key) || 0;
        counter.set(key, k + 1);
        // keep='first' → 第 1 次出现保留；keep='last' → 最后一次出现保留
        const isKeep = p.keep === 'first' ? k === 0 : k === total - 1;
        items.push({ id: r._id, flag: isKeep ? 'pass' : 'dup' });
        if (!isKeep) dupIds.push(r._id);
      });
      const out = new D.DataFrame(
        df.rows.filter((r) => !dupIds.includes(r._id)).map((r) => Object.assign({}, r)),
        df.columns.map((c) => Object.assign({}, c)), Object.assign({}, df.meta)
      );
      const trace = [
        { t: 'say', badge: '清洗', title: `检测重复行：${cols.join(' + ')}`, sub: `为每行计算「指纹」，指纹重复且非保留位的就是重复行（keep='${p.keep}'）` },
        { t: 'scan', col: cols[0], items, per: 85, track: 'flag', hud: true, keepLabel: '保留', dropLabel: '重复' },
        { t: 'say', badge: '清洗', title: `发现 ${dupIds.length} 条重复记录`, sub: dupIds.length ? '黄色标记为重复行，即将删除' : '数据很干净，没有重复' },
      ];
      if (dupIds.length) trace.push({ t: 'drop', ids: dupIds, label: '重复行' });
      trace.push({ t: 'settle', mode: 'render' });
      return { df: out, trace, summary: { rowsRemoved: dupIds.length } };
    },
  };

  /* ============ 6. 缺失值处理 ============ */
  OPS.missing = {
    id: 'missing', name: '缺失值处理', icon: '🩹', cat: '清洗',
    desc: 'dropna 删除 / fillna 填充（均值·中位数·众数）',
    params: (df) => [
      P.select('strategy', '策略', ['dropna', 'fillna'], 'fillna'),
      P.cols('cols', '作用列', df, (d) => {
        const withNa = d.names().filter((c) => d.missingCount(c) > 0);
        return withNa.length ? withNa : d.names();
      }),
      P.select('how', '填充值', ['mean', 'median', 'mode', '0', '自定义'], 'mean'),
      P.text('value', '自定义值', '0'),
    ],
    title: (p) => (p.strategy === 'dropna' ? '删除含缺失的行' : `填充缺失（${p.how}）`),
    code: (p) => {
      const cols = JSON.stringify(p.cols || []);
      if (p.strategy === 'dropna') return `df = df.dropna(subset=${cols})`;
      if (p.how === 'mean') return `df[${cols}] = df[${cols}].fillna(df[${cols}].mean())`;
      if (p.how === 'median') return `df[${cols}] = df[${cols}].fillna(df[${cols}].median())`;
      if (p.how === 'mode') return `df[${cols}] = df[${cols}].fillna(df[${cols}].mode().iloc[0])`;
      return `df[${cols}] = df[${cols}].fillna(${isNaN(Number(p.value)) ? `'${p.value}'` : p.value})`;
    },
    run(df, p) {
      const cols = (p.cols || []).filter((c) => df.has(c));
      if (!cols.length) throw new Error('请选择作用列');
      const cells = [];
      df.rows.forEach((r) => cols.forEach((c) => { if (isMissing(r[c])) cells.push({ id: r._id, col: c }); }));
      const trace = [
        {
          t: 'say', badge: '清洗',
          title: `扫描缺失值：${cols.join('、')}`,
          sub: `缺失单元格会在扫描中被标红（⌀ 表示空值）`,
        },
        { t: 'scan', mode: 'cells', col: cols[0], cellItems: cells, per: 130, track: 'null', hud: true },
        {
          t: 'say', badge: '清洗',
          title: cells.length ? `共发现 ${cells.length} 个缺失单元格` : '没有发现缺失值',
          sub: cells.length ? `涉及 ${new Set(cells.map((c) => c.id)).size} 行` : '数据完整，无需处理',
        },
      ];

      if (p.strategy === 'dropna') {
        const dropIds = Array.from(new Set(cells.map((c) => c.id)));
        const out = new D.DataFrame(
          df.rows.filter((r) => !dropIds.includes(r._id)).map((r) => Object.assign({}, r)),
          df.columns.map((c) => Object.assign({}, c)), Object.assign({}, df.meta)
        );
        trace.push({ t: 'say', badge: '清洗', title: `dropna：删除 ${dropIds.length} 行含缺失的记录`, sub: '整行删除，保证后续计算不受空值干扰' });
        if (dropIds.length) trace.push({ t: 'drop', ids: dropIds, label: '含缺失' });
        trace.push({ t: 'settle', mode: 'render' });
        return { df: out, trace, summary: { rowsRemoved: dropIds.length, filled: 0 } };
      }

      // fillna
      const fillVals = {};
      cols.forEach((c) => {
        const vals = df.values(c);
        if (p.how === 'mean') fillVals[c] = vals.length ? S.mean(vals) : 0;
        else if (p.how === 'median') fillVals[c] = vals.length ? S.median(vals) : 0;
        else if (p.how === 'mode') {
          const vc = df.valueCounts(c, 1);
          const m = vc.length ? vc[0][0] : '0';
          fillVals[c] = df.typeOf(c) === 'number' ? (D.toNumber(m) ?? 0) : m;
        } else if (p.how === '0') fillVals[c] = 0;
        else fillVals[c] = df.typeOf(c) === 'number' ? (D.toNumber(p.value) ?? 0) : p.value;
      });
      const descCols = cols.map((c) => `${c}→${num(fillVals[c])}`).join('，');
      trace.push({ t: 'say', badge: '清洗', title: `fillna：用${p.how === 'mean' ? '均值' : p.how === 'median' ? '中位数' : p.how === 'mode' ? '众数' : p.how === '0' ? ' 0 ' : '自定义值'}填充`, sub: descCols });
      const fills = cells.map((c) => ({ id: c.id, col: c.col, v: fillVals[c.col] }));
      if (fills.length) trace.push({ t: 'fill', cells: fills, per: 220 });
      const out = df.clone();
      fills.forEach((f) => {
        const r = out.rows.find((x) => x._id === f.id);
        if (r) r[f.col] = f.v;
      });
      trace.push({ t: 'settle', mode: 'render' });
      return { df: out, trace, summary: { filled: fills.length } };
    },
  };

  /* ============ 7. 去除极值（★核心演示） ============ */
  OPS.outlier = {
    id: 'outlier', name: '去除极值', icon: '⚖️', cat: '清洗',
    desc: '扫全列找最大/最小 → 标记 → 删除（评委打分同款逻辑）',
    params: (df) => [
      P.select('mode', '方式', ['extreme', 'iqr', 'clip'], 'extreme'),
      P.col('col', '列', df, (c) => df.numericColumns().includes(c), preferNumCol(df)),
      P.number('n', '两端各去掉', 1, 1, 10),
    ],
    title: (p) => {
      if (p.mode === 'extreme') return `去极值：${p.col} 两端各 ${p.n} 个`;
      if (p.mode === 'iqr') return `IQR 剔除异常：${p.col}`;
      return `分位裁剪 clip：${p.col}`;
    },
    code: (p) => {
      if (p.mode === 'extreme') {
        return `# 去掉最高的 ${p.n} 个与最低的 ${p.n} 个\ndf = df.drop(df['${p.col}'].nlargest(${p.n}).index \\\n              .union(df['${p.col}'].nsmallest(${p.n}).index))`;
      }
      if (p.mode === 'iqr') {
        return `q1, q3 = df['${p.col}'].quantile([.25, .75])\niqr = q3 - q1\ndf = df[(df['${p.col}'] >= q1-1.5*iqr) & (df['${p.col}'] <= q3+1.5*iqr)]`;
      }
      return `q1, q3 = df['${p.col}'].quantile([.25, .75])\ndf['${p.col}'] = df['${p.col}'].clip(q1, q3)`;
    },
    run(df, p) {
      const col = p.col;
      const vals = df.rawValues(col);
      const valid = df.rows.map((r, i) => ({ id: r._id, v: D.toNumber(r[col]), idx: i })).filter((x) => x.v !== null);
      if (!valid.length) throw new Error(`「${col}」没有可用的数值`);

      if (p.mode === 'extreme') {
        const n = clamp(parseInt(p.n, 10) || 1, 1, Math.floor(valid.length / 2) || 1);
        const sorted = valid.slice().sort((a, b) => a.v - b.v);
        const lowIds = sorted.slice(0, n).map((x) => x.id);
        const highIds = sorted.slice(-n).map((x) => x.id);
        const dropIds = lowIds.concat(highIds);
        const items = df.rows.map((r) => ({ id: r._id, v: D.toNumber(r[col]) }));
        const minRow = sorted[0], maxRow = sorted[sorted.length - 1];
        const out = new D.DataFrame(
          df.rows.filter((r) => !dropIds.includes(r._id)).map((r) => Object.assign({}, r)),
          df.columns.map((c) => Object.assign({}, c)), Object.assign({}, df.meta)
        );
        const trace = [
          { t: 'hud', show: true },
          { t: 'say', badge: '核心', title: `去除极值：「${col}」两端各去掉 ${n} 个`, sub: '像评委打分一样：先扫全列找到最高与最低，再删除 —— 下面完整演示寻找过程' },
          { t: 'scan', col, items, per: 110, track: 'minmax', hud: true, note: '扫描中：蓝色=当前最小，红色=当前最大' },
          { t: 'say', badge: '核心', title: `扫描结束：最小 ${num(minRow.v)}，最大 ${num(maxRow.v)}`, sub: `两端极值共 ${dropIds.length} 行（最低 ${n} 个 + 最高 ${n} 个）` },
          { t: 'mark', rows: lowIds.map((id) => ({ id, kind: 'row-min' })).concat(highIds.map((id) => ({ id, kind: 'row-max' }))), col },
          { t: 'say', badge: '核心', title: '标记极值行：蓝色=最低，红色=最高', sub: '现在可以清楚地看到将被删除的目标' },
          { t: 'drop', ids: dropIds, label: '极值行' },
          { t: 'hud', show: false },
          { t: 'say', badge: '完成', title: `删除 ${dropIds.length} 行，剩余 ${out.length} 行`, sub: `新区间：${num(S.min(out.values(col)))} ~ ${num(S.max(out.values(col)))}` },
          { t: 'settle', mode: 'render' },
        ];
        return { df: out, trace, summary: { rowsRemoved: dropIds.length, extreme: true } };
      }

      // IQR / clip
      const vs = valid.map((x) => x.v);
      const q1 = S.quantile(vs, 0.25), q3 = S.quantile(vs, 0.75), iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
      const items = df.rows.map((r) => {
        const v = D.toNumber(r[col]);
        return { id: r._id, v, flag: v !== null && (v < lo || v > hi) ? 'outlier' : 'pass' };
      });
      const outIds = items.filter((i) => i.flag === 'outlier').map((i) => i.id);

      if (p.mode === 'iqr') {
        const out = new D.DataFrame(
          df.rows.filter((r) => !outIds.includes(r._id)).map((r) => Object.assign({}, r)),
          df.columns.map((c) => Object.assign({}, c)), Object.assign({}, df.meta)
        );
        const trace = [
          { t: 'hud', show: true },
          { t: 'say', badge: '核心', title: `IQR 法检测异常值：「${col}」`, sub: `四分位 Q1=${num(q1)}，Q3=${num(q3)}，IQR=${num(iqr)}` },
          { t: 'say', badge: '核心', title: `正常区间 = [Q1-1.5×IQR, Q3+1.5×IQR] = [${num(lo)}, ${num(hi)}]`, sub: '落在区间之外的行视为异常' },
          { t: 'scan', col, items, per: 100, track: 'flag', hud: true, keepLabel: '正常', dropLabel: '异常' },
          { t: 'say', badge: '核心', title: `检出 ${outIds.length} 个异常值`, sub: outIds.length ? '红色标记为异常行，即将剔除' : '该列没有统计意义上的异常值' },
        ];
        if (outIds.length) trace.push({ t: 'drop', ids: outIds, label: '异常值' });
        trace.push({ t: 'hud', show: false }, { t: 'settle', mode: 'render' });
        return { df: out, trace, summary: { rowsRemoved: outIds.length } };
      }

      // clip：不删行，把越界值拉回边界
      const out = df.clone();
      const fills = [];
      outIds.forEach((id) => {
        const r = out.rows.find((x) => x._id === id);
        const v = D.toNumber(r[col]);
        const nv = v < lo ? lo : hi;
        r[col] = Number(nv.toFixed(4));
        fills.push({ id, col, v: r[col] });
      });
      const trace = [
        { t: 'hud', show: true },
        { t: 'say', badge: '核心', title: `分位裁剪 clip：「${col}」`, sub: `把超出 [${num(lo)}, ${num(hi)}] 的值拉回边界，保留样本数量` },
        { t: 'scan', col, items, per: 90, track: 'flag', hud: true, keepLabel: '区间内', dropLabel: '越界' },
        { t: 'say', badge: '核心', title: `裁剪 ${fills.length} 个越界值`, sub: '数值会平滑地“滑”到边界上' },
      ];
      if (fills.length) trace.push({ t: 'fill', cells: fills, per: 240 });
      trace.push({ t: 'hud', show: false }, { t: 'settle', mode: 'render' });
      return { df: out, trace, summary: { clipped: fills.length } };
    },
  };

  /* ============ 8. 新增计算列 ============ */
  OPS.assign = {
    id: 'assign', name: '新增计算列', icon: '➕', cat: '变换',
    desc: 'df.assign：由已有列算出新列',
    params: (df) => [
      P.text('name', '新列名', '总分'),
      P.select('mode', '计算', ['sum', 'mean', 'max', 'min', 'aopb'], 'sum'),
      P.cols('cols', '来源列', df, (d) => {
        const nums = d.numericColumns();
        const cand = nums.filter((n) => !ID_LIKE.test(n));
        return cand.length ? cand : nums;
      }),
    ],
    title: (p) => `新增列 ${p.name}`,
    code: (p) => {
      const cols = p.cols || [];
      if (p.mode === 'aopb') return `df['${p.name}'] = df['${cols[0]}'] / df['${cols[1]}'] if len else 0`;
      return `df['${p.name}'] = df[${JSON.stringify(cols)}].${p.mode}(axis=1)`;
    },
    run(df, p) {
      const cols = (p.cols || []).filter((c) => df.has(c));
      if (!cols.length) throw new Error('请选择来源列');
      const name = (p.name || '新列').trim();
      const calc = (r) => {
        const vs = cols.map((c) => D.toNumber(r[c])).filter((v) => v !== null);
        if (!vs.length) return null;
        if (p.mode === 'sum') return S.sum(vs);
        if (p.mode === 'mean') return S.mean(vs);
        if (p.mode === 'max') return S.max(vs);
        if (p.mode === 'min') return S.min(vs);
        if (p.mode === 'aopb') return vs.length >= 2 && vs[1] !== 0 ? vs[0] / vs[1] : null;
        return null;
      };
      const formula = p.mode === 'aopb'
        ? `${cols[0]} ÷ ${cols[1]}`
        : `${cols.join(' + ')} 的${{ sum: '和', mean: '均值', max: '最大值', min: '最小值' }[p.mode]}`;
      const out = df.clone();
      const cells = [];
      out.rows.forEach((r) => { const v = calc(r); r[name] = v === null ? null : Number(v.toFixed(4)); cells.push({ id: r._id, v: r[name] }); });
      out.columns.push({ name, type: 'number' });
      const trace = [
        { t: 'say', badge: '变换', title: `新增列「${name}」 = ${formula}`, sub: '新列从右侧滑入，逐行计算并填充' },
        { t: 'addcol', col: name, cells, formula, per: 60 },
        { t: 'say', badge: '变换', title: `「${name}」已生成`, sub: `取值范围 ${num(S.min(out.values(name)))} ~ ${num(S.max(out.values(name)))}，均值 ${num(S.mean(out.values(name)))}` },
        { t: 'settle', mode: 'render' },
      ];
      return { df: out, trace, summary: { colsAdded: 1 } };
    },
  };

  /* ============ 9. 归一化 / 标准化 ============ */
  OPS.normalize = {
    id: 'normalize', name: '归一化', icon: '📐', cat: '变换',
    desc: 'min-max 缩放 / z-score 标准化',
    params: (df) => [
      P.col('col', '列', df, (c) => df.numericColumns().includes(c), preferNumCol(df)),
      P.select('how', '方法', ['minmax', 'zscore'], 'minmax'),
    ],
    title: (p) => `${p.col} ${p.how === 'minmax' ? 'min-max' : 'z-score'}`,
    code: (p) => (p.how === 'minmax'
      ? `df['${p.col}_norm'] = (df['${p.col}'] - df['${p.col}'].min()) / (df['${p.col}'].max() - df['${p.col}'].min())`
      : `df['${p.col}_z'] = (df['${p.col}'] - df['${p.col}'].mean()) / df['${p.col}'].std()`),
    run(df, p) {
      const col = p.col;
      const vals = df.values(col);
      if (!vals.length) throw new Error('该列没有数值');
      const mn = S.min(vals), mx = S.max(vals), mu = S.mean(vals), sd = S.std(vals);
      const name = col + (p.how === 'minmax' ? '_norm' : '_z');
      const formula = p.how === 'minmax'
        ? `(x - ${num(mn)}) / (${num(mx)} - ${num(mn)})`
        : `(x - 均值${num(mu)}) / 标准差${num(sd)}`;
      const out = df.clone();
      const cells = [];
      out.rows.forEach((r) => {
        const v = D.toNumber(r[col]);
        const nv = v === null ? null : (p.how === 'minmax'
          ? (mx === mn ? 0 : (v - mn) / (mx - mn))
          : (sd === 0 ? 0 : (v - mu) / sd));
        r[name] = nv === null ? null : Number(nv.toFixed(4));
        cells.push({ id: r._id, v: r[name] });
      });
      out.columns.push({ name, type: 'number' });
      const items = df.rows.map((r) => ({ id: r._id, v: D.toNumber(r[col]) }));
      const trace = [
        { t: 'hud', show: true },
        { t: 'say', badge: '变换', title: `${p.how === 'minmax' ? 'min-max 归一化' : 'z-score 标准化'}：「${col}」`, sub: '先找到这列的极值（或均值与标准差），才能得到变换公式' },
        { t: 'scan', col, items, per: 70, track: 'minmax', hud: true },
        { t: 'say', badge: '变换', title: `公式：${formula}`, sub: `结果落在${p.how === 'minmax' ? ' [0, 1] ' : '均值 0、标准差 1 '}的尺度上，便于跨列比较` },
        { t: 'addcol', col: name, cells, formula, per: 55 },
        { t: 'hud', show: false },
        { t: 'settle', mode: 'render' },
      ];
      return { df: out, trace, summary: { colsAdded: 1 } };
    },
  };

  /* ============ 10. 分组聚合 ============ */
  OPS.groupby = {
    id: 'groupby', name: '分组聚合', icon: '🗂️', cat: '分析',
    desc: 'groupby → 分组上色 → 聚拢 → 坍缩为汇总行',
    params: (df) => [
      P.col('by', '分组列', df, (c) => df.typeOf(c) !== 'number', preferCatCol(df)),
      P.col('col', '聚合列', df, (c) => df.numericColumns().includes(c), preferNumCol(df)),
      P.select('how', '聚合', ['mean', 'sum', 'count', 'max', 'min', 'median'], 'mean'),
    ],
    title: (p) => `按 ${p.by} 聚合 ${p.col}(${p.how})`,
    code: (p) => `df = df.groupby('${p.by}')['${p.col}'].${p.how}().reset_index()\n# 等价于 df.groupby('${p.by}').agg({ '${p.col}': '${p.how}' })`,
    run(df, p) {
      const by = p.by, col = p.col, how = p.how;
      const map = new Map();
      df.rows.forEach((r) => {
        const k = isMissing(r[by]) ? '(缺失)' : String(r[by]);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
      });
      const groups = Array.from(map.entries()).map(([key, rows]) => {
        const vs = rows.map((r) => D.toNumber(r[col])).filter((v) => v !== null);
        let v;
        if (how === 'mean') v = vs.length ? S.mean(vs) : 0;
        else if (how === 'sum') v = S.sum(vs);
        else if (how === 'count') v = rows.length;
        else if (how === 'max') v = vs.length ? S.max(vs) : 0;
        else if (how === 'min') v = vs.length ? S.min(vs) : 0;
        else v = vs.length ? S.median(vs) : 0;
        return { key, rows, value: Number(v.toFixed(4)), n: rows.length };
      });
      const nameOf = { mean: '均值', sum: '求和', count: '计数', max: '最大值', min: '最小值', median: '中位数' }[how];
      const valCol = how === 'count' ? '行数' : `${col}_${nameOf}`;
      const outCols = [{ name: by, type: df.typeOf(by) }, { name: valCol, type: 'number' }, { name: '样本数', type: 'number' }];
      const outRows = groups.map((g) => ({ _id: D.nextId(), [by]: g.key, [valCol]: g.value, 样本数: g.n }));
      const out = new D.DataFrame(outRows, outCols, Object.assign({}, df.meta));

      const trace = [
        { t: 'say', badge: '分析', title: `分组：按「${by}」共 ${groups.length} 组`, sub: '同组行会被染上同一种颜色，随后聚拢到一起' },
        { t: 'group', col: by, groups: groups.map((g, i) => ({ key: g.key, ids: g.rows.map((r) => r._id), gi: i })) },
        { t: 'say', badge: '分析', title: `各组数量：${groups.slice(0, 5).map((g) => `${g.key}(${g.n})`).join('、')}`, sub: '行已经按组重新聚集，接下来每组坍缩成一行' },
        {
          t: 'agg', col, how, valCol,
          groups: groups.map((g) => ({ key: g.key, ids: g.rows.map((r) => r._id), value: g.value, n: g.n })),
        },
        { t: 'say', badge: '完成', title: `聚合完成：${groups.length} 组 → ${groups.length} 行`, sub: `统计口径：${nameOf}` },
        { t: 'settle', mode: 'render' },
      ];
      return { df: out, trace, summary: { grouped: groups.length, rowsRemoved: df.length - groups.length } };
    },
  };

  /* ============ 11. 重命名列 ============ */
  OPS.rename = {
    id: 'rename', name: '重命名列', icon: '✏️', cat: '整理',
    desc: 'rename(columns={...})',
    params: (df) => [P.col('col', '列', df), P.text('name', '新名称', '新列名')],
    title: (p) => `${p.col} → ${p.name}`,
    code: (p) => `df = df.rename(columns={'${p.col}': '${p.name}'})`,
    run(df, p) {
      const out = df.clone();
      const c = out.columns.find((x) => x.name === p.col);
      if (c) c.name = p.name;
      out.rows.forEach((r) => { r[p.name] = r[p.col]; delete r[p.col]; });
      const trace = [
        { t: 'say', badge: '整理', title: `重命名：${p.col} → ${p.name}`, sub: 'df.rename(columns={...})' },
        { t: 'rename', from: p.col, to: p.name },
        { t: 'settle', mode: 'render' },
      ];
      return { df: out, trace, summary: { renamed: 1 } };
    },
  };

  /* ============ 12. 随机采样 ============ */
  OPS.sample = {
    id: 'sample', name: '随机采样', icon: '🎲', cat: '整理',
    desc: 'df.sample(n=...) 抽取子集',
    params: (df) => [P.number('n', '抽取行数', Math.max(1, Math.floor(df.length / 2)), 1, 10000), P.number('seed', '随机种子', 42, 0, 9999)],
    title: (p) => `采样 ${p.n} 行`,
    code: (p) => `df = df.sample(n=${p.n}, random_state=${p.seed})`,
    run(df, p) {
      const n = clamp(parseInt(p.n, 10) || 1, 1, df.length);
      const rnd = mulberry32(parseInt(p.seed, 10) || 42);
      const order = df.rows.map((r, i) => ({ r, k: rnd(), i })).sort((a, b) => a.k - b.k);
      const keep = new Set(order.slice(0, n).map((x) => x.r._id));
      const items = df.rows.map((r) => ({ id: r._id, flag: keep.has(r._id) ? 'pass' : 'fail' }));
      const out = new D.DataFrame(
        df.rows.filter((r) => keep.has(r._id)).map((r) => Object.assign({}, r)),
        df.columns.map((c) => Object.assign({}, c)), Object.assign({}, df.meta)
      );
      const trace = [
        { t: 'say', badge: '整理', title: `随机采样 ${n} 行（种子 ${p.seed}）`, sub: '每行生成一个随机数，取最小的 n 个' },
        { t: 'scan', col: df.names()[0], items, per: 55, track: 'flag', hud: true, keepLabel: '抽中', dropLabel: '未抽中' },
        { t: 'drop', ids: items.filter((i) => i.flag === 'fail').map((i) => i.id), label: '未抽中' },
        { t: 'settle', mode: 'render' },
      ];
      return { df: out, trace, summary: { rowsRemoved: df.length - n } };
    },
  };

  /* ============ 13. 统计摘要 ============ */
  OPS.describe = {
    id: 'describe', name: '统计摘要', icon: '📊', cat: '观察',
    desc: 'df.describe()：count/mean/std/min/分位/max',
    params: () => [],
    title: () => '统计摘要 describe()',
    code: () => `df.describe()   # 数值列的分布画像`,
    run(df) {
      const cols = df.numericColumns();
      if (!cols.length) throw new Error('没有数值列，无法生成统计摘要');
      const trace = [
        { t: 'say', badge: '观察', title: `统计摘要：扫描 ${cols.length} 个数值列`, sub: '逐列累计 count / sum，再推出均值、标准差与分位数' },
      ];
      cols.forEach((c) => {
        const st = D.columnStats(df, c);
        trace.push({ t: 'scan', col: c, items: df.rows.map((r) => ({ id: r._id, v: D.toNumber(r[c]) })), per: 26, track: 'minmax', hud: true });
        trace.push({
          t: 'say', badge: '观察',
          title: `${c}：均值 ${num(st.mean)}，标准差 ${num(st.std)}`,
          sub: `min ${num(st.min)} · Q1 ${num(st.q1)} · 中位 ${num(st.median)} · Q3 ${num(st.q3)} · max ${num(st.max)}`,
        });
      });
      trace.push({ t: 'hud', show: false });
      return { df: df.clone(), trace, summary: { unchanged: true } };
    },
  };

  /* ---------------- 分类顺序 ---------------- */
  const CATS = ['观察', '整理', '清洗', '变换', '分析'];

  global.OPS = OPS;
  global.OPS_CATS = CATS;
  global.OPS.byCat = function () {
    const m = new Map();
    CATS.forEach((c) => m.set(c, []));
    Object.keys(OPS).forEach((k) => {
      const o = OPS[k];
      if (!m.has(o.cat)) m.set(o.cat, []);
      m.get(o.cat).push(o);
    });
    return m;
  };
})(window);
