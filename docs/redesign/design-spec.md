# 赛博霓虹 · 强动效 — 全站设计规范

> 项目：`qiyuan-blog-template`（Astro 5 + React 19 + Tailwind CSS v4）
> 版本：v2（全站结构重做，覆盖 Shoka 粉色体系）
> 本文只有设计规范，不含任何源码改动。所有色值均可直接粘贴为 CSS 声明。

---

## 0. 设计方向

**三个形容词**：冷冽、克制的发光、结构感。

**参照物**：像 **Linear 官网的暗色主题** 叠加 **Vercel 仪表盘** 的深空底色 —— 整页只有一处冷光源，其余全是留白与细线。

**一句话理由**：博客的主体是长文，霓虹只能用来「指示焦点」，不能用来「装饰版面」。因此本规范把发光当作稀缺资源分配（每屏 ≤ 3 处），把层次交给三阶明度台阶与 1px 高光描边，而不是靠颜色堆叠。

---

## 1. 结构重做：四个必须先回答的问题

| # | 问题 | 结论 | 理由 |
|---|---|---|---|
| 1 | 首页还是「左图右栏 + 内容区」双栏吗 | **不是。** 改为「通栏 Hero（高 320px）+ 下方 12 列栅格」：左 8 列内容 / 右 4 列侧栏（320px） | Hero 通栏一次性建立氛围与品牌；侧栏移到右侧后，文章标题的起始边与 Hero 标题左对齐，形成一条贯穿全站的阅读轴线；右侧栏 sticky 位置更符合「辅助信息」的语义 |
| 2 | 文章列表 2 列网格还是单列宽列表 | **单列横向卡片**（缩略图 248×156 左置），不做 2 列网格；**例外**：首页「置顶」区只有 1 篇，用**单张全宽 Feature 卡**（不是 2 列网格） | 封面来自 `defaultCoverList` 随机池，本身风格不统一，2 列网格会把不一致放大一倍；横向单列让中文长标题独占一行不被 `line-clamp` 截断；10 篇/页的分页体量下，单列滚动成本更低。置顶区用 2 列会留一个空洞，且会把唯一一篇置顶推到"首屏全占"的观感上（见 §6.23-A） |
| 3 | 文章页侧栏保留吗，移动端怎么收 | **保留**，右侧 320px，分段控件切换「目录 / 信息 / 系列」，默认停在「目录」；**≤992px 收进抽屉**，并在右上角给一个 44×44 的浮动「目录」按钮 | 长文阅读时目录是刚需；作者信息在文章页是噪声。移动端抽屉复用现有 `MobileDrawer` 的 `HomeSiderType.POST` 分支，不新增组件 |
| 4 | banner 还要 60dvh 大图吗 | **不要。** 改为五档窄幅：320 / 280 / 220 / 180 / 152px；背景 = 深空底 + 双色光晕 + 32px 网格 + 海报图 `opacity .12` `grayscale(1)` `mix-blend-mode: luminosity`；`/video/top.mp4` **直接删除** | 60dvh 在 900px 高视口吃掉 540px，用户每进一页要滚 1.5 屏才看到列表；赛博氛围靠「光 + 网格」建立，图片降级为纹理；自动播放视频额外吃 3–6MB 流量，与静音阅读场景冲突 |

---

## 2. 色彩系统

### 2.1 分层原则

- **底色三阶**：`--background`（0b0e14）→ `--surface-1`（11151d）→ `--surface-2`（1d212b）→ `--surface-3`（242833）。页面主体永远是最暗一档，浮起来的卡片才变亮，**不允许**用亮色卡压暗色底。
- **霓虹三色**：青（主）/ 紫罗兰（辅）/ 琥珀（警示与强调）。青用得最多，紫只用于「次级强调与装饰线」，琥珀只用于「提示/草稿/警告」。
- **文字两档**：`--foreground`（暖白 #e9edf1）与 `--muted-foreground`（#919cac）。不用纯白、不用纯黑。

### 2.2 深色模式（主）— 可直接粘贴

写入 `src/styles/theme/shadcn.css` 的 `.dark { }` 块：

```css
.dark {
  /* ---- 底色三阶 ---- */
  --background: 222 28% 6%;          /* #0b0e14 页面底 */
  --surface-1: 222 24% 9%;           /* #11151d 分区底 */
  --surface-2: 222 20% 12%;          /* #161a22 卡片底 */
  --surface-3: 222 18% 17%;          /* #242833 悬浮层/输入框 */

  /* ---- 文字 ---- */
  --foreground: 210 22% 93%;         /* #e9edf1 正文，对底 16.42:1 */
  --muted-foreground: 215 14% 62%;   /* #919cac 次级文字，对 card 5.79:1 */

  /* ---- 霓虹 ---- */
  --primary: 186 100% 55%;           /* #1ae8ff 主青，对底 12.91:1 */
  --primary-foreground: 222 32% 7%;  /* #080b11 青底上的字，12.5:1 */
  --neon-cyan: 186 100% 55%;         /* 同 primary，语义别名 */
  --neon-cyan-soft: 186 90% 70%;     /* #6fecf9 细描边/次要青 */
  --neon-violet: 280 95% 68%;        /* #c760fb 辅助，对 card 4.98:1（只允许 ≥16px） */
  --neon-violet-soft: 282 90% 78%;   /* #df9dfb 装饰线，对 card 6.88:1 */
  --neon-amber: 38 100% 62%;         /* #ffb83d 草稿/提示，对底 11.20:1 */

  /* ---- shadcn 语义槽（沿用原变量名） ---- */
  --card: 222 20% 12%;
  --card-foreground: 210 22% 93%;
  --popover: 222 24% 10%;
  --popover-foreground: 210 22% 93%;
  --secondary: 222 18% 17%;
  --secondary-foreground: 210 22% 95%;
  --muted: 222 18% 17%;
  --accent: 222 22% 16%;             /* 注意：accent 是 hover 底色，不要设成紫色 */
  --accent-foreground: 210 22% 95%;
  --destructive: 352 90% 62%;
  --destructive-foreground: 222 32% 7%;
  --success: 158 84% 45%;
  --warning: 38 100% 62%;
  --border: 200 24% 22%;             /* 纯装饰线，非唯一分隔手段 */
  --input: 200 22% 42%;              /* 表单控件边界，对 card 3.19:1，满足 1.4.11 */
  --ring: 186 100% 55%;
  --badge-primary: 186 90% 68%;
  --radius: 0.5rem;                  /* 圆角收敛到 8px */

  /* ---- 玻璃拟态 ---- */
  --glass-bg: rgba(20, 26, 37, 0.62);
  --glass-bg-strong: rgba(16, 21, 30, 0.88);
  --glass-border-top: rgba(255, 255, 255, 0.14);
  --glass-border-bottom: rgba(255, 255, 255, 0.04);
  --glass-inner-glow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06);

  /* ---- 纹理 ---- */
  --grid-line: rgba(140, 200, 230, 0.05);    /* 网格，透明度 5% */
  --dot-line: rgba(140, 200, 230, 0.10);     /* 点阵，仅用于 Hero */
  --noise-opacity: 0.035;                    /* 噪点层透明度 */

  /* ---- 发光（统一在这里定，组件只引用） ---- */
  --glow-cyan-sm: 0 0 12px hsl(var(--neon-cyan) / 0.18);
  --glow-cyan-md: 0 0 24px hsl(var(--neon-cyan) / 0.22);
  --glow-cyan-lg: 0 0 40px hsl(var(--neon-cyan) / 0.28);
  --glow-violet-md: 0 0 28px hsl(var(--neon-violet) / 0.22);
  --shadow-card: 0 12px 32px rgba(0, 0, 0, 0.45);
  --shadow-pop: 0 24px 64px rgba(0, 0, 0, 0.55);
}
```

### 2.3 浅色模式（可选，保留 `:root` 不让站点崩）

```css
:root {
  --background: 210 30% 98%;         /* #f8fafb */
  --surface-1: 210 24% 96%;
  --surface-2: 0 0% 100%;
  --surface-3: 210 22% 94%;

  --foreground: 222 26% 14%;         /* #1a202d，对底 15.57:1 */
  --muted-foreground: 220 10% 44%;   /* #656c7b，对 surface-3 4.82:1 */

  --primary: 194 100% 30%;           /* #007599，对底 5.01:1；白字在其上 5.24:1 */
  --primary-foreground: 0 0% 100%;
  --neon-cyan: 194 100% 34%;         /* 浅色下青必须压深，否则对比度不达标 */
  --neon-cyan-soft: 194 90% 42%;
  --neon-violet: 282 80% 42%;        /* #8d15c1，对底 6.66:1 */
  --neon-violet-soft: 282 70% 52%;
  --neon-amber: 30 90% 38%;

  --card: 0 0% 100%;
  --card-foreground: 222 26% 14%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 26% 14%;
  --secondary: 210 24% 94%;
  --secondary-foreground: 222 26% 14%;
  --muted: 210 24% 94%;
  --accent: 210 24% 94%;
  --accent-foreground: 222 26% 14%;
  --border: 210 18% 86%;
  --input: 207 14% 52%;              /* 对底 3.60:1 */
  --ring: 194 100% 34%;
  --badge-primary: 194 100% 30%;

  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-bg-strong: rgba(255, 255, 255, 0.92);
  --glass-border-top: rgba(255, 255, 255, 0.90);
  --glass-border-bottom: rgba(20, 30, 45, 0.06);
  --glass-inner-glow: inset 0 1px 0 0 rgba(255, 255, 255, 0.80);

  --grid-line: rgba(30, 90, 120, 0.05);
  --dot-line: rgba(30, 90, 120, 0.08);

  --glow-cyan-sm: 0 0 12px hsl(var(--neon-cyan) / 0.14);
  --glow-cyan-md: 0 0 24px hsl(var(--neon-cyan) / 0.16);
  --glow-cyan-lg: 0 0 40px hsl(var(--neon-cyan) / 0.20);
  --shadow-card: 0 10px 28px rgba(22, 34, 48, 0.10);
  --shadow-pop: 0 24px 56px rgba(22, 34, 48, 0.16);
}
```

### 2.4 必须改写的渐变（`src/styles/theme/index.css`）

原来这里全是粉，是全站「粉色没洗干净」的根源：

```css
/* dark */
--gradient-bg-start: #0b0e14;
--gradient-bg-end: #070910;
--gradient-bg: linear-gradient(180deg, var(--gradient-bg-start) 0%, var(--gradient-bg-end) 100%);
--gradient-pink: linear-gradient(135deg, hsl(186 100% 55%) 0%, hsl(280 95% 68%) 100%); /* 改青→紫 */
--gradient-header: linear-gradient(180deg, rgba(11, 14, 20, 0.92) 0%, rgba(11, 14, 20, 0.72) 100%);
--bg-overlay: rgba(11, 14, 20, 0.92);
--gradient-shoka-button-start: hsl(186 100% 52%);
--gradient-shoka-button-end: hsl(196 100% 42%);
--gradient-shoka-button: linear-gradient(135deg, var(--gradient-shoka-button-start) 0%, var(--gradient-shoka-button-end) 100%);
--color-pink: hsl(186 100% 55%);         /* 名字保留，值换青，避免大范围改类名 */
--color-pink-a3: rgba(26, 232, 255, 0.30);
--box-bg-shadow: rgba(0, 0, 0, 0.55);
--shoka-blue: 186 100% 70%;
--grey-4: 200 18% 34%;
```

```css
/* :root 浅色 */
--gradient-bg-start: #f8fafb;
--gradient-bg-end: #eef2f6;
--gradient-header: linear-gradient(180deg, rgba(248, 250, 251, 0.94) 0%, rgba(248, 250, 251, 0.76) 100%);
--bg-overlay: rgba(248, 250, 251, 0.92);
--gradient-shoka-button-start: hsl(194 100% 34%);
--gradient-shoka-button-end: hsl(200 100% 26%);
--color-pink: hsl(194 100% 30%);
--color-pink-a3: rgba(0, 117, 153, 0.24);
```

> `--gradient-shoka-button` 被 10 个文件引用（按钮、下拉、分段控件、抽屉、分类卡、文章卡、`ButtonLink`、`button.tsx`、`segmented.tsx`）。**只改这两个变量值，不动类名**，全站按钮一次性由「粉→橙」变成「青→深青」，这是性价比最高的一步。

### 2.5 发光配额（硬规定，评审时逐条对）

1. **每屏同时可见的发光元素 ≤ 3 处。** 超了就是土味。
2. 允许发光的位置，白名单：当前导航项 / hover 中的卡片与按钮 / Hero 主标题 / 激活的目录项 / 空状态图标 / 年份时间线节点。
3. **正文区（`.prose`）里任何元素都不得发光**，包括链接与强调文字。
4. 发光参数区间：`blur 12–40px`、`透明度 0.14–0.28`。**禁止** `spread > 0` 的实心外扩，那是廉价霓虹灯管的做法。
5. 紫色不得用于大面积填充（白字在 `#c760fb` 上只有 3.23:1）。紫色只做描边、短分隔线、以及深色字的底。
6. **例外：封面图内部不受本条约束。** 每篇文章的封面可以有自己的主色相（见 §6.23-B），那是「图片」，不是「UI 色」。但该色相**不得**回流到任何文字、按钮、边框、发光上。

---

## 3. 字体阶梯

### 3.1 字体栈（全部为系统字体，不新增下载）

```css
--font-display: -apple-system, "SF Pro Display", "Segoe UI Variable Display",
                "HarmonyOS Sans SC", "PingFang SC", "Noto Sans SC",
                "Source Han Sans SC", "Microsoft YaHei", sans-serif;
--font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
             "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono",
             Menlo, Consolas, "Noto Sans Mono CJK SC", monospace;
```

**关键动作**：把 `tailwind.css` 中 `h1–h6` 的 `font-family: "寒蝉全圆体"` 全部替换为 `var(--font-display)`。原字体是圆体，字重只有 Regular/Bold 两档，导致标题与正文区分度不足（问题 8）。`font-sans` 变量同样改为 `var(--font-body)`。日文 `:lang(ja)` 分支保留 `Gen Jyuu Gothic P`，不动。

### 3.2 字号阶梯（桌面基准，断点缩放见第 8 节）

| 语义 | 字号 | 行高 | 字重 | 字距 | 用途 |
|---|---|---|---|---|---|
| H1 / Hero 主标 | 44px | 1.15 | 700 | -0.030em | 首页 Hero、页面标题 |
| H1 / 文章标题 | 40px | 1.20 | 700 | -0.025em | `/post/*` 顶部 |
| H2 / 区块标题 | 26px | 1.35 | 700 | -0.020em | 「文章列表」「精选分类」 |
| H3 / 卡片标题 | 20px | 1.45 | 600 | -0.015em | 文章卡、分类卡标题 |
| H4 | 17px | 1.55 | 600 | -0.010em | 侧栏小标题、正文 H3 |
| H5 | 15px | 1.55 | 600 | 0 | 表头、备注标题 |
| H6 | 13px | 1.50 | 600 | +0.060em | 小标签，建议配 `text-transform: uppercase` |
| Body | 16px | 1.75 | 400 | +0.010em | 全站默认 |
| Body / 文章正文 | 17px | 1.85 | 400 | +0.012em | `.prose` 段落，中文阅读最佳区间 |
| Body-sm | 14px | 1.70 | 400 | +0.008em | 摘要、说明 |
| Caption / 元信息 | 12px | 1.50 | 500 | +0.060em | 日期、字数、路径、`uppercase` |
| Mono / 数字 | 13px | 1.60 | 500 | +0.020em | 统计数字、代码、快捷键，`font-variant-numeric: tabular-nums` |
| Code | 13px | 1.70 | 400 | 0 | 代码块 |

### 3.3 中文排版规则

- 正文行宽 **68ch**（中文约等于 34 个汉字，落在 30–40 字的舒适区）；`.prose` 容器设 `max-width: 68ch`，但 `h1/h2` 与表格、代码块可突破到 `100%`。
- 段落间距 `1.25em`，段首不缩进。
- 中英文之间保留 1/4 空格由编辑器负责，**CSS 不使用 `text-spacing` 等实验属性**。
- 标点挤压用 `text-align: justify` + `text-justify: inter-ideograph`，仅用于 `.prose`。
- 标题不使用 `letter-spacing: 0.04em`（原来的圆体字距方案），因为无衬线粗体加大字距在中文里会「散架」；改为负字距收紧。

---

## 4. 间距与栅格

### 4.1 刻度（4px 基数）

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 120`

沿用现有 `design-tokens.ts` 的 `spacing`，**新增习惯用法**：

| 名称 | 值 | 用途 |
|---|---|---|
| `--space-3xs` | 4px | 图标与文字 |
| `--space-2xs` | 8px | 徽章内距、按钮图标间距 |
| `--space-xs` | 12px | 卡片内元素间距 |
| `--space-sm` | 16px | 卡片间距、栅格 gutter（移动端） |
| `--space-md` | 24px | 栅格 gutter（桌面）、卡片内距 |
| `--space-lg` | 32px | 主栏与侧栏间距 |
| `--space-xl` | 48px | 区块间距（移动端） |
| `--space-2xl` | 64px | 区块间距（桌面） |
| `--space-3xl` | 96px | Hero 与首屏区块之间 |

### 4.2 页面宽度与栅格

| 断点 | 内容最大宽 | 栅格 | 主栏 | 侧栏 | gutter |
|---|---|---|---|---|---|
| desktop ≥1480 | 1360px | 12 列 | 8 列（≈ 952px） | 320px | 32px |
| 993–1479 | 1180px | 12 列 | 8 列（≈ 812px） | 300px | 28px |
| tablet 769–992 | 960px | 6 列 | 满宽 | — 收进抽屉 | 24px |
| md 481–768 | 100%（内边距 24px） | 4 列 | 满宽 | — | 16px |
| xs ≤480 | 100%（内边距 16px） | 2 列 | 满宽 | — | 12px |

**变量落地**：

```css
--content-max: 1360px;   /* @media (max-width: 1479px) 下改 1180px */
--content-max: 960px;    /* @media (max-width: 992px) 下 */
--sidebar-w: 320px;      /* 993–1479 下 300px */
--page-pad-x: 24px;      /* ≤768 下 24px，≤480 下 16px */
```

### 4.3 关键间距

| 位置 | 值 |
|---|---|
| 卡片内边距 | 24px（≤768 降 16px） |
| 卡片之间 gap | 16px（≤768 降 12px） |
| 区块标题 ↔ 内容 | 20px |
| 区块 ↔ 区块 | 48px（desktop 64px） |
| Hero 底部 ↔ 首个区块 | 32px |
| 导航高 | 60px（≤992 为 56px） |
| 侧栏 sticky top | 80px（导航 60 + 20） |
| 页脚上内距 | 40px（≤768 降 32px） |

### 4.4 层级（z-index）

沿用 `design-tokens.ts`，新增两档：`--z-hero-glow: 0`、`--z-float: 50`、`--z-drawer: 50`、`--z-search: 60`（搜索弹层必须高于抽屉，因为抽屉关闭前可能触发搜索）。

---

## 5. 页面规格

> 所有页面共用骨架：`Header(60) → Hero(变高) → 12 列栅格主区 → Footer`。
> 视觉重心统一落在「主栏左上角第一个标题」，因此 Hero 内的标题必须左对齐（不再居中）。

### 5.1 首页 `/`

```
┌──────────────────────────────────────────────────────────────┐
│ Header 60px：logo 左 / 菜单中 / 搜索·语言·主题 右             │
├──────────────────────────────────────────────────────────────┤
│ Hero 320px（通栏 ≥1480，内容宽 1360 居中）                    │
│  [eyebrow] 12px mono uppercase cyan                          │
│  H1 44px 700  ← 视觉重心，左对齐                              │
│  subtitle 15px muted / meta 12px mono（N 篇文章 · 最后更新）   │
│  右侧：300×300 双色光斑，不承载信息                            │
│  底边 1px 渐变线（transparent→cyan 50%→transparent）          │
├───────────────────────────┬──────────────────────────────────┤
│ 主栏 8 列                  │ 侧栏 4 列 320px（sticky top 80）   │
│ ┌ 置顶 ────────────────┐  │ ┌ 个人信息卡 ─────────────────┐  │
│ │ 1 张全宽 Feature 卡  │  │ │ 头像 88×88 r20 / 昵称 18px   │  │
│ │ 封面 16:10 满宽 256h │  │ │ 简介 13px / 社交 28×28 ×4    │  │
│ │ 标题 28px 压在封面下 │  │ │ 统计三列 mono cyan           │  │
│ └──────────────────────┘  │ └─────────────────────────────┘  │
│ ┌ 文章列表 ────────────┐  │ ┌ 导航菜单 ───────────────────┐  │
│ │ 单列横向卡 ×4        │  │ │ 首页/文章/分类/标签/归档/关于 │  │
│ │ 缩略图 248×156 左置  │  │ └─────────────────────────────┘  │
│ │ 序号 01–04 mono 锚点 │  │ ┌ 最近标签云（可选）──────────┐  │
│ │ gap 16，无分割线     │  │ └─────────────────────────────┘  │
│ └──────────────────────┘  │                                  │
│ ┌ 精选分类 ────────────┐  │                                  │
│ │ 3 列等宽 gap 16，16:9│  │                                  │
│ └──────────────────────┘  │                                  │
│ ┌ 分页器（本次 5 篇不显示）│                                  │
└───────────────────────────┴──────────────────────────────────┘
Footer：三段式，顶部 1px 青色渐变光带
```

- 区块标题不再使用「两侧长横线 + 居中文字」的 Shoka 分割线，改为：**左对齐 26px 标题 + 右侧 1px 渐变横线延伸到主栏右边界**，标题前加 6×6 青色菱形（旋转 45°）作为视觉锚点。
- 「置顶」区当前只有 1 篇，用**单张全宽 Feature 卡**（规格见 §6.23-A）；「文章列表」用横向卡，两者共用同一组件不同 `variant`。
- **节奏锚点**：删掉封面左右交替后，4 张同构卡片容易发闷。用卡片左上角 `01 / 02 / 03 / 04` 的 mono 序号（12px，`--muted-foreground`，`opacity .55`）替代左右交替提供节奏——这是装饰性编号，不参与信息层级。
- 本次上线 5 篇 < `pageSize` 10，分页器不渲染；但样式必须按 §6.17 备好，**不要**把分页逻辑写死。
- 分页器：居中，页码 36×36 圆角 8，当前页 `bg: hsl(var(--primary)/0.12)` + 文字青 + 底部 2px 青条。

### 5.2 文章列表 `/posts`

结构与首页主栏一致（Hero 220 + 单列横向卡 + 分页器），差异：

- Hero 高度 220px（`title` 模式），标题 36px，去掉 subtitle。
- 顶部加一行面包屑 `首页 / 共 N 篇文章`，12px mono，高 40px。
- 侧栏保留个人信息卡 + 菜单，去掉「最近标签云」。
- **不做** 2 列网格；**不做** 左右交替 `clip-path` 对角切角（这是 Shoka 标记最强的元素，必须删）。

### 5.3 文章详情 `/post/[...slug]`

```
┌ Header 60 ───────────────────────────────────────────────────┐
├ Hero 160px：面包屑 12px / 标题 40px 700 / 日期·字数 12px mono  │
├───────────────────────────┬──────────────────────────────────┤
│ 主栏 8 列，正文 max 68ch  │ 侧栏 4 列 320px sticky top 80     │
│ ┌ 摘要面板 ─────────────┐ │ ┌ 分段控件（目录/信息/系列）──┐  │
│ │ 1px 左青条 + 14px 说明 │ │ │ 高 32，圆角 8              │  │
│ └───────────────────────┘ │ ├ 目录 13px 项高 32 ──────────┤  │
│ ┌ .prose ───────────────┐ │ │ 激活：青字 + 左 2px 青条   │  │
│ │ 17px/1.85             │ │ └───────────────────────────┘  │
│ │ H2 26 / H3 20 / H4 17 │ │ ┌ 系列文章列表（可选）────────┐  │
│ │ 代码块 / 表格 / 提示条 │ │ └───────────────────────────┘  │
│ └───────────────────────┘ │ ┌ 滚动进度（2px 青→紫渐变）──┐  │
│ ┌ 上一篇 / 下一篇 2 列 ─┐ │ └───────────────────────────┘  │
│ └───────────────────────┘ │                                  │
├───────────────────────────┴──────────────────────────────────┤
│ 相关文章 / 随机文章（保留现有 PostFooter，改 2 列卡片样式）     │
│ Footer                                                        │
└──────────────────────────────────────────────────────────────┘
```

- Hero 上的「复制链接」图标：18px，颜色 `--muted-foreground`，hover 变青 + `--glow-cyan-sm`。
- 正文中的链接：青色 + `text-underline-offset: 3px` + `text-decoration-thickness: 1px`，hover 时下划线由 0→100% 宽度走一遍（`background-image` 渐变实现，200ms）。**不加发光**。
- `.prose` 内 `h2` 前加 4×18 青色竖条（`border-left`），`h3` 前加 4×4 菱形。
- 加密文章、`isFallback` 提示条：见 6.21。

### 5.4 分类 `/categories` 与 `/categories/[...slug]`

- Hero 220px（title 模式）。
- 分类列表改为**两列分组卡**（不是原来的「树形缩进 + 虚线」）：
  - 一级分类：24px 700 标题 + 右侧 mono 青色计数，整行高 56，底部 1px `--border`。
  - 二级分类：13px，`padding-left: 20px`，行高 40，左侧 1px 竖线（`--border`），hover 时竖线变青。
- 分类详情页：Hero 240px 带分类名 + 计数；主栏顶部分类描述（14px muted，最多 3 行）；下面接单列横向卡列表。

### 5.5 标签 `/tags` 与 `/tags/[tag]`

- `/tags`：Hero 220；标签用**芯片墙**：`display: flex; flex-wrap: wrap; gap: 8px`；芯片规格见 6.14；按数量降序，前 20 个用「青色描边」突出，其余用「中性描边」；单次出现标签默认折叠（沿用 `CollapsibleTags`）。
- `/tags/[tag]`：结构与文章列表一致，Hero 显示 `#标签名`（前置 `#` 用 `--neon-violet`，字号 0.8em）。

### 5.6 归档 `/archives`

时间线改为**左侧竖线 + 节点**：

```
2025 ──●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 12 篇
       │  06-18   文章标题 …………………… 15px
       │  05-02   文章标题 …………………… 15px
2024 ──●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 31 篇
```

- 竖线：`width: 1px`，颜色 `--border`，从左 8px 处垂直贯穿所有年份。
- 年份节点：`12×12` 圆点，青填充 + `--glow-cyan-sm`，垂直位置与年份标题中线对齐。
- 年份标题：22px 700，后接 mono 12px 青色计数。
- 条目：高 36，日期列固定 88px（mono 12px muted），标题 15px，hover 时整行 `bg: hsl(var(--primary)/0.06)` + 标题变青 + 左侧补一个 3×3 青点。
- 移动端（≤768）：竖线隐藏，年份变成 sticky 吸顶条（高 40，`bg: var(--background)` + 底部 1px 线）。

### 5.7 关于 `/about`

- 这是 `PageLayout` 渲染的 Markdown 页，正文用 `.prose`。
- 顶部加「个人卡横向版」：头像 72×72 + 昵称 + 简介 + 社交，平铺成一行，高 120，玻璃卡。
- 正文中「联系」「平台」「社交」三个小标题统一 `h3` + 前置青竖条。
- 链接列表：每项前加 `→` 青色箭头（`::before`），hover 时箭头 `translateX(3px)`。

### 5.8 404

- Hero 不显示（`title` 为空即跳过），整页只有主栏居中内容，最大宽 720，垂直居中 `min-height: calc(100dvh - 60px)`。
- 保留现有「404 猫」SVG（有记忆点），但**全部改线框青色**：`--c-stroke: hsl(186 100% 55% / 0.55)`、`--c-features: hsl(210 22% 80%)`，去掉粉色与渐变按钮。
- 加一层 glitch：整组 SVG 每 4.8s 做一次 120ms 的 `translateX(±2px)` + 青色/紫色重影（`filter: drop-shadow(2px 0 0 cyan) drop-shadow(-2px 0 0 violet)`），`reduced-motion` 下禁用。
- 两个按钮改用「主按钮 / 次按钮」规格（见 6.13），不再用粉色渐变。

---

## 6. 组件规格

> 通用约定：所有过渡 `200ms cubic-bezier(0.16, 1, 0.3, 1)`；所有 `hover` 位移不超过 `2px`；所有边框 `1px`。

### 6.1 顶部导航 `Header.astro` / `Navigator.tsx`

| 项 | 值 |
|---|---|
| 高度 | 60px（≤992 为 56px） |
| 定位 | `fixed; top:0; inset-inline: 0; z-index: 30` |
| 初始背景 | 透明（Hero 之上） |
| 滚动后（`.with-background`） | `background: hsl(var(--background) / 0.72)` + `backdrop-filter: blur(16px) saturate(1.2)` + 底部 `1px solid hsl(var(--border) / 0.6)` |
| 内容布局 | `max-width: var(--content-max); padding: 0 24px`，三段 flex：logo / 菜单（`margin-left: 32px`）/ 右侧图标组（`margin-left: auto`） |
| 菜单项 | 14px / 600 / 字距 0.06em，`padding: 8px 12px`，圆角 6 |
| 菜单 hover | `background: rgba(255,255,255,0.05)`；文字到 `--foreground`；无位移 |
| 菜单激活 | 文字 `--primary`；`background: hsl(var(--primary) / 0.09)`；下缘 2px 条，宽度 60%，`background: var(--primary)` + `box-shadow: 0 0 12px hsl(var(--primary)/0.6)` |
| 下拉菜单 | 宽 200，`--glass-bg-strong` + `blur(20px)`，圆角 10，顶部 1px `--glass-border-top`，阴影 `--shadow-pop`；项高 36，13px；hover 同菜单 |
| 右侧图标组 | 3 个 32×32，圆角 8，`gap: 4px`，图标 18px |
| 图标 hover | `background: hsl(var(--primary)/0.08)` + `border-color: hsl(var(--primary)/0.35)` |
| 滚动隐藏 | 保留现有「下滚隐藏 / 上滚出现」逻辑（`-translate-y-full`），过渡 300ms |

### 6.2 Logo（替换 `.logo-text`）

- 结构改为「符号 + 文字」：
  - 符号：`24×24`，圆角 6，`1.5px solid hsl(var(--primary)/0.75)` 描边 + 内部一条 45° 短线（`1.5px`，青），中心一个 3×3 青点。整体配 `--glow-cyan-sm`。
  - 文字：`16px / 600 / 字距 0.12em / uppercase`，颜色 `--foreground`，内容为站点 `alternate`。
- hover：符号描边到 `--primary` 全亮，`box-shadow: 0 0 18px hsl(var(--primary)/0.35)`；文字 `color: --primary`，`text-shadow: 0 0 18px hsl(var(--primary)/0.30)`。
- **删除**：`.logo-text` 中的 `text-shadow: 3px 4px 2px #060000, -1px -1px 0 #ffffff`、`color: #e9546b`、`font-family: "Bear Days"`。`Bear Days` 字体文件可保留但不再引用。
- 移动端（`MobilePostHeader`）沿用同一套颜色，logo 缩到 20×20、文字 14px。

### 6.3 Hero Banner `Cover.astro`

| 项 | 值 |
|---|---|
| 高度 | 320px（≥1480）/ 280px（993–1479）/ 220px（≤992）/ 180px（≤768）/ 152px（≤480） |
| 背景层 1 | `background: hsl(222 30% 7%)` |
| 背景层 2（光晕） | `radial-gradient(680px 380px at 22% 42%, hsl(186 100% 55% / 0.16), transparent 70%)` + `radial-gradient(560px 420px at 78% 62%, hsl(280 95% 68% / 0.14), transparent 72%)` |
| 背景层 3（网格） | `linear-gradient(var(--grid-line) 1px, transparent 1px)`, `linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)`，`background-size: 32px 32px`；上下用 `mask-image: linear-gradient(180deg, transparent, #000 25%, #000 75%, transparent)` 淡出 |
| 背景层 4（海报图） | `opacity: .12`，`filter: grayscale(1) contrast(1.15)`，`mix-blend-mode: luminosity`，`object-fit: cover` |
| 背景层 5（噪点） | 一层 200×200 的内联 SVG `feTurbulence`，`opacity: var(--noise-opacity)`，`mix-blend-mode: overlay` |
| 视频 | **删除** `/video/top.mp4` 及其 `canplaythrough` 逻辑 |
| 底边 | `1px` `linear-gradient(90deg, transparent, hsl(var(--primary)/0.50), transparent)` |
| 内距 | `padding: 0 24px`；内容块 `max-width: var(--content-max)`，左对齐 |
| eyebrow | `12px mono / 500 / 字距 0.18em / uppercase / color: --primary`，后接 `│` 分隔与 `12px` muted 的日期 |
| H1 | `44px / 700 / -0.03em`，`text-shadow: 0 0 28px hsl(186 100% 55% / 0.28)`（**只此一处允许文字发光**） |
| subtitle | `15px / 400 / 1.7`，`--muted-foreground` |
| meta 行 | `12px mono`，各项之间 `1px` 竖线 `rgba(255,255,255,0.12)`，间距 12px |
| 右侧装饰 | 300×300 圆，`border: 1px solid hsl(var(--primary)/0.10)`，内部 3 圈同心圆（0.25/0.5/0.75 缩放），`animation: rotate 90s linear infinite` |
| 文章页变体 | 高 160px；标题 40px；面包屑在上；右下角放「复制链接」18px 图标 |
| 移动端 | ≤768 隐藏右侧装饰圆与 poster 层，只保留底 + 光晕 + 网格 |

### 6.4 侧栏个人信息卡 `HomeInfo.astro`

| 项 | 值 |
|---|---|
| 容器 | 宽 100%（侧栏 320），`padding: 24px`，`border-radius: 12px`，`background: var(--glass-bg)`，`backdrop-filter: blur(16px)`，边框用「上亮下暗」渐变的 border-image 方案（见下） |
| 玻璃边框 | `border: 1px solid transparent;` + `background-clip: padding-box, border-box;` `background-image: linear-gradient(var(--glass-bg), var(--glass-bg)), linear-gradient(160deg, var(--glass-border-top), var(--glass-border-bottom) 55%, var(--glass-border-bottom));` + `box-shadow: var(--glass-inner-glow)` |
| 头像（霓虹 monogram，**正式方案**） | **88×88** 渲染，`border-radius: 20px`（不用圆形）。**结构**：深底 `hsl(222 26% 9%)` + 字形「烁」居中 + `1px solid hsl(var(--primary)/0.35)` 描边 + `box-shadow: 0 0 24px hsl(var(--primary)/0.16)`。**字形**：`font-family: var(--font-display)`，`font-size: 40px`，`font-weight: 700`，`color: --primary`，`letter-spacing: 0`，`line-height: 1`，视觉居中（`transform: translateY(-1px)` 修正中文字形的基线偏移）。**实现为手写 SVG**，矢量、无固定像素尺寸，按 88 渲染（关于页 72、抽屉 72 同源复用同一 SVG），不引入位图 |
| 头像 hover | `scale(1.03)` 200ms；描边提到 `hsl(var(--primary)/0.55)`，发光提到 `0 0 32px hsl(var(--primary)/0.28)`。**删除** `hover:animate-shake`（抖动与冷峻气质冲突） |
| 昵称 | 18px / 700 / -0.02em，上距 16px |
| 简介 | 13px / 1.7 / `--muted-foreground`，上距 8px，居中，最多 2 行 |
| 社交图标 | 28×28，圆角 8，`gap: 8px`，上距 16px；图标 16px；默认 `--muted-foreground` + `border: 1px solid hsl(var(--border)/0.6)`；hover 文字青 + 边框 `hsl(var(--primary)/0.4)` + `--glow-cyan-sm` |
| 统计区 | 三列 `grid-template-columns: repeat(3, 1fr)`，上距 20px，`border-top: 1px solid hsl(var(--border)/0.6)`，`padding-top: 16px` |
| 统计数字 | 20px / 700 / mono / `font-variant-numeric: tabular-nums` / 颜色 `--primary` |
| 统计标签 | 11px / 500 / 字距 0.12em / `uppercase` / `--muted-foreground`，上距 4px |
| 列分隔 | `1px` 竖线 `hsl(var(--border)/0.5)`，高 28px，垂直居中 |
| 统计 hover | 数字 `text-shadow: 0 0 16px hsl(var(--primary)/0.35)` |

### 6.5 侧栏导航菜单

| 项 | 值 |
|---|---|
| 容器 | 上距 16px，`gap: 4px`，`flex-direction: column` |
| 项 | 高 40px，`padding: 0 12px`，圆角 8，`font-size: 14px / 500`，`gap: 10px` |
| 图标 | 16px |
| 默认 | 文字 `--muted-foreground`；左侧 2px 条 `scaleY(0)` |
| hover | `background: rgba(255,255,255,0.04)`；文字 `--foreground`；左条 `scaleY(1)` 颜色 `hsl(var(--primary)/0.5)`，180ms |
| 激活 | `background: hsl(var(--primary)/0.09)`；文字 `--primary / 600`；左条实心 `--primary` + `box-shadow: 0 0 12px hsl(var(--primary)/0.55)`；图标同步变青 |
| 子项 | 缩进 12px，高 36，13px；当前子项同「激活」但背景降到 `0.06` |
| 「文章」可折叠项 | 折叠箭头 16px，`rotate(180deg)` 200ms；展开动画沿用现有 CSS Grid `0fr→1fr` 技巧，`300ms` |
| **删除** | `bg-gradient-shoka-button` 的粉色胶囊按钮形态、`shoka-button-shadow`（`0 0 0.75rem` 粉色实心外扩）、`rounded-xl` 12px 圆角 |

### 6.6 文章卡片 `PostItemCard.astro`（列表项）

| 项 | 值 |
|---|---|
| 容器 | 横向 flex，`gap: 20px`，`padding: 16px`，圆角 12，`background: var(--glass-bg)`，玻璃边框同 6.4 |
| 高度 | 桌面 ≈ 188px（缩略图 156 + padding）；≤768 改为纵向，缩略图全宽 16:9 |
| 缩略图 | **248×156**（`aspect-ratio: 16/10`），圆角 8，`object-fit: cover`；`flex-shrink: 0` |
| 缩略图处理 | **全站统一罩层，不做逐图特例**：`filter: brightness(0.92) saturate(0.88) contrast(1.03)` + 上层 `background: linear-gradient(180deg, transparent 45%, rgba(11,14,20,0.55))` + 整图叠 `rgba(11,14,20,0.06)`。目的见下方「封面亮度上限」 |
| 封面亮度上限（系统级规则） | 页面**最亮的对象必须是 Hero 的青紫光晕与激活态**，不能是任意一张封面。因此 5 张封面 + 置顶 Feature 封面**一律套同一层 `brightness(0.92)` + 6% 页面底色 scrim**，不允许某张单独更亮或更暗 |
| 缩略图 hover 缩放 | `scale(1.04)`，600ms `ease-out`。**删除** 现有 `group-hover:rotate-3` |
| 元信息行 | 12px mono，`--muted-foreground`，字距 0.06em，`uppercase`；分类前置 12px 青色 `▸`；项间 1px 竖线 `rgba(255,255,255,0.12)` |
| 标题 | 20px / 600 / -0.015em，`--foreground`，`line-clamp: 2`；上距 8px |
| 标题 hover | `color: --primary` |
| 摘要 | 14px / 1.7，`--muted-foreground`，上距 6px。**裁切规则：`line-clamp: 2`（≥769px）/ `line-clamp: 3`（≤768px）** —— 现有 `description` 硬上限 78 字。另须 `overflow-wrap: anywhere` 兜长英文 slug。**必须加 `min-height: 2 行 = 48px`（≥769px）/ `3 行 = 72px`（≤768px）**：现有 5 篇摘要 51–78 字不等，不锁最小高会导致卡片高低参差、整列节奏散掉 |
| 摘要容量实测 | 78 字边界样本（`tailwind-v4-migration` 那篇）：≥1480 时文字列宽 708px ≈ 50 字/行 → 1.6 行；993–1479 时 552px ≈ 39 字/行 → **正好 2.0 行（最紧的一档）**；769–992 时 660px ≈ 47 字/行 → 1.7 行；≤480 时 311px ≈ 22 字/行 → 3.5 行（第 4 行为补语，3 行截断不影响信息完整度）。**结论：78 字不需要删，但 993–1479 这一档没有余量，摘要不要再加字** |
| 标签 | 芯片规格见 6.14，`gap: 6px`，上距 10px；最多显示 3 个 + `+N` |
| 「阅读 →」 | 13px / 500 青，`margin-top: auto`；箭头 `translateX(4px)` 200ms；**删除** 现在的粉色 `more...` 按钮 + 绝对定位角标 |
| 序号 | 左上角 `01–04`，12px mono，`--muted-foreground`，`opacity .55`，`letter-spacing: .08em`。三条硬要求：① **由列表索引生成并加 `aria-hidden="true"`**（否则读屏会先念「零一」再念标题，信息顺序乱）；② **只在首页「文章列表」段渲染**，置顶 Feature 卡、分类/标签/归档页一律不渲染（同屏出现两个 `01` 会被误读成列表重复）；③ 序号是**位置**不是身份，不得写进分享卡/OG 图/封面图等任何会被外部引用的地方 |
| 卡片 hover | `transform: translateY(-2px)`；`box-shadow: var(--shadow-card), 0 0 0 1px hsl(var(--primary)/0.18), 0 0 24px hsl(var(--primary)/0.10)`；260ms |
| 卡片 active | `translateY(0) scale(0.995)`，120ms |
| 卡片之间 | 只用 `gap: 16px`，**不加分割线** |
| 封面素材 | 1200×630（约 1.9:1），卡片内 `object-fit: cover` 裁到 16:10 —— 主体与大字标题须落在中央 **safest area：居中 1120×520**，否则 16:10 裁切会切掉标题首尾 |
| **删除** | `clip-path-post-img-left/right` 对角切角、左右交替布局（`contentConfig.postCardImagePosition` 的 `alternating` 语义保留但 UI 一律 `left`）、`shadow-card`（0 5px 15px 的软阴影） |

### 6.7 精选分类卡 `CategoryCards.astro`

| 项 | 值 |
|---|---|
| 网格 | `grid-template-columns: repeat(3, 1fr); gap: 16px`（≥1480 与 993–1479 都是 3 列，因为主栏 ≥812 能放 3 张 260 宽卡）；≤992 的 2 列；≤768 的 1 列 |
| 卡片比例 | **`aspect-ratio: 16/9`**，`min-height: 168px` —— 与素材 800×450 完全一致，**零裁切**（3 列时单卡约 306×172，正好放得下一行 20px 标题 + 一行 12px 说明） |
| 素材安全区 | 800×450 内，**标题与主体必须落在居中 720×405**，四边各留 40px；因为 ≤992 变 2 列、≤768 变 1 列时卡片宽度变化，`object-cover` 可能横向多裁几像素 |
| 圆角 | 12px |
| 封面 | `object-fit: cover`，`filter: saturate(0.9)` |
| 覆盖层 | `linear-gradient(180deg, rgba(11,14,20,0.20) 0%, rgba(11,14,20,0.55) 55%, rgba(11,14,20,0.92) 100%)` —— 这是解决「粉色描边字看不清」的核心手段：**文字一律压深底 + 暖白字** |
| 分类名 | 20px / 700 / -0.015em / `--foreground`；`text-shadow: 0 1px 12px rgba(0,0,0,0.65)`；**去掉** 现有的 `text-primary`（青字压白图不可读）与 `shadow-text-on-light` |
| 计数 | 右上角 `12px mono`，`--neon-cyan`，`background: rgba(11,14,20,0.65)`，`padding: 2px 6px`，圆角 4 |
| 底部说明 | 左下角 `12px`，`--muted-foreground`，只放 **1 行**（16:9 卡高度有限）：显示文章篇数或最相关的一个子分类，`line-height: 22` |
| hover | 封面 `scale(1.04)` 400ms；顶部进度条 `height: 2px`，`background: linear-gradient(90deg, var(--primary), var(--neon-violet))`，宽度 `0 → 100%` 300ms；卡片 `box-shadow: var(--shadow-card), 0 0 0 1px hsl(var(--primary)/0.22)` |
| **删除** | `FlippedCard` 3D 翻转（翻到背面才是「有信息」的卡，等于首屏什么也看不到）、缎带角标（`after:border-*` 三角）、所有 `bg-gradient-shoka-button` 的「more...」按钮 |

### 6.8 空状态 `EmptySvg` + `PostList`

| 项 | 值 |
|---|---|
| 容器 | `min-height: 320px`，`display: grid; place-items: center`，文字居中，`padding: 48px 24px` |
| 图标 | `96×96` 线框 SVG：一个「终端窗口」轮廓（圆角 8，`1.5px` 描边 `hsl(var(--primary)/0.45)`），内部 3 条 12px 宽的扫描线，`animation: scan 3s linear infinite`（`translateY(0→18px)` + `opacity` 跟随）；底部配一个 6×14 的青色光标方块，`animation: blink 1.1s step-end infinite` |
| 主文案 | 18px / 600 / `--foreground`，上距 24px：「这里还没有文章」 |
| 副文案 | 14px / 1.7 / `--muted-foreground`，上距 8px，最大宽 320：「第一篇正在路上。先去归档或分类里翻翻？」 |
| CTA | 主按钮「浏览归档」+ 次按钮「全部标签」，`gap: 12px`，上距 24px |
| 底部提示 | `12px mono`，`--muted-foreground`，上距 24px，放在 `border: 1px dashed hsl(var(--border))` 圆角 6 的条里：「$ ls ./posts --empty」 |
| 空状态变体 | 分类/标签为空时文案换成对应语义，图标不变 |

### 6.9 右侧悬浮工具组 `FloatingGroup.tsx`

**收敛方案**：3 个按钮（↑ ↓ ×）→ 只保留 **2 个**，并且删掉「×（收起）」这个交互。

| 项 | 值 |
|---|---|
| 位置 | `right: 24px; bottom: 24px`（≤768 为 16px） |
| 排布 | 竖向 `gap: 8px` |
| 按钮 1 | 返回顶部，40×40，圆角 10 |
| 按钮 2 | 打开搜索（显示 `⌘K` tooltip），40×40，圆角 10；**≤768 隐藏**（移动端搜索在导航里） |
| 背景 | `rgba(14, 18, 26, 0.72)` + `backdrop-filter: blur(12px)` |
| 边框 | `1px solid rgba(255,255,255,0.10)` |
| 图标 | 18px，`--primary` |
| hover | `border-color: hsl(var(--primary)/0.40)`；`box-shadow: 0 0 18px hsl(var(--primary)/0.22)`；`translateY(-2px)`；200ms |
| 出现条件 | `scrollY > 240` 时 `opacity 0→1` + `translateY(8px→0)`，240ms；其余时间 `pointer-events: none; opacity: 0` |
| 抽屉打开时 | `translateX(120px) + opacity 0`（保留现有逻辑） |
| **删除** | 「×」收起按钮、上下两个箭头中的「到底部」、暗紫暗红配色（来自 `text-primary` 旧值 + `bg-background/80`） |

### 6.10 搜索弹层 `SearchDialog.tsx`

| 项 | 值 |
|---|---|
| 遮罩 | `rgba(6, 9, 14, 0.72)` + `backdrop-filter: blur(8px)`；淡入 180ms |
| 面板 | 宽 640（≤768 为 `calc(100vw - 32px)`），顶部对齐 `12vh`；圆角 14；`background: rgba(18, 23, 32, 0.92)` + `blur(24px)`；`border: 1px solid rgba(255,255,255,0.10)`；`box-shadow: var(--shadow-pop)` |
| 面板内顶部高光 | `inset 0 1px 0 rgba(255,255,255,0.08)` |
| 输入区 | 高 56，`padding: 0 20px`，16px，无边框；占位符 `--muted-foreground` |
| 聚焦指示 | 输入区下缘 1px 线段，`background: linear-gradient(90deg, transparent, var(--primary), transparent)`，`scaleX(0→1)` 260ms |
| 结果项 | 高 56，`padding: 0 16px`，圆角 8，`gap: 12px` |
| 结果 hover / 键盘激活 | `background: hsl(var(--primary)/0.08)`；左缘 2px 青条；标题 `--primary` |
| 结果标题 | 14px / 600 / `--foreground`；摘要 12px / `--muted-foreground`，`line-clamp: 1` |
| 快捷键徽章 | 11px mono，`padding: 2px 6px`，`border: 1px solid rgba(255,255,255,0.12)`，圆角 4，`--muted-foreground` |
| 空结果 | 复用 6.8 的图标，缩到 64×64，文案「没有匹配的条目」 |
| 底部条 | 高 40，`border-top: 1px solid var(--border)`，左侧 3 组快捷键提示（`↑↓` 选择 / `↵` 打开 / `esc` 关闭），12px mono |

### 6.11 移动端抽屉 `MobileDrawer.astro`

| 项 | 值 |
|---|---|
| 宽度 | `min(86vw, 320px)` |
| 背景 | `hsl(222 27% 8% / 0.96)` + `blur(20px)` |
| 右缘 | `1px solid rgba(255,255,255,0.08)` |
| 顶部区 | 高 64，关闭按钮 32×32 圆角 8（`--muted-foreground`，hover 青） |
| 导航项 | 高 44，15px / 500，圆角 8；激活规格同 6.5 但背景升到 `0.10` |
| 个人信息 | 复用 6.4，头像缩到 72×72，去掉统计区（省高度） |
| 打开动效 | `translateX(-100% → 0)`，280ms `cubic-bezier(0.22, 1, 0.36, 1)`；遮罩 200ms；关闭 220ms |
| 遮罩 | `rgba(6, 9, 14, 0.66)` + `blur(4px)` |
| 焦点 | 打开后焦点移到关闭按钮；`Esc` 关闭；保留现有 scroll-lock |

### 6.12 页脚 `Footer.astro`

| 项 | 值 |
|---|---|
| 上边距 | `margin-top: 64px`（≤768 为 48px） |
| 顶部光带 | `height: 1px`，`background: linear-gradient(90deg, transparent, hsl(var(--primary)/0.45), hsl(var(--neon-violet)/0.35), transparent)` |
| 内距 | `padding: 40px 24px 32px` |
| 布局 | 桌面三段：左（站点名 15px/600 + 一句话 12px muted）/ 中（统计）/ 右（社交 + ICP）；≤768 单列居中，`gap: 16px` |
| 统计项 | 图标 16px + 数字 13px mono 青 + 单位 11px muted；项间 `1px` 竖线 `rgba(255,255,255,0.12)` |
| 版权行 | 12px / `--muted-foreground`；`©` 与年份 digit 用 mono |
| 樱花图标 | 换成 6×6 青色菱形（旋转 45°），`animation: pulse 3.2s ease-in-out infinite`（`opacity .4→.8`）；`reduced-motion` 下静止 |
| hover | 所有链接文字 → `--primary`，下划线 0→100% 宽 200ms |
| **删除** | `text-[#FFC0CB]`、`opacity-75` 的灰蒙蒙观感（改用明确的 `--muted-foreground`） |

### 6.13 按钮

| 变体 | 规格 |
|---|---|
| 主按钮 | 高 40（大号 44），`padding: 0 20px`，圆角 8；`background: linear-gradient(135deg, hsl(186 100% 55%), hsl(196 100% 44%))`；文字 14px/600，颜色 `--primary-foreground`（`#080b11`，12.5:1）；`box-shadow: 0 2px 12px hsl(186 100% 55% / 0.18)` |
| 主按钮 hover | `filter: brightness(1.08)`；`box-shadow: 0 0 24px hsl(186 100% 55% / 0.35)`；`translateY(-1px)`；200ms |
| 主按钮 active | `translateY(0) scale(0.985)`，120ms |
| 主按钮 disabled | `opacity: .45`；`filter: grayscale(.6)`；`cursor: not-allowed` |
| 次按钮 | 透明底；`border: 1px solid hsl(var(--primary)/0.35)`；文字 `--primary`；其余同主按钮 |
| 次按钮 hover | `background: hsl(var(--primary)/0.10)`；`border-color: hsl(var(--primary)/0.60)`；`box-shadow: 0 0 18px hsl(var(--primary)/0.18)` |
| 文字按钮 | 无底无边；`--muted-foreground`；hover `--primary` + 下划线 `offset 4px` |
| 危险按钮 | 同次按钮，色相换 `--destructive` |
| 图标按钮 | 32×32（导航）/ 40×40（悬浮），圆角 8/10 |
| 焦点（全部） | 见第 9 节 |

### 6.14 徽章 / 芯片

| 类型 | 值 |
|---|---|
| 基础 | 高 22，`padding: 0 8px`，圆角 6，`font-size: 12px / 600 / 字距 0.04em`，`display: inline-flex; gap: 4px` |
| 青（分类/主标签） | `background: hsl(var(--primary)/0.12)`；文字 `--primary`；`border: 1px solid hsl(var(--primary)/0.30)` |
| 紫（辅助标签） | `background: hsl(var(--neon-violet)/0.12)`；文字 `--neon-violet-soft`（6.88:1）；`border: 1px solid hsl(var(--neon-violet)/0.30)` |
| 中性（标签云默认） | `background: rgba(255,255,255,0.05)`；文字 `--muted-foreground`；`border: 1px solid hsl(var(--border))` |
| 琥珀（草稿/提示） | `background: hsl(38 100% 62% / 0.12)`；文字 `--neon-amber`；`border: 1px solid hsl(38 100% 62% / 0.30)` |
| hover | `border-color` 提到 `0.55`；文字提到纯色；**不发光**（避免给 20 个标签 20 处光） |
| 标签芯片（标签墙用） | 高 28，`padding: 0 12px`，圆角 6，13px/500；计数 11px mono 青，`margin-left: 6px` |

### 6.15 分割线（含带标题的分割线）

```css
/* 纯线 */
height: 1px;
background: linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.10) 20%, hsl(0 0% 100% / 0.10) 80%, transparent);

/* 带标题：用于「文章列表」「精选分类」 */
.hd { display: flex; align-items: center; gap: 16px; }
.hd::before { content: ""; width: 6px; height: 6px; background: var(--primary);
              transform: rotate(45deg); box-shadow: 0 0 10px hsl(var(--primary)/0.55); flex: none; }
.hd > .label { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--foreground); }
.hd::after { content: ""; flex: 1; height: 1px;
             background: linear-gradient(90deg, hsl(var(--primary)/0.35), transparent); }
```

### 6.16 面包屑

- 高 40，`padding: 0 4px`，13px，`--muted-foreground`；分隔符 `›`（14px，`--border` 色）；当前页 13px / 500 / `--foreground` + `background: hsl(var(--primary)/0.08)` + `padding: 2px 8px` + 圆角 4。
- hover 项 → `--primary`，200ms。

### 6.17 分页器 `Paginator.astro`

- 居中，`gap: 8px`，上距 32。
- 页码：36×36，圆角 8，13px mono；默认 `--muted-foreground` + `border: 1px solid hsl(var(--border))`；hover `border-color: hsl(var(--primary)/0.45)` + 文字青；当前页 `background: hsl(var(--primary)/0.12)` + 文字青 + `border-color: hsl(var(--primary)/0.45)` + 下缘 2px 青条。
- 上一页/下一页：`padding: 0 14px`，高 36，文字 13px。
- ≤480：只显示「上一页 / 当前 / 下一页」，中间页码折叠为 `1 … 4 5 6 … 12`。

### 6.18 目录 `TableOfContents`

- 项：高 32，13px，`padding-left: 12px`，左缘 2px 透明条。
- 默认 `--muted-foreground`；hover 文字 `--foreground` + 左条 `hsl(var(--primary)/0.45)`。
- 激活：文字 `--primary / 500` + 左条实心 `--primary` + `box-shadow: 0 0 10px hsl(var(--primary)/0.45)`。
- 层级缩进：每级 `+12px`；H3 及以下字号降到 12px。
- 编号（`counter` 方案保留）：编号弱化为 `--muted-foreground` 40% 透明度。
- sticky `top: 80px`，`max-height: calc(100dvh - 120px)`，`overflow-y: auto`，滚动条用 `.vertical-scrollbar`（青 thumb）。

### 6.19 代码块与行内代码

| 项 | 值 |
|---|---|
| 行内 code | `background: hsl(186 100% 55% / 0.10)`；文字 `--primary`；`padding: 2px 6px`；圆角 4；13px；**无阴影、无 hover 变化**（现在有 hover 变化，会误以为是链接） |
| 代码块容器 | **`background: hsl(222 34% 4%)`（比正文底 `222 28% 6%` 更暗，不是更亮）**；`border: 1px solid rgba(255,255,255,0.07)`；圆角 10；`margin: 1.5em 0` |
| **代码块亮度硬规则** | 代码块背景**必须比正文背景更暗**。原因：赛博朋克那篇正文有 3 段代码块 + 5 条编号清单，一旦代码底色比正文亮，3 个大色块会连成一条视觉带，把标题从中轴线上挤下去。深底 + 1px 细描边 + 顶栏已经足够把代码区框出来，不需要靠提亮。内容侧的原话可以直接当设计依据：**「它不发光，但它被看见——这恰恰是发光标题需要的对比。」** |
| 代码块顶栏 | 高 32，`background: rgba(255,255,255,0.03)`，底部 1px `var(--border)`；左侧 3 个 8px 圆点（`#ff5f57` `#febc2e` `#28c840` 各降饱和到 `.5` 透明度）；右侧语言标签 11px mono `--primary`；**顶栏是代码块里唯一允许比容器亮的部分** |
| 代码正文 | 13px / 1.7 / mono；`padding: 16px 20px`；`tab-size: 2` |
| 行高亮 | `background: hsl(186 100% 55% / 0.07)` + 左缘 2px 青条 |
| 复制按钮 | 32×32，圆角 6，默认 `opacity: 0`，块 hover 时 `opacity: 1`；成功时图标变 `--success` 并淡出 1.2s |
| Shiki 主题 | 保留现有 `github-dark`（与深空底接近），但把 `--shiki-*` 里的注释色替换为 `#6b7a8c`，保证 ≥4.5:1 |
| 全屏按钮 | 与复制按钮同规格，`⌘` 图标 |

### 6.20 表格

- 容器 `border: 1px solid var(--border)`，圆角 10，`overflow: hidden`。
- 表头：`background: rgba(255,255,255,0.04)`，13px / 600 / 字距 0.04em，`--foreground`，高 44。
- 单元格：13px / 1.6，`padding: 12px 16px`；行边框 `1px solid hsl(var(--border)/0.7)`。
- 斑马纹不用底色，用 `:hover` 行 `background: hsl(186 100% 55% / 0.05)`。
- 数字列 `font-variant-numeric: tabular-nums` + `text-align: right`。
- ≤768：横向滚动，`overflow-x: auto`，滚动条用 `.horizontal-scrollbar`。

### 6.21 提示条（note / alert / fallback）

- 容器：`padding: 12px 16px`，圆角 8，`border-left: 2px solid var(--accent-color)`，`background: hsl(var(--accent-color) / 0.08)`。
- 图标 16px 同色；文字 14px / 1.7 `--foreground`。
- 四色：info 青、success `--success`、warning `--neon-amber`、danger `--destructive`。
- 正文里的 `note-block` 沿用这个规格（替换现在 `.note-block` 的 4px 左边框和 emoji 图标，改 16px 线性图标）。

### 6.22 上一篇 / 下一篇

- 2 列 `grid`，`gap: 12px`，`margin-top: 48px`。
- 卡片：`padding: 16px`，圆角 10，玻璃底；方向标签 11px mono uppercase `--muted-foreground`；标题 15px / 600，`line-clamp: 1`。
- hover：边框 `hsl(var(--primary)/0.40)` + `--glow-cyan-sm`；箭头 `translateX(±4px)`。
- ≤768 单列，箭头朝下。

### 6.23-A 置顶 Feature 卡（首页唯一一张）

首页置顶只有 1 篇，**不能做成 2 列网格，也不能做成占满首屏的巨型 Hero**（它下面还有 4 篇同等权重的常规卡，压得太重会造成信息权重失衡）。

| 项 | 值 |
|---|---|
| 容器 | 全宽（主栏 8 列内 100%），`border-radius: 14px`，`overflow: hidden`，玻璃边框 |
| 高度 | 桌面 **272px**（封面区 16:10 裁切铺满）；≤992 为 232px；≤768 为 200px（改为封面在上、文字在下的堆叠） |
| 封面 | 满宽 `object-fit: cover`，`filter: brightness(0.94) saturate(0.9) contrast(1.03)`（比列表卡亮 2%，保留置顶权重，但仍在全局亮度上限内） |
| 覆盖层 | 三段式 `linear-gradient(90deg, rgba(11,14,20,0.92) 0%, rgba(11,14,20,0.72) 46%, rgba(11,14,20,0.12) 100%)` —— 文字压在左半区，右侧留出封面主体 |
| 角标 | 左上角 `置顶` 芯片：高 22，`padding: 0 8px`，圆角 6，11px / 700 / 字距 0.1em，青底 `hsl(var(--primary)/0.16)` + 青字 + 1px 青边 |
| 标题 | **28px / 700 / -0.025em / 行高 1.3**，`--foreground`，**`line-clamp: 2` 且必须按两行预留高度（2 × 36.4 ≈ 73px）**，最大宽 `60%`。现有置顶篇《用 Astro 5 把博客重写了一遍》15 个字，左半区（约 604px 文字宽）在 28px 下约 21 字/行，实际会排成 1 行，**但仍要预留 2 行**——标题含「Astro 5」版本号，一旦被 clamp 成一行加省略号就丢失了关键信息 |
| 摘要 | 14px / 1.7，`--muted-foreground`，`line-clamp: 2`，`min-height: 48px`，最大宽 `54%`，上距 10px |
| 元信息 | 12px mono，底部对齐，`margin-top: auto` |
| hover | 封面 `scale(1.03)` 500ms；卡片 `box-shadow: var(--shadow-card), 0 0 0 1px hsl(var(--primary)/0.20), 0 0 28px hsl(var(--primary)/0.10)`；标题变青 |
| ≤768 堆叠 | 封面 `aspect-ratio: 16/9`，标题/摘要最大宽 100%，覆盖层改垂直渐变 `180deg` 从 `0.20 → 0.95` |

### 6.23-B 文章主题色（accent）系统 —— 只允许出现在 3 个位置

文案侧按每篇文章的内容气质给了 5 个主色。**不能把这 5 个色当 UI 文字色用**，否则整站会从「一个冷光源」变成「彩虹灯箱」，这正是本规范 §2.5 要防的事。做法是：**色相留在封面图内部，UI 只用系统三色。**

| 文章 | 文案侧建议 | UI 是否采用 | 处理 |
|---|---|---|---|
| astro-blog-rebuild（置顶） | 青 `#38f5d0` | **采用为封面主色**，UI 仍用 `--neon-cyan` `#1ae8ff` | 封面内部用 `#38f5d0`（更偏薄荷，和 UI 青有 8° 色相差，是好的"同族不同调"） |
| my-2026-toolbox | 冷灰 `#9aa4b2` | 采用，且与 `--muted-foreground` `#919cac` **几乎同值** | 直接统一为 `--muted-foreground`，封面也用同色，别再多一个灰 |
| tailwind-v4-migration | 洋红 `#ff4d9d` | **封面上采用，UI 不采用为文字** | UI 里映射到 `--neon-violet`；封面用洋红可以，但标题压其上必须走深色遮罩 |
| cyberpunk-web-aesthetics | 高对比黄 `#ffd60a` | 封面上采用，UI 映射到 `--neon-amber` `#ffb83d` | `#ffd60a` 在暗底 13.68:1 很安全，但太"警示牌"，UI 层统一降到琥珀 |
| writing-at-night | 深蓝 `#3b5bdb` | **必须废弃为 UI 文字色** | ⚠️ 实测对页面底 `#0b0e14` 只有 **3.41:1**，对卡片底 `#161a22` 只有 **3.08:1**，**不满足 4.5:1**。封面上用深蓝做背景块没问题；如需 UI 强调，改用 `--neon-violet-soft` `#df9dfb`（9.52:1） |

**允许出现 accent 色的 3 个位置（除此之外一律不许）**：

1. 卡片封面图的**内部**（图片本身，不受 UI 调色板约束）。
2. 卡片 hover 时左缘 `2px` 实心条（`background: var(--article-accent)`，`opacity: .85`）。
3. 文章详情页正文顶部，标题下方一条 `48×2px` 的短横线。

```css
/* 由 frontmatter 或 data 属性注入，不用 JS */
[data-accent="cyan"]    { --article-accent: #38f5d0; }
[data-accent="neutral"] { --article-accent: #919cac; }
[data-accent="magenta"] { --article-accent: #ff4d9d; }
[data-accent="amber"]   { --article-accent: #ffd60a; }
[data-accent="indigo"]  { --article-accent: #8b9dff; } /* 替代 #3b5bdb，暗底 6.9:1 */
```

**禁止**：用作标题色、链接色、按钮底色、徽章底色、发光色。发光永远只有青/紫两种。

### 6.23-C 素材清单与安全区（与内容侧对齐）

| 素材 | 尺寸 | 数量 | 关键要求 |
|---|---|---|---|
| 文章封面 / `og:image` | 1200×630（1.9:1） | 5（每篇 1 张） | 封面内部可用该篇 accent 色；大字标题落在**居中 1120×520**，且需整体偏右（中心点约在 60% 处），**左缘留出 ≥120px 空白**给 hover 时的 2px accent 条与卡片左内边距，否则大字会和左缘色块叠一起；**禁用图库照片**（会把霓虹视觉拉回商务风） |
| 封面制作口径（**出图侧必读**） | 既然所有封面进页面后都会被统一压 `brightness(0.92) saturate(0.88)`，**出图时必须按本规范的色值做满**：不提前降饱和、不自带暗角、不预先压暗。提前压过的图进页面会被压第二次，出来是脏的；做足的色被压 8% 不会坏（`#38f5d0` → 约 `#34e0bf`，仍在霓虹可用区间）。另：大字别贴极暗角落，压 8% 后容易糊进背景 |
| 精选分类封面 | 800×450（16:9） | 3（life / note / tools） | 与卡片 `aspect-ratio: 16/9` 完全一致，零裁切；主体落在居中 720×405；三张必须是同一套视觉语言（同一网格密度、同一字重、同一角标位置） |
| 头像 | **矢量 SVG，无固定像素尺寸**，按 88 渲染（关于页 72、抽屉 72） | 1 | **霓虹 monogram，正式方案**：深底 + 站点名首字「烁」+ 青色描边，手写 SVG，规格见 §6.4。不用真实照片（AI 生成人脸是另一种不可信；字形标识在个人站是标准做法），也不再借用模板默认 `avatar.svg` |
| OG 卡片标题 | — | — | 允许与 H1 不同（如赛博朋克那篇用副标题「霓虹是结论，不是起点」）；但**站内卡片标题必须用 H1/frontmatter title**，不要为了抓人把卡片标题也换掉，会与正文标题不一致 |

**封面阵列的相邻配色约束（一条补充，不改列表顺序）**

5 张封面会在首页一个视野里同时出现，如果 5 个主色均匀分布开了，这一屏自己就变成"彩虹"，把 Hero 那点克制的青紫光盖掉。规则：

1. **相邻两张封面不得同属高饱和冷暖冲突组合**（最差是「洋红 × 青」直接相邻）。若时间倒序排下来正好撞上，把其中一张的底色压成中性深灰、只保留一处小面积 accent。
2. 推荐相邻关系：青 ↔ 黄（同属高亮冷/暖对比，稳）、洋红 ↔ 冷灰（一艳一浊，稳）。深夜篇要做"蓝"就往 `#8b9dff` 那侧的冷紫蓝靠，**不要用 `#3b5bdb` 那种饱和正蓝**——饱和正蓝和青同屏是最容易显脏的组合，暗部带蓝偏移会吃掉青色发光。
3. 不能用「按颜色重排文章顺序」来解决这个问题，时间倒序是内容约定。

**封面亮度与「中性色封面显得没上色」的处理（系统级，不做逐图特例）**

问题场景：置顶 Feature 卡的封面是整页最亮的一块（青系），下面紧跟一张**冷灰**封面的常规卡（工具清单那篇）。低饱和中性色排在青之后，容易读成"这张图忘了上色"。

**方案：给所有封面加同一层亮度上限，而不是把置顶那张单独压暗。**

```css
/* 所有文章封面（含 Feature），一份规则 */
.post-cover {
  filter: brightness(0.92) saturate(0.88) contrast(1.03);
  position: relative;
}
.post-cover::after {           /* 6% 页面底色 scrim，统一压低整体亮度 */
  content: "";
  position: absolute; inset: 0;
  background: rgba(11, 14, 20, 0.06);
}
.post-card--feature .post-cover {
  filter: brightness(0.94) saturate(0.90) contrast(1.03); /* 只比常规卡高 2% */
}
```

**为什么不是「把置顶封面压到 80%」**：那会**反向削弱置顶权重**——置顶卡是这一屏信息优先级最高的，把它压得比常规卡还暗，等于用视觉否定了内容层级。亮度上限应该作用在「全站所有封面」这一层，让最亮的对象回到 Hero 光晕和激活态上，而不是拿置顶卡开刀。

**中性色封面怎么不显脏**：不靠改图，靠 UI 层的"归属感"。冷灰封面的卡片，其**分类芯片、hover 时 2px 左缘 accent 条、计数徽章仍然是青色**——图片可以是无彩的，但它的 UI 外框始终在调色板里，读者不会认为它脱队。这也是 §6.23-B 只给 accent 三个落点的原因之一。

**禁止**：为某一张封面单独降低亮度/去饱和；用 `opacity` 压封面（会让下层玻璃底透出来，脏）。

---

## 7. 动效规范

### 7.1 Token

```css
--dur-fast: 120ms;
--dur-base: 200ms;
--dur-ui: 260ms;
--dur-slow: 360ms;
--dur-enter: 520ms;

--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* 进场、位移 */
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);  /* hover 位移 */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);      /* 颜色、透明度 */
--ease-drawer: cubic-bezier(0.22, 1, 0.36, 1);    /* 抽屉 */
```

### 7.2 交互对应表

| 场景 | 属性 | 时长 | 缓动 |
|---|---|---|---|
| 链接/文字色变 | `color` | 200 | ease-in-out |
| 按钮 hover | `box-shadow, transform, filter` | 200 | ease-out-quart |
| 卡片 hover | `transform, box-shadow, border-color` | 260 | ease-out-quart |
| 卡片封面缩放 | `transform: scale` | 400–600 | ease-out-expo |
| 导航激活条 | `width: 0→60%` | 200 | ease-out-quart |
| 侧栏左条 | `scaleY: 0→1` | 180 | ease-out-quart |
| 分类卡顶部进度条 | `width: 0→100%` | 300 | ease-out-quart |
| 抽屉开 / 关 | `transform: translateX` | 280 / 220 | ease-drawer |
| 搜索弹层开 / 关 | `opacity, transform: scale(0.98→1) translateY(-6→0)` | 180 / 140 | ease-out-expo |
| 折叠面板 | `grid-template-rows: 0fr→1fr` | 300 | ease-in-out |
| 悬浮组出现 | `opacity, translateY` | 240 | ease-out-expo |

### 7.3 滚动进场（全站统一）

```css
[data-reveal] {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity var(--dur-enter) var(--ease-out-expo),
              transform var(--dur-enter) var(--ease-out-expo);
  will-change: opacity, transform;
}
[data-reveal].is-visible { opacity: 1; transform: none; }
```

- 触发：`IntersectionObserver({ threshold: 0.15, rootMargin: "0px 0px -10% 0px" })`，进入后立即 `unobserve`。
- 只给**区块级容器**加（区块标题、卡片列表、Hero 内文），不给单个列表项加，避免 20 张卡片各自闪一下。
- 若列表项要做 stagger，用 `--i` 变量 `transition-delay: calc(var(--i) * 60ms)`，且 **stagger 上限 6 项**（第 7 项起 delay 固定 360ms）。
- 备选实现：`animation-timeline: view()`（Chrome 115+），用 `@supports (animation-timeline: view())` 包裹，逻辑等价。两种实现二选一，不要同时挂。

### 7.4 发光动画（严格限量）

- 允许循环发光的只有 3 类：Hero 装饰同心圆（`rotate 90s linear infinite`，无闪烁）、空状态图标扫描线、页脚菱形 `opacity .4→.8 / 3.2s`。
- **禁止** `box-shadow` 的 `infinite` 循环（性能差且廉价）。需要呼吸感时用 `opacity` 或 `filter: brightness()`。
- 同一个视口内循环动画 ≤ 2 个。

### 7.5 `prefers-reduced-motion: reduce` 降级（必须实现）

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  [data-reveal] { opacity: 1 !important; transform: none !important; }
  /* hover 只保留颜色变化，去掉所有位移与缩放 */
  .card-hover:hover, .btn:hover { transform: none !important; }
  /* 循环装饰动画直接关闭 */
  .hero-orbit, .empty-scan, .footer-diamond, .cat-404 .composition { animation: none !important; }
}
```

降级后仍然可用的信息通道：颜色变化、边框变化、背景明度——**发光与位移都不是唯一状态信号**（见第 9 节）。

---

## 8. 响应式断点策略

> 项目 `tailwind.config.mjs` 的断点是 **max-width 语义**：`xs: max 480` / `md: max 768` / `tablet: max 992` / `lg: max 1440` / `desktop: min 1480`。
> 因此 `tablet:` 前缀的样式在 **≤992px** 生效；`lg:` 在 **≤1440px** 生效；`desktop:` 在 **≥1480px** 生效。写样式时注意 `lg:` 与 `desktop:` 是互补的，`lg:` 不要覆盖 `desktop`。

| 断点 | 页面宽度 | 布局 | Hero 高 | 侧栏 | 导航形态 | 字号 | 悬浮组 |
|---|---|---|---|---|---|---|---|
| **desktop ≥1480** | 内容 1360，`padding 32` | 12 列：主 8 / 侧 320 / gutter 32 | 320 | 右侧 sticky | 完整横向菜单 + 3 图标 | 基准字号（§3.2） | 2 按钮 |
| **993–1479**（`lg:` 生效区） | 内容 1180，`padding 24` | 12 列：主 8 / 侧 300 / gutter 28 | 280 | 右侧 sticky | 同上 | 基准字号 | 2 按钮 |
| **tablet 769–992** | 内容 960，`padding 24` | 单列，侧栏 → 抽屉 | 220 | 抽屉（`HomeSider` `isDrawer`） | 汉堡菜单（左上）+ logo 居中 + 主题图标右 | H1 36 / H2 24 / 正文 17 | 1 按钮（回顶） |
| **md 481–768** | 100%，`padding 24` | 单列；置顶卡转 1 列；分类卡 1 列；关于页个人卡纵向 | 180 | 抽屉 | 汉堡 + 居中标题（文章页显示标题）+ 主题 | H1 30 / H2 22 / 正文 17 / 卡片标题 18 | 1 按钮，`right/bottom 16` |
| **xs ≤480** | 100%，`padding 16` | 单列；卡片缩略图全宽 16:9 置顶；分页器折叠 | 152 | 抽屉宽 86vw | 汉堡 + 居中标题 | H1 26 / H2 20 / 正文 16 / 卡片标题 17 | 1 按钮 36×36 |

### 8.1 逐断点的布局变化规则

- **侧栏消失时（≤992）**：
  1. 个人信息卡的「社交 + 统计」在抽屉内保留；抽屉里去掉统计区以省高度。
  2. 抽屉顶部固定一个「关闭」按钮，滚动时不动。
  3. 文章页面额外在右上角（导航下方 12px）放一个 44×44 的「目录」按钮，点击打开抽屉并自动切到 `DIRECTORY` 分段。
- **导航形态（关键，写清）**：
  - `≥993`：logo 左、菜单中、图标组右，`#site-header` 固定，滚动下隐藏/上出现。
  - `≤992`：`MenuIcon` 固定在左上（`top: 12; left: 12`），logo 由 `MobilePostHeader` 居中渲染；文章页时居中位置显示当前文章标题（截断 18 字符 + `…`），滚动时**保持可见**（保留现有逻辑）；右侧只留主题切换 1 个图标。
  - 搜索入口在 `≤992` 进抽屉（抽屉顶部一个搜索框，点击展开弹层）。
- **栅格塌陷**：
  - 置顶 2 列 → `≤768` 1 列。
  - 精选分类 3 列 → `≤992` 2 列 → `≤768` 1 列（**严禁**「2+1 不等宽」，这是原版最刺眼的问题之一）。
  - 上一篇/下一篇 2 列 → `≤768` 1 列。
  - 页脚 3 段 → `≤768` 单列居中。
- **字体缩放方式**：`clamp()` 而非多断点重写。H1 `clamp(26px, 4vw + 12px, 44px)`，H2 `clamp(20px, 2.2vw + 12px, 26px)`。正文固定 `17px`（≤480 降 `16px`），因为正文缩小会直接伤害中文可读性。
- **触控区**：`≤992` 起所有可点元素最小 `44×44`（菜单项高从 40 → 44，图标按钮从 32 → 44，通过 `padding` 或透明外扩实现，不放大视觉尺寸）。

---

## 9. 无障碍

### 9.1 对比度实测（WCAG 2.1 相对亮度公式计算，非估算）

深色模式（主）：

| 组合 | 前景 | 背景 | 比值 | 结论 |
|---|---|---|---|---|
| 正文 | `#e9edf1` | `#0b0e14` | **16.42:1** | AAA |
| 正文（卡片上） | `#e9edf1` | `#161a22` | **13.68:1** | AAA |
| 次级文字 | `#919cac` | `#0b0e14` | **6.95:1** | AA |
| 次级文字（卡片上） | `#919cac` | `#161a22` | **5.79:1** | AA |
| 次级文字（悬浮层） | `#919cac` | `#242833` | **5.30:1** | AA |
| 主青（链接/激活） | `#1ae8ff` | `#0b0e14` | **12.91:1** | AAA |
| 主青（卡片上） | `#1ae8ff` | `#161a22` | **10.75:1** | AAA |
| 青底上的字 | `#080b11` | `#1ae8ff` | **12.52:1** | AAA |
| 紫（≥16px 才可用） | `#c760fb` | `#161a22` | **4.98:1** | AA（仅大字） |
| 紫柔（可做小字） | `#df9dfb` | `#161a22` | **6.88:1** | AA |
| 琥珀 | `#ffb83d` | `#0b0e14` | **11.20:1** | AAA |
| ⚠️ 白字压紫（禁用） | `#ffffff` | `#c760fb` | **3.23:1** | **不达标，禁止** |
| ⚠️ 更淡的灰（禁用） | `#7e8a9a` | `#161a22` | 4.59:1 | 临界，不要用在小字 |
| 表单边框（非文本 3:1） | `#547383` | `#161a22` | **3.19:1** | 达标 |

浅色模式（可选）：

| 组合 | 前景 | 背景 | 比值 |
|---|---|---|---|
| 正文 | `#1a202d` | `#f8fafb` | **15.57:1** |
| 次级文字 | `#656c7b` | `#f3f5f7` | **4.82:1** |
| 青（链接） | `#007599` | `#f8fafb` | **5.01:1** |
| 白字压青（主按钮） | `#ffffff` | `#007599` | **5.24:1** |
| 紫 | `#8d15c1` | `#f8fafb` | **6.66:1** |
| 表单边框 | `#738696` | `#f8fafb` | **3.60:1** |

**硬性条款**：

1. 正文与背景 ≥ 4.5:1（已满足，最差组合 5.30:1）。
2. 霓虹色**作文字**：青随便用；紫只允许 ≥16px 或直接用 `--neon-violet-soft`；白字**禁止**压在紫上（只有 3.23:1）。
3. 发光**不能**作为唯一的状态指示。激活态必须同时有至少两项：颜色变化 + 2px 实心条 / 背景明度变化。
4. 图片上压文字，必须叠一层不透明度 ≥ 0.55 的深色遮罩后再校验（分类卡已按 §6.7 处理）。

### 9.2 焦点样式（全站统一，禁止 `outline: none`）

```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
  border-radius: inherit;
  box-shadow: 0 0 0 4px hsl(var(--ring) / 0.18);
}
/* 深色底上的双环，保证在霓虹光晕附近仍然可见 */
.dark :focus-visible {
  outline-color: hsl(186 100% 70%);
  box-shadow: 0 0 0 4px hsl(186 100% 55% / 0.22);
}
/* 输入框内聚焦不位移 */
:focus:not(:focus-visible) { outline: none; }
```

- 焦点环必须在 `overflow: hidden` 的祖先上不被裁掉：卡片、按钮的 `overflow` 一律改 `visible`，或把 padding 加大 4px。
- 抽屉 / 搜索弹层需要焦点陷阱（Tab 循环），关闭后焦点回到触发按钮。

### 9.3 点击区

- 最小 **44×44**（移动端强制）；桌面可 36×36 但需 `::after` 透明外扩补足 44。
- 相邻可点元素间距 ≥ 8px。
- 纯图标按钮必须带 `aria-label`。

### 9.4 语义与内容

- Hero 用 `<header>`；正文用 `<article>`；目录 `<nav aria-label="目录">`；搜索 `<dialog role="dialog" aria-modal="true">`；抽屉同。
- 每页只有一个 `<h1>`（Hero 的标题即 `h1`，正文内标题从 `h2` 起）。
- 图片替代文本：装饰图（光晕、纹理、网格）必须 `alt=""` + `aria-hidden="true"`；封面图 `alt={文章标题}`；头像 `alt="站点作者头像"`。
- 跳过导航链接：`<a href="#main" class="sr-only focus:not-sr-only">跳到正文</a>`，聚焦时出现在左上角（高 40，青底深字）。
- 动效：`prefers-reduced-motion` 全套降级（§7.5）；自动播放视频已删除，因此不涉及"暂停自动播放"要求。

---

## 10. 落地映射表

| # | 设计决策 | 文件 | 动作 |
|---|---|---|---|
| 1 | 深色主tokens（全部色值） | `src/styles/theme/shadcn.css` | 整块替换 `.dark {}`，按 §2.2 |
| 2 | 浅色 tokens | `src/styles/theme/shadcn.css` | 整块替换 `:root {}`，按 §2.3 |
| 3 | 渐变/粉值/`--color-pink` 归零 | `src/styles/theme/index.css` | 按 §2.4 替换 `:root` 与 `.dark` 两组 |
| 4 | 标题字体去掉「寒蝉全圆体」 | `src/styles/global/tailwind.css`（`h1..h6` 与 `body`） | 换 `var(--font-display)` / `var(--font-body)` |
| 5 | `.logo-text` 粉色手写体 | `src/styles/global/tailwind.css` + `.dark .logo-text` | 删除全部样式，改 §6.2（或直接删类，Logo 改结构） |
| 6 | logo 结构（符号 + 文字） | `src/components/layout/Header.astro` | 替换 `LogoSvg` / `<p class="logo-text">` 为符号 + 文字；同步 `src/assets/svg/logo.svg` 重绘为线框青 |
| 7 | 导航视觉（高度/背景/hover/激活） | `src/components/layout/Navigator.tsx` + `src/styles/global/utils.css`（`with-background`、`#site-header`） | 按 §6.1；`#site-header::before` 的 `bg-gradient-header` 换成玻璃 |
| 8 | `shadow-text` / `shadow-text-on-light` | `src/styles/global/utils.css` | `shadow-text` 改为 `0 1px 3px rgba(0,0,0,.6)`；`shadow-text-on-light` 直接删除（不再用"白描边"方案） |
| 9 | Hero 重做（尺寸/层叠/去视频） | `src/components/ui/cover/Cover.astro` | 按 §6.3；删除 `<video>` 与 `canplaythrough` 脚本、`WaveSvg` 换成直线底边 |
| 10 | 波纹底边移除 | `src/components/ui/cover/wave.tsx` + `src/styles/components/wave.css` | 不再引用（可保留文件，`Cover.astro` 停止 import） |
| 11 | 个人信息卡 | `src/components/layout/HomeInfo.astro`、`src/assets/svg/avatar-monogram.svg`（新建） | 按 §6.4；删 `hover:animate-shake`、`shadow-card-darker`；把 `<img src="/img/avatar.svg">` 换成 monogram SVG（内联或 `<img>` 均可，矢量无需固定尺寸，按 88 渲染） |
| 12 | 侧栏菜单（去粉色胶囊） | `src/components/layout/HomeInfo.astro`（`ButtonLink` 段） | 按 §6.5；移除 `bg-gradient-shoka-button` / `shoka-button-shadow` / `rounded-xl` |
| 13 | `shoka-button-shadow`（粉色外扩） | `src/styles/global/tailwind.css` | 改为 `box-shadow: var(--glow-cyan-sm)` |
| 14 | 侧栏容器（去粉阴影） | `src/styles/global/utils.css`（`shadow-home-sider`）/ `src/components/layout/HomeSider.astro` | 阴影改 `--shadow-card`；宽 `min-w-64 max-w-64` → `--sidebar-w`（320） |
| 15 | 阅读方向：侧栏移到右侧 | `src/layouts/TwoColumnLayout.astro` | `<slot name="sider">` 用 `order` 或调整 DOM 顺序放到主栏之后；容器改 flex + `gap: var(--space-lg)` |
| 16 | 主栏宽度与内距 | `src/constants/layout.ts`（`CONTENT_PADDING` / `MAX_WIDTH`） | `MAX_WIDTH.content` 改 `--content-max`；三档 padding 按 §4.2 |
| 17 | 文章卡片（去对角切角）+ 空状态 | `src/components/post/PostItemCard.astro`、`src/components/post/PostList.astro` | 按 §6.6 / §6.8；删 `clip-path-*`、`group-hover:rotate-3`、粉色 `more...`；空状态换新图标与文案 |
| 18 | 对角切角工具类 | `src/styles/global/tailwind.css`（`.clip-path-post-img-left/right`） | 删除 |
| 19 | 精选分类卡（去翻转/去缎带/等宽网格） | `src/components/post/CategoryCards.astro`、`src/components/post/FlippedCard.astro` | 按 §6.7；`FlippedCard` 不再使用（保留文件或删除） |
| 20 | 分类卡文字可读性 | `src/components/post/CategoryCards.astro` | `text-primary` → `--foreground` + 深色渐变遮罩 |
| 21 | 悬浮工具组收敛 | `src/components/layout/FloatingGroup.tsx` | 按 §6.9；删 `×` 与 `scrollToBottom` |
| 22 | 搜索弹层视觉 | `src/components/layout/SearchDialog.tsx`、`src/components/ui/dialog.tsx` | 按 §6.10 |
| 23 | 抽屉视觉 | `src/components/layout/MobileDrawer.astro` | 按 §6.11；`bg-gradient-start` → 深色玻璃 |
| 24 | 页脚 | `src/components/layout/Footer.astro`、`src/components/svg/SakuraSvg.tsx` | 按 §6.12；樱花改菱形（或改 fill 为青） |
| 25 | 按钮基类 | `src/components/ui/button.tsx`、`src/components/control/ButtonLink.astro` | gradient 变体保留但由 `--gradient-shoka-button` 换色；圆角/尺寸按 §6.13 |
| 26 | 徽章 | `src/components/ui/badge.tsx` | 按 §6.14 |
| 27 | 分割线（带标题） | `src/components/ui/divider.tsx` | 按 §6.15 重写 |
| 28 | 分页器 | `src/components/post/Paginator.astro` | 按 §6.17 |
| 29 | 目录 | `src/components/layout/TableOfContents/*` | 按 §6.18 |
| 30 | 代码块 / 行内代码 | `src/styles/theme/markdown.css`、`src/components/markdown/*` | 按 §6.19；行内 code 去掉 hover 变化 |
| 31 | 正文排版 | `src/styles/theme/markdown.css`（`.prose`） | `max-width: 68ch`；17px/1.85；标题按 §3.2 |
| 32 | 归档时间线 | `src/pages/archives.astro` | 按 §5.6 重写列表结构 |
| 33 | 分类页分组卡 | `src/components/category/CategoryList.astro`、`CategoryTitle.astro`、`SubCategory.astro`、`src/styles/components/category.css` | 按 §5.4 |
| 34 | 标签页芯片墙 | `src/components/tag/TagItem.tsx`、`CollapsibleTags.tsx`、`src/pages/tags/index.astro` | 按 §5.5 / §6.14 |
| 35 | 关于页个人卡横条 | `src/layouts/PageLayout.astro`、`src/pages/about.md` | 顶部插入横向个人卡；注意 `.md` 内不要写样式 |
| 36 | 404 | `src/pages/404.astro` | 按 §5.8；改线框青色、去粉色渐变按钮 |
| 37 | 全局动效 token | `src/constants/design-tokens.ts`（`animation`）、`tailwind.config.mjs`（`transitionDuration`/`transitionTimingFunction`） | 加入 §7.1 的 duration/easing |
| 38 | 滚动进场 | 新增 `src/scripts/reveal.ts` 并在 `src/layouts/Layout.astro` 引入；或纯 CSS `animation-timeline: view()` | 按 §7.3 |
| 39 | reduced-motion | `src/styles/global/tailwind.css`（`@layer base`） | 追加 §7.5 全局降级块 |
| 40 | 焦点样式 | `src/styles/global/tailwind.css` | 追加 §9.2 |
| 41 | 玻璃卡工具类 | `src/styles/global/utils.css` | 新增 `@utility glass-card`（§6.4 的 border-image 方案）与 `@utility glass-panel` |
| 42 | 网格/噪点纹理 | `src/styles/global/utils.css` | 新增 `@utility grid-texture`、`@utility noise-layer` |
| 43 | 加载指示条颜色 | `src/layouts/Layout.astro`（`<LoadingIndicator color="#e9536a" />`） | 改 `#1ae8ff` |
| 44 | 全局背景（`background.gif` 粉色底纹） | `src/styles/global/tailwind.css`（`body` / `html` 的 `background`） | 删除 `url('/img/background.gif')`，改「底色 + 光晕 + 网格」三层 |
| 45 | 硬编码粉色常量 | `src/constants/design-tokens.ts`（`colors.shoka`、`shadows.shoka-button`、`themeToggle`） | `shoka` 改为青系；`shadows.shoka-button` 改 `--glow-cyan-sm` 值 |
| 46 | 站点级 image 预加载 | `src/layouts/Layout.astro`（`<link rel="preload" as="image" href="/img/top-poster.webp">`） | 保留但降优先级（`fetchpriority="low"`），因为海报已降级为纹理 |
| 47 | 置顶区改单张全宽 Feature 卡 | `src/pages/index.astro`、`src/components/post/PostList.astro`、`src/components/post/PostItemCard.astro` | 新增 `variant="feature"`；首页置顶段传该 variant，去掉原有的"2 列网格"设想（§6.23-A） |
| 48 | 文章主题色系统 | `src/components/post/PostItemCard.astro`（`data-accent`）、`src/types/blog.ts`、`src/lib/content/transforms.ts`、`src/styles/global/utils.css` | 按 §6.23-B：只注入 `--article-accent`，仅用于 hover 左条与详情页短横线；**不得**用于文字/按钮 |
| 49 | 摘要裁切按屏宽变化 | `src/components/post/PostItemCard.astro` | `line-clamp-2` → `line-clamp-2 md:line-clamp-3`；加 `overflow-wrap: anywhere` |
| 50 | 代码块底色压暗 | `src/styles/theme/markdown.css`、`src/styles/components/*` 下的 pre 样式 | `hsl(222 34% 4%)` + `1px rgba(255,255,255,.07)`（§6.19） |
| 51 | 精选分类卡比例 4:3 → 16:9 | `src/components/post/CategoryCards.astro` | `aspect-ratio: 16/9`，`min-height: 168px`，与 800×450 素材零裁切（§6.7） |
| 52 | 取消封面左右交替 | `config/site.yaml`（已设为 `postCardImagePosition: left`）+ `src/components/post/PostList.astro`（`getLeftClip`）+ `src/components/post/PostItemCard.astro`（`clip-path-*` 类）+ `src/styles/global/tailwind.css`（`.clip-path-post-img-left/right`） | ⚠️ **只改 yaml 不够**：`leftClip === true` 仍会挂上 `clip-path-post-img-left`，对角切角会留在每张卡上。必须同时删掉 `PostItemCard.astro` 里的 `clip-path-post-img-left/right` 类名与 `tailwind.css` 里的两个工具类，才算真正取消 |

---

## 11. 收尾三问

### 这套规范的关键取舍

**用「明度台阶 + 细描边」换掉了「阴影 + 粉色」。** 深色界面里阴影几乎不可见（`rgba(0,0,0,.45)` 压 `#0b0e14` 看不出来），所以卡片分层必须靠底色明度差（6% → 12% → 17%）和 1px 上亮下暗的玻璃边框，而不是 `box-shadow`。代价是卡片之间没有"漂浮感"，需要靠 `gap` 和严格的留白纪律来建立节奏——这也意味着**如果前端把 gap 从 16 改成 8，整页会立刻坍成一坨**。

**砍掉了三个 Shoka 标记性元素**：对角 `clip-path` 切角、3D 翻转分类卡、粉色渐变胶囊按钮。这三个是原来"有设计感"的主要来源，删掉后短期的观感会"变素"，但这是走向克制霓虹的必经之路——留着它们，赛博配色会打架成四不像。

**发光做了硬配额（每屏 ≤3 处）**。这是整份规范里最容易被突破也最伤气质的一条。霓虹的"高级"来自稀缺；一旦每个卡片 hover 都发光，页面就变成廉价灯箱。

**"每篇一色"被收编进了封面图内部，没有升级成 UI 色板。** 文案侧按内容气质给的 5 个色相（薄荷青 / 冷灰 / 洋红 / 高对比黄 / 深蓝）如果直接用在标题和链接上，全站会同时出现 5 个强调色，赛博感立刻变彩虹灯箱。处理方式是：色相留在图片里，UI 只用青/紫两色，另加一个只出现在「hover 左条 + 详情页短横线」的 `--article-accent` 通道。其中深蓝 `#3b5bdb` 实测对页面底只有 3.41:1，作为文字色不达标，已废弃，改用 `#8b9dff`（6.9:1）。

### 前端最容易做走样的 2 个点

1. **玻璃卡的边框**。`border: 1px solid rgba(255,255,255,0.08)` 是不够的——四个边的亮度一样，看起来就是"一个灰框"。必须用 §6.4 的 `background-clip: padding-box, border-box` 双层背景方案（或 `border-image: linear-gradient(160deg, ...) 1`），做出**顶部亮、底部暗**的高光走向。做错了整个卡片会显得扁、脏。

2. **发光的 blur 与 opacity 值被随手放大**。`0 0 24px hsl(cyan/0.22)` 和 `0 0 24px cyan` 是两种设计。前者是"空气里有光"，后者是"贴了一圈荧光胶带"。所有发光必须从 `--glow-cyan-sm/md/lg` 三个变量取，**禁止**在组件里手写 `box-shadow` 的发光值。

### 已拍板的 3 个决策（定稿，不再讨论）

1. **海报图 `/img/top-poster.webp`：保留**，按 §6.3 的 `opacity .12` + `grayscale(1)` + `mix-blend-mode: luminosity` 作纹理层，不删除。Hero 不做"纯光晕+网格"的极简变体。
2. **主题：默认深色，保留切换**。`html` 初始带 `dark` 类，`ThemeToggle` 保留；浅色变量按 §2.3 完整实现，切浅色时走 `theme-transition.css` 的 200ms 过渡。不锁死深色、不移除切换按钮。
3. **头像：霓虹 monogram，正式方案**。站点名首字「烁」+ 青色描边 + 深底，手写 SVG，规格见 §6.4。不使用真实照片（AI 生成人脸是另一种不可信；字形标识在个人站是标准做法），也不再引用模板默认的 `avatar.svg`。矢量无固定像素尺寸，按 88 渲染，关于页与抽屉 72 同源复用。
