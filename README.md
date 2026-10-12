# DataFlow Lab · 可视化数据分析实验室

> 数据可视化作业 —— 把 **pandas 的数据处理逻辑** 变成 **可观看动画** 的网站，并用图形把数据分析做深。
> 不止给结果，而是把「扫描 → 比较 → 标记 → 删除 → 填充 → 聚合 → 落定」的全过程逐步演出来。
> **中英双语 · 明暗主题 · 28 个 pandas 操作 · 14 种分析级图表 · 刷选联动 · 自动洞察**

![总览](docs/images/01-overview.png)

---

## 1. 它解决什么问题

用 pandas 做数据处理时，`df.dropna()`、`df.groupby('班级')['总分'].mean()` 一行代码就出结果，
**但初学者看不到中间发生了什么**：哪些行被判为缺失？最大值是怎么被扫出来的？分组之后行去哪儿了？

DataFlow Lab 的做法是：
1. 把每个 pandas 操作拆解成一条 **动画剧本（trace）**；
2. 用表格作为舞台，逐格「探针扫描」、逐行「标记 / 淡出 / 坍缩 / 重排」；
3. **图表订阅同一套事件**：扫描时同步画出「当前最小 / 当前最大」的轨迹，删除时柱子掉落；
4. 同步更新右侧的图表、自动洞察、描述统计、等价 pandas 代码与变化量；
5. 你可以在任意步骤 **暂停 / 单步 / 回退 / 调速 / 跳转**，看清每一步的逻辑；
6. 图表可以**反向驱动分析**：点击柱子 / 箱体 / 异常点 → 表格高亮并定位到对应行。

---

## 2. 功能一览

### 数据源
- **默认数据集**：学生成绩 / Student Scores（24 行 × 8 列，含缺失值与重复行）——打开即用
- **内置数据集切换**：门店销售 / 比赛评分（去极值经典场景）/ 鸢尾花 iris
- **导入替换**：本地文件（`.csv / .tsv / .txt / .json`）、直接**粘贴**数据
- **导出**：把当前处理结果导出为 CSV（带 BOM，Excel 不乱码）

### 28 个 pandas 风格操作（全部带动画演示）

| 分类 | 操作 |
|---|---|
| 观察 (2) | 查看数据 `head/tail/sample`、统计摘要 `describe()` |
| 整理 (8) | 选择列、删除列、重命名列、条件筛选、排序、随机采样、类型转换 `astype`、宽表转长表 `melt` |
| 清洗 (5) | 去除重复、缺失值处理（`dropna/fillna/ffill/bfill/interpolate`）、去除极值（`nlargest/nsmallest/IQR/clip`）、值替换、删除无用列 |
| 变换 (7) | 新增计算列 `assign`、归一化 / 标准化、数学变换（`log/sqrt/abs/round/square`）、文本处理 `str.*`、日期特征 `dt.*`、排名 `rank`、窗口计算（`cumsum/diff/pct_change/rolling`） |
| 分析 (4) | 分组聚合 `groupby().agg()`、透视表 `pivot_table()`、值计数 `value_counts()`、相关性矩阵 `corr()` |
| 合并 (2) | 合并关联表 `merge()`（内置关联表）、纵向拼接 `concat()`（内置补充表） |

### 14 种分析级图表，随分析联动
| 分组 | 图表 | 回答什么问题 |
|---|---|---|
| 基础 | 自动 / 直方图 / 折线 / 条形 / 饼图 | 分布形态？趋势？各类占比？ |
| 分布 | 箱线图 / 分组箱线图 / 并列直方图 | 有没有离群点？各组分布差异？多列怎么比？ |
| 关系 | 散点图 / 散点矩阵 / 相关性热力图 | 两两关系？哪些变量强相关？ |
| 质量 | 缺失值热力图 / 数据画像 / 处理前后对比 | 缺失在哪？每列质量如何？这一步改变了什么？ |

- **★ 智能推荐**：根据当前数据推荐最合适的图
- **过程实时图**：扫描时画出 running min / running max 轨迹、保留 / 剔除计数条
- **刷选联动**：点击图元 → 表格高亮定位；悬停表格行 → 图上高亮
- **自动洞察**：图表下方自动给出「偏度 / 离群点 / 最强相关对 / 缺失最多列 / 常数列」等结论
- **表内微可视化**：表头内嵌分布迷你图（sparkline）、数值单元格内嵌数据条

### 中英双语（内容完全一致）
顶栏一键切换 `中文 / EN`：界面文案、28 个操作名与说明、参数名与选项、每一步解说、HUD 探针、
提示消息、**数据集名称与说明、表头列名、以及单元格内的文本数据**全部同步；
切换语言后流水线按列 key 重新计算，结果与动画完全一致。

### 明暗主题 + 现代简约配色
中性灰底 + 单一靛蓝主色（浅色白底 / 深色中性炭黑），顶栏 `☀ / ☾` 一键切换并记忆，
首次访问跟随系统偏好；图表颜色随主题同步刷新。

### 交互与节奏控制
- 流水线卡片：点击加入 / 参数即时编辑 / 上移下移 / 删除
- 播放条：`⏮ ◀ ▶ ▶| ⏭`、单步运行、步骤时间轴任意跳转
- 速度 **0.5× / 1× / 2× / 4×**，「只看结果」一键跳过动画
- 快捷键：`空格` 播放暂停 · `←/→` 上/下一步 · `R` 运行全部
- **自动演示**按钮：一键播放一套完整的、带解说的分析流程

### 同步面板
数据概览 KPI（含与上一步的增减）· 14 种图表（可切 / 可点选）· 自动洞察 ·
描述统计表 · 等价 pandas 代码（当前步骤前全部代码，可复制）· 本步变化量

---

## 3. 目录结构

```
web6/
├── index.html                 # 页面骨架（含 i18n 钩子）
├── assets/
│   ├── css/main.css           # 设计令牌 + 明暗主题 + 全部动画样式
│   └── js/
│       ├── util.js            # 工具（可取消 sleep、数字补间、toast…）
│       ├── i18n.js            # 双语核心（词条 / t() / say() / onChange）
│       ├── i18n-ext.js        # 操作名、参数、解说词、数据集词条
│       ├── dataframe.js       # 轻量 DataFrame：列 key/name、CSV/JSON 解析、类型推断、统计
│       ├── datasets.js        # 4 个内置数据集（中英双语）+ 关联表 + 演示脚本
│       ├── operations.js      # 28 个 pandas 风格操作 + 动画剧本生成
│       ├── tableview.js       # 表格视图：探针/标记/删除/坍缩/FLIP 重排
│       ├── animator.js        # 动画剧本播放器（可取消/调速/瞬时模式）
│       ├── charts.js          # SVG 图表 14 种 + 过程实时图 + 刷选 + 洞察 + 表头迷你图
│       ├── pipeline.js        # 流水线模型 + 操作库/步骤卡片 UI
│       ├── importer.js        # 导入导出
│       └── app.js             # 主控：状态机、播放控制、面板联动、主题与语言
├── tools/
│   ├── narration.json         # 解说词（16 段，中英双语 + 语速参数）
│   ├── tts-sapi.ps1           # Windows 内置语音合成（离线回退通道）
│   ├── tts-narrate.mjs        # 逐段合成（在线语音）+ 拼接音轨 + 输出每段时长
│   ├── record-demo.mjs        # Playwright 自动录屏（按解说时间轴调度画面）
│   ├── mux-video.mjs          # 音画合成 → MP4（H.264 + AAC）
│   └── publish-github-api.mjs # 通过 REST API 发布（备用部署通道）
└── docs/
    ├── 亮点说明文档.md          # 关键亮点说明（交付文档）
    ├── 视频讲解稿.md            # 录屏分镜与讲解词
    ├── images/                 # 截图
    └── video/                  # 演示视频
```

**零依赖、零构建**：纯原生 HTML/CSS/JS（全局命名空间 + 经典 `<script>`），
直接双击 `index.html` 即可运行，也天然适配 GitHub Pages。

---

## 4. 本地运行

```bash
# 方式一：直接双击 index.html（无需服务器）

# 方式二：起一个静态服务器
python -m http.server 8123
# 浏览器打开 http://127.0.0.1:8123

# 方式三：
npx serve .
```

## 5. 部署到 GitHub Pages

**方式一：常规 git 推送**

```bash
git init -b main && git add . && git commit -m "feat: DataFlow Lab"
gh repo create dataflow-lab --public --source=. --remote=origin --push
gh api --method POST /repos/<用户名>/dataflow-lab/pages \
  -f "source[branch]=main" -f "source[path]=/"   # 或直接在 Settings → Pages 选择 main 分支
```

**方式二：只走 GitHub REST API（备用通道）**

若所在网络无法直连 `github.com:443`（`git push` 超时 / 连接被重置），可改用只依赖
`api.github.com` 的通道，把工作区内容直接构建成一次提交推送到 `main`，并自动开启 Pages：

```bash
gh auth login                                  # 需要 repo 权限
node tools/publish-github-api.mjs <用户名>/dataflow-lab
```

**本站已部署地址：<https://wangling1206.github.io/dataflow-lab/>**
（仓库：<https://github.com/WangLing1206/dataflow-lab>）

---

## 6. 核心机制（实现要点）

### 1) 每个操作产出一份「动画剧本」
`operations.js` 里每个操作 `run(df, params)` 返回：

```js
{ df: 处理后的新数据, code: '等价 pandas 代码', trace: [ 事件序列 ] }
```

事件类型：`say` · `scan` · `mark` · `drop` · `fill` · `addcol` · `removecol` · `rename` ·
`reorder` · `group` · `agg` · `settle` · `hud` · `wait`。

### 2) 列 key + 行 id 双稳定
列是 `{ key, name, type }`：key 语言无关（步骤参数存 key），name 随语言变化（显示用）；
每行有唯一 `_id`，删除 / 排序 / 聚合后视图仍能追踪这一行，FLIP 重排与坍缩动画才能精确命中。

### 3) 扫描探针 = 「寻找逻辑可视化」
`scan` 事件带 `track: 'minmax' | 'flag'`：
- `minmax`：边扫边维护「当前最小 / 最大」，HUD 实时刷新，蓝 / 红标记随扫描**移动**，
  扫描结束停在真正的最值上 —— 这正是「最大值是怎么被找到的」；
- `flag`：边扫边判定命中 / 剔除（筛选、去重、IQR 异常值）。

### 4) 图表订阅同一套事件
播放器在扫描 / 删除 / 填充 / 落定等事件上回调 `app.chartLive(phase, data)`，
图表据此绘制过程实时图（running min/max、保留/剔除计数），实现"图形与分析过程同步"。

### 5) 刷选联动靠 `data-ids`
每个图元都带上对应的行 id（`data-ids`），点击即回调选中行、悬停行即高亮图元，
因此直方图柱 / 箱体 / 异常点 / 饼图扇区都能定位到具体数据行。

### 6) 可取消的异步播放
播放器持有 `token`，暂停 / 跳转 / 改参数 / 切语言都会 `cancel()` 打断动画链，
保证状态永远一致、不出现动画错位。

### 5) 双语与双主题都是「数据驱动」
文案 → `I18n.t(key)`；颜色 → CSS 变量（JS 端用 `getComputedStyle` 取值）；
因此新增一个操作或一张图表，不需要重复写两套语言 / 两套配色。

---

## 7. 已知边界

- 表格最多渲染前 **400 行**以保证动画流畅（统计与计算仍基于全量数据，界面有提示）。
- 类型推断支持 `number / date / string`；日期列按文本参与分组与图表横轴。
- 运算符仅覆盖演示所需范围（`>` `>=` `<` `<=` `==` `!=` 包含 / 为空 / 不为空）。
- 演示视频为 MP4（H.264 + AAC），带中文/英文语音讲解，浏览器、PPT、剪辑软件均可直接使用。

---

## 8. 交付清单

| 交付项 | 说明 |
|---|---|
| 网站链接 | <https://wangling1206.github.io/dataflow-lab/> |
| 源代码 | `DataFlow-Lab-源码.zip`（纯静态资源，不含 node_modules） |
| 视频 | `docs/video/DataFlow-Lab-demo.mp4`（**4 分 35 秒 · 1280×760 · H.264 + AAC · 带中文/英文语音讲解**，含虚拟光标与字幕；讲解稿：`docs/视频讲解稿.md`） |
| 文档 | `docs/亮点说明文档.md` |

> **视频是怎么做出来的**（全部脚本化，可一键重做）：
>
> ```bash
> python -m http.server 8123                        # 1) 起本地服务
> node tools/tts-narrate.mjs                        # 2) 生成解说音轨（在线语音，失败自动回退内置语音）
> node tools/record-demo.mjs --url http://127.0.0.1:8123/index.html --out docs/video
> node tools/mux-video.mjs                          # 3) 音画合成 → MP4（H.264 + AAC）
> ```
>
> - 解说词在 `tools/narration.json`（16 段，中文 15 段 + 英文 1 段，含语速参数）；
> - `tts-narrate.mjs` 逐段调用语音接口合成 MP3（`provider: "http"`），再用 ffmpeg 统一成 WAV 拼接，
>   输出 `narration.wav` 与每段起止时间；网络不可用时自动回退 Windows 内置语音（`--provider sapi`）；
> - `record-demo.mjs` **按解说时间轴调度画面**（"说到哪、演到哪"），并记录音画对齐偏移 `lead`；
> - `mux-video.mjs` 用 ffmpeg 以 `-itsoffset lead` 合成 MP4，语音与画面字幕严格同步。
>
> 若要改成自己的讲解，只改 `tools/narration.json` 的文本后重跑上面三步即可。
