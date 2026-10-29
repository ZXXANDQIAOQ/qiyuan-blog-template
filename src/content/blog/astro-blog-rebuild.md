---
title: 用 Astro 5 把博客重写了一遍
cover: ../../assets/covers/astro-blog-rebuild.webp
date: 2026-10-18
accent: cyan
description: 从 Next.js pages router 搬到 Astro 5 的完整过程：内容集合怎么组织、岛屿架构真正该用在哪几处、以及三个让我卡了半天的坑。
subtitle: 构建时间从 4 分 12 秒掉到 38 秒
tags:
  - Astro
  - 前端
  - 重构
categories:
  - 笔记
sticky: true
---

上一个版本是 Next.js 的 pages router，配 `next-mdx-remote` 和一堆为了 prerender 而写的胶水代码。它跑得不算慢，但每次构建要 4 分 12 秒，改一个错别字也要等这 4 分钟。真正让我下决心的是九月底的一次改动：我只把某个开头的"的"改成了"了"，CI 里 300 多张图片重新生成了 300 多份 webp。

搬家花了一个周末，加两个晚上的收尾。下面是这次重写的几个关键决定和踩过的坑。

## 为什么要换成 Astro

不是因为"新"，是因为三件具体的事。

**第一，文章的元信息需要被校验。** 旧站里 frontmatter 是随手写的，`date` 有的带时间有的不带，`tags` 有的是字符串有的是数组，某个主题模板在 `.map` 的时候直接崩了。Astro 的内容集合用 zod schema 兜住这一层，写错字段在构建期就报错，而不是等到线上渲染出 `undefined`。

**第二，页面上其实只有三个地方需要 JavaScript。** 主题切换、站内搜索、代码块复制按钮。评论我直接去掉了，换成邮件。旧站把整个 React 运行时塞给每个页面，首屏 210 KB 的 JS 里有 90% 从来没被执行过。

**第三，图片处理应该由框架负责。** Astro 的 `image()` 在构建期做尺寸裁切和格式转换，我在 frontmatter 里只写文件名。

搬家后的数字：构建 38 秒，首页 JS 12 KB，Lighthouse 移动端性能从 68 到 99。

## 岛屿架构：只有三块是岛

"岛屿架构"这个词很容易被用成新的性能口号，但我建议先数清楚自己页面上到底有几个交互点。我的全部清单是这样的：

```astro
<!-- 主题切换：进页面就要响应，用 client:load -->
<ThemeToggle client:load />

<!-- 搜索：用户点开才需要，用 client:idle -->
<SearchDialog client:idle />

<!-- 代码复制：滚到代码块才需要，用 client:visible -->
<CodeCopy client:visible />
```

三个岛之外，文章列表、目录、标签云、页脚全是构建期生成的静态 HTML。

这里有一个我一开始没想明白的点：`client:visible` 并不是"滚到可见才渲染"，它依赖 IntersectionObserver，如果在首屏之上，效果和 `client:load` 差不多。所以给代码块用 `client:visible` 是对的，因为代码块一般在正文中间；但如果把搜索框放在 header 又写 `client:visible`，它其实立刻就加载了。

## 坑一：`content.config.ts` 换了位置

Astro 5 把内容集合的配置文件从 `src/content/config.ts` 挪到了 `src/content.config.ts`——上移了一级。文件放错地方的报错信息很不友好，它不会说"你放错位置了"，而是说：

```
Collection "blog" does not exist or is empty.
```

我对着这句话查了四十分钟，最后在升级指南的小字里看到迁移说明。

顺带一个细节：`glob()` 的 `base` 是相对**项目根目录**的，不是相对配置文件所在目录。写成 `./blog` 会得到空集合，同样报上面那句。

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    tags: z.array(z.string()).optional(),
  }),
});
```

## 坑二：`entry.slug` 没有了

内容层 API 统一用 `entry.id`。对于 markdown 文件，`id` 是带扩展名的相对路径（`astro-blog-rebuild.md`），不再是 `slug` 那种干净的短横线串。所以列表页的 `getStaticPaths` 要自己处理：

```ts
// src/pages/posts/[...slug].astro
import { getCollection, render } from 'astro:content';
import type { GetStaticPaths } from 'astro';

export const getStaticPaths = (async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.id.replace(/\.mdx?$/, '') },
    props: { post },
  }));
}) satisfies GetStaticPaths;

const { post } = Astro.props;
const { Content, headings } = await render(post);
```

`render()` 从 `astro:content` 里导入，返回 `Content` 组件和 `headings`。我原来自己写了个 remark 插件去扒标题做目录，现在直接删掉了——`headings` 里的 `depth` 和 `slug` 正是目录需要的。

图片那块也有变化：`image()` 只能在 schema 是函数形式时使用，因为要拿到构建上下文。

```ts
schema: ({ image }) =>
  z.object({
    title: z.string(),
    cover: image().optional(),
  }),
```

写成 `schema: z.object({...})` 直接调用 `image()` 会在模块加载期报 `image is not a function`。

## 坑三：i18n 路由生成了两份内容

站点要支持中英日，中文不带前缀（`/posts/xxx`），英日带前缀（`/en/posts/xxx`、`/ja/posts/xxx`）。默认语言不设前缀的时候，`[...lang]` 动态路由会把默认语言也匹配进去，于是同一个页面同时生成 `/posts/xxx` 和 `/zh/posts/xxx`。构建不报错，但 Search Console 两周后给我寄来 60 多条"重复网页，Google 选择的规范网页与用户指定的不同"。

修法是在 `getStaticPaths` 里显式排除默认语言：

```ts
const langs = ['en', 'ja']; // 不含默认语言 zh

export const getStaticPaths = (async () => {
  const posts = await getCollection('blog');
  return langs.flatMap((lang) =>
    posts.map((post) => ({
      params: { lang, slug: post.id.replace(/\.mdx?$/, '') },
      props: { post, lang },
    })),
  );
}) satisfies GetStaticPaths;
```

同时给每个页面输出 `<link rel="alternate" hreflang>`，包括一个指向默认语言版本的 `x-default`。这一条加完，那 60 多条告警两周内清空了。

## 现在的目录长什么样

```
src/
  content.config.ts
  content/blog/*.md
  pages/
    index.astro
    posts/[...slug].astro
    [lang]/
      index.astro
      posts/[...slug].astro
```

`src/content/blog/` 里只有 markdown，没有任何一篇文章知道路由怎么生成。这个隔离是我这次最满意的地方：以后要换路由结构，动的是 `pages/`，不是 300 篇文章。

## 三条教训

1. **先量，再换。** 我先把旧站的构建时间、JS 体积、首屏 LCP 记到表格里，搬家后逐项对比。不然"感觉快了"这种结论，三天后就会被自己怀疑。
2. **框架的报错信息从来不告诉你真正的原因。** `Collection does not exist` 其实是"文件放错位置"，`image is not a function` 其实是"schema 不是函数"。遇到这类错，先去翻升级指南的 Breaking Changes 段落，别急着 Google。
3. **能被 schema 校验的东西，不要靠自觉。** 我至今没想明白旧站为什么会有 `date: "2025/3/7"` 这种格式还能构建通过。

下一步想把文章朗读和全文搜索做起来。搜索打算用 Pagefind，构建后再索引，这样不用把索引塞进 JS bundle。等做完再写一篇。

样式层这次也顺手从 Tailwind v3 迁到了 v4，踩的坑单独写在[《Tailwind v4 迁移手记》](/post/tailwind-v4-migration)里。
