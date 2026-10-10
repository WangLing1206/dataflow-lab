/* =============================================================
   i18n-ext.js · 操作 / 解说 / 数据集词条（与 i18n.js 合并）
   ============================================================= */
(function (global) {
  'use strict';
  const D = global.I18n.dict;

  /* ---------------- 中文 ---------------- */
  Object.assign(D.zh, {
    /* --- 数据集 --- */
    'ds.students.name': '学生成绩', 'ds.students.desc': '30 名学生的语文 / 数学 / 英语成绩与出勤率，含缺失值与重复行。',
    'ds.sales.name': '门店销售', 'ds.sales.desc': '36 条门店销售记录，含异常销量，可按区域 / 品类聚合。',
    'ds.scoring.name': '比赛评分', 'ds.scoring.desc': '12 条评委打分记录，适合演示「去掉一个最高分、一个最低分」。',
    'ds.iris.name': '鸢尾花 iris', 'ds.iris.desc': '60 条鸢尾花测量数据，3 个品种，适合演示归一化与分组统计。',

    /* --- 查看 --- */
    'op.view.name': '查看数据', 'op.view.desc': 'df.head / tail / sample',
    'op.view.summary': '查看{how} {n} 行',
    'say.view.start': { t: '预览数据：查看{how} {n} 行', s: '逐行掠过，并报出当前数据的形状与列类型' },
    'say.view.done': { t: '预览完成：{r} 行 × {c} 列', s: '查看只是观察，不会修改数据；后续步骤从这一步的结果继续' },

    'op.describe.name': '统计摘要', 'op.describe.desc': 'df.describe()',
    'op.describe.summary': '统计摘要（{k} 个数值列）',
    'say.describe.start': { t: '开始统计摘要：共 {k} 个数值列', s: '逐列累计 count / mean / std / 分位数' },
    'say.describe.col': { t: '「{col}」：均值 {mean}，标准差 {std}', s: '范围 {min} ~ {max}，缺失 {miss} 个' },
    'say.describe.done': { t: '摘要完成：{k} 个数值列已统计', s: '右侧「描述统计」面板即为 df.describe() 的结果' },

    /* --- 整理 --- */
    'op.select.name': '选择列', 'op.select.desc': 'df[[cols]] 保留指定列',
    'op.select.summary': '保留 {k} 列',
    'say.select.start': { t: '选择列：保留 {k} 列', s: '未选中的列会先变暗，再淡出消失' },
    'say.select.done': { t: '保留 {k} 列，其余 {d} 列已移除', s: '等价于 df = df[[...]]' },

    'op.dropcol.name': '删除列', 'op.dropcol.desc': 'df.drop(columns=...)',
    'op.dropcol.summary': '删除 {k} 列',
    'say.dropcol.start': { t: '删除 {k} 列', s: '被删除的列先变暗，再整列淡出' },
    'say.dropcol.done': { t: '已删除 {k} 列，剩余 {r} 列', s: '等价于 df.drop(columns=[...])' },

    'op.rename.name': '重命名列', 'op.rename.desc': 'df.rename(columns=...)',
    'op.rename.summary': '「{from}」→「{to}」',
    'say.rename.start': { t: '重命名列：「{from}」→「{to}」', s: '表头会 3D 翻转一次，数据本身不变' },
    'say.rename.done': { t: '列名已更新为「{to}」', s: '等价于 df.rename(columns={...})' },

    'op.filter.name': '条件筛选', 'op.filter.desc': 'df[df[col] op value]',
    'op.filter.summary': '{col} {op} {v}',
    'say.filter.start': { t: '逐行比较：{col} {op} {v}', s: '命中的行变绿保留，未命中的行变红剔除' },
    'say.filter.done': { t: '命中 {k} 行，剔除 {d} 行', s: '每行都参与一次比较，这就是布尔索引的内部过程' },

    'op.sort.name': '排序', 'op.sort.desc': 'df.sort_values(...)',
    'op.sort.summary': '按 {col} {asc}',
    'say.sort.start': { t: '读取排序键：{col}（{asc}）', s: '先扫描每一行的排序值，再重排整张表' },
    'say.sort.flip': { t: '重排 {n} 行', s: '使用 FLIP 动画：每行从旧位置平滑滑到新位置' },
    'say.sort.done': { t: '排序完成：{col} 从 {min} 到 {max}', s: '等价于 df.sort_values(...)' },

    'op.sample.name': '随机采样', 'op.sample.desc': 'df.sample(n, random_state)',
    'op.sample.summary': '随机抽 {n} 行（seed {seed}）',
    'say.sample.start': { t: '随机采样 {n} 行（随机种子 {seed}）', s: '抽中的行保留，未抽中的行淡出' },
    'say.sample.done': { t: '采样完成：保留 {k} 行', s: '固定随机种子可以保证结果可复现' },

    'op.astype.name': '类型转换', 'op.astype.desc': 'df.astype(...)',
    'op.astype.summary': '「{col}」→ {to}',
    'say.astype.start': { t: '类型转换：「{col}」→ {to}', s: '逐个单元格转换，无法转换的值会被置为缺失' },
    'say.astype.done': { t: '「{col}」已转为「{to}」类型', s: '等价于 df[col].astype(...)' },

    'op.melt.name': '宽表转长表', 'op.melt.desc': 'df.melt(...)',
    'op.melt.summary': '宽转长：保留 {k} 个标识列',
    'say.melt.start': { t: '宽表转长表：{k} 个值列 → 「变量 / 值」两列', s: '多行会被拆开：每行的每个值列生成一条新记录' },
    'say.melt.done': { t: '转换完成：{r} 行 × {c} 列', s: '等价于 df.melt(id_vars=[...])' },

    /* --- 清洗 --- */
    'op.dedupe.name': '去除重复', 'op.dedupe.desc': 'df.drop_duplicates(...)',
    'op.dedupe.summary': '按 {k} 列去重（{keep}）',
    'say.dedupe.start': { t: '逐行计算指纹：依据 {k} 列', s: '指纹相同的行即为重复行' },
    'say.dedupe.found': { t: '发现 {d} 行重复', s: '重复行会被标黄，按「{keep}」规则保留其中一行' },
    'say.dedupe.done': { t: '去重完成：删除 {d} 行，剩余 {r} 行', s: '等价于 df.drop_duplicates(subset=[...])' },

    'op.missing.name': '缺失值处理', 'op.missing.desc': 'dropna / fillna / interpolate',
    'op.missing.summary': '{strategy}：{cols}',
    'say.missing.start': { t: '扫描缺失值：{cols}', s: '空单元格（⌀）会被逐个标红定位' },
    'say.missing.found': { t: '共发现 {n} 个缺失单元格', s: '接下来按「{strategy}」处理' },
    'say.missing.fill': { t: '用{howname}填充：{v}', s: '数值会滚动着填入空位，你能看到哪一格被填了什么' },
    'say.missing.done': { t: '缺失值处理完成，剩余 {m} 个缺失', s: '缺失值会严重影响均值与模型，清洗是第一步' },

    'op.outlier.name': '去除极值', 'op.outlier.desc': 'nlargest / nsmallest / IQR / clip',
    'op.outlier.summary': '{mode}：{col}',
    'say.outlier.start': { t: '扫描「{col}」：寻找最小值与最大值', s: '右侧探针实时显示「当前最小 / 当前最大」，标记会随扫描移动' },
    'say.outlier.found': { t: '扫描结束：最小 {min}，最大 {max}', s: '蓝色标记停在最小值，红色标记停在最大值' },
    'say.outlier.mark': { t: '标记 {n} 个极值行', s: '这些行将被剔除（评委打分常见的"去掉最高最低分"）' },
    'say.outlier.drop': { t: '开始删除：{n} 行（极值行）', s: '被标记的行依次淡出、收起，其余行自然上移' },
    'say.outlier.iqr': { t: '计算四分位：Q1={q1}，Q3={q3}，IQR={iqr}', s: '正常区间 [{lo}, {hi}]，区间外的行判定为异常' },
    'say.outlier.clip': { t: '分位裁剪：把越界的值拉回 [{lo}, {hi}]', s: '不删除行，只修正数值 —— 越界的数字会平滑滑回边界' },
    'say.outlier.done': { t: '删除 {n} 行，剩余 {r} 行，新区间 {lo} ~ {hi}', s: '极值会严重拉偏均值，这一步让分布更稳健' },

    'op.replace.name': '值替换', 'op.replace.desc': 'df.replace(a, b)',
    'op.replace.summary': '「{col}」：{from} → {to}',
    'say.replace.start': { t: '扫描「{col}」：把「{from}」替换为「{to}」', s: '逐行比对，命中的单元格被改写' },
    'say.replace.done': { t: '共替换 {n} 处', s: '等价于 df[col].replace(a, b)' },

    'op.cleanconst.name': '删除无用列', 'op.cleanconst.desc': '删除常数列 / 空列',
    'op.cleanconst.summary': '删除{what}列',
    'say.cleanconst.start': { t: '检查每一列：找出{what}列', s: '取值只有一个、或整列为空的列会被标记' },
    'say.cleanconst.done': { t: '删除 {k} 列，剩余 {r} 列', s: '常数列不携带信息，属于典型的特征清洗' },

    /* --- 变换 --- */
    'op.assign.name': '新增计算列', 'op.assign.desc': 'df.assign(...) 行内计算',
    'op.assign.summary': '{name} = {how}({cols})',
    'say.assign.start': { t: '新增计算列「{name}」', s: '计算方式：{formula}' },
    'say.assign.add': { t: '插入新列「{name}」', s: '新列从右侧滑入，随后逐行滚动生成结果' },
    'say.assign.done': { t: '「{name}」计算完成：{r} 行已填充', s: '等价于 df.assign(name=...)' },

    'op.normalize.name': '归一化 / 标准化', 'op.normalize.desc': 'min-max / z-score',
    'op.normalize.summary': '{col} → {how}',
    'say.normalize.start': { t: '先扫出「{col}」的{minmax}', s: '归一化需要极值，标准化需要均值与标准差' },
    'say.normalize.stat': { t: '{statname} = {v}', s: '这是这一步的关键统计量' },
    'say.normalize.apply': { t: '逐行套用公式：{formula}', s: '每一行的新值都会滚动过渡到目标值' },
    'say.normalize.done': { t: '「{name}」生成完毕：范围 {lo} ~ {hi}', s: '不同量纲的列放到同一尺度后才可比较' },

    'op.transform.name': '数学变换', 'op.transform.desc': 'log / sqrt / abs / round 等',
    'op.transform.summary': '{how}：{col}',
    'say.transform.start': { t: '对「{col}」做{how}变换', s: '公式：{formula}' },
    'say.transform.done': { t: '生成新列「{name}」', s: '对数 / 开方常用于压缩右偏分布' },

    'op.strcase.name': '文本处理', 'op.strcase.desc': 'str.upper / lower / strip 等',
    'op.strcase.summary': '{how}：{col}',
    'say.strcase.start': { t: '文本处理：对「{col}」做{how}', s: '逐行读取字符串并生成新列' },
    'say.strcase.done': { t: '生成新列「{name}」', s: '等价于 df[col].str.xxx()' },

    'op.datepart.name': '日期特征', 'op.datepart.desc': 'dt.year / month / weekday',
    'op.datepart.summary': '提取「{col}」的{how}',
    'say.datepart.start': { t: '从「{col}」提取{how}', s: '日期拆解成数值特征后才能进入模型' },
    'say.datepart.done': { t: '生成新列「{name}」', s: '等价于 df[col].dt.{how}' },

    'op.rank.name': '排名', 'op.rank.desc': 'df.rank(...)',
    'op.rank.summary': '按 {col} {asc} 排名',
    'say.rank.start': { t: '读取排名键：{col}', s: '先扫描每一行的取值，再排序' },
    'say.rank.sort': { t: '按 {col} {asc} 重排 {n} 行', s: '排名 = 排序后的位置序号' },
    'say.rank.assign': { t: '写入名次 1 ~ {n}', s: '名次从 1 开始，逐行滚动生成' },
    'say.rank.done': { t: '排名完成：第 1 名是 {top}', s: '等价于 df[col].rank(ascending=...)' },

    'op.window.name': '窗口计算', 'op.window.desc': 'cumsum / diff / pct_change / rolling',
    'op.window.summary': '{how}：{col}',
    'say.window.start': { t: '窗口计算：对「{col}」做{how}', s: '公式：{formula}' },
    'say.window.done': { t: '生成新列「{name}」', s: '常用于时间序列的累计与移动平均' },

    /* --- 分析 --- */
    'op.groupby.name': '分组聚合', 'op.groupby.desc': 'df.groupby(...).agg(...)',
    'op.groupby.summary': '按 {by} 聚合 {col}({how})',
    'say.groupby.start': { t: '按「{by}」分组：共 {k} 组', s: '同组的行会先被染成同一个颜色' },
    'say.groupby.group': { t: '染色完成：{k} 组', s: '接下来把同组的行聚拢到一起' },
    'say.groupby.agg': { t: '组「{key}」：{n} 行 → {how} = {v}', s: '组内多行先聚拢，再坍缩成 1 行汇总' },
    'say.groupby.done': { t: '{k} 组已聚合为 {k} 行', s: '等价于 df.groupby(...).agg(...).reset_index()' },

    'op.pivot.name': '透视表', 'op.pivot.desc': 'df.pivot_table(...)',
    'op.pivot.summary': '透视：{index} × {columns}',
    'say.pivot.start': { t: '透视表：行 = {index}，列 = {columns}', s: '先扫描出所有行标签与列标签' },
    'say.pivot.build': { t: '行列交叉：{r} 行 × {c} 列', s: '每个单元格是该交叉组合的{how}值' },
    'say.pivot.done': { t: '透视完成：{r} 行 × {c} 列', s: '等价于 df.pivot_table(...)' },

    'op.valuecount.name': '值计数', 'op.valuecount.desc': 'df.value_counts(...)',
    'op.valuecount.summary': '「{col}」值计数',
    'say.valuecount.start': { t: '统计「{col}」的取值分布', s: '每遇到一个新取值就建立一个计数桶' },
    'say.valuecount.done': { t: '共 {k} 个不同取值，出现最多的是 {top}', s: '等价于 df[col].value_counts()' },

    'op.corr.name': '相关性矩阵', 'op.corr.desc': 'df.corr()',
    'op.corr.summary': '相关性：{k} 个数值列',
    'say.corr.start': { t: '计算 {k} 个数值列的两两相关系数', s: '右侧图表会切换为相关性热力图' },
    'say.corr.done': { t: '最强正相关：{a} 与 {b}（r = {r}）', s: '相关系数越接近 ±1，线性关系越强' },

    /* --- 合并 --- */
    'op.merge.name': '合并关联表', 'op.merge.desc': 'df.merge(right, how=left)',
    'op.merge.summary': '左连接：{key}',
    'say.merge.start': { t: '左连接：按「{key}」关联「{right}」', s: '逐行到关联表里查找匹配的那一行' },
    'say.merge.hit': { t: '「{v}」→ 匹配到 {row}', s: '匹配成功则把关联表的列补到这一行' },
    'say.merge.done': { t: '合并完成：新增 {k} 列', s: '等价于 df.merge(right, on=..., how="left")' },

    'op.concat.name': '纵向拼接', 'op.concat.desc': 'pd.concat([df, df2])',
    'op.concat.summary': '拼接 +{n} 行',
    'say.concat.start': { t: '纵向拼接：追加 {n} 行', s: '新行会从底部滑入，列结构保持一致' },
    'say.concat.done': { t: '拼接完成：{r} 行 × {c} 列', s: '等价于 pd.concat([df, df2], ignore_index=True)' },

    'say.drop.start': { t: '开始删除：{n} 行（{label}）', s: '红色标记的行会依次淡出并收起，剩余行自然上移' },
    'drop.default': '不满足条件', 'drop.extreme': '极值行', 'drop.dup': '重复行',
    'drop.missing': '含缺失的行', 'drop.preview': '不在预览范围内',

    'msg.importFail': '解析失败', 'msg.pasteEmpty': '请先粘贴数据',
    'msg.exported': '已导出 dataflow-result.csv',
    'ui.readyTip': '准备就绪：点击「运行全部」，观察数据一步步被处理',
    'ui.readySub': '每一步都会展示内部的寻找、比较与删除逻辑，而不是直接给出结果。',
    'ui.allDone': '全部 {n} 步执行完毕',
    'ui.allDoneSub': '最终结果：{shape}，可点击「导出」保存处理后的数据',
  });

  /* ---------------- English ---------------- */
  Object.assign(D.en, {
    'ds.students.name': 'Student Scores', 'ds.students.desc': '30 students with Chinese / math / English scores and attendance, including missing values and a duplicate row.',
    'ds.sales.name': 'Store Sales', 'ds.sales.desc': '36 store sales records with an outlier, ready to aggregate by region / category.',
    'ds.scoring.name': 'Competition Scores', 'ds.scoring.desc': '12 judge scoring records — the classic "drop the highest and lowest" case.',
    'ds.iris.name': 'Iris', 'ds.iris.desc': '60 iris measurements across 3 species — good for normalization and group stats.',

    'op.view.name': 'Preview', 'op.view.desc': 'df.head / tail / sample',
    'op.view.summary': '{how} {n} rows',
    'say.view.start': { t: 'Preview: {how} {n} rows', s: 'Rows are highlighted one by one while the shape and dtypes are reported' },
    'say.view.done': { t: 'Preview done: {r} rows × {c} cols', s: 'Previewing never changes the data; later steps continue from here' },

    'op.describe.name': 'Describe', 'op.describe.desc': 'df.describe()',
    'op.describe.summary': 'describe ({k} numeric cols)',
    'say.describe.start': { t: 'Describing {k} numeric columns', s: 'Accumulating count / mean / std / quantiles column by column' },
    'say.describe.col': { t: '"{col}": mean {mean}, std {std}', s: 'range {min} ~ {max}, {miss} missing' },
    'say.describe.done': { t: 'Described {k} numeric columns', s: 'The right-hand "Descriptive statistics" panel is exactly df.describe()' },

    'op.select.name': 'Select columns', 'op.select.desc': 'df[[cols]]',
    'op.select.summary': 'keep {k} columns',
    'say.select.start': { t: 'Selecting {k} columns', s: 'Unselected columns dim out first, then fade away' },
    'say.select.done': { t: 'Kept {k} columns, removed {d}', s: 'Equivalent to df = df[[...]]' },

    'op.dropcol.name': 'Drop columns', 'op.dropcol.desc': 'df.drop(columns=...)',
    'op.dropcol.summary': 'drop {k} columns',
    'say.dropcol.start': { t: 'Dropping {k} columns', s: 'Dropped columns dim out, then fade away as a whole' },
    'say.dropcol.done': { t: 'Dropped {k} columns, {r} left', s: 'Equivalent to df.drop(columns=[...])' },

    'op.rename.name': 'Rename column', 'op.rename.desc': 'df.rename(columns=...)',
    'op.rename.summary': '"{from}" → "{to}"',
    'say.rename.start': { t: 'Renaming "{from}" to "{to}"', s: 'The header flips once; the data itself is untouched' },
    'say.rename.done': { t: 'Column renamed to "{to}"', s: 'Equivalent to df.rename(columns={...})' },

    'op.filter.name': 'Filter rows', 'op.filter.desc': 'df[df[col] op value]',
    'op.filter.summary': '{col} {op} {v}',
    'say.filter.start': { t: 'Comparing every row: {col} {op} {v}', s: 'Matches turn green and stay; non-matches turn red and are dropped' },
    'say.filter.done': { t: '{k} rows matched, {d} dropped', s: 'Every row takes part in one comparison — this is boolean indexing' },

    'op.sort.name': 'Sort values', 'op.sort.desc': 'df.sort_values(...)',
    'op.sort.summary': 'by {col} {asc}',
    'say.sort.start': { t: 'Reading the sort key: {col} ({asc})', s: 'First scan each row\'s key, then reorder the whole table' },
    'say.sort.flip': { t: 'Reordering {n} rows', s: 'FLIP animation: every row slides smoothly from its old position' },
    'say.sort.done': { t: 'Sorted: {col} from {min} to {max}', s: 'Equivalent to df.sort_values(...)' },

    'op.sample.name': 'Random sample', 'op.sample.desc': 'df.sample(n, random_state)',
    'op.sample.summary': 'sample {n} rows (seed {seed})',
    'say.sample.start': { t: 'Sampling {n} rows (seed {seed})', s: 'Sampled rows stay, the rest fade out' },
    'say.sample.done': { t: 'Sampled: {k} rows kept', s: 'A fixed random seed makes the result reproducible' },

    'op.astype.name': 'Cast dtype', 'op.astype.desc': 'df.astype(...)',
    'op.astype.summary': '"{col}" → {to}',
    'say.astype.start': { t: 'Casting "{col}" to {to}', s: 'Each cell is converted; unconvertible values become missing' },
    'say.astype.done': { t: '"{col}" is now of type "{to}"', s: 'Equivalent to df[col].astype(...)' },

    'op.melt.name': 'Wide to long', 'op.melt.desc': 'df.melt(...)',
    'op.melt.summary': 'melt, keeping {k} id columns',
    'say.melt.start': { t: 'Melting {k} value columns into "variable / value"', s: 'Each row is split: every value column becomes one new record' },
    'say.melt.done': { t: 'Melted into {r} rows × {c} cols', s: 'Equivalent to df.melt(id_vars=[...])' },

    'op.dedupe.name': 'Drop duplicates', 'op.dedupe.desc': 'df.drop_duplicates(...)',
    'op.dedupe.summary': 'dedupe on {k} cols ({keep})',
    'say.dedupe.start': { t: 'Computing a fingerprint per row from {k} columns', s: 'Rows with the same fingerprint are duplicates' },
    'say.dedupe.found': { t: 'Found {d} duplicate rows', s: 'Duplicates are marked yellow; "{keep}" decides which one survives' },
    'say.dedupe.done': { t: 'Dropped {d} rows, {r} left', s: 'Equivalent to df.drop_duplicates(subset=[...])' },

    'op.missing.name': 'Handle missing', 'op.missing.desc': 'dropna / fillna / interpolate',
    'op.missing.summary': '{strategy}: {cols}',
    'say.missing.start': { t: 'Scanning for missing values: {cols}', s: 'Empty cells (⌀) are located and marked red one by one' },
    'say.missing.found': { t: 'Found {n} missing cells', s: 'They will be handled with "{strategy}"' },
    'say.missing.fill': { t: 'Filling with {howname}: {v}', s: 'Numbers roll into the empty slots — you see exactly what fills what' },
    'say.missing.done': { t: 'Done, {m} missing cells remain', s: 'Missing values bias means and models, so cleaning comes first' },

    'op.outlier.name': 'Remove outliers', 'op.outlier.desc': 'nlargest / nsmallest / IQR / clip',
    'op.outlier.summary': '{mode}: {col}',
    'say.outlier.start': { t: 'Scanning "{col}" for the minimum and maximum', s: 'The probe shows the current min / max live; markers move as the scan advances' },
    'say.outlier.found': { t: 'Scan finished: min {min}, max {max}', s: 'The blue marker rests on the minimum, the red one on the maximum' },
    'say.outlier.mark': { t: 'Marking {n} extreme rows', s: 'These rows will be dropped (the "drop highest & lowest" rule in judging)' },
    'say.outlier.drop': { t: 'Dropping {n} rows (extremes)', s: 'Marked rows fade out and collapse; the rest move up naturally' },
    'say.outlier.iqr': { t: 'Quartiles: Q1={q1}, Q3={q3}, IQR={iqr}', s: 'Normal range [{lo}, {hi}]; anything outside is an outlier' },
    'say.outlier.clip': { t: 'Clipping out-of-range values into [{lo}, {hi}]', s: 'No rows are dropped — outlying numbers slide back to the boundary' },
    'say.outlier.done': { t: 'Dropped {n} rows, {r} left, new range {lo} ~ {hi}', s: 'Extremes skew the mean; this step makes the distribution robust' },

    'op.replace.name': 'Replace values', 'op.replace.desc': 'df.replace(a, b)',
    'op.replace.summary': '"{col}": {from} → {to}',
    'say.replace.start': { t: 'Scanning "{col}": replacing "{from}" with "{to}"', s: 'Each row is compared; matched cells are rewritten' },
    'say.replace.done': { t: 'Replaced {n} cells', s: 'Equivalent to df[col].replace(a, b)' },

    'op.cleanconst.name': 'Drop useless cols', 'op.cleanconst.desc': 'drop constant / empty columns',
    'op.cleanconst.summary': 'drop {what} columns',
    'say.cleanconst.start': { t: 'Inspecting every column for {what} ones', s: 'Columns with a single value, or all empty, are marked' },
    'say.cleanconst.done': { t: 'Dropped {k} columns, {r} left', s: 'Constant columns carry no information — a classic cleaning step' },

    'op.assign.name': 'Add computed column', 'op.assign.desc': 'df.assign(...)',
    'op.assign.summary': '{name} = {how}({cols})',
    'say.assign.start': { t: 'Adding computed column "{name}"', s: 'Formula: {formula}' },
    'say.assign.add': { t: 'Inserting column "{name}"', s: 'The new column slides in from the right, then fills row by row' },
    'say.assign.done': { t: '"{name}" computed for {r} rows', s: 'Equivalent to df.assign(name=...)' },

    'op.normalize.name': 'Scale / normalize', 'op.normalize.desc': 'min-max / z-score',
    'op.normalize.summary': '"{col}" → {how}',
    'say.normalize.start': { t: 'First scan the {minmax} of "{col}"', s: 'Min-max needs extremes; z-score needs mean and std' },
    'say.normalize.stat': { t: '{statname} = {v}', s: 'This is the key statistic of this step' },
    'say.normalize.apply': { t: 'Applying row by row: {formula}', s: 'Each new value tweens smoothly to its target' },
    'say.normalize.done': { t: 'Created "{name}": range {lo} ~ {hi}', s: 'Columns on different scales only become comparable after scaling' },

    'op.transform.name': 'Math transform', 'op.transform.desc': 'log / sqrt / abs / round',
    'op.transform.summary': '{how}: {col}',
    'say.transform.start': { t: 'Applying {how} to "{col}"', s: 'Formula: {formula}' },
    'say.transform.done': { t: 'Created column "{name}"', s: 'Log / sqrt are typical for compressing right-skewed data' },

    'op.strcase.name': 'Text transform', 'op.strcase.desc': 'str.upper / lower / strip',
    'op.strcase.summary': '{how}: {col}',
    'say.strcase.start': { t: 'Text transform: {how} on "{col}"', s: 'Each string is read and a new column is produced' },
    'say.strcase.done': { t: 'Created column "{name}"', s: 'Equivalent to df[col].str.xxx()' },

    'op.datepart.name': 'Date features', 'op.datepart.desc': 'dt.year / month / weekday',
    'op.datepart.summary': 'extract {how} of "{col}"',
    'say.datepart.start': { t: 'Extracting {how} from "{col}"', s: 'Dates must be split into numeric features before modeling' },
    'say.datepart.done': { t: 'Created column "{name}"', s: 'Equivalent to df[col].dt.{how}' },

    'op.rank.name': 'Rank', 'op.rank.desc': 'df.rank(...)',
    'op.rank.summary': 'rank by {col} {asc}',
    'say.rank.start': { t: 'Reading the ranking key: {col}', s: 'Scan every value, then sort' },
    'say.rank.sort': { t: 'Reordering {n} rows by {col} {asc}', s: 'A rank is simply the position after sorting' },
    'say.rank.assign': { t: 'Writing ranks 1 ~ {n}', s: 'Ranks start at 1 and roll in row by row' },
    'say.rank.done': { t: 'Ranked: #1 is {top}', s: 'Equivalent to df[col].rank(ascending=...)' },

    'op.window.name': 'Window calc', 'op.window.desc': 'cumsum / diff / pct_change / rolling',
    'op.window.summary': '{how}: {col}',
    'say.window.start': { t: 'Window calc: {how} on "{col}"', s: 'Formula: {formula}' },
    'say.window.done': { t: 'Created column "{name}"', s: 'Typical for cumulative and moving averages in time series' },

    'op.groupby.name': 'Group & aggregate', 'op.groupby.desc': 'df.groupby(...).agg(...)',
    'op.groupby.summary': 'group by {by}, {col} ({how})',
    'say.groupby.start': { t: 'Grouping by "{by}": {k} groups', s: 'Rows of the same group are painted the same colour' },
    'say.groupby.group': { t: 'Coloured {k} groups', s: 'Next, rows of a group gather together' },
    'say.groupby.agg': { t: 'Group "{key}": {n} rows → {how} = {v}', s: 'Rows gather first, then collapse into one summary row' },
    'say.groupby.done': { t: '{k} groups collapsed into {k} rows', s: 'Equivalent to df.groupby(...).agg(...).reset_index()' },

    'op.pivot.name': 'Pivot table', 'op.pivot.desc': 'df.pivot_table(...)',
    'op.pivot.summary': 'pivot: {index} × {columns}',
    'say.pivot.start': { t: 'Pivot: rows = {index}, cols = {columns}', s: 'First scan all row labels and column labels' },
    'say.pivot.build': { t: 'Crossing rows × cols: {r} × {c}', s: 'Each cell is the {how} of that combination' },
    'say.pivot.done': { t: 'Pivoted into {r} rows × {c} cols', s: 'Equivalent to df.pivot_table(...)' },

    'op.valuecount.name': 'Value counts', 'op.valuecount.desc': 'df.value_counts(...)',
    'op.valuecount.summary': 'value counts of "{col}"',
    'say.valuecount.start': { t: 'Counting the values of "{col}"', s: 'A counter bucket is created for every new value encountered' },
    'say.valuecount.done': { t: '{k} distinct values; most frequent is {top}', s: 'Equivalent to df[col].value_counts()' },

    'op.corr.name': 'Correlation matrix', 'op.corr.desc': 'df.corr()',
    'op.corr.summary': 'correlation of {k} numeric cols',
    'say.corr.start': { t: 'Correlating {k} numeric columns pairwise', s: 'The chart on the right switches to a correlation heat map' },
    'say.corr.done': { t: 'Strongest positive: {a} & {b} (r = {r})', s: 'The closer to ±1, the stronger the linear relation' },

    'op.merge.name': 'Merge lookup', 'op.merge.desc': 'df.merge(right, how=left)',
    'op.merge.summary': 'left join on {key}',
    'say.merge.start': { t: 'Left join on "{key}" with "{right}"', s: 'Each row looks up its match in the lookup table' },
    'say.merge.hit': { t: '"{v}" → matched {row}', s: 'On a match, the lookup columns are appended to the row' },
    'say.merge.done': { t: 'Merged: {k} new columns', s: 'Equivalent to df.merge(right, on=..., how="left")' },

    'op.concat.name': 'Concat rows', 'op.concat.desc': 'pd.concat([df, df2])',
    'op.concat.summary': 'append {n} rows',
    'say.concat.start': { t: 'Concatenating: appending {n} rows', s: 'New rows slide in from the bottom; the column layout stays the same' },
    'say.concat.done': { t: 'Concatenated: {r} rows × {c} cols', s: 'Equivalent to pd.concat([df, df2], ignore_index=True)' },

    'say.drop.start': { t: 'Dropping {n} rows ({label})', s: 'Marked rows fade out and collapse; the rest move up naturally' },
    'drop.default': 'not matching', 'drop.extreme': 'extremes', 'drop.dup': 'duplicates',
    'drop.missing': 'rows with missing', 'drop.preview': 'outside the preview',

    'msg.importFail': 'Could not parse', 'msg.pasteEmpty': 'Paste some data first',
    'msg.exported': 'Exported dataflow-result.csv',
    'ui.readyTip': 'Ready: press "Run all" and watch the data being processed step by step',
    'ui.readySub': 'Every step shows its internal search, compare and drop logic instead of just the result.',
    'ui.allDone': 'All {n} steps finished',
    'ui.allDoneSub': 'Final result: {shape} — click "Export" to save the processed data',
  });
})(window);
