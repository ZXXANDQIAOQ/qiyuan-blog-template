# 部署到 GitHub Pages

本文档说明如何把本站部署到 **GitHub Pages**，以及它与 Cloudflare Pages 并存时需要注意什么。

> 相关文档：[`deploy-cloudflare.md`](./deploy-cloudflare.md)（Cloudflare Pages）、[`studio.md`](./studio.md)（内容后台）

---

## 一、为什么原来会失败

你看到的报错来自 **Jekyll**：

```
Build with Jekyll
GitHub Pages: github-pages v232
Generating...
build failed
```

原因很简单：**GitHub Pages 默认用 Jekyll 构建**。当仓库里没有自定义的 Actions 工作流时，Pages 会回退到 legacy 构建器，它把仓库根目录当作一个 **Jekyll 站点**去渲染。

而本仓库是 **Astro 项目**——Jekyll 完全看不懂 `astro.config.mjs`、`package.json`、`.astro` 文件这类内容，于是必然失败。

这不是代码有 bug，而是**构建器选错了**。

---

## 二、解决方案

本仓库现在通过自定义 GitHub Actions 工作流部署，绕开 Jekyll：

| 文件 | 作用 |
| --- | --- |
| `.github/workflows/deploy-pages.yml` | 用 Node 构建 Astro，再把 `dist/` 发布到 Pages |
| `public/.nojekyll` | 告诉 Pages 不要做 Jekyll 处理 |

工作流流程：`npm ci` → `npm run build` → 上传 `dist/` → 发布。

---

## 三、需要你手动做的一步（重要）

**仓库的 Pages Source 必须改成 "GitHub Actions"。**

路径：仓库 → **Settings** → **Pages** → **Build and deployment** → **Source** → 选 **GitHub Actions**

如果这里还停留在 **"Deploy from a branch"**，Pages 会继续用 Jekyll 构建，报错不会消失。

> 工作流跑过一次之后，Source 通常会被自动置为 GitHub Actions；
> 但如果是首次配置，手动确认一下最稳妥。

---

## 四、网址与路径

GitHub Pages 的**项目站点**部署在子路径下，这一点和 Cloudflare 不同：

| | Cloudflare Pages | GitHub Pages |
| --- | --- | --- |
| 部署位置 | 域名根路径 `/` | 子路径 `/<仓库名>/` |
| 站点地址 | 你自己的域名 | `https://<用户名>.github.io/<仓库名>/` |
| Astro `base` | `/` | `/<仓库名>/` |

本项目通过**环境变量**切换，源码只维护一份：

| 变量 | 作用 | 何时设置 |
| --- | --- | --- |
| `SITE_BASE` | Astro 的 `base`，资源与链接前缀 | GitHub Actions 自动注入；Cloudflare / 本地**不用管** |
| `SITE_URL` | 站点绝对地址，影响 canonical / sitemap / RSS | 同上 |

在 `astro.config.mjs` 中：

```js
// 不设置 SITE_BASE → base = '/'（Cloudflare、本地开发）
// SITE_BASE=/<仓库名>/ → base = '/<仓库名>/'（GitHub Pages）
```

**所以你不需要改任何配置**：Cloudflare 那边不设这两个变量，行为与之前完全一致。

---

## 五、同步生效的原理

为了让子路径部署不只是「能打开」，而是「资源、链接、SEO 都正确」，做了这些处理：

| 方面 | 处理方式 |
| --- | --- |
| 站内链接 | 统一走 `localizedPath()`，内部已拼接 base |
| 静态资源（字体、海报、视频、favicon、katex） | 统一走 `withBase()` |
| 文章封面、分类图、头像、系列封面 | 渲染时补 base（数据层保持干净） |
| canonical / hreflang | 基于 `Astro.url`，Astro 会自动带上 base |
| sitemap / robots.txt | 由 `SITE_URL` + base 推导 |
| RSS 链接与样式表 | 显式走 `withBase()`（`new URL()` 会丢弃子路径前缀） |
| 多语言路由识别 | `getLocaleFromUrl()` 先剥离 base 再判断，避免把仓库名误认为语言代码 |
| 站内搜索 | Pagefind 的 bundlePath 基于 `BASE_URL`，天然正确 |

---

## 六、两个平台同时部署

两边可以并存，互不干扰：

```
push 到 main
├── GitHub Actions  → 构建（SITE_BASE=/<仓库名>/）→ GitHub Pages
└── Cloudflare Git  → 构建（不设 SITE_BASE）      → Cloudflare Pages
```

**功能差异**：

| 功能 | Cloudflare Pages | GitHub Pages |
| --- | --- | --- |
| 站点内容 | ✅ | ✅ |
| 站内搜索 | ✅ | ✅ |
| `/studio` 内容后台 | ❌（404） | ❌（404） |
| 自定义域 | ✅ | ✅（或 CNAME） |

`/studio` 后台两边都不可用，因为它依赖 `edge-functions/`（EdgeOne 平台约定），只在 **EdgeOne Makers** 上工作。

---

## 七、已知限制：文章正文里的图片

Markdown 正文中**根绝对路径**的图片不会自动加 base：

```markdown
<!-- 子路径部署下会 404 -->
![图](/img/pic.png)

<!-- 也会 404（相对仓库根，不是页面路径） -->
![图](../../img/pic.png)
```

**建议做法**：正文图片放在 `src/` 下并用相对路径引用，让 Astro 的图片管线处理：

```markdown
![图](./images/pic.png)
```

> 当前 `src/content/blog` 是空目录，暂时不受影响。新增文章时留意这一点。

---

## 八、故障排查

| 现象 | 原因与处理 |
| --- | --- |
| 仍报 `Build with Jekyll` 失败 | **Pages Source 还是 "Deploy from a branch"**，改成 "GitHub Actions"（见第三节） |
| 工作流报 Node 版本错误 | 工作流用 `node-version-file: .nvmrc` 读取 `22.12.0`；确认 `.nvmrc` 已提交 |
| 页面能开但样式/图片全丢 | `SITE_BASE` 没生效。检查工作流的 `env` 段，或手动设 `SITE_BASE=/<仓库名>/` 重新构建 |
| 页面链接跳到域名根目录 | 同上，通常是 base 没设置正确 |
| `npm ci` 失败 | 确认 `package-lock.json` 已提交且与 `package.json` 一致 |
| 发布后仍是旧内容 | 到 **Actions** 看最新一次运行是否成功；再看 **Deployments** 里最新发布状态 |
| 工作流找不到 Pages 权限 | 确认工作流文件里的 `permissions` 段未被改动（需要 `pages: write` 与 `id-token: write`） |

---

## 九、手动触发部署

除了 push，也可以在仓库 **Actions** 页面选中 **Deploy to GitHub Pages**，点 **Run workflow** 手动跑一次。

---

## 十、本地验证子路径构建

想在本机确认 GitHub Pages 那份构建是否正常：

```bash
# Windows (Git Bash)
SITE_BASE=/<仓库名>/ npm run build
```

然后检查产出的 `dist/index.html`，确认资源路径都带上了 `/<仓库名>/` 前缀。
