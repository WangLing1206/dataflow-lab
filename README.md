# DataFlow Lab · 可视化数据分析实验室

> 数据可视化作业 —— 一个把 **pandas 的数据处理逻辑** 变成 **可观看动画** 的网站。
> 不止给结果，而是把「扫描 → 比较 → 标记 → 删除 → 填充 → 聚合 → 落定」的全过程逐步演出来。

![总览](docs/images/01-overview.png)

---

## 1. 它解决什么问题

用 pandas 做数据处理时，`df.dropna()`、`df.groupby('班级')['总分'].mean()` 一行代码就出结果，
**但初学者看不到中间发生了什么**：哪些行被判为缺失？最大值是怎么被扫出来的？分组之后行去哪儿了？

DataFlow Lab 的做法是：
1. 把每个 pandas 操作拆解成一条 **动画剧本（trace）**；
2. 用表格作为舞台，逐格「探针扫描」、逐行「标记 / 淡出 / 坍缩 / 重排」；
3. 同步更新右侧的分布图、描述统计、等价 pandas 代码与变化量；
4. 你可以在任意步骤 **暂停 / 单步 / 回退 / 调速 / 跳转**，看清每一步的逻辑。

---

## 2. 功能一览

### 数据源
- **默认数据集**：学生成绩（30 行，含缺失值与重复行）——打开即用
- **内置数据集切换**：门店销售 / 比赛评分（去极值经典场景）/ 鸢尾花 iris
- **导入替换**：本地文件导入（`.csv / .tsv / .txt / .json`）、直接**粘贴**数据
- **导出**：把当前处理结果导出为 CSV

### 13 个 pandas 风格操作（全部带动画演示）

| 分类 | 操作 | 对应 pandas | 动画亮点 |
|---|---|---|---|
| 观察 | 查看数据 | `df.head/tail/sample` | 逐行掠过，报出形状与类型 |
| 观察 | 统计摘要 | `df.describe()` | 逐列累计 count/sum，实时滚动结果 |
| 整理 | 选择列 | `df[[...]]` | 未选中的列先变暗再消失 |
| 整理 | 条件筛选 | `df[df[c] >= v]` | 逐行比较，命中变绿、未命中变红后剔除 |
| 整理 | 排序 | `df.sort_values` | 先读键，再 FLIP 平滑重排整张表 |
| 整理 | 重命名列 | `df.rename` | 表头 3D 翻转 |
| 整理 | 随机采样 | `df.sample(n, seed)` | 随机抽中/落选可视化 |
| 清洗 | 去除重复 | `drop_duplicates` | 逐行计算「指纹」，重复行标黄后删除 |
| 清洗 | 缺失值处理 | `dropna / fillna` | 缺失单元格标红，填充时数字滚动到位 |
| 清洗 | **去除极值** | `nlargest/nsmallest/IQR/clip` | **HUD 探针实时显示当前最小/最大，扫描完成后标记并删除** |
| 变换 | 新增计算列 | `df.assign` | 新列从右侧滑入，逐行数字滚动生成 |
| 变换 | 归一化 | min-max / z-score | 先扫极值（或均值标准差）再展示公式与结果 |
| 分析 | 分组聚合 | `groupby().agg()` | 同组上色 → 聚拢 → 坍缩成汇总行 |

### 交互与节奏控制
- 流水线卡片：点击加入 / 参数即时编辑 / 上移下移 / 删除
- 播放条：`⏮ ◀ ▶ ▶| ⏭`、单步运行、步骤时间轴任意跳转
- 速度 **0.5× / 1× / 2× / 4×**，「只看结果」一键跳过动画
- 快捷键：`空格` 播放暂停 · `←/→` 上/下一步 · `R` 运行全部
- **自动演示**按钮：一键播放一套完整的、带解说的分析流程

### 同步面板
数据概览 KPI（含与上一步的增减）· 分布图（直方图 / 柱状图，柱高平滑过渡）·
描述统计表 · 等价 pandas 代码（当前步骤前全部代码）· 本步变化量

---

## 3. 目录结构

```
web6/
├── index.html                 # 页面骨架
├── assets/
│   ├── css/main.css           # 设计系统 + 全部动画样式
│   └── js/
│       ├── util.js            # 工具（可取消 sleep、数字补间、toast…）
│       ├── dataframe.js       # 轻量 DataFrame 引擎：CSV/JSON 解析、类型推断、统计
│       ├── datasets.js        # 4 个内置数据集 + 自动演示脚本
│       ├── operations.js      # 13 个 pandas 风格操作 + 动画剧本生成
│       ├── tableview.js       # 表格视图：探针/标记/删除/坍缩/FLIP 重排
│       ├── animator.js        # 动画剧本播放器（支持取消/调速/瞬时模式）
│       ├── charts.js          # SVG 图表（直方图/柱状图）
│       ├── pipeline.js        # 流水线模型 + 操作库/步骤卡片 UI
│       ├── importer.js        # 导入导出
│       └── app.js             # 主控：状态机、播放控制、面板联动
└── docs/
    ├── 亮点说明文档.md          # 关键亮点说明（交付文档）
    ├── 视频讲解稿.md            # 录屏分镜与讲解词
    └── images/                 # 截图
```

**零依赖、零构建**：纯原生 HTML/CSS/JS（ES5 级语法 + 全局命名空间），
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
{ df: 处理后的新数据, code: '等价 pandas 代码', trace: [ 事件序列 ], summary: {...} }
```

事件类型：`say`（解说）· `scan`（扫描探针）· `mark`（标记）· `drop`（删除）·
`fill`（填充补间）· `addcol`（新列滑入）· `removecol` · `rename` · `group` · `agg`（分组坍缩）· `settle`（落定）。

### 2) 数据与视图解耦：稳定的行 id
每一行都有唯一 `_id`，删除 / 排序 / 聚合后视图仍能追踪到「这一行去哪了」，
因此 FLIP 重排、行坍缩、行飞入等动画都能精确命中目标。

### 3) 扫描探针 = 「寻找逻辑可视化」
`scan` 事件带 `track: 'minmax' | 'flag'`：
- `minmax`：边扫边维护「当前最小/最大」，HUD 实时刷新，蓝色/红色标记会**移动**，
  扫描结束留在真正的最值上 —— 这正是「最大值是怎么被找到的」。
- `flag`：边扫边判定命中/剔除（筛选、去重、IQR 异常值）。

### 4) 可取消的异步播放
播放器持有 `token`，暂停 / 跳转 / 参数修改都会 `cancel()` 打断动画链，
保证状态永远一致、不出现动画错位。

---

## 7. 已知边界

- 为保证动画流畅，表格最多渲染前 **400 行**（统计与计算仍基于全量数据）。
- 类型推断支持 `number / date / string` 三类；日期列按文本参与分组与图表横轴。
- 运算符仅覆盖作业演示所需范围（>、>=、<、<=、==、!=、包含、为空、不为空）。

---

## 8. 交付清单

| 交付项 | 说明 |
|---|---|
| 网站链接 | <https://wangling1206.github.io/dataflow-lab/> |
| 源代码 | `DataFlow-Lab-源码.zip`（不含 node_modules，纯静态资源） |
| 视频 | `docs/video/DataFlow-Lab-demo.webm`（3 分 37 秒，1280×760，含字幕与讲解要点；配套讲解稿：`docs/视频讲解稿.md`） |
| 文档 | `docs/亮点说明文档.md` |

> **关于视频格式**：录像由 Playwright 自动生成，输出为 WebM（VP8）。
> Chrome / Edge / Firefox / VLC / PotPlayer 均可直接播放；若需要 MP4，执行一条命令即可转换：
>
> ```bash
> ffmpeg -i docs/video/DataFlow-Lab-demo.webm -c:v libx264 -crf 23 -pix_fmt yuv420p docs/video/DataFlow-Lab-demo.mp4
> ```
>
> 视频中的画面字幕与网站自带的解说条已覆盖全部讲解要点，静音观看也能看懂；
> 需要人声讲解时，按 `docs/视频讲解稿.md` 的分镜逐段配音即可（总时长 ≤ 5 分钟）。
> 视频可通过 `node tools/record-demo.mjs` 一键重新录制。
