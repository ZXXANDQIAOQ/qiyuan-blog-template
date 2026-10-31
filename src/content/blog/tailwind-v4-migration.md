---
title: Tailwind v4 迁移手记
cover: ../../assets/covers/tailwind-v4-migration.webp
date: 2026-08-17
accent: magenta
description: 一个周末把 4000 行 Tailwind v3 配置搬到 v4：@theme 取代 config、@reference 报错怎么修，以及语义被反转的断点。
subtitle: 配置文件删了 340 行，CSS 反而变小了
tags:
  - Tailwind
  - CSS
  - 前端
categories:
  - 笔记
---

这个站的前端样式层一直是 Tailwind。从 v2 到 v3 都是改改 `tailwind.config.mjs` 就过去了，v4 这次不一样：它把配置从 JavaScript 搬进了 CSS，`tailwind.config.mjs` 从"必须存在"变成"可选兼容"。我的配置文件有 400 多行，删掉之后剩 60 行。

这篇记录我怎么迁的、哪里卡住、哪些地方到现在还留着兼容层。前置背景是把博客从 Next.js 换到了 Astro 5，那一段写在[《用 Astro 5 把博客重写了一遍》](/post/astro-blog-rebuild)里。

## 第一步：入口文件的三行变一行

v3 的入口：

```css
/* v3: src/styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn { @apply rounded px-3 py-1.5 text-sm; }
}
```

v4 换成一行导入，`@layer` 也不再需要包裹（`@apply` 可以直接写在普通选择器里）：

```css
/* v4: src/styles/global.css */
@import "tailwindcss";

.btn {
  @apply rounded px-3 py-1.5 text-sm;
}
```

这一步改完就能构建。但页面会难看——因为 `content` 数组没了，v4 用自动扫描，它扫的是项目里所有非 gitignore 的文件。我的文章 markdown 在 `src/content/blog/`，通常没问题；但我有一个用脚本生成的 `public/search-index.js`，里面拼了类名，自动扫描扫不到，那几个类名就消失了。这种情况要用 `@source` 显式补：

```css
@import "tailwindcss";

@source "../content/blog/**/*.md";
@source "../scripts/generated/**/*.js";
```

## 第二步：`theme.extend` 翻译成 `@theme`

这是迁移里工作量最大的一块，但也是收益最明显的。v4 的 `@theme` 里定义的每一条都是一个真实 CSS 变量，同时按命名空间自动生成工具类。

v3：

```js
// tailwind.config.mjs
export default {
  theme: {
    extend: {
      colors: {
        ink: { 50: '#f5f7fa', 900: '#0b0d12' },
        neon: '#38f5d0',
      },
      fontFamily: { display: ['"Space Grotesk"', 'ui-sans-serif'] },
      screens: { '3xl': '120rem' },
    },
  },
};
```

v4：

```css
@theme {
  --color-ink-50: #f5f7fa;
  --color-ink-900: #0b0d12;
  --color-neon: #38f5d0;

  --font-display: "Space Grotesk", ui-sans-serif;

  --breakpoint-3xl: 120rem;
}
```

规则很直白：`--color-*` 生成颜色类，`--font-*` 生成 `font-*`，`--breakpoint-*` 生成响应式前缀，`--spacing-*` 进间距刻度。我用到的就这四类，翻译完 `text-ink-900`、`bg-neon`、`font-display`、`3xl:grid-cols-6` 全都能用。

**这里有个真收益**：以前改暗色主题要写两套类名（`bg-white dark:bg-black`），现在只要覆写变量：

```css
:root {
  --color-surface: #ffffff;
}

[data-theme="dark"] {
  --color-surface: #0b0d12;
}
```

组件里永远写 `bg-surface`。我趁机把全站 200 多处 `dark:` 变体删掉了大半，那些"忘了写 dark 变体导致暗色下白底黑字"的 bug 一次性消失。

## 第三步：`@config` 兼容层

v4 不会自动去找 `tailwind.config.mjs`，需要手动引用。我有两个东西暂时不敢删：一个用了 `plugin()` 写的 `text-shadow` 插件，一个老组件依赖 `safelist`。

```css
@import "tailwindcss";
@config "../tailwind.config.mjs";
@theme { /* ... */ }
```

两个注意点：

1. `@config` 的路径是**相对当前 CSS 文件**的，不是相对项目根。写成 `./tailwind.config.mjs` 会报 `Cannot find module`。
2. `@config` 和 `@theme` 可以共存，但同名的令牌以 `@theme` 为准。我一开始两边都写了 `neon`，调试了半小时才发现 JS 里那份根本没生效。

## 坑一：`@apply` 报 unknown utility class

这个坑让我以为迁移失败了。症状：`.astro` 组件、Vue SFC、CSS Module 里只要用了 `@apply`，构建就报：

```
Cannot apply unknown utility class: bg-surface
```

原因是 v4 里每个 CSS 文件是独立处理的，一个隔离作用域的样式块（scoped style、CSS Module）没有上下文，不知道 `bg-surface` 是什么。修法是加一行 `@reference`：

```css
/* 组件内的 scoped 样式块开头 */
@reference "../styles/global.css";

.card {
  @apply bg-surface text-ink-900;
}
```

`@reference` 只做"告诉编译器去哪找令牌"，不会重复输出 CSS，所以不用担心样式翻倍。

## 坑二：断点语义被反转

这个是最容易上线后才发现的问题。我旧配置里的断点是这么写的：

```js
// v3 —— 桌面优先，用 max-width 表达
screens: {
  sm: { max: '639px' },
  md: { max: '1023px' },
  lg: { max: '1439px' },
}
```

在 v3 里，`md:flex` 的语义是"视口 **小于等于** 1023px 时 flex"。也就是说 `md:` 在这里表示窄屏。

v4 的 `--breakpoint-*` 只能表达 min-width 语义，`md:` 一律是"大于等于 48rem"。迁移之后我整个站点的布局翻了过来：本该只在手机上出现的单列排布，跑到了桌面；三列网格在手机上挤成一团。

修法有两种，我选了第二种：

- 把配置改写成 min-width 形式，然后逐个检查调用点；
- 保留旧语义，把所有前缀换成 `max-*` 变体，明确表达"小于这个尺寸时生效"。

```html
<!-- 迁移前：md: 在旧配置里表示 ≤1023px -->
<div class="md:flex-col">...</div>

<!-- 迁移后：语义写明白，不再依赖配置的隐含约定 -->
<div class="max-lg:flex-col">...</div>
```

顺手把配置改成了标准 min-width，这样团队里其他人一眼能看懂：

```css
@theme {
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
}
```

## 坑三：默认值变了，边框全变黑

v4 有两个默认值调整，迁移文档里都写了，但我还是踩了：

- `border` 的默认颜色从 `gray-200` 变成 `currentColor`。所有只写了 `border` 没写颜色的地方，边框变成了文字色，我的表格和分割线瞬间重了一圈。
- `ring` 的默认宽度从 3px 变成 1px。焦点轮廓在暗色背景上几乎看不见了。

这两处我都在全局层统一兜住，而不是去改 300 个调用点：

```css
@layer base {
  *, ::before, ::after {
    border-color: var(--color-ink-200, #e4e7ee);
  }
}

@layer components {
  :focus-visible {
    outline: 2px solid var(--color-neon);
    outline-offset: 2px;
  }
}
```

## 迁移结果

一共花了 8 小时左右：翻译令牌 2 小时，改断点语义 3 小时（最耗时，因为要逐个页面看效果），修 `@apply` 与默认值 2 小时，剩下是收尾。

数字上的变化：

| 指标 | v3 | v4 |
| --- | --- | --- |
| `tailwind.config.mjs` | 412 行 | 60 行（只剩插件和 safelist） |
| 生产 CSS | 46 KB | 18 KB |
| 增量构建（改一个类名） | 480 ms | 90 ms |

另外 v4 有浏览器下限：Safari 16.4、Chrome 111、Firefox 128。我的访客里这三个版本以下的加起来不到 1%，可以接受；如果是面向政企内网的项目，这个前提要先确认。

## 如果重来一次

我会把顺序改成：先在 `@config` 兼容模式下什么都不改跑通构建，确认基线；再翻断点语义，因为这是唯一会"静默改变布局"的改动；最后才翻译令牌、删 `dark:` 变体。我这次先动令牌后动断点，导致布局问题出现时同时有十几个变量在变，很难定位是哪一个引起的。

样式层的东西，能一次只改一类，就别图快。
