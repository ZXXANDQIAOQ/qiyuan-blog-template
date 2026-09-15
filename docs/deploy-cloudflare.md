# 部署到 Cloudflare Pages

本文档说明如何把本站部署到 **Cloudflare Pages**，以及在这个平台上**哪些功能可用、哪些不可用**。

> 如果你要部署到 **EdgeOne Makers**，请看 [`studio.md`](./studio.md)。

---

## 一、结论先行

**可以直接部署，构建不会失败。** 本站是纯静态站点（`output: 'static'`，没有安装任何 Astro 适配器），`npm run build` 产出标准的 `dist/` 目录，这正是 Cloudflare Pages 期望的形态。

**但有一个功能在 Cloudflare Pages 上不可用**：`/studio` 内容后台。

原因是两个平台的边缘函数目录约定不同：

| | EdgeOne Makers | Cloudflare Pages |
| --- | --- | --- |
| 后端目录 | `edge-functions/` | `functions/` |
| 配置文件 | `edgeone.json` | 无（用控制台配置） |
| 本仓库的后端 | `edge-functions/api/studio.js` | — |

Cloudflare Pages 只扫描 `functions/` 目录，`edge-functions/` 会被当作**普通静态资源目录忽略掉**——不会报错，但也**不会部署**。所以：

- 站点本身：**正常构建、正常发布**
- `/studio` 后台：**在 Cloudflare 上不可用**（访问会得到 404）

这是刻意的设计：两个平台的文件互不干扰，你可以同时部署到两边，各取所长。

---

## 二、部署步骤

### 1. 确认构建设置

在 Cloudflare 控制台创建 Pages 项目并连接 Git 仓库后，填写的构建配置：

| 配置项 | 值 |
| --- | --- |
| Framework preset | `Astro` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | （留空，即仓库根目录） |

### 2. 指定 Node 版本

**这一步很重要。** 本站的 `package.json` 声明了 `"node": ">=22.12.0"`，而 Cloudflare Pages 的默认 Node 版本可能低于这个要求，会导致构建报错。

仓库根目录已经放了 `.nvmrc` 和 `.node-version`（内容均为 `22.12.0`），Cloudflare 会自动读取。

如果仍然报 Node 版本相关的错误，到 **Settings → Environment variables** 手动添加一个变量：

| 变量名 | 值 |
| --- | --- |
| `NODE_VERSION` | `22.12.0` |

> 同一个变量在 **Production** 和 **Preview** 两个环境都要加，否则 PR 预览构建可能失败。

### 3. 环境变量

**本站不需要任何环境变量就能构建成功。**

`package.json` 里的 `prebuild` 会运行 `scripts/studio-prebuild.mjs`，它检测到 `STUDIO_BLOB_*` 凭据不存在时会直接跳过并正常退出，不会影响构建。

> ⚠️ **不要**在 Cloudflare 上配置 `STUDIO_BLOB_PROJECT_ID` / `STUDIO_BLOB_TOKEN`。
> 这两个凭据是给 EdgeOne Blob 用的，在 Cloudflare 上配了只会让构建多跑一次无效的网络请求。
> 即使误配了也不会导致构建失败——脚本会打印警告后降级为「使用仓库内文章构建」。

### 4. 自定义域（可选）

到 **Custom domains** 添加你的域名。如果你同时用 EdgeOne，注意**两个方面都要配置好 DNS**，避免两边抢同一个记录。

---

## 三、日常发文章怎么做

在 Cloudflare 平台上，`/studio` 后台不可用，所以有两条路：

### 路线 A：继续用 Git（适合 Cloudflare 部署）

直接在仓库里新增 `src/content/blog/<slug>.md`，push 后 Cloudflare 会自动构建发布。

### 路线 B：EdgeOne 写、Cloudflare 发布（混合方案）

1. 在 EdgeOne 上部署一份，用 `/studio` 后台写文章
2. 在后台点「发布到网站」——注意这触发的是 **EdgeOne 的部署钩子**，更新的是 EdgeOne 那份
3. 如果你希望 Cloudflare 这份也更新，需要在写完文章后**把生成的 Markdown 提交回仓库**，然后 Cloudflare 才会跟着构建

> 也就是说：跨平台的「一键发布」不成立。后台的发布按钮只对它自己所在的平台生效。
> 如果你主要在 Cloudflare 上跑，又想要在线编辑器，需要额外做一层适配（见第四节）。

---

## 四、如果想让后台在 Cloudflare 上也能用

这需要把边缘函数从 EdgeOne 的写法迁移到 Cloudflare Pages Functions 的写法。主要差异：

| 方面 | EdgeOne 写法 | Cloudflare 写法 |
| --- | --- | --- |
| 目录 | `edge-functions/api/studio.js` | `functions/api/studio/[[path]].js` |
| 入口签名 | `export async function onRequest(context)` | 同上，但 `context` 需含 `params` |
| 读请求体 | `await request.json()` | 一致 |
| 环境变量 | `context.env.XXX` | 一致 |
| 存储 | `@edgeone/pages-blob` | **需替换**为 R2（对象存储）或 KV |
| 部署触发 | EdgeOne 部署钩子 | Cloudflare Deploy Hook |

**最大的工作量在存储层**：`@edgeone/pages-blob` 在 Cloudflare 上不可用，需要改写成 Cloudflare R2 绑定或 KV 绑定。

好消息是 `edge-functions/api/studio.js` 里的业务逻辑（口令校验、会话签名、文章增删改查、图片处理）与平台无关，只有 `getContentStore()` 这一个函数需要换实现。如果你决定要做这个迁移，告诉我，我可以直接在 `functions/` 下建一份 Cloudflare 版本的实现，两边共存互不影响。

---

## 六、构建验证结果

本项目已在本地完整跑通构建，结果如下：

```
[build] 24 page(s) built in 70.10s
[build] Complete!
```

- **exit code = 0，零错误**
- `dist/` 产出 903 个文件，包含 `index.html`、`pagefind/` 搜索索引、`sitemap-index.xml`、`robots.txt`
- `npm run studio:test` → 39 用例全部通过
- `astro check` → 253 文件 0 错误

> 构建耗时约 50~70 秒（本机）。Cloudflare 的构建机器通常更快。

### 修复过的一个真实缺陷

开发过程中发现并修复了一个会导致**任意平台构建失败**的问题，记录在此供参考：

`src/pages/studio/posts/[slug].astro` 是动态路由。在 `output: 'static'` 下，Astro 强制要求动态路由导出 `getStaticPaths()`，否则整个构建报错：

```
[GetStaticPathsRequired] `getStaticPaths()` function is required for dynamic routes.
```

而后台的文章 slug 只有运行时才知道（用户在编辑器里输入），构建期无法枚举。

最终解法是让 `getStaticPaths()` **返回空数组**——构建期不预渲染该路由，Astro 跳过它，构建正常通过。该页面是纯客户端渲染（数据全靠 `fetch /api/studio/*`），本身不需要参与静态生成。

> 注意：不要试图用 `export const prerender = false` 解决。本站没有安装 SSR 适配器，那样会报 `NoAdapterInstalled`；而安装适配器会改变 `dist` 的形态，影响静态部署。

---

## 七、故障排查

| 现象 | 原因与处理 |
| --- | --- |
| 构建报 Node 版本错误 | 确认 `.nvmrc` 已提交；或在环境变量加 `NODE_VERSION=22.12.0`（Production 与 Preview 都要加） |
| 构建时 Pagefind 报错 | 已用 `integrations/safe-pagefind.mjs` 包裹，最坏情况是搜索索引跳过、构建仍然成功。若反复失败可在构建日志确认是否只是 warning |
| `/studio` 返回 404 | **预期行为**，该平台不支持 `edge-functions/`。见第一节 |
| `/studio/posts/xxx` 返回 404 | 同上；且该页面需 `getStaticPaths` 返回空数组才能构建通过，已在代码中处理 |
| 部署成功但页面是旧的 | 检查是否命中了旧构建缓存；到 Deployments 里看最新一次是否成功 |
| 构建超时 | 本机构建约 50~70 秒；Cloudflare 免费版构建上限通常足够。若超时先检查是否卡在依赖安装 |
| 文章没更新 | 确认 Markdown 已提交到仓库。Cloudflare 构建的是仓库内容，不是后台存储 |

### 关于「构建看起来卡住」

构建过程中会出现较长的静默期（例如 `Collecting build info...` 之后的依赖预构建阶段），看起来像卡住，实际仍在工作。

判断方法：观察进程的 CPU 时间是否在增长。**只要 CPU 在涨就是在干活**，不要过早中断——本项目完整构建需要 50 秒以上。

> 排查时请勿在构建进行中手动结束进程，否则日志会停在中间状态，容易误判为「卡死」。

