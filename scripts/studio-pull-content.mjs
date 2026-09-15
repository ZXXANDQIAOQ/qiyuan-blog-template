#!/usr/bin/env node
/**
 * 构建期内容拉取：把 Studio 后台里保存的文章同步到本地内容目录
 *
 * 背景
 * ----
 * 本站是纯静态站点，文章在构建时被烘焙成 HTML。后台（/studio）把文章存在
 * EdgeOne Blob 里，所以在构建前必须先把它们拉到本地，交给 Astro 的集合加载器。
 *
 * 用法
 * ----
 *   npm run studio:pull        # 手动拉取
 *   npm run build              # 构建前自动执行（见 package.json 的 prebuild）
 *
 * 需要的环境变量（EdgeOne 控制台的「构建环境变量」，本地可放 .env）：
 *   STUDIO_BLOB_PROJECT_ID   EdgeOne 项目 ID
 *   STUDIO_BLOB_TOKEN        EdgeOne API Token（只读权限即可）
 * 两个都没配时本脚本静默跳过，不影响本地开发与纯手写文章的构建流程。
 *
 * 退出码
 * ------
 *   0  成功，或未配置凭据（无需同步）
 *   2  配置了凭据但同步失败——调用方应回退到仓库内文章，而非判定构建失败
 *
 * 说明：本脚本**不会**因为同步失败而让构建中断。它把失败信息通过退出码
 * 上报给 scripts/studio-prebuild.mjs，由后者决定如何降级。
 *
 * 产物
 * ----
 *   src/content/blog/<slug>.md        每篇文章一个 Markdown 文件（frontmatter + 正文）
 *   src/content/blog/.studio-manifest.json   记录本次由后台生成的文件，下次运行前清理旧文件
 *
 * 注意：由后台管理的文章会被覆盖，请勿手动编辑同名文件。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'blog');
const MANIFEST = path.join(CONTENT_DIR, '.studio-manifest.json');
const STORE_NAME = process.env.STUDIO_BLOB_NAME || 'studio-content';
const POSTS_PREFIX = 'posts/';

/**
 * 退出码约定（供调用方 scripts/studio-prebuild.mjs 判断）：
 *   0  —— 成功，或「无需同步」（未配置凭据）
 *   2  —— 配置了凭据但同步失败。
 *         调用方据此回退到「用仓库内文章构建」，而不是让构建失败。
 */
const EXIT_SYNC_FAILED = 2;

function log(message) {
  console.log(`[studio:pull] ${message}`);
}

/** 把 frontmatter 值安全地序列化成 YAML 标量 */
function yamlScalar(value) {
  if (typeof value === 'string') {
    // 含特殊字符或首尾空格时加引号
    if (value === '' || /[:#\-?[\]{}&*!|>'"%@`\n]/.test(value) || /^\s|\s$/.test(value)) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return `"${String(value)}"`;
}

function yamlList(key, items) {
  if (!items || items.length === 0) return '';
  const lines = items.map((item) => `  - ${yamlScalar(item)}`);
  return `${key}:\n${lines.join('\n')}\n`;
}

/** 把后台的文章 JSON 还原成带 frontmatter 的 Markdown */
function toMarkdown(post) {
  const lines = ['---'];

  lines.push(`title: ${yamlScalar(post.title)}`);
  if (post.description) lines.push(`description: ${yamlScalar(post.description)}`);
  lines.push(`pubDate: ${yamlScalar(post.date)}`);
  if (post.updated) lines.push(`updatedDate: ${yamlScalar(post.updated)}`);
  if (post.cover) lines.push(`heroImage: ${yamlScalar(post.cover)}`);

  const tagsBlock = yamlList('tags', post.tags);
  if (tagsBlock) lines.push(tagsBlock.trimEnd());

  const categoriesBlock = yamlList('categories', post.categories);
  if (categoriesBlock) lines.push(categoriesBlock.trimEnd());

  lines.push(`sticky: ${post.sticky === true}`);
  if (post.draft === true) lines.push('draft: true');

  lines.push('---', '');
  lines.push(String(post.body || ''), '');

  return lines.join('\n');
}

async function readManifest() {
  try {
    const raw = await fs.readFile(MANIFEST, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

/** 清掉上一轮由后台生成、这一轮已不存在的文件 */
async function cleanStale(previousFiles, currentFiles) {
  const current = new Set(currentFiles);
  let removed = 0;
  for (const file of previousFiles) {
    if (current.has(file)) continue;
    try {
      await fs.unlink(path.join(CONTENT_DIR, file));
      removed += 1;
    } catch {
      // 文件本就不在，忽略
    }
  }
  if (removed > 0) log(`清理了 ${removed} 个已删除的文章文件`);
}

async function fetchPosts() {
  const projectId = process.env.STUDIO_BLOB_PROJECT_ID;
  const token = process.env.STUDIO_BLOB_TOKEN;

  if (!projectId || !token) {
    log('未配置 STUDIO_BLOB_PROJECT_ID / STUDIO_BLOB_TOKEN，跳过云端同步');
    return null;
  }

  let getStore;
  try {
    ({ getStore } = await import('@edgeone/pages-blob'));
  } catch {
    log('未安装 @edgeone/pages-blob，跳过云端同步');
    return null;
  }

  const store = getStore({ name: STORE_NAME, projectId, token, consistency: 'strong' });
  const index = await store.get('posts/index.json', { type: 'json', consistency: 'strong' });

  const slugs = [];
  if (Array.isArray(index)) {
    for (const item of index) {
      if (item && typeof item.slug === 'string') slugs.push(item.slug);
    }
  }

  if (slugs.length === 0) {
    // 索引缺失时退化为列目录
    const listed = await store.list({ prefix: POSTS_PREFIX, consistency: 'strong' });
    for (const entry of listed.blobs || listed.keys || []) {
      const key = entry.key ?? entry.name;
      if (!key || key.endsWith('index.json')) continue;
      slugs.push(path.basename(key, '.json'));
    }
  }

  const posts = [];
  for (const slug of slugs) {
    try {
      const post = await store.get(`${POSTS_PREFIX}${slug}.json`, { type: 'json', consistency: 'strong' });
      if (post && typeof post === 'object') posts.push(post);
    } catch (error) {
      log(`读取文章 ${slug} 失败：${error?.message || error}`);
    }
  }

  return posts;
}

async function main() {
  const posts = await fetchPosts();
  if (posts === null) return; // 未配置，静默退出

  if (posts.length === 0) {
    log('云端暂无文章');
    const previous = await readManifest();
    await cleanStale(previous, []);
    await fs.writeFile(MANIFEST, JSON.stringify({ files: [] }, null, 2));
    return;
  }

  await fs.mkdir(CONTENT_DIR, { recursive: true });

  const written = [];
  for (const post of posts) {
    if (!post.slug || typeof post.slug !== 'string') continue;
    // 草稿不进静态站点，只有后台里能预览
    if (post.draft === true) continue;

    const filename = `${post.slug}.md`;
    await fs.writeFile(path.join(CONTENT_DIR, filename), toMarkdown(post), 'utf8');
    written.push(filename);
  }

  const previous = await readManifest();
  await cleanStale(previous, written);
  await fs.writeFile(MANIFEST, JSON.stringify({ files: written, syncedAt: new Date().toISOString() }, null, 2));

  log(`同步完成：${written.length} 篇（${written.length} 个文件已写入 src/content/blog/）`);
}

main().catch((error) => {
  console.error(`[studio:pull] 同步失败：${error?.message || error}`);
  // 退出码 2：明确告知调用方「同步没成功」，但这是可降级的，
  // 已有的本地文章照常参与构建。
  process.exit(EXIT_SYNC_FAILED);
});
