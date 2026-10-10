/* =============================================================
   dataframe.js · 轻量 DataFrame 引擎（pandas 风格，纯前端实现）
   - 行以 { _id, 列名: 值 } 存储，_id 保证动画可稳定追踪每一行
   ============================================================= */
(function (global) {
  'use strict';

  const MISSING_TOKENS = new Set(['', 'NA', 'N/A', 'na', 'n/a', 'null', 'NULL', 'None', 'NaN', 'nan', '-', '—', '?']);

  function isMissing(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'number') return !isFinite(v);
    if (typeof v === 'string') return MISSING_TOKENS.has(v.trim());
    return false;
  }

  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const s = v.trim().replace(/,/g, '').replace(/%$/, '');
    if (s === '') return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  function looksLikeDate(s) {
    return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s);
  }

  function inferType(values) {
    let num = 0, date = 0, total = 0;
    for (const v of values) {
      if (isMissing(v)) continue;
      total++;
      if (toNumber(v) !== null) num++;
      else if (typeof v === 'string' && looksLikeDate(v)) date++;
    }
    if (total === 0) return 'string';
    if (num === total) return 'number';
    if (num + date === total && date > 0) return 'date';
    return 'string';
  }

  /* ------------------------------ CSV / JSON 解析 ------------------------------ */
  function detectDelimiter(text) {
    const head = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
    const cands = [',', '\t', ';', '|'];
    let best = ',', bestScore = -1;
    for (const d of cands) {
      const counts = head.map((l) => l.split(d).length);
      const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
      const same = counts.every((c) => c === counts[0]);
      const score = (same ? 2 : 0) + avg;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  function parseCSV(text, delimiter) {
    const d = delimiter || detectDelimiter(text);
    const rows = [];
    let row = [], cur = '', i = 0, inQuotes = false;
    const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    while (i < src.length) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cur += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cur += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === d) { row.push(cur); cur = ''; i++; continue; }
      if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; i++; continue; }
      cur += ch; i++;
    }
    row.push(cur);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  }

  function uniqNames(names) {
    const seen = {}, out = [];
    for (let i = 0; i < names.length; i++) {
      let n = (names[i] === undefined || names[i] === null || String(names[i]).trim() === '')
        ? 'col_' + (i + 1) : String(names[i]).trim();
      if (seen[n] !== undefined) {
        seen[n]++;
        n = n + '_' + seen[n];
      } else seen[n] = 0;
      out.push(n);
    }
    return out;
  }

  let ID_SEQ = 1;
  const nextId = () => ID_SEQ++;

  /* ------------------------------ DataFrame ------------------------------ */
  class DataFrame {
    constructor(rows, columns, meta) {
      this.rows = rows || [];
      this.columns = columns || [];
      this.meta = meta || {};
    }

    /* ---- 构造 ---- */
    static fromMatrix(matrix, meta) {
      if (!matrix.length) return new DataFrame([], [], meta);
      const header = uniqNames(matrix[0].map((h) => String(h)));
      const body = matrix.slice(1);
      const columns = header.map((name, i) => ({
        key: name,                 // 导入数据：key == 显示名
        name,
        type: inferType(body.map((r) => r[i])),
      }));
      const rows = body.map((r) => {
        const o = { _id: nextId() };
        header.forEach((h, i) => { o[h] = castCell(r[i], columns[i].type); });
        return o;
      });
      return new DataFrame(rows, columns, meta);
    }

    /**
     * 由「列定义 + 行数组」构造（内置数据集用）
     * cols: [{ key, name }]  —— key 稳定不随语言变化，name 是当前语言的显示名
     * rows: [[v1, v2, ...], ...]
     */
    static fromColumns(cols, rows, meta) {
      const columns = cols.map((c, i) => ({
        key: c.key,
        name: c.name,
        type: inferType((rows || []).map((r) => r[i])),
      }));
      const body = (rows || []).map((r) => {
        const o = { _id: nextId() };
        columns.forEach((c, i) => { o[c.key] = castCell(r[i], c.type); });
        return o;
      });
      return new DataFrame(body, columns, meta);
    }

    static fromCSV(text, meta) {
      const m = parseCSV(text);
      if (m.length < 2) throw new Error('数据至少需要 2 行（表头 + 数据）');
      return DataFrame.fromMatrix(m, meta);
    }

    static fromJSON(text, meta) {
      let data = JSON.parse(text);
      if (!Array.isArray(data)) data = data.data || [data];
      if (!data.length) throw new Error('JSON 数据为空');
      const keys = [];
      data.forEach((r) => Object.keys(r).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
      const matrix = [keys].concat(data.map((r) => keys.map((k) => (r[k] === null || r[k] === undefined ? '' : r[k]))));
      return DataFrame.fromMatrix(matrix, meta);
    }

    static auto(text, meta) {
      const t = text.trim();
      if (t.startsWith('[') || t.startsWith('{')) return DataFrame.fromJSON(t, meta);
      return DataFrame.fromCSV(t, meta);
    }

    /* ---- 基本属性（列用 key 寻址；name 仅用于显示） ---- */
    get shape() { return [this.rows.length, this.columns.length]; }
    get length() { return this.rows.length; }
    keys() { return this.columns.map((c) => c.key); }
    names() { return this.columns.map((c) => c.name); }
    column(key) { return this.columns.find((c) => c.key === key); }
    nameOf(key) { const c = this.column(key); return c ? c.name : key; }
    keyOf(name) { const c = this.columns.find((x) => x.name === name); return c ? c.key : name; }
    typeOf(key) { const c = this.column(key); return c ? c.type : 'string'; }
    numericColumns() { return this.columns.filter((c) => c.type === 'number').map((c) => c.key); }
    textColumns() { return this.columns.filter((c) => c.type !== 'number').map((c) => c.key); }
    has(key) { return this.columns.some((c) => c.key === key); }

    clone() {
      return new DataFrame(
        this.rows.map((r) => Object.assign({}, r)),
        this.columns.map((c) => Object.assign({}, c)),
        Object.assign({}, this.meta)
      );
    }

    head(n) { return new DataFrame(this.rows.slice(0, n), this.columns.map((c) => Object.assign({}, c)), this.meta); }
    tail(n) { return new DataFrame(this.rows.slice(-n), this.columns.map((c) => Object.assign({}, c)), this.meta); }

    /** 值序列（跳过缺失） */
    values(key) {
      const out = [];
      for (const r of this.rows) { const v = r[key]; if (!isMissing(v)) out.push(typeof v === 'number' ? v : toNumber(v)); }
      return out.filter((v) => v !== null);
    }

    rawValues(key) { return this.rows.map((r) => r[key]); }

    missingCount(key) {
      let n = 0;
      for (const r of this.rows) if (isMissing(r[key])) n++;
      return n;
    }

    totalMissing() { return this.columns.reduce((a, c) => a + this.missingCount(c.key), 0); }

    /** 全表缺失单元格比例 */
    cellCount() { return this.rows.length * this.columns.length; }

    uniqueValues(key) {
      const s = new Set();
      for (const r of this.rows) if (!isMissing(r[key])) s.add(String(r[key]));
      return Array.from(s);
    }

    valueCounts(key, limit) {
      const m = new Map();
      for (const r of this.rows) {
        const k = isMissing(r[key]) ? '(缺失)' : String(r[key]);
        m.set(k, (m.get(k) || 0) + 1);
      }
      const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      return limit ? arr.slice(0, limit) : arr;
    }

    /** 缺失值序列（用于 ffill / bfill / 插值） */
    isMissingAt(i, key) { return isMissing(this.rows[i] && this.rows[i][key]); }

    toCSV() {
      const esc = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const cols = this.columns;
      const lines = [cols.map((c) => esc(c.name)).join(',')];
      for (const r of this.rows) lines.push(cols.map((c) => esc(r[c.key])).join(','));
      return lines.join('\n');
    }

    /** 相关性矩阵（数值列两两皮尔逊相关） */
    corrMatrix() {
      const cols = this.numericColumns();
      const m = cols.map(() => cols.map(() => 0));
      for (let i = 0; i < cols.length; i++) {
        for (let j = 0; j < cols.length; j++) {
          if (i === j) { m[i][j] = 1; continue; }
          if (j < i) { m[i][j] = m[j][i]; continue; }
          m[i][j] = Stats.corr(this.values(cols[i]), this.values(cols[j]));
        }
      }
      return { cols, matrix: m };
    }
  }

  function castCell(v, type) {
    if (isMissing(v)) return null;
    if (type === 'number') { const n = toNumber(v); return n === null ? String(v) : n; }
    return typeof v === 'string' ? v : String(v);
  }

  /* ------------------------------ 统计 ------------------------------ */
  const Stats = {
    mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; },
    median(a) {
      if (!a.length) return 0;
      const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    },
    std(a) {
      if (a.length < 2) return 0;
      const mu = Stats.mean(a);
      return Math.sqrt(a.reduce((s, v) => s + (v - mu) * (v - mu), 0) / (a.length - 1));
    },
    quantile(a, q) {
      if (!a.length) return 0;
      const s = a.slice().sort((x, y) => x - y);
      const pos = (s.length - 1) * q;
      const lo = Math.floor(pos), hi = Math.ceil(pos);
      return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
    },
    sum(a) { return a.reduce((x, y) => x + y, 0); },
    min(a) { return a.length ? Math.min.apply(null, a) : 0; },
    max(a) { return a.length ? Math.max.apply(null, a) : 0; },
    corr(x, y) {
      const n = Math.min(x.length, y.length);
      if (n < 2) return 0;
      const mx = Stats.mean(x.slice(0, n)), my = Stats.mean(y.slice(0, n));
      let sn = 0, dx = 0, dy = 0;
      for (let i = 0; i < n; i++) {
        const a = x[i] - mx, b = y[i] - my;
        sn += a * b; dx += a * a; dy += b * b;
      }
      return dx && dy ? sn / Math.sqrt(dx * dy) : 0;
    },
  };

  /** 单列统计摘要 */
  function columnStats(df, col) {
    const vals = df.values(col);
    return {
      col,
      type: df.typeOf(col),
      count: vals.length,
      missing: df.missingCount(col),
      unique: df.uniqueValues(col).length,
      mean: vals.length ? Stats.mean(vals) : null,
      median: vals.length ? Stats.median(vals) : null,
      std: vals.length ? Stats.std(vals) : null,
      min: vals.length ? Stats.min(vals) : null,
      max: vals.length ? Stats.max(vals) : null,
      q1: vals.length ? Stats.quantile(vals, 0.25) : null,
      q3: vals.length ? Stats.quantile(vals, 0.75) : null,
      sum: vals.length ? Stats.sum(vals) : null,
    };
  }

  /** pandas.describe() 风格：数值列统计表 */
  function describe(df) {
    const cols = df.numericColumns();
    if (!cols.length) return null;
    const stats = cols.map((c) => columnStats(df, c));
    const rows = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map((k) => {
      const o = { stat: k };
      stats.forEach((s) => {
        if (k === 'count') o[s.col] = s.count;
        else if (k === 'mean') o[s.col] = s.mean;
        else if (k === 'std') o[s.col] = s.std;
        else if (k === 'min') o[s.col] = s.min;
        else if (k === '25%') o[s.col] = s.q1;
        else if (k === '50%') o[s.col] = s.median;
        else if (k === '75%') o[s.col] = s.q3;
        else o[s.col] = s.max;
      });
      return o;
    });
    return { columns: cols, rows };
  }

  global.DF = {
    DataFrame, Stats, isMissing, toNumber, parseCSV, detectDelimiter,
    columnStats, describe, nextId, inferType,
  };
})(window);
