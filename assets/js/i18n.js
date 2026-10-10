/* =============================================================
   i18n.js · 中英双语词典与运行时切换
   - t(key, args)       取字符串（{name} 占位符替换）
   - say(key, args)     取 { title, sub }（解说条）
   - lang / set(lang)   切换语言并回调刷新
   ============================================================= */
(function (global) {
  'use strict';

  const DICT = {
    /* ============================ 通用 ============================ */
    zh: {
      'lang.name': '中文', 'lang.other': 'English',
      'theme.light': '浅色', 'theme.dark': '深色',

      'c.row': '行', 'c.col': '列', 'c.rows': '行', 'c.cols': '列',
      'c.value': '值', 'c.total': '合计', 'c.and': '与', 'c.yes': '是', 'c.no': '否',
      'c.avg': '均值', 'c.count': '计数', 'c.sum': '求和', 'c.max': '最大值', 'c.min': '最小值',
      'c.median': '中位数', 'c.std': '标准差', 'c.none': '无', 'c.other': '其他',
      'c.asc': '升序', 'c.desc': '降序', 'c.stat': '统计', 'c.or': '或',

      /* 顶栏 / 面板 */
      'app.title': 'DataFlow Lab',
      'app.subtitle': '可视化数据分析实验室 · 让每一步处理都看得见',
      'app.dataset': '数据集',
      'app.import': '导入数据', 'app.export': '导出', 'app.demo': '自动演示',
      'app.help': '使用说明', 'app.lang': '语言', 'app.theme': '主题',

      'panel.source': '数据源',
      'panel.sourceTip': '选择一个内置数据集，或导入自己的 CSV / JSON 数据。',
      'panel.library': '操作库', 'panel.libraryTip': '点击加入流水线',
      'panel.pipeline': '分析流水线',
      'panel.overview': '数据概览',
      'panel.chart': '图表',
      'panel.describe': '描述统计',
      'panel.code': '等价 pandas 代码', 'panel.copy': '复制',
      'panel.diff': '本步变化',

      'btn.runAll': '运行全部', 'btn.stepOnce': '只跑下一步', 'btn.clear': '清空步骤',
      'btn.paste': '粘贴数据', 'btn.reset': '重置数据',
      'btn.parse': '解析并载入', 'btn.cancel': '取消',
      'btn.speed': '速度', 'btn.instant': '只看结果',

      'ui.totalRows': '总行数', 'ui.cols': '列数', 'ui.numCols': '数值列', 'ui.missing': '缺失单元格',
      'ui.rows': '行数', 'ui.colCount': '列数', 'ui.missingVal': '缺失值',
      'ui.stageRaw': '原始', 'ui.stageStep': '第 {n} 步',
      'ui.shape': '{r} 行 × {c} 列',
      'ui.sourceNode': '原始数据',
      'ui.stepOf': '步骤 {n}',
      'ui.diffHint': '当前展示的是原始数据，运行步骤后可查看每一步的变化量。',
      'ui.codeHint': '# 流水线为空',
      'ui.descHint': '运行「统计摘要」或任意步骤后查看。',
      'ui.noNumeric': '当前数据没有数值列。',
      'ui.renderLimit': '为保证动画流畅，仅渲染前 {n} 行（共 {t} 行），统计与计算仍基于全量数据。',
      'ui.missingCell': '缺失值',
      'ui.typeNum': 'num', 'ui.typeStr': 'str',
      'ui.notExist': '（不存在）',
      'ui.up': '上移', 'ui.down': '下移', 'ui.del': '删除',
      'ui.badgeReady': '就绪', 'ui.badgeRun': '运行', 'ui.badgeDone': '完成',
      'ui.badgeDel': '删除', 'ui.badgeCore': '核心', 'ui.badgeAgg': '聚合',
      'ui.badgeTrans': '变换', 'ui.badgeSkip': '跳过', 'ui.badgeRaw': '原始',
      'ui.badgeStep': '第 {n} 步',

      'hud.probe': '🔎 扫描探针',
      'hud.progress': '扫描进度',
      'hud.min': '当前最小', 'hud.max': '当前最大', 'hud.cur': '当前值',
      'hud.hit': '命中', 'hud.out': '剔除', 'hud.curRow': '当前行',
      'hud.found': '已发现缺失', 'hud.col': '当前列', 'hud.mark': '标记',
      'hud.read': '已读取',
      'hud.dash': '–',

      'chart.auto': '自动', 'chart.hist': '直方图', 'chart.line': '折线图',
      'chart.scatter': '散点图', 'chart.bar': '条形图', 'chart.box': '箱线图',
      'chart.pie': '饼图', 'chart.corr': '相关性热力图',
      'chart.x': 'X 轴', 'chart.y': 'Y 轴', 'chart.col': '字段',
      'chart.freq': '频数', 'chart.meanLine': '均值',
      'chart.corrTip': '数值列之间的皮尔逊相关系数（越接近 1 越正相关）',
      'chart.noData': '暂无可绘制的数据',
      'chart.boxTip': '箱体为四分位区间，圆点为异常值',
      'chart.pieTip': '占比前 {n} 类，其余合并为「其他」',

      'msg.paused': '已暂停',
      'msg.cleared': '已清空流水线步骤',
      'msg.copied': '代码已复制', 'msg.copyFail': '复制失败',
      'msg.demoStart': '自动演示开始：观察每一步的处理逻辑',
      'msg.emptyPipe': '流水线为空：先从左侧操作库添加步骤，或点击「自动演示」',
      'msg.addStep': '已加入「{name}」：点 ▶ 单步观看，或「运行全部」从头演示',
      'msg.stepError': '该步骤无法执行：{err}',
      'msg.stepErrorSub': '请调整参数或前置步骤',
      'msg.loaded': '数据已载入',
      'msg.loadedSub': '数据集已替换，流水线已重置',
      'msg.instantOn': '已跳过过程动画，直接给出结果',
      'msg.skipSub': '已跳过过程动画，直接给出结果',
      'msg.langSwitched': '已切换为中文',
      'msg.themeSwitched': '已切换为{theme}主题',
      'msg.noLookup': '当前数据集没有内置关联表，「合并」暂不可用',
      'msg.noExtra': '当前数据集没有内置补充表，「纵向拼接」暂不可用',

      /* 分类 */
      'cat.observe': '观察', 'cat.shape': '整理', 'cat.clean': '清洗',
      'cat.transform': '变换', 'cat.analyze': '分析', 'cat.combine': '合并',

      /* 通用参数名 */
      'p.col': '列', 'p.cols': '列（可多选）', 'p.how': '方式', 'p.n': '数量',
      'p.name': '新列名', 'p.to': '目标', 'p.by': '分组列', 'p.value': '值',
      'p.mode': '模式', 'p.asc': '顺序', 'p.strategy': '策略', 'p.keep': '保留',
      'p.key': '关联键', 'p.index': '行标签', 'p.columns': '列维度', 'p.window': '窗口大小',

      'opt.head': '前 N 行', 'opt.tail': '后 N 行', 'opt.sample': '随机抽样',
      'opt.mean': '均值', 'opt.median': '中位数', 'opt.zero': '常数 0',
      'opt.ffill': '前向填充', 'opt.bfill': '后向填充', 'opt.interp': '线性插值',
      'opt.extreme': '去最大最小', 'opt.iqr': 'IQR 异常值', 'opt.clip': '分位裁剪',
      'opt.first': '保留首个', 'opt.last': '保留末个',
      'opt.fillna': '填充', 'opt.dropna': '删除整行',
      'opt.contains': '包含', 'opt.isna': '为空', 'opt.notna': '不为空',
      'opt.minmax': '归一化 (0~1)', 'opt.zscore': '标准化 (Z)',
      'opt.sum': '求和', 'opt.count': '计数', 'opt.max': '最大值', 'opt.min': '最小值',
      'opt.multi': '两列运算',
      'opt.upper': '转大写', 'opt.lower': '转小写', 'opt.trim': '去空格',
      'opt.digits': '提取数字', 'opt.len': '字符串长度',
      'opt.year': '年份', 'opt.month': '月份', 'opt.day': '日',
      'opt.weekday': '星期', 'opt.quarter': '季度',
      'opt.cumsum': '累计求和', 'opt.diff': '一阶差分', 'opt.pct': '环比变化率',
      'opt.roll': '移动平均',
      'opt.rank': '排名', 'opt.top': '前 N 名',
      'opt.constant': '常数列', 'opt.empty': '空列',
      'opt.number': '数值', 'opt.text': '文本', 'opt.date': '日期',
      'opt.asc': '升序', 'opt.desc': '降序',

      'help.t1': '<b>选数据</b>：左上角切换内置数据集，或「导入数据 / 粘贴数据」载入自己的文件。',
      'help.t2': '<b>搭流水线</b>：在左侧「操作库」点击操作，加入中间流水线；在步骤卡片里设置参数。',
      'help.t3': '<b>看过程</b>：点击「运行全部」，表格会以动画演示扫描 → 比较 → 标记 → 删除 → 结果的完整逻辑。',
      'help.t4': '<b>控节奏</b>：底部播放条可播放 / 暂停 / 单步 / 跳转，速度 0.5×–4×，也可勾选「只看结果」。',
      'help.t5': '<b>读结果</b>：右侧同步更新数据概览、图表（7 种可切换）、描述统计与等价 pandas 代码。',
      'help.kbd': '快捷键：', 'help.materials': '配套材料：',
      'paste.tip': '支持 CSV / TSV / JSON（数组对象）格式，首行作为列名。',
      'paste.ph': '姓名,语文,数学\n张三,88,92\n李四,75,80',
      'paste.title': '粘贴数据',
      'help.title': '使用说明',
      'doc.video': '演示视频', 'doc.highlight': '亮点说明文档', 'doc.script': '视频讲解稿', 'doc.readme': 'README',

      'colname.total': '总分', 'colname.avg': '平均分', 'colname.rank': '排名',
      'colname.norm': '{col}_norm', 'colname.z': '{col}_z', 'colname.log': '{col}_log',
      'colname.sqrt': '{col}_sqrt', 'colname.abs': '{col}_abs', 'colname.round': '{col}_r',
      'colname.sq': '{col}_sq', 'colname.cum': '{col}_累计', 'colname.diff': '{col}_差分',
      'colname.pct': '{col}_环比', 'colname.roll': '{col}_均值{n}',
      'colname.var': '变量', 'colname.val': '值',
      'colname.value': '数值', 'colname.percent': '占比', 'colname.freq': '频数',
      'colname.len': '{col}_长度', 'colname.digit': '{col}_数字',
      'colname.count': '计数', 'colname.avg2': '{col}均值',
      'colname.sum': '{col}求和', 'colname.max': '{col}最大值',
      'colname.min': '{col}最小值', 'colname.median': '{col}中位数',
    },

    /* ============================ English ============================ */
    en: {
      'lang.name': 'English', 'lang.other': '中文',
      'theme.light': 'Light', 'theme.dark': 'Dark',

      'c.row': 'row', 'c.col': 'col', 'c.rows': 'rows', 'c.cols': 'cols',
      'c.value': 'value', 'c.total': 'total', 'c.and': 'and', 'c.yes': 'Yes', 'c.no': 'No',
      'c.avg': 'mean', 'c.count': 'count', 'c.sum': 'sum', 'c.max': 'max', 'c.min': 'min',
      'c.median': 'median', 'c.std': 'std', 'c.none': 'none', 'c.other': 'Other',
      'c.asc': 'ascending', 'c.desc': 'descending', 'c.stat': 'stat', 'c.or': 'or',

      'app.title': 'DataFlow Lab',
      'app.subtitle': 'Visual Data Analysis Lab · see every step of the pipeline',
      'app.dataset': 'Dataset',
      'app.import': 'Import', 'app.export': 'Export', 'app.demo': 'Auto Demo',
      'app.help': 'Help', 'app.lang': 'Language', 'app.theme': 'Theme',

      'panel.source': 'Data Source',
      'panel.sourceTip': 'Pick a built-in dataset, or import your own CSV / JSON file.',
      'panel.library': 'Operations', 'panel.libraryTip': 'Click to add to the pipeline',
      'panel.pipeline': 'Analysis Pipeline',
      'panel.overview': 'Overview',
      'panel.chart': 'Chart',
      'panel.describe': 'Descriptive Statistics',
      'panel.code': 'Equivalent pandas code', 'panel.copy': 'Copy',
      'panel.diff': 'Change in this step',

      'btn.runAll': 'Run all', 'btn.stepOnce': 'Run next', 'btn.clear': 'Clear steps',
      'btn.paste': 'Paste data', 'btn.reset': 'Reset data',
      'btn.parse': 'Parse & load', 'btn.cancel': 'Cancel',
      'btn.speed': 'Speed', 'btn.instant': 'Result only',

      'ui.totalRows': 'Rows', 'ui.cols': 'Columns', 'ui.numCols': 'Numeric', 'ui.missing': 'Missing cells',
      'ui.rows': 'Rows', 'ui.colCount': 'Columns', 'ui.missingVal': 'Missing',
      'ui.stageRaw': 'raw', 'ui.stageStep': 'step {n}',
      'ui.shape': '{r} rows × {c} cols',
      'ui.sourceNode': 'Raw data',
      'ui.stepOf': 'step {n}',
      'ui.diffHint': 'Showing the raw data. Run a step to see what changed.',
      'ui.codeHint': '# pipeline is empty',
      'ui.descHint': 'Run "Describe" or any step to see statistics.',
      'ui.noNumeric': 'No numeric column in the current data.',
      'ui.renderLimit': 'Only the first {n} rows are rendered (of {t}) to keep animations smooth; all statistics use the full data.',
      'ui.missingCell': 'missing',
      'ui.typeNum': 'num', 'ui.typeStr': 'str',
      'ui.notExist': ' (missing)',
      'ui.up': 'Move up', 'ui.down': 'Move down', 'ui.del': 'Delete',
      'ui.badgeReady': 'ready', 'ui.badgeRun': 'running', 'ui.badgeDone': 'done',
      'ui.badgeDel': 'drop', 'ui.badgeCore': 'core', 'ui.badgeAgg': 'aggregate',
      'ui.badgeTrans': 'transform', 'ui.badgeSkip': 'skipped', 'ui.badgeRaw': 'raw',
      'ui.badgeStep': 'step {n}',

      'hud.probe': '🔎 Scan probe',
      'hud.progress': 'progress',
      'hud.min': 'current min', 'hud.max': 'current max', 'hud.cur': 'current',
      'hud.hit': 'kept', 'hud.out': 'dropped', 'hud.curRow': 'current row',
      'hud.found': 'missing found', 'hud.col': 'column', 'hud.mark': 'mark',
      'hud.read': 'read',
      'hud.dash': '–',

      'chart.auto': 'Auto', 'chart.hist': 'Histogram', 'chart.line': 'Line',
      'chart.scatter': 'Scatter', 'chart.bar': 'Bar', 'chart.box': 'Box',
      'chart.pie': 'Pie', 'chart.corr': 'Correlation',
      'chart.x': 'X', 'chart.y': 'Y', 'chart.col': 'Field',
      'chart.freq': 'frequency', 'chart.meanLine': 'mean',
      'chart.corrTip': "Pearson correlation between numeric columns (closer to 1 = stronger)",
      'chart.noData': 'Nothing to plot',
      'chart.boxTip': 'Box = interquartile range, dots = outliers',
      'chart.pieTip': 'Top {n} categories, the rest merged into "Other"',

      'msg.paused': 'Paused',
      'msg.cleared': 'Pipeline steps cleared',
      'msg.copied': 'Code copied', 'msg.copyFail': 'Copy failed',
      'msg.demoStart': 'Auto demo started: watch how each step works',
      'msg.emptyPipe': 'Pipeline is empty: add a step from the library, or click "Auto Demo"',
      'msg.addStep': 'Added "{name}": press ▶ to run just this step, or "Run all"',
      'msg.stepError': 'Cannot run this step: {err}',
      'msg.stepErrorSub': 'Adjust the parameters or previous steps',
      'msg.loaded': 'Data loaded',
      'msg.loadedSub': 'Dataset replaced, pipeline reset',
      'msg.instantOn': 'Animation skipped, showing the result',
      'msg.skipSub': 'Animation skipped, showing the result',
      'msg.langSwitched': 'Switched to English',
      'msg.themeSwitched': 'Switched to {theme} theme',
      'msg.noLookup': 'This dataset has no built-in lookup table, so "Merge" is unavailable',
      'msg.noExtra': 'This dataset has no built-in extra table, so "Concat" is unavailable',

      'cat.observe': 'Inspect', 'cat.shape': 'Reshape', 'cat.clean': 'Clean',
      'cat.transform': 'Transform', 'cat.analyze': 'Analyze', 'cat.combine': 'Combine',

      'p.col': 'Column', 'p.cols': 'Columns', 'p.how': 'Method', 'p.n': 'Count',
      'p.name': 'New column', 'p.to': 'Target', 'p.by': 'Group by', 'p.value': 'Value',
      'p.mode': 'Mode', 'p.asc': 'Order', 'p.strategy': 'Strategy', 'p.keep': 'Keep',
      'p.key': 'Join key', 'p.index': 'Index', 'p.columns': 'Columns dim', 'p.window': 'Window',

      'opt.head': 'First N', 'opt.tail': 'Last N', 'opt.sample': 'Random sample',
      'opt.mean': 'mean', 'opt.median': 'median', 'opt.zero': 'constant 0',
      'opt.ffill': 'forward fill', 'opt.bfill': 'backward fill', 'opt.interp': 'interpolate',
      'opt.extreme': 'drop min & max', 'opt.iqr': 'IQR outliers', 'opt.clip': 'clip to quantile',
      'opt.first': 'keep first', 'opt.last': 'keep last',
      'opt.fillna': 'fill', 'opt.dropna': 'drop rows',
      'opt.contains': 'contains', 'opt.isna': 'is null', 'opt.notna': 'not null',
      'opt.minmax': 'min-max (0~1)', 'opt.zscore': 'z-score',
      'opt.sum': 'sum', 'opt.count': 'count', 'opt.max': 'max', 'opt.min': 'min',
      'opt.multi': 'two-column math',
      'opt.upper': 'upper case', 'opt.lower': 'lower case', 'opt.trim': 'trim spaces',
      'opt.digits': 'extract digits', 'opt.len': 'string length',
      'opt.year': 'year', 'opt.month': 'month', 'opt.day': 'day',
      'opt.weekday': 'weekday', 'opt.quarter': 'quarter',
      'opt.cumsum': 'cumulative sum', 'opt.diff': 'difference', 'opt.pct': 'pct change',
      'opt.roll': 'moving average',
      'opt.rank': 'rank', 'opt.top': 'top N',
      'opt.constant': 'constant', 'opt.empty': 'empty',
      'opt.number': 'number', 'opt.text': 'text', 'opt.date': 'date',
      'opt.asc': 'ascending', 'opt.desc': 'descending',

      'help.t1': '<b>Pick data</b>: switch the built-in dataset at the top-left, or import / paste your own file.',
      'help.t2': '<b>Build a pipeline</b>: click an operation in the left library to append it, then tune its parameters.',
      'help.t3': '<b>Watch the process</b>: press "Run all" — the table animates scan → compare → mark → drop → result.',
      'help.t4': '<b>Control the pace</b>: play / pause / step / jump, speed 0.5×–4×, or tick "Result only".',
      'help.t5': '<b>Read the result</b>: the right side updates overview, chart (7 types), statistics and pandas code live.',
      'help.kbd': 'Shortcuts: ', 'help.materials': 'Materials: ',
      'paste.tip': 'CSV / TSV / JSON (array of objects) supported; the first line is the header.',
      'paste.ph': 'name,chinese,math\nAlice,88,92\nBob,75,80',
      'paste.title': 'Paste data',
      'help.title': 'How to use',
      'doc.video': 'demo video', 'doc.highlight': 'highlights', 'doc.script': 'video script', 'doc.readme': 'README',

      'colname.total': 'total', 'colname.avg': 'avg', 'colname.rank': 'rank',
      'colname.norm': '{col}_norm', 'colname.z': '{col}_z', 'colname.log': '{col}_log',
      'colname.sqrt': '{col}_sqrt', 'colname.abs': '{col}_abs', 'colname.round': '{col}_r',
      'colname.sq': '{col}_sq', 'colname.cum': '{col}_cum', 'colname.diff': '{col}_diff',
      'colname.pct': '{col}_pct', 'colname.roll': '{col}_ma{n}',
      'colname.var': 'variable', 'colname.val': 'value',
      'colname.value': 'value', 'colname.percent': 'share', 'colname.freq': 'count',
      'colname.len': '{col}_len', 'colname.digit': '{col}_digits',
      'colname.count': 'count', 'colname.avg2': '{col}_mean',
      'colname.sum': '{col}_sum', 'colname.max': '{col}_max',
      'colname.min': '{col}_min', 'colname.median': '{col}_median',
    },
  };

  /* ---------------- 运行时 ---------------- */
  const state = { lang: 'zh', listeners: [] };

  function lookup(lang, key) {
    const d = DICT[lang];
    return d && d[key] !== undefined ? d[key] : undefined;
  }

  function fill(s, args) {
    if (typeof s !== 'string') return s === undefined || s === null ? '' : String(s);
    if (args) {
      Object.keys(args).forEach((k) => {
        s = s.split('{' + k + '}').join(args[k] === null || args[k] === undefined ? '' : args[k]);
      });
    }
    return s;
  }

  function raw(key) {
    let s = lookup(state.lang, key);
    if (s === undefined) s = lookup('zh', key);
    return s;
  }

  function t(key, args) {
    const s = raw(key);
    if (s === undefined) return key;
    if (typeof s === 'object' && s) return fill(s.t || '', args);
    return fill(s, args);
  }

  /** 解说条目：dict 里放 { t: 标题, s: 副标题 } */
  function say(key, args) {
    const s = raw(key);
    if (s && typeof s === 'object') return { title: fill(s.t || '', args), sub: fill(s.s || '', args) };
    return { title: s === undefined ? key : fill(s, args), sub: '' };
  }

  function set(lang) {
    if (!DICT[lang] || lang === state.lang) return;
    state.lang = lang;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    state.listeners.forEach((f) => { try { f(lang); } catch (e) { console.error(e); } });
  }

  global.I18n = {
    t, say, set,
    get lang() { return state.lang; },
    onChange(f) { state.listeners.push(f); },
    dict: DICT,
    /** 操作参数标签：优先 op.<id>.p.<key>，退回 p.<key> */
    pl(opId, key) {
      const k1 = 'op.' + opId + '.p.' + key;
      if (lookup(state.lang, k1) !== undefined) return t(k1);
      return t('p.' + key);
    },
    /** 选项标签：优先 op.<id>.opt.<v>，退回 opt.<v> */
    opt(opId, v) {
      const k1 = 'op.' + opId + '.opt.' + v;
      if (lookup(state.lang, k1) !== undefined) return t(k1);
      const k2 = 'opt.' + v;
      return lookup(state.lang, k2) !== undefined ? t(k2) : String(v);
    },
  };
})(window);
