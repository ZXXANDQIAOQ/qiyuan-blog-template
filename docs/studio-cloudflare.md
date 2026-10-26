# 内容后台（Studio）· Cloudflare Pages 版

本文档说明如何在 **Cloudflare Pages** 上启用 `/studio` 内容后台：管理员账号密码登录后，在浏览器里写 Markdown 文章，保存并触发重新构建。

> 仓库同时也保留了 EdgeOne 版的实现（`edge-functions/api/studio.js` 与本文档的 Cloudflare 版并存），
> 两个平台的文件互不干扰，可以同时部署。EdgeOne 版见 [`studio.md`](./studio.md)。

---

## 一、它是什么 / 不是什么

**是**：一个轻量的无头 CMS。文章存在 Cloudflare KV，构建时从 KV 同步到 `src/content/blog/`，复用站点现有的全部 Markdown 能力（Shoka 语法、数学公式、代码高亮、加密块、测验等原样可用）。

**不是**：所见即所得的富文本编辑器。正文用 Markdown 写，右侧有实时预览。

### 为什么保存后要点「发布」

本站是**纯静态站点**——文章在构建那一刻被烘焙成 HTML 并缓存到边缘。保存文章只是把它写进 KV 存储，**必须再构建一次**网站才会显示新内容。

这是静态站架构的固有特性，不是实现缺陷。好处是访问速度极快、成本极低且没有数据库故障面；代价就是内容更新需要一次构建（通常一两分钟）。

---

## 二、架构

| | EdgeOne 部署 | Cloudflare Pages 部署 |
| --- | --- | --- |
| 后端目录 | `edge-functions/api/studio.js` | `functions/api/studio/` |
| 存储 | `@edgeone/pages-blob`（Blob store） | **Cloudflare KV** |
| 部署钩子 | `EDGEONE_DEPLOY_HOOK` | `CF_DEPLOY_HOOK` |
| 谁被扫描 | EdgeOne 只扫 `edge-functions/` | Cloudflare 只扫 `functions/` |

两版的业务逻辑完全一致（PBKDF2 口令校验、HMAC 会话、登录限流、文章增删改查、图片处理、发布触发），只有存储层换成了 KV。

```
functions/api/studio/
├── [[path]].js    路由总入口，按 method + 路径分发到 10 个接口
├── auth.js        PBKDF2 校验 / HMAC 会话 / 登录限流
├── normalize.js   文章字段规范化（11 字段）
└── store.js       Cloudflare KV 存储层
```

---

## 三、部署步骤

### 1. 生成管理员口令

```bash
node scripts/studio-hash-password.mjs '设一个足够长的密码'
```

会输出两样东西：口令哈希（`pbkdf2$...`）和一个随机会话密钥。**明文密码不会被写入任何文件**。

### 2. 创建 KV Namespace

Cloudflare 控制台 → **Workers & Pages → KV → Create namespace**，记下创建后的 Namespace ID。

### 3. 绑定到 Pages 项目

项目 → **Settings → Functions → KV namespace bindings** → Add binding：

| 项目 | 值 |
| --- | --- |
| Variable name | `STUDIO_KV` |
| KV namespace | 上一步创建的那个 |

> 变量名必须是 `STUDIO_KV`，代码里按这个名字取。

### 4. 配置环境变量

项目 → **Settings → Environment variables**，**Production 与 Preview 两个环境都要配**：

| 变量名 | 值 | 必填 |
| --- | --- | --- |
| `STUDIO_USERNAME` | 你想用的管理员账号 | ✅ |
| `STUDIO_PASSWORD_HASH` | 第 1 步输出的 `pbkdf2$...` 整行 | ✅ |
| `STUDIO_SESSION_SECRET` | 第 1 步输出的会话密钥 | ✅ |
| `CF_DEPLOY_HOOK` | 部署钩子 URL（见下一步） | 可选 |

> ⚠️ **不要**配置 `STUDIO_BLOB_PROJECT_ID` / `STUDIO_BLOB_TOKEN` / `EDGEONE_DEPLOY_HOOK`
> —— 那些是 EdgeOne 专用，在 Cloudflare 上配了只会让构建多跑一次无效的网络请求。

### 5. 创建部署钩子（可选但推荐）

项目 → **Settings → Build & deployment → Deploy hooks** → 新建一个钩子（分支选 `main`），拿到 URL 后填入环境变量 `CF_DEPLOY_HOOK`。

不配也能用：保存不受影响，只是点「发布到网站」时会提示「尚未配置部署钩子」，需要手动到控制台点构建。

### 6. 推送代码并部署

`functions/` 目录与 `edge-functions/` 并存放在仓库根目录，Cloudflare Pages 会自动识别并部署 Functions。

---

## 四、日常使用

| 操作 | 路径 |
| --- | --- |
| 登录 | `你的域名/studio` |
| 文章列表 | `你的域名/studio/posts` |
| 新建 | 列表页右上角「写新文章」 |
| 编辑 | 列表里点「编辑」，或直接访问 `/studio/posts/<slug>` |

**发布流程**：写完后点「保存」，再回列表点右上角「发布到网站」。等构建完成（一两分钟），刷新网站即可看到。

在编辑器里按 `Ctrl/Cmd + S` 可以直接保存。

---

## 五、几个设计决定

**URL 短名（slug）独立于标题。** 改标题不会改变文章链接，已发布出去的链接不会失效。新建时会根据标题自动生成，可以手动改。

**草稿不会上线。** 勾选「存为草稿」后，文章只存在于后台，构建时会被跳过，网站上访问不到。

**图片走后台代理。** 上传的图片按内容哈希命名，保存在 KV 里，通过 `/api/studio/media/<文件名>` 访问。相同图片重复上传不会产生副本。

**KV 是最终一致的。** 保存后立刻刷新列表可能短暂看到旧数据，通常 1 秒内自动一致。保存接口会在响应里直接回传最新文章，前端不依赖立即回读。

---

## 六、安全说明

- 口令只存 **PBKDF2-SHA256 哈希**（10 万次迭代 + 随机 salt），仓库里没有明文
- 会话是 **HMAC 签名的 HttpOnly Cookie**，JavaScript 读不到，有效期 7 天
- 所有写操作都在服务端校验会话，前端绕过无从下手
- 登录失败有**恒定时间比较**，无法从响应耗时区分「账号错」还是「密码错」
- 登录失败限流：同一 IP 15 分钟内失败 8 次则暂时封锁
- `/studio` 已加入 `robots.txt` 的 Disallow，页面带 `noindex`，且 `sitemap.xml` 排除该路径
- 后台不加入任何导航入口，只有知道地址的人才能找到登录页
- **未配置 `STUDIO_USERNAME` / `STUDIO_PASSWORD_HASH` 时，所有接口一律返回 404** —— 即使忘记关掉功能，也不会暴露一个无人管理的登录入口

### 想关掉后台

最快：清空 Cloudflare 控制台的 `STUDIO_PASSWORD_HASH` 环境变量 —— 接口立即失效，无需重新部署。

或把 `config/site.yaml` 里的 `admin.enabled` 改为 `false`（需重新部署）。

---

## 七、故障排查

| 现象 | 原因与处理 |
| --- | --- |
| 登录页 404 | 三个必填环境变量缺任一；或项目未重新部署 |
| 登录提示「账号或密码不对」 | 哈希可能被换行符污染；重新跑一次生成脚本，注意复制完整一行 |
| 登录提示「试得太多次了」 | 限流生效（15 分钟 / 8 次），等待自动解封 |
| 保存失败 | KV 未绑定，或绑定变量名不是 `STUDIO_KV`；看 Functions 日志 |
| 提示「尚未配置部署钩子」 | 缺 `CF_DEPLOY_HOOK`，保存不受影响，可手动在控制台点构建 |
| 保存成功但网站没变化 | 还没触发构建。点「发布到网站」，或检查构建是否失败 |
| 登录后立刻被踢回登录页 | Cookie 需要 HTTPS；本地 `http://localhost` 调试时 Secure Cookie 不会保存，属预期行为 |
| 构建报 Node 版本错误 | 确认 `.nvmrc`（内容 `22.12.0`）已提交，或环境变量加 `NODE_VERSION=22.12.0` |

---

## 八、本地调试

仓库根目录提供 `wrangler.toml.example`，复制为 `wrangler.toml` 并填入 KV Namespace ID 后可本地调试：

```bash
cp wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml，把 id 换成你的 KV Namespace ID
npx wrangler pages dev dist --kv STUDIO_KV
```

> `wrangler.toml` 已在 `.gitignore` 中忽略，不会提交到仓库；
> Cloudflare Pages 通过 Git 部署时也不读这个文件（KV 绑定在控制台配置）。

---

## 九、想改接口时

前后端并行开发时**必须照同一份接口契约**，禁止两边各自定义字段。

| 想做的事 | 改哪里 |
| --- | --- |
| 加文章字段 | `functions/api/studio/normalize.js` 的 `normalizePost()` + 前端 `collect()` |
| 改接口路径/响应字段 | 同时改 `[[path]].js` + 前端 `fetch` 调用处 |
| 改后台路径（`/studio`→`/admin`） | `config/site.yaml` 的 `admin.path` + `src/pages/studio/` 目录名 + `robots` 的 `disallow` + `sitemap` 的 `filter` |
