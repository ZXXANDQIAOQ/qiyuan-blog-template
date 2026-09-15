#!/usr/bin/env node
/**
 * 构建前置钩子（由 package.json 的 prebuild 调用）
 *
 * 为什么需要这一层
 * ----------------
 * prebuild 会在**任意 CI 平台**上自动执行，而不同平台的运行环境差异很大
 * （Node 版本、网络可达性、是否有原生二进制）。任何一个子步骤抛错都会让
 * `npm run build` 整体失败，导致网站根本发不出去。
 *
 * 因此这里的原则是：**内容同步永远不能阻断构建**。
 * 同步失败就退回「用仓库里已有的文章构建」，网站照常上线。
 *
 * 这层包装也承担平台判定的职责——下面的步骤只在与当前平台匹配时才执行。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * 判断当前构建环境属于哪个平台。
 * Cloudflare Pages 会注入 CF_PAGES=1；EdgeOne 会注入 EDGEONE_* 系列变量。
 */
function detectPlatform() {
  if (process.env.CF_PAGES) return 'cloudflare';
  if (process.env.EDGEONE_ANY_ENV || process.env.EDGEONE_PROJECT_ID) return 'edgeone';
  if (process.env.VERCEL) return 'vercel';
  return 'local';
}

/** 跑一个 Node 脚本，永远不抛错，只回报退出码 */
function runNodeScript(scriptPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(scriptPath)) {
      resolve({ code: -1, reason: '脚本不存在' });
      return;
    }

    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => resolve({ code: -1, reason: error.message }));
    child.on('close', (code) => resolve({ code: code ?? -1, reason: `退出码 ${code}` }));
  });
}

async function main() {
  const platform = detectPlatform();
  console.log(`[prebuild] 平台=${platform}  Node=${process.version}`);

  const pullScript = path.join(process.cwd(), 'scripts', 'studio-pull-content.mjs');

  // 内容同步只在配置了凭据时才有意义。
  // 未配置时直接跳过——这是绝大多数部署（含 Cloudflare Pages）的常态。
  const hasCredentials = Boolean(process.env.STUDIO_BLOB_PROJECT_ID && process.env.STUDIO_BLOB_TOKEN);

  if (!hasCredentials) {
    console.log('[prebuild] 未配置 STUDIO_BLOB_* 凭据，跳过云端内容同步（使用仓库内文章构建）');
    return;
  }

  const result = await runNodeScript(pullScript);

  if (result.code === 0) {
    console.log('[prebuild] 云端内容同步完成');
    return;
  }

  if (result.code === 2) {
    // 已知的「同步失败」信号：可降级，用仓库里已有的 Markdown 继续构建。
    console.warn('[prebuild] 云端内容同步失败，回退为使用仓库内文章构建（网站仍会正常发布）');
    return;
  }

  // 其它退出码（脚本崩溃、被杀等）同样不阻断构建——
  // 保证「内容同步」这个可选环节永远不会导致网站发不出去。
  console.warn(`[prebuild] 内容同步脚本异常退出（${result.reason}），回退为使用仓库内文章构建`);
}

main().catch((error) => {
  console.warn(`[prebuild] 前置步骤异常：${error?.message || error}，继续构建`);
  // 同样不阻断
});
