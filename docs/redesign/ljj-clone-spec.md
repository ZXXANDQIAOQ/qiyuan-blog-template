# ljj.world 逐像素克隆规格（唯一事实来源）

参考资料目录 `docs/redesign/ljj-reference/`：
- `pw_home.png` 首页首屏 1440 宽截图（**必看**）
- `page_blog.png` / `page_about.png` 子页截图（部分内容因入场动画未渲染，以 DOM 为准）
- `dom_home.html` `dom_blog.html` `dom_about.html` `dom_projects.html` `dom_desk.html` 渲染后真实 DOM
- `ljj-full.css` 官方完整样式表（333KB，查任何数值用它）
- `ljj_key_rules.css` 已按组件名过滤的 1127 条关键规则（**首选查询源**）

查样式时用 grep 查类名，例如：
`grep "blog-console-topline" docs/redesign/ljj-reference/ljj_key_rules.css`

---

## 0. 设计总纲

编辑部/工作台极简风。全站直角 `--radius: 0`。1px 墨线代替阴影。**没有传统页脚**——页面以四边流动光轨收尾。所有动效克制、快速（.18s~.72s，cubic-bezier(.16,1,.3,1)）。

### 全局令牌（精确值，写进 CSS 变量体系）

**浅色**：
```
--bg: #f3f4f1          页面底
--surface: #e9eae6     一级面板
--surface-raised: #f8f9f6  卡片/浮层
--surface-deep: #d9dad5    下沉面板
--text: #151613        主墨色
--muted: #696b64       次级文字
--muted-strong: #383a35
--line: #15161329      1px 细线（16% 墨）
--line-strong: #15161375  强线（46% 墨）
--accent: #b93b28      铁锈红
--accent-hover: #9f2f1f
--accent-soft: #f3d8d0
--accent-ink: #f8f9f6  锈红上的文字色
--shadow: #15161314    极轻墨影
--shadow-strong: #1516132e
--header-bg: #f3f4f1e0
```
HSL 三元组换算（供 shadcn.css 使用，不带 hsl() 包裹）：
`#f3f4f1`=75 12% 95% / `#151613`=80 7% 8% / `#b93b28`=8 64% 44% / `#9f2f1f`=8 54% 37% / `#e9eae6`=75 10% 91% / `#f8f9f6`=75 20% 97% / `#d9dad5`=75 8% 85% / `#696b64`=75 3% 41% / `#383a35`=60 4% 22%

**深色**（`.dark`）：
```
--bg: #121210（=75 6% 7%）
--surface: #1c1c19
--surface-raised: #252520
--surface-deep: #30302a
--text: #f2f1eb
--muted: #aaa89d
--muted-strong: #d6d4ca
--line: #f2f1eb2b
--line-strong: #f2f1eb70
--accent: #f06449（橙红）
--accent-hover: #ff8a70
--accent-soft: #3a1c14
--accent-ink: #121210（橙红底上用深字，参考亮 site 反差）
--header-bg: #121210f0
```

**字体**（已装包：@fontsource-variable/manrope / geist / geist-mono）：
- `--font-display: "Manrope Variable", "Geist Variable", "Noto Sans CJK SC", sans-serif`
- `--font-body: "Geist Variable", "Noto Sans CJK SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
- `--font-mono: "Geist Mono Variable", "SFMono-Regular", Consolas, monospace`

### 布局壳
`.section-shell { width: min(100% - 112px, 1440px); margin-inline: auto; }`
（移动端 112px 缩到 40px 左右，自行加断点）

---

## 1. 全局 Chrome（页头 + 全局特效）

### 1.1 页头 `.site-header`（结构照抄 DOM）
```html
<header class="site-header">        <!-- sticky top-0 z-60, border-bottom:1px solid var(--line), background: var(--header-bg) -->
  <div class="nav-shell">           <!-- flex space-between items-center gap-28px, 宽 min(100%-112px,1440px), height 80px -->
    <a class="brand" href="/">      <!-- font-size 1.35rem, font-weight 620, line-height 1 -->
      <span>luminoussss.xyz</span>  <!-- 站点名+红点结尾（见截图 logo 右侧红点）：用 <i class="brand-dot"> 红色实心 -->
    </a>
    <nav class="desktop-nav">       <!-- 绝对居中: position:absolute; left:50%; transform:translateX(-50%); flex gap 44px; font-size .92rem; color var(--muted) -->
      <a href="/">首页</a> <a href="/posts">文章</a> <a href="/categories">分类</a> <a href="/tags">标签</a> <a href="/archives">归档</a> <a href="/about">关于</a>
      <!-- 每个链接: position:relative; padding-block:10px
           ::after { content:""; position:absolute; bottom:5px; left:0; right:0; height:1px; background:currentColor; transform:scaleX(0); transform-origin:100%; transition:transform .22s }
           hover: color→var(--text)，::after scaleX(1) origin 0
           aria-current=page: color var(--text) + ::after scaleX(1)（激活项常显下划线，颜色为 accent——见截图首页激活红下划线） -->
    </nav>
    <div class="nav-actions">       <!-- flex items-center gap 10px -->
      GitHub 图标链接 / 语言切换 / 明暗切换（滑块开关样式，直角轨道）/ Menu 按钮（移动端）
    </div>
  </div>
</header>
```

### 1.2 全局鼠标像素轨迹 `<canvas class="global-pixel-trail">`
- `position:fixed; inset:68px 0 0; z-index:0; pointer-events:none; width:100%; height:calc(100dvh - 68px)`
- 行为：鼠标移动时在画布上留下小方块像素点，逐帧衰减消失。像素 3~4px，颜色跟随 accent（锈红）+ 墨色混合，寿命约 0.6~1.2s，透明度衰减。参考 dshdesktop 类实现，自写 ~80 行 canvas 代码即可
- 挂在 Layout `<body>` 最前（z-index 0，位于内容之下）。注意我们内容容器需要透明背景才可见——页面底色由 body 承担

### 1.3 四边流动光轨 `.global-flowing-lights`
```html
<div class="global-flowing-lights">  <!-- position:fixed; inset:68px 0 0; z-index:52; pointer-events:none; overflow:hidden -->
  <span class="global-flow-light-rail is-horizontal is-top"><span class="global-flow-light-runner"></span></span>
  <span class="global-flow-light-rail is-horizontal is-bottom"><span class="global-flow-light-runner"></span></span>
  <span class="global-flow-light-rail is-vertical is-left"><span class="global-flow-light-runner"></span></span>
  <span class="global-flow-light-rail is-vertical is-right"><span class="global-flow-light-runner"></span></span>
</div>
```
- rail: `position:absolute; overflow:hidden; opacity:.68`；四条轨道分别为 top:0/left:0/right:0、bottom:0、left:0/top:0/bottom:0、right:0，粗细 1px，背景 var(--line)
- runner: 小亮段（约 60~120px 长、1px 高/宽，锈红渐变），沿轨道循环平移动画（top 从左到右、bottom 从右到左、left 从上到下、right 从下到上），周期 7~12s 不等、四条错开 delay，用 CSS keyframes 实现
- 挂在 Layout，页面所有路由生效

### 1.4 页脚
- **删除 Footer.astro 的引用**（Layout 里去掉）。如需保留备案/版权一行，做成位于页面底部、`.section-shell` 内、`font-mono text-xs color muted` 的一行注记（`© 2026 SHUO — LAST UPDATED 2026.11.02` 风格），不做成传统多列页脚

---

## 2. 首页 Hero（单屏，照抄结构）

`<section class="hero hero-intro section-shell">`：
- `display:grid; grid-template-columns: minmax(0,1.18fr) clamp(20px,2.2vw,32px) minmax(420px,.82fr); column-gap:24px; align-items:center; min-height:calc(88dvh - 80px); padding-block:72px 46px; position:relative; isolation:isolate`
- **hero-axis**：`grid-area:1/2; width:100%; height:100%; background:var(--accent); transform-origin:top`——**文案列和右列之间一条全高锈红竖线**（宽度即轨道列宽 20-32px？不对——看截图竖线是 1~2px 细线，放在轨道列内水平居中：内部再套一个居中 1px 竖线，或把 hero-axis 宽度设为 1px 居中。以截图为准：细锈红竖线）
- **hero-copy**（grid-area:1/1, z-index:2）：
  - `h1 { font-size: clamp(4.8rem, 6.9vw, 6.2rem); font-weight: 650; line-height: .94; letter-spacing: 0; margin: 0 }`
  - 第一行 `.identity`：`display:block; color:var(--accent); font-family:var(--mono); font-size:.78rem; font-weight:500; line-height:1.3; margin-bottom:42px`，文案 `luminoussss.xyz / 独立开发者`，**入场乱码解密动画**（字符随机翻牌→逐渐落定，约 1.2s）
  - `.hero-statement`：两行 span 各占一行：`你好，我是烁烁。` / `把想法做成跑得起来的产品。`，**逐词模糊浮现动画**（每词 blur(8px)+opacity0 → 清晰，间隔 40~60ms，总 1s）
  - `.hero-summary { max-width:35rem; color:var(--muted); margin:26px 0 0; font-size:1rem; line-height:1.72 }` 文案：写代码、折腾工具、记录日常。这里是我放文章、笔记和想法的地方。
  - `.hero-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:34px }`：
    - 主按钮 `.button.button-primary { display:inline-flex; align-items:center; gap:8px; min-height:48px; padding:0 18px; font-size:.9rem; font-weight:620; border:1px solid var(--accent); background:var(--accent); color:var(--accent-ink); border-radius:0 }` hover 换 `--accent-hover`。文案「查看文章」+ `.button-arrow`
    - `.button-arrow { display:grid; place-items:center; width:40px; aspect-ratio:1; border-radius:50%; background:color-mix(in srgb, var(--bg) 18%, transparent) }`（**唯一保留圆形的元素**，内放 → 箭头 svg）
    - 次按钮：同尺寸，`border:1px solid var(--line-strong); background:transparent; color:var(--text)`，文案「了解我 →」，hover 背景 var(--surface)
- **hero-portrait**（`position:absolute; inset:0; z-index:3; pointer-events:none; overflow:hidden`）：右下角人物/头像立绘，`object-fit:contain; object-position:right bottom; filter:saturate(.92) contrast(1.02)`。**我们没有立绘素材——用用户头像图片放大放右下角，或先放占位（surface-deep 色块+名字首字母），并在代码注释标注替换点**
- **hero-signal-instrument**（左下）：`position:absolute; bottom:34px; left:0; width:min(31vw,460px); height:176px; color:var(--accent); opacity:.7; pointer-events:none; z-index:2`。内容是红色线稿「仪表/电路」装饰 SVG——自绘简化版：水平基线 + 折线波形 + 几个节点圆 + 虚线圆弧，参考截图左下角样式
- **背景**：页面 body 底色 + 细网格。网格实现：body 或 hero 区域 `background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 48px 48px; opacity 控制在 .35`（截图网格非常淡，间距约 44~52px，只铺首屏即可，或全页很淡）
- **删除**：原 Cover.astro 的 FluidNoiseBackground / InteractiveDotGrid / 海报纹理层 / 噪点层等所有旧背景层

---

## 3. 文章索引页 `/posts`（blog-console 布局，照抄 DOM 结构）

`<section class="blog-index"><div class="blog-console section-shell">`：

1. **topline**（`display:flex; align-items:center; gap:16px; font-family:var(--mono); font-size:.72rem`）：
   - `.blog-topline-index`「02 / POSTS」+ `.blog-topline-rule`（flex:1 的 1px 墨线）+ `.blog-topline-copy`「WORKING NOTES」+ `.blog-topline-status`（`<i>` 状态点 + 「7 / 2026」，i 是 accent 色小方块/圆点）
2. **intro 区**（上留白约 72px）：
   - `.blog-console-kicker { color:var(--accent); font-family:var(--mono); font-size:.78rem }` 文案如「写给还要继续维护的自己」
   - `h1 { font-size:clamp(3rem,5vw,4.4rem); font-weight:650; line-height:1.02 }`「文章与笔记」
   - lead（.95rem muted）+ summary（小一号）
   - **story 精选块**（最新一篇）：`<span>分类名</span> <strong>标题</strong> <p>摘要前 80 字</p> <a class="blog-console-read">阅读这篇文章 →</a>`（read 链接 accent 色 + 箭头）
3. **visual 区**（与 intro 同行或下方，grid 两列时放右列）：人像图（可用头像或封面图）+ `.blog-console-caption`（`font-mono .72rem`：`分类 / 2026.10.25 / 6 分钟阅读`）+ signal 装饰轨（两三条 1px 墨线 + 两三个 accent 小点，绝对定位装饰）
4. **detail 区**：
   - `.blog-console-heading`：`h2 { font-size:1.6rem; font-weight:650 }`「最近写下的」+ `.blog-count`（`<b>24</b> 篇笔记`，b 用 accent）
   - **文章列表 `<ol>`**（无 padding，li 间 1px 墨线分隔）：每项 `<a>` 三列 grid：`<time>`（mono .78rem muted，格式 `10.25`）/ `<strong>`（标题，.95~1rem，weight 620）/ `<span>`（分类名，mono .72rem muted 右对齐）；行高 padding-block 18px；hover：标题变 accent + 行背景 var(--surface)（极淡）；当前 hover 项左侧可加 2px accent 短线（参考截图列表样式）

---

## 4. 关于页 `/about`（三栏，照抄 page_about.png + dom_about.html）

- 顶部 breadcrumb 条（mono 小字：`01 / INDEX — 关于`）+ 1px 底线
- 主体三栏 grid（约 `minmax(0,.9fr) minmax(280px,.7fr) minmax(300px,.8fr)`，gap 48px，垂直居中，上下留白极大 `padding-block: 18vh`）：
  - 左栏：mono 红字 kicker + `h2`「关于我」（超大 clamp(2.8rem,4vw,3.6rem) w650）+ 两段介绍（muted，lh 1.8）+ 底部一行 mono 小字注记
  - 中栏：照片（直角，1px 墨线边框，filter grayscale(0.1)，约 4:5 比例）
  - 右栏「我现在都做些什么」状态卡：`border:1px solid var(--line)`、直角、内部小节用 1px 线分隔：状态行（`<i>` accent 点 + 「正在折腾」+ 文字）、链接行（mono 小字）；下方 icon 网格 2×2 或 3×2（`border:1px solid var(--line)` 直角格子，每格 icon + mono 小字标签：GitHub / RSS / 邮箱 / 博客等，hover 背景 var(--surface)）

---

## 5. 分类/标签/归档页（同语言适配）

保持现有信息架构，样式对齐本规格：
- 页面顶部统一加 topline（`0X / CATEGORY —— RULE —— 统计`，同 §3.1）
- 列表样式统一为 §3.4 的三列 time/title/meta 行式列表（分类卡从卡片改成**行式索引列表**，直角、1px 线分隔）
- 所有残留 rounded-* 清零、彩色阴影清零

## 6. 动效规范

- 全站缓动：`cubic-bezier(.16,1,.3,1)`；时长 .18s（颜色）/ .22s（下划线）/ .35s（图片）/ .72s（主题切换）
- `.magnetic-target`：页头 logo、nav 链接、按钮包一层，hover 时元素向鼠标方向轻微位移（≤4px）再回弹——实现为小 JS 组件（~30 行）
- 文本动画：identity 乱码解密（1.2s）、hero statement 逐词模糊（词间隔 50ms）——只在首页挂载，prefers-reduced-motion 时直接显示最终态
- 入场动画依赖 IntersectionObserver 的区块（子页内容）需保证 SSR 直出内容可见，动画只做 transform/opacity 且首屏可见区不隐藏

## 7. 禁改清单

- `config/site.yaml` 内容字段、文章集合 schema、搜索/订阅等功能逻辑
- 路由结构（/posts /categories /tags /archives /about 保持）
- 已有的暗色模式切换机制（`.dark` class 切换照常）
