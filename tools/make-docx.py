# -*- coding: utf-8 -*-
"""
tools/make-docx.py · 生成《网站关键亮点说明》Word 文档
排版规范参照 paper/ 目录下的往期文档：
  A4 页面、页边距 2.5cm、正文 12pt / 1.5 倍行距 / 两端对齐、
  一级标题 16pt 居中、二级标题 14pt 左对齐、图注 10.5pt 居中、目录为 TOC 域。
用法：python tools/make-docx.py
"""
import os
import docx
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, 'docs', 'images')
LOGO = os.path.join(ROOT, 'paper', '校徽校名.png')
OUT = os.path.join(ROOT, 'docs', 'DataFlow-Lab-网站关键亮点说明.docx')

CN_BODY = '宋体'
CN_HEAD = '黑体'
EN_FONT = 'Times New Roman'


# ---------------------------------------------------------------- 基础工具
def set_run_font(run, size=None, bold=None, cn=CN_BODY, latin=EN_FONT, color=None):
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    run.font.name = latin
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn('w:rFonts'))
    if rf is None:
        rf = OxmlElement('w:rFonts')
        rpr.append(rf)
    rf.set(qn('w:ascii'), latin)
    rf.set(qn('w:hAnsi'), latin)
    rf.set(qn('w:eastAsia'), cn)
    if color is not None:
        run.font.color.rgb = color


def para(doc, text='', size=12, bold=False, align='justify', cn=CN_BODY,
         space_before=0, space_after=6, line=1.5, indent_chars=0, latin=EN_FONT):
    p = doc.add_paragraph()
    amap = {
        'justify': WD_ALIGN_PARAGRAPH.JUSTIFY,
        'left': WD_ALIGN_PARAGRAPH.LEFT,
        'center': WD_ALIGN_PARAGRAPH.CENTER,
        'right': WD_ALIGN_PARAGRAPH.RIGHT,
    }
    p.alignment = amap[align]
    pf = p.paragraph_format
    pf.line_spacing = line
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    if indent_chars:
        pf.first_line_indent = Pt(size * indent_chars)
    if text:
        r = p.add_run(text)
        set_run_font(r, size=size, bold=bold, cn=cn, latin=latin)
    return p


def h1(doc, text):
    p = para(doc, text, size=16, bold=True, align='center', cn=CN_HEAD,
             space_before=14, space_after=10, line=1.5)
    p.style = doc.styles['Heading 1']
    for r in p.runs:
        set_run_font(r, size=16, bold=True, cn=CN_HEAD, color=RGBColor(0, 0, 0))
    return p


def h2(doc, text):
    p = para(doc, text, size=14, bold=True, align='left', cn=CN_HEAD,
             space_before=10, space_after=6, line=1.5)
    p.style = doc.styles['Heading 2']
    for r in p.runs:
        set_run_font(r, size=14, bold=True, cn=CN_HEAD, color=RGBColor(0, 0, 0))
    return p


def body(doc, text, indent=True):
    return para(doc, text, size=12, align='justify', indent_chars=2 if indent else 0)


def item(doc, text):
    return para(doc, text, size=12, align='justify', indent_chars=0, space_after=3)


def fig(doc, filename, caption, width=15.0):
    path = os.path.join(IMAGES, filename)
    if not os.path.exists(path):
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(path, width=Cm(width))
    para(doc, caption, size=10.5, align='center', space_after=10, line=1.15)


def table(doc, headers, rows, widths=None, caption=None):
    # 中文规范：表题在表格上方
    if caption:
        para(doc, caption, size=10.5, align='center', space_before=6, space_after=3, line=1.15)
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    for i, htxt in enumerate(headers):
        hdr[i].text = ''
        p = hdr[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(htxt)
        set_run_font(r, size=10.5, bold=True, cn=CN_HEAD)
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ''
            p = cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if i == 0 else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(str(val))
            set_run_font(r, size=10.5, cn=CN_BODY)
    if widths:
        for i, w in enumerate(widths):
            for row in t.rows:
                row.cells[i].width = Cm(w)
    para(doc, '', size=6, space_after=0)
    return t


def add_toc(doc):
    p = doc.add_paragraph()
    r = p.add_run()
    f1 = OxmlElement('w:fldChar'); f1.set(qn('w:fldCharType'), 'begin')
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = r'TOC \o "1-2" \h \z \u'
    f2 = OxmlElement('w:fldChar'); f2.set(qn('w:fldCharType'), 'separate')
    t = OxmlElement('w:t'); t.text = '（在 Word 中按 Ctrl+A 后按 F9，或右键“更新域”生成目录）'
    f3 = OxmlElement('w:fldChar'); f3.set(qn('w:fldCharType'), 'end')
    for x in (f1, it, f2, t, f3):
        r._r.append(x)
    set_run_font(r, size=12)


def add_page_number(doc):
    footer = doc.sections[0].footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run()
    f1 = OxmlElement('w:fldChar'); f1.set(qn('w:fldCharType'), 'begin')
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = 'PAGE'
    f2 = OxmlElement('w:fldChar'); f2.set(qn('w:fldCharType'), 'end')
    for x in (f1, it, f2):
        r._r.append(x)
    set_run_font(r, size=10.5)


# ---------------------------------------------------------------- 文档
def build():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = sec.top_margin = sec.bottom_margin = Cm(2.5)

    st = doc.styles['Normal']
    st.font.size = Pt(12)
    st.font.name = EN_FONT
    st.element.rPr.rFonts.set(qn('w:eastAsia'), CN_BODY)
    st.paragraph_format.line_spacing = 1.5
    st.paragraph_format.space_after = Pt(6)

    add_page_number(doc)

    # ---------------- 封面 ----------------
    if os.path.exists(LOGO):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(18)
        p.add_run().add_picture(LOGO, width=Cm(11))
    para(doc, '网 站 关 键 亮 点 说 明', size=36, bold=True, align='center', cn=CN_HEAD,
         space_after=18, line=1.2)
    para(doc, 'DataFlow Lab', size=18, align='left', space_after=4, line=1.2)
    para(doc, '——可视化数据分析实验室·让每一步处理都看得见', size=18, align='right',
         space_after=70, line=1.2)
    para(doc, '姓　　名：　王文岭', size=16, bold=True, align='left', space_after=8, line=1.5)
    para(doc, '学　　号：　2407040110', size=16, bold=True, align='left', space_after=8, line=1.5)
    para(doc, '班　　级：　人工智能2401', size=16, bold=True, align='left', space_after=60, line=1.5)
    para(doc, '2026 年 10 月', size=16, align='center', space_after=0, line=1.5)
    doc.add_page_break()

    # ---------------- 目录 ----------------
    para(doc, '目　录', size=16, align='center', space_after=12, line=1.5)
    add_toc(doc)
    doc.add_page_break()

    # ---------------- 第 1 章 ----------------
    h1(doc, '第1章　设计立意')
    body(doc, 'DataFlow Lab 是一个以“可视化数据分析”为主题的网站。它的出发点是一个朴素的问题：'
              '当 pandas 用 dropna()、groupby() 一行代码就给出结果时，数据在中间究竟经历了什么？'
              '哪些行被判为缺失？最大值是怎么被比较出来的？分组之后行去了哪里？这些问题在传统的数据分析工具里是“黑箱”。')
    body(doc, '因此本网站确立了三条设计主线：第一，把每个数据处理操作拆解成可播放的动画剧本，'
              '让数据从原始状态到处理完成的全过程逐步呈现；第二，用图形承担“提问”的职责——'
              '分布形态、离群点、相关关系、缺失模式、组间差异这些表格看不出来的信息，由图形来回答；'
              '第三，让图形反向驱动分析——点击图元即可定位数据行，图形不只是展示结果的画布，而是分析的工具。')

    h2(doc, '1.1　对作业要求的逐项响应')
    table(doc,
          ['作业要求', '本网站的落实方式'],
          [
              ['自由加载数据', '4 个内置数据集随时切换；本地导入 CSV / TSV / TXT / JSON；弹窗粘贴数据；结果导出 CSV'],
              ['设定默认数据集', '打开即载入“学生成绩”数据集（24 行 × 8 列，内含 2 个缺失值、1 组重复行、1 个超高分）'],
              ['参考 pandas 实现各种功能', '28 个操作覆盖 describe / melt / pivot_table / corr / merge / concat / rank / rolling / astype / replace 等，并给出等价 pandas 代码'],
              ['清晰呈现每个步骤', '顶部“分析流水线”串联 数据集 → 步骤 1 → 步骤 2 → …，每张卡片显示参数摘要与执行状态'],
              ['每个步骤动态交互演示', '暂停 / 单步 / 回退 / 任意跳转 / 0.5×–4× 调速 /“只看结果”瞬时模式'],
              ['去极值要给出寻找逻辑与删除步骤', '表格探针逐格扫描，图表同步画出“当前最小 / 当前最大”的下降与上升轨迹，标记随扫描移动，随后逐行删除'],
              ['核心不是调用库直接出结果', '全部计算由自研 dataframe.js 完成（CSV 解析、类型推断、分位数、相关矩阵、describe）'],
              ['一定要用可视化的方式，用图形增加数据分析能力', '14 种图表 + 过程实时图 + 刷选联动 + 自动洞察 + 表头分布迷你图 + 单元格数据条'],
          ],
          widths=[4.6, 11.4], caption='表1-1　作业要求与落实方式对照')

    # ---------------- 第 2 章 ----------------
    h1(doc, '第2章　网站结构总览')
    body(doc, '网站采用三栏式布局：左栏是“数据源 + 操作库”，中栏是“分析流水线 + 动画舞台”，'
              '右栏是“结果面板（KPI / 图表 / 洞察 / 描述统计 / 等价代码 / 变化量）”。'
              '三栏的比例为 292 : 自适应 : 384，顶栏 56px；窄屏时自动降级为单列纵向布局。'
              '信息层级遵循“我要做什么 → 正在发生什么 → 结果是什么 / 看出了什么”的顺序。')
    fig(doc, '01-overview.png', '图2-1　网站总览：左栏操作库、中栏动画表格、右栏图表与自动洞察（注意表头右上角的分布迷你图与单元格底部的数据条）', 15.5)

    h2(doc, '2.1　模块清单')
    table(doc,
          ['模块', '文件', '核心内容'],
          [
              ['页面骨架', 'index.html', '三栏结构、播放条、弹窗、双语钩子'],
              ['数据引擎', 'dataframe.js', '列 key/name 双语列、CSV/JSON 解析、类型推断、统计与相关矩阵'],
              ['动画剧本', 'operations.js', '28 个 pandas 风格操作，每个操作生成一条可播放事件序列'],
              ['剧本播放器', 'animator.js', 'say / scan / mark / drop / fill / addcol / group / agg / settle 事件'],
              ['表格视图', 'tableview.js', '探针扫描、标记、删除、FLIP 重排、行坍缩、表头迷你图与数据条'],
              ['图表模块', 'charts.js', '14 种 SVG 图表、过程实时图、刷选联动、自动洞察'],
              ['主控与面板', 'app.js', '状态机、播放控制、面板联动、主题与语言切换'],
              ['双语与数据集', 'i18n.js / i18n-ext.js / datasets.js', '同一套 key 驱动全站文案；数据集本身也提供中英两套数据'],
          ],
          widths=[2.6, 4.4, 9.0], caption='表2-1　主要模块清单')

    # ---------------- 第 3 章 ----------------
    h1(doc, '第3章　关键亮点')

    h2(doc, '3.1　动画剧本：把每个操作拆成可播放的事件序列')
    body(doc, '本项目最重要的架构决策是：每个操作 run(df, params) 不返回“结果”，而是返回一条动画剧本——'
              '包含处理后的数据、等价 pandas 代码，以及一串事件。播放器只认识事件类型，'
              '于是“新增一个数据处理操作”就退化成“写一个 run()”，动画、界面、双语、图表都会自动获得支持。'
              '这也是 28 个操作仍能保持统一动效的原因。')
    item(doc, '（1）扫描事件（scan）：逐格推进探针，支持 minmax（找最值）与 flag（判定命中 / 剔除）两种轨迹；')
    item(doc, '（2）标记与删除事件（mark / drop）：先标记待删目标，再逐行淡出、收起，其余行自然上移；')
    item(doc, '（3）填充与新增列事件（fill / addcol）：数值滚动补间、新列从右侧滑入；')
    item(doc, '（4）分组聚合事件（group / agg）：同组上色 → 聚拢 → 坍缩成汇总行；')
    item(doc, '（5）落定事件（settle）：整表 FLIP 重排或重新渲染，与会话状态保持一致。')

    h2(doc, '3.2　图形化的“寻找逻辑”——去除极值')
    body(doc, '“去掉一个最高分、一个最低分”是典型的评委打分场景。多数可视化只会告诉你删了两行，'
              '而本网站演示的是“这两行是怎么被找到的”：表格逐格扫描的同时，右侧图表同步画出两条轨迹——'
              '红色阶梯线是“当前最大值”的上升过程，蓝色阶梯线是“当前最小值”的下降过程，'
              '圆点标记当前扫描到的数值，图内实时标注“当前最小 57 / 当前最大 100”与扫描进度。'
              '扫描结束后标记停在真正的极值行上，随后这两行被逐行删除，图表里的分布也随之重新生成。')
    fig(doc, '02-live-minmax.png', '图3-1　扫描过程中，图表实时画出“当前最大”（红）与“当前最小”（蓝）的轨迹，表格中极值行被同步标记', 15.5)

    h2(doc, '3.3　十四种分析级图表——用图形提出问题')
    body(doc, '图表按“回答什么问题”分为四组：基础组（自动 / 直方图 / 折线 / 条形 / 饼图）回答分布与占比；'
              '分布组（箱线图 / 分组箱线图 / 并列直方图）回答离群点与组间差异；'
              '关系组（散点图 / 散点矩阵 / 相关性热力图）回答变量之间的关联；'
              '质量组（缺失值热力图 / 数据画像 / 处理前后对比）回答数据质量与“这一步改变了什么”。'
              '系统还会根据当前数据自动推荐最合适的图表（以 ★ 标记），并让图表跟随当前步骤正在处理的字段联动。')
    fig(doc, '04-missmap.png', '图3-2　缺失值热力图：上排为各列缺失率，右侧为各行缺失率，红色即缺失单元格', 13.0)
    fig(doc, '05-profile.png', '图3-3　数据画像：每列一行，给出类型、缺失率、取值数量与分布迷你图', 13.0)
    fig(doc, '06-splom.png', '图3-4　散点矩阵（鸢尾花数据集）：下三角为相关系数，其余为两两散点图', 15.0)

    h2(doc, '3.4　图形驱动分析：刷选联动与自动洞察')
    body(doc, '图形不只是“看”的对象，还是“操作”的入口。每个图元都携带对应的数据行标识，'
              '点击直方图的柱子、箱线图的箱体或异常点、散点图的点、饼图的扇区，'
              '表格会立即高亮并自动滚动定位到这些行；反过来，鼠标悬停表格行时，图上包含该行的图元也会高亮，'
              '形成“图表 ⇄ 表格”的双向联动。此外，图表下方会自动给出最多三条“从图形读出来的结论”，'
              '例如分布偏度、离群点数量与正常区间、最强相关变量对、缺失最多的列、取值恒定的列等。')
    fig(doc, '07-brush.png', '图3-5　点击直方图的柱子后，表格中被选中的行整体高亮（图表与表格刷选联动）', 15.5)

    h2(doc, '3.5　表内微可视化：表头分布迷你图与单元格数据条')
    body(doc, '为了减少“表格与图表之间来回切换”的成本，网站把可视化直接嵌入表格：'
              '每个数值列的表头右上角内嵌一条分布迷你图（sparkline），不用点开图表就能判断该列是偏态还是双峰；'
              '每个数值单元格底部有一条长度与数值大小成正比的细条，比较大小不必逐个读数字。'
              '两者均为纯 SVG/CSS 实现，不增加行高，也不影响探针、标记、删除等既有动画。')

    h2(doc, '3.6　中英双语：同一套 key 驱动全站')
    body(doc, '网站原生支持中英切换，且两种语言“内容一致”而非只翻界面：界面文案、28 个操作的名称与说明、'
              '参数名与选项、每一步的解说词、HUD 探针标签、提示消息、图表名与洞察文案全部双语；'
              '数据集本身也提供两套数据，切换英文后表头变为 ID / Name / Class / Chinese / Math，'
              '单元格里的姓名、班级、性别、品类、品种同步翻译；右侧等价 pandas 代码中的列名也会相应变化。'
              '实现上，列以语言无关的内部 key 寻址，步骤参数只存 key，因此切换语言后会按同一套流水线重算，结果与动画完全一致。')

    h2(doc, '3.7　明暗双主题与现代简约配色')
    body(doc, '配色体系采用“中性灰底 + 单一主色（靛蓝）”的现代简约风格：浅色主题为白底浅灰面板，'
              '深色主题为中性炭黑而非蓝黑。所有颜色通过 CSS 变量管理，图表（SVG）通过 getComputedStyle 取值，'
              '因此主题切换后图表颜色同步刷新；主题选择写入 localStorage，首次访问跟随系统偏好，'
              '并支持 prefers-reduced-motion 的动画降级。')
    fig(doc, '08-dark-en.png', '图3-6　English + 深色主题：界面、图表、代码与统计同步切换', 15.5)

    h2(doc, '3.8　分组聚合与图表联动')
    body(doc, '分组聚合是最容易被忽略过程的一步。本网站先按分组列给每一行上色，让同组行聚拢，'
              '再一组一组坍缩成汇总行，解说同步报出“组「一班」：8 行 → 均值 249.7”。'
              '聚合完成后，右侧图表自动联动为“按班级的汇总柱状图”，桶状分布与会话状态保持一致。')
    fig(doc, '03-charts.png', '图3-7　分组聚合完成后，表格坍缩为汇总行，右侧图表自动联动为按班级的柱状图', 15.5)

    # ---------------- 第 4 章 ----------------
    h1(doc, '第4章　数据分析功能对照')
    body(doc, '操作库共 28 个操作，按“观察 / 整理 / 清洗 / 变换 / 分析 / 合并”六类组织，每个操作都给出等价 pandas 代码。')
    table(doc,
          ['分类', '操作', '等价 pandas'],
          [
              ['观察', '查看数据 / 统计摘要', 'df.head(n) / df.sample(n) / df.describe()'],
              ['整理', '选择列 / 删除列 / 重命名列', 'df[[...]] / df.drop(columns=[...]) / df.rename(columns={...})'],
              ['整理', '条件筛选 / 排序 / 随机采样', "df[df[c] >= v] / df.sort_values(c, ascending=False) / df.sample(n, random_state=42)"],
              ['整理', '类型转换 / 宽表转长表', "df[c].astype('float'|'str'|'datetime64') / df.melt(id_vars=[...], value_vars=[...])"],
              ['清洗', '去除重复', "df.drop_duplicates(subset=[...], keep='first')"],
              ['清洗', '缺失值处理', 'dropna / fillna(mean|median|mode|0) / ffill / bfill / interpolate'],
              ['清洗', '去除极值', 'nlargest(n) ∪ nsmallest(n) / IQR 区间过滤 / df[c].clip(q05, q95)'],
              ['清洗', '值替换 / 删除无用列', 'df[c].replace(a, b) / 常数列与全空列剔除'],
              ['变换', '新增计算列 / 归一化 / 标准化', "df['total'] = df[[...]].sum(axis=1) / (x-min)/(max-min) / (x-mean)/std"],
              ['变换', '数学变换 / 文本处理 / 日期特征', "np.log|sqrt|abs|round|square / str.upper|lower|strip|extract / dt.year|month|weekday"],
              ['变换', '排名 / 窗口计算', "df[c].rank(ascending=False, method='min') / cumsum|diff|pct_change|rolling(n).mean"],
              ['分析', '分组聚合 / 透视表', "df.groupby(by)[c].mean().reset_index() / df.pivot_table(index, columns, values, aggfunc)"],
              ['分析', '值计数 / 相关性矩阵', 'df[c].value_counts() / df.corr(numeric_only=True)'],
              ['合并', '合并关联表 / 纵向拼接', "df.merge(right, on='key', how='left') / pd.concat([df, extra], ignore_index=True)"],
          ],
          widths=[1.8, 5.0, 9.2], caption='表4-1　操作与 pandas API 对照（节选）')

    # ---------------- 第 5 章 ----------------
    h1(doc, '第5章　演示视频与交付清单')
    h2(doc, '5.1　演示视频的自动生产流程')
    body(doc, '演示视频并非手工录制，而是由脚本自动生成，全过程可一键重做：首先由解说词脚本逐段合成语音并'
              '输出每段起止时间；随后录屏脚本读取这些时间点，按绝对时间轴调度画面动作，做到“说到哪、演到哪”；'
              '最后用 ffmpeg 按音画对齐偏移合成 MP4（H.264 + AAC）。视频中的字幕直接取自解说词原文，'
              '与配音严格一致，并叠加了虚拟光标与点击涟漪。')
    item(doc, '（1）解说词与语速、音色参数集中放在 tools/narration.json，便于替换与重录；')
    item(doc, '（2）字幕与配音同源：录屏脚本直接读取解说词作为画面字幕，避免两者不一致；')
    item(doc, '（3）音频统一重采样为 22.05kHz 单声道后再拼接，保证时长测量与画面调度精确到 0.01 秒。')

    h2(doc, '5.2　交付清单')
    table(doc,
          ['交付项', '说明'],
          [
              ['网站链接', 'https://wangling1206.github.io/dataflow-lab/'],
              ['源代码压缩包', '仅包含网站运行代码（index.html、assets/css、assets/js、README、.gitignore、.nojekyll）'],
              ['演示视频', 'DataFlow-Lab-demo.mp4（1280×760，H.264 + AAC，带语音讲解与同步字幕），随交付单独提供，不随网站上架'],
              ['说明文档', '本文档（Word 版）'],
          ],
          widths=[3.2, 12.8], caption='表5-1　交付清单')

    # ---------------- 第 6 章 ----------------
    h1(doc, '第6章　技术与工程亮点')
    h2(doc, '6.1　零依赖的数据引擎')
    body(doc, 'dataframe.js 自行实现了 pandas 的核心语义：CSV 解析（引号转义、分隔符嗅探、列名去重）、'
              '缺失值语义（空串 / NA / null / None / NaN / “-” / “?” 统一识别，界面显示为红色 “⌀”）、'
              '类型推断（number / date / string）、均值 / 中位数 / 样本标准差 / 任意分位数（线性插值）/ '
              '皮尔逊相关 / valueCounts / describe / corrMatrix，以及带 BOM 的 CSV 导出。'
              '全部文件为经典 <script>，无模块化、无打包器，双击 index.html 即可运行。')

    h2(doc, '6.2　可取消的异步播放引擎')
    body(doc, '播放器持有 token，所有等待与补间动画都按速度系数缩放；暂停、跳转、改参数、切语言、切数据集'
              '都会立即打断动画链并清理定时器，避免出现“动画还在跑但数据已经变了”的状态错位。'
              '扫描期间图表的刷新做了节流处理（每两项刷新一次），在保证 60fps 的同时让过程图保持跟随。')

    h2(doc, '6.3　性能与兼容')
    body(doc, '表格最多渲染前 400 行以保证动画流畅，统计与计算仍基于全量数据并在界面提示；'
              '缺失值热力图最多绘制 60 行 × 全部列；扫描步长随数据量自适应（12–130ms）。'
              '代码仅使用 ES2017 语法与 CSS 变量 / 过渡，Chrome、Edge、Firefox、Safari 现代版本均可直接运行；'
              '整站资源约 300KB，无外部 CDN、无字体下载，可离线使用。')

    # ---------------- 附录 ----------------
    h1(doc, '附　录：操作速查')
    item(doc, '快捷键：空格（播放 / 暂停）、← / →（上一步 / 下一步）、R（运行全部）')
    item(doc, '播放条：⏮ 回到起点、◀ 上一步、▶ 播放、▶| 下一步、⏭ 跳到结果、时间轴任意跳转、0.5×–4× 调速、“只看结果”瞬时模式')
    item(doc, '图表：点击图元可选中并定位数据行；悬停表格行可在图上高亮；★ 为系统推荐图表')
    item(doc, '数据：顶栏可切换 4 个内置数据集、导入本地文件、粘贴数据、导出当前结果为 CSV')

    doc.save(OUT)
    print('OK ->', OUT)


if __name__ == '__main__':
    build()
