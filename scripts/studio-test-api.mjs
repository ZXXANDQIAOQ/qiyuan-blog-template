/**
 * Studio API 端到端测试
 *
 * 目的：在不依赖 EdgeOne 运行时、不依赖 Astro/Vite 的前提下，
 * 真实执行 edge-functions/api/studio.js 的每一段逻辑，验证：
 *   登录鉴权、Cookie 会话、文章增删改查、索引维护、越权拦截、
 *   未配置时的隐身行为、图片类型与大小限制、发布钩子。
 *
 * 做法：把 V8 运行时缺失的东西补齐（Web Crypto 用 Node 内置的），
 *       把 @edgeone/pages-blob 换成内存实现（见 studio-test-preload.mjs），
 *       然后直接调用 onRequest。
 *
 * 运行：npm run studio:test
 */

import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// ---------------------------------------------------------------------------
// 1. 补齐 EdgeOne 运行时提供的全局对象
// ---------------------------------------------------------------------------
// Node 18+ 已内置 globalThis.crypto（且是只读 getter），无需也不能覆盖。
// 这里只兜底补齐可能缺失的 btoa / atob。

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
}
if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

// 内存版 Blob store，模拟 @edgeone/pages-blob 的接口
const memoryBlob = new Map();
const memoryBlobTypes = new Map();

const mockStore = {
  async set(key, value, options = {}) {
    if (options.onlyIfNew && memoryBlob.has(key)) return { ok: false };
    if (value instanceof ArrayBuffer) memoryBlob.set(key, Buffer.from(value));
    else memoryBlob.set(key, value);
    if (options.contentType) memoryBlobTypes.set(key, options.contentType);
    return { ok: true };
  },
  async setJSON(key, value) {
    memoryBlob.set(key, JSON.stringify(value));
  },
  async get(key, options = {}) {
    const raw = memoryBlob.get(key);
    if (raw === undefined || raw === null) return null;
    if (options.type === 'json') {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    return raw;
  },
  async getWithHeaders(key, options = {}) {
    const raw = memoryBlob.get(key);
    if (raw === undefined || raw === null) return null;
    return {
      data: options.type === 'blob' ? raw : raw,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? memoryBlobTypes.get(key) : null) },
    };
  },
  async delete(key) {
    memoryBlob.delete(key);
    memoryBlobTypes.delete(key);
  },
  async list(options = {}) {
    const prefix = options.prefix || '';
    return {
      complete: true,
      cursor: '',
      blobs: [...memoryBlob.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })),
    };
  },
};

// 拦截对 @edgeone/pages-blob 的 import。
// 注意：被测文件是 ESM，Module._load 钩子对它无效（ESM 走的是 loader 而非 require），
// 因此这里用 module.register 注册一个解析钩子，把该模块重定向到内存实现。
// 内存 store 通过 globalThis 暴露给替身模块共享（替身模块与 loader 由预加载脚本生成）
globalThis.__STUDIO_MOCK_BLOB__ = { store: mockStore, data: memoryBlob, types: memoryBlobTypes };

// ---------------------------------------------------------------------------
// 2. 载入被测模块
// ---------------------------------------------------------------------------

const studio = await import('../edge-functions/api/studio.js');
const { onRequest } = studio;

// ---------------------------------------------------------------------------
// 3. 测试骨架
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
    failed += 1;
  }
}

/** 构造一个最小的 Edge Function context */
function makeContext(url, options = {}) {
  const { method = 'GET', headers = {}, body, env = {} } = options;
  const request = new Request(url, {
    method,
    headers,
    body,
  });
  return { request, env, params: {}, waitUntil: () => {} };
}

/**
 * 构造「带 JSON body」的请求参数。
 * 注意：调用方若同时传了 headers（如鉴权 Cookie），必须在这里合并而不是被覆盖，
 * 因此这个 helper 接受额外 headers。
 */
function withJson(data, extraHeaders = {}) {
  return {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(data),
  };
}

function jsonBody(data) {
  return withJson(data);
}

const BASE = 'https://example.com/api/studio';

// 固定口令：TestPassword123 -> 由 scripts/studio-hash-password.mjs 生成
const PASSWORD_HASH = 'pbkdf2$100000$D77ZK5BFy7A5Z4vjc7Y4sA==$Y30TtuVwjbyVPjKs2VO348YA0g0ClsZtRCvfZcgo2oQ=';
const SESSION_SECRET = 'test-secret-key-for-unit-testing-only';

const baseEnv = {
  STUDIO_USERNAME: 'admin',
  STUDIO_PASSWORD_HASH: PASSWORD_HASH,
  STUDIO_SESSION_SECRET: SESSION_SECRET,
  EDGEONE_DEPLOY_HOOK: 'https://example.com/hook',
};

function extractCookie(response) {
  const raw = response.headers.get('set-cookie');
  if (!raw) return null;
  const match = raw.match(/studio_session=([^;]+)/);
  return match ? match[1] : null;
}

// =============================================================================
// 测试开始
// =============================================================================

console.log('\n=== Studio API 端到端测试 ===\n');

console.log('[未配置环境变量时应完全隐身]');

await test('缺少 STUDIO_USERNAME 时登录返回 404', async () => {
  const ctx = makeContext(`${BASE}/login`, {
    method: 'POST',
    env: { STUDIO_PASSWORD_HASH: PASSWORD_HASH, STUDIO_SESSION_SECRET: SESSION_SECRET },
    ...jsonBody({ username: 'admin', password: 'TestPassword123' }),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 404);
});

await test('缺少 STUDIO_PASSWORD_HASH 时 session 也返回 404', async () => {
  const ctx = makeContext(`${BASE}/session`, {
    env: { STUDIO_USERNAME: 'admin', STUDIO_SESSION_SECRET: SESSION_SECRET },
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 404);
});

await test('完全无环境变量时任意接口都 404', async () => {
  const ctx = makeContext(`${BASE}/posts`, { env: {} });
  const res = await onRequest(ctx);
  assert.equal(res.status, 404);
});

console.log('\n[登录]');

await test('正确账号密码可以登录并下发 httpOnly Cookie', async () => {
  const ctx = makeContext(`${BASE}/login`, {
    method: 'POST',
    env: baseEnv,
    ...jsonBody({ username: 'admin', password: 'TestPassword123' }),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.ok, true);

  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie.includes('HttpOnly'), 'Cookie 必须带 HttpOnly');
  assert.ok(setCookie.includes('Secure'), 'Cookie 必须带 Secure');
  assert.ok(setCookie.includes('SameSite=Strict'), 'Cookie 必须带 SameSite=Strict');
});

await test('错误密码被拒绝', async () => {
  const ctx = makeContext(`${BASE}/login`, {
    method: 'POST',
    env: baseEnv,
    ...jsonBody({ username: 'admin', password: 'WrongPassword' }),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

await test('错误账号被拒绝', async () => {
  const ctx = makeContext(`${BASE}/login`, {
    method: 'POST',
    env: baseEnv,
    ...jsonBody({ username: 'root', password: 'TestPassword123' }),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

await test('空密码被拒绝', async () => {
  const ctx = makeContext(`${BASE}/login`, {
    method: 'POST',
    env: baseEnv,
    ...jsonBody({ username: 'admin', password: '' }),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 400);
});

// 取得有效会话 Cookie
const loginCtx = makeContext(`${BASE}/login`, {
  method: 'POST',
  env: baseEnv,
  ...jsonBody({ username: 'admin', password: 'TestPassword123' }),
});
const loginRes = await onRequest(loginCtx);
const sessionToken = extractCookie(loginRes);

console.log('\n[会话校验]');

await test('带有效 Cookie 的 session 返回登录态', async () => {
  const ctx = makeContext(`${BASE}/session`, {
    env: baseEnv,
    headers: { cookie: `studio_session=${sessionToken}` },
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.username, 'admin');
});

await test('无 Cookie 的 session 返回 401', async () => {
  const ctx = makeContext(`${BASE}/session`, { env: baseEnv });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

await test('被篡改的 Cookie 返回 401', async () => {
  const tampered = `${sessionToken.slice(0, -6)}AAAAAA`;
  const ctx = makeContext(`${BASE}/session`, {
    env: baseEnv,
    headers: { cookie: `studio_session=${tampered}` },
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

await test('用别的密钥签发的 Cookie 返回 401', async () => {
  // 手工构造一个签名不匹配的 token
  const fake = `${Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64')}.AAAA`;
  const ctx = makeContext(`${BASE}/session`, {
    env: baseEnv,
    headers: { cookie: `studio_session=${fake}` },
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

console.log('\n[鉴权拦截]');

await test('未登录访问文章列表返回 401', async () => {
  const ctx = makeContext(`${BASE}/posts`, { env: baseEnv });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

await test('未登录保存文章返回 401', async () => {
  const ctx = makeContext(`${BASE}/posts?slug=hack`, {
    method: 'POST',
    env: baseEnv,
    ...jsonBody({ title: '入侵', body: 'x' }),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

await test('未登录删除文章返回 401', async () => {
  const ctx = makeContext(`${BASE}/posts/x`, { method: 'DELETE', env: baseEnv });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

await test('未登录触发发布返回 401', async () => {
  const ctx = makeContext(`${BASE}/publish`, { method: 'POST', env: baseEnv });
  const res = await onRequest(ctx);
  assert.equal(res.status, 401);
});

console.log('\n[文章增删改查]');

const auth = { cookie: `studio_session=${sessionToken}` };

await test('空列表初始状态正确', async () => {
  const ctx = makeContext(`${BASE}/posts`, { env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.posts, []);
});

await test('新建文章成功', async () => {
  const ctx = makeContext(`${BASE}/posts?slug=hello-world`, {
    method: 'POST',
    env: baseEnv,
    ...withJson(
      {
        title: '你好世界',
        description: '第一篇',
        date: '2026-09-15',
        tags: ['Astro'],
        categories: ['笔记'],
        body: '# 标题\n\n正文内容',
      },
      auth,
    ),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.post.slug, 'hello-world');
  assert.equal(body.post.title, '你好世界');
});

await test('标题为空时拒绝保存', async () => {
  const ctx = makeContext(`${BASE}/posts?slug=no-title`, {
    method: 'POST',
    env: baseEnv,
    ...withJson({ title: '   ', body: 'x' }, auth),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 400);
});

await test('非法 slug 被拒绝', async () => {
  for (const bad of ['../etc/passwd', 'a b', 'UPPER/slash', '中文', '']) {
    const ctx = makeContext(`${BASE}/posts?slug=${encodeURIComponent(bad)}`, {
      method: 'POST',
      env: baseEnv,
      ...withJson({ title: 'x', body: 'y' }, auth),
    });
    const res = await onRequest(ctx);
    assert.equal(res.status, 400, `slug "${bad}" 应被拒绝，实际 ${res.status}`);
  }
});

await test('读取刚建的文章', async () => {
  const ctx = makeContext(`${BASE}/posts/hello-world`, { env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.post.title, '你好世界');
  assert.ok(body.post.body.includes('正文内容'));
});

await test('列表里能看到这篇文章', async () => {
  const ctx = makeContext(`${BASE}/posts`, { env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  const body = await res.json();
  assert.equal(body.posts.length, 1);
  assert.equal(body.posts[0].slug, 'hello-world');
  // 列表不应带正文，减小响应体积
  assert.equal(body.posts[0].body, undefined);
});

await test('更新文章会保留 createdAt 并刷新 updated', async () => {
  const first = await onRequest(makeContext(`${BASE}/posts/hello-world`, { env: baseEnv, headers: auth }));
  const original = (await first.json()).post;

  const ctx = makeContext(`${BASE}/posts?slug=hello-world`, {
    method: 'POST',
    env: baseEnv,
    ...withJson({ title: '改过的标题', body: '新正文' }, auth),
  });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  const updated = (await res.json()).post;

  assert.equal(updated.title, '改过的标题');
  assert.equal(updated.createdAt, original.createdAt, 'createdAt 必须保持不变');
});

await test('索引里不会出现重复条目', async () => {
  const ctx = makeContext(`${BASE}/posts`, { env: baseEnv, headers: auth });
  const body = await (await onRequest(ctx)).json();
  assert.equal(body.posts.length, 1, `索引应只有 1 条，实际 ${body.posts.length}`);
});

await test('草稿字段被正确保存', async () => {
  const ctx = makeContext(`${BASE}/posts?slug=draft-post`, {
    method: 'POST',
    env: baseEnv,
    ...withJson({ title: '草稿', body: 'x', draft: true }, auth),
  });
  const res = await onRequest(ctx);
  const body = await res.json();
  assert.equal(body.post.draft, true);
});

await test('多余字段不会被写入', async () => {
  const ctx = makeContext(`${BASE}/posts?slug=extra-field`, {
    method: 'POST',
    env: baseEnv,
    ...withJson({ title: 'x', body: 'y', isAdmin: true, random: 'nope' }, auth),
  });
  const res = await onRequest(ctx);
  const body = await res.json();
  assert.equal(body.post.isAdmin, undefined, '不应写入 isAdmin');
  assert.equal(body.post.random, undefined, '不应写入 random');
});

await test('删除文章成功且索引同步', async () => {
  const ctx = makeContext(`${BASE}/posts/extra-field`, { method: 'DELETE', env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);

  const listCtx = makeContext(`${BASE}/posts`, { env: baseEnv, headers: auth });
  const list = await (await onRequest(listCtx)).json();
  assert.equal(
    list.posts.find((p) => p.slug === 'extra-field'),
    undefined,
    '索引中不应再有该文章',
  );
});

await test('删除不存在的文章返回 404', async () => {
  const ctx = makeContext(`${BASE}/posts/never-existed`, { method: 'DELETE', env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 404);
});

await test('读取不存在的文章返回 404', async () => {
  const ctx = makeContext(`${BASE}/posts/never-existed`, { env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 404);
});

console.log('\n[图片上传]');

await test('拒绝非图片类型', async () => {
  const form = new FormData();
  form.append('file', new Blob(['#!/bin/sh'], { type: 'text/x-shellscript' }), 'evil.sh');
  const ctx = makeContext(`${BASE}/upload`, { method: 'POST', env: baseEnv, headers: auth, body: form });
  const res = await onRequest(ctx);
  assert.equal(res.status, 415);
});

await test('接受图片并按哈希命名', async () => {
  const form = new FormData();
  const fakePng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  form.append('file', new Blob([fakePng], { type: 'image/png' }), 'a.png');
  const ctx = makeContext(`${BASE}/upload`, { method: 'POST', env: baseEnv, headers: auth, body: form });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.url.startsWith('/api/studio/media/'), '应返回媒体代理 URL');
  assert.ok(body.url.endsWith('.png'), '应保留图片扩展名');
});

await test('相同图片重复上传得到同一地址', async () => {
  const makeForm = () => {
    const form = new FormData();
    const fakePng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    form.append('file', new Blob([fakePng], { type: 'image/png' }), 'b.png');
    return form;
  };
  const r1 = await (
    await onRequest(makeContext(`${BASE}/upload`, { method: 'POST', env: baseEnv, headers: auth, body: makeForm() }))
  ).json();
  const r2 = await (
    await onRequest(makeContext(`${BASE}/upload`, { method: 'POST', env: baseEnv, headers: auth, body: makeForm() }))
  ).json();
  assert.equal(r1.url, r2.url, '内容相同的图片应命中同一哈希');
});

await test('图片可以读回且带正确 Content-Type', async () => {
  const form = new FormData();
  const fakePng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  form.append('file', new Blob([fakePng], { type: 'image/png' }), 'c.png');
  const up = await (
    await onRequest(makeContext(`${BASE}/upload`, { method: 'POST', env: baseEnv, headers: auth, body: form }))
  ).json();

  const mediaPath = up.url.replace('/api/studio/media/', '');
  const ctx = makeContext(`${BASE}/media/${mediaPath}`, { env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.ok(res.headers.get('cache-control').includes('immutable'));
});

await test('图片路径穿越被拒绝', async () => {
  for (const bad of ['..%2F..%2Fetc%2Fpasswd', 'a/../../b.png', 'x.txt.exe']) {
    const ctx = makeContext(`${BASE}/media/${bad}`, { env: baseEnv, headers: auth });
    const res = await onRequest(ctx);
    assert.ok(res.status === 400 || res.status === 404, `路径 ${bad} 应被拒绝`);
  }
});

console.log('\n[发布]');

await test('未配置部署钩子时返回 501 并说明原因', async () => {
  const envNoHook = { ...baseEnv, EDGEONE_DEPLOY_HOOK: undefined };
  const ctx = makeContext(`${BASE}/publish`, { method: 'POST', env: envNoHook, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 501);
  const body = await res.json();
  assert.ok(body.error.includes('部署钩子'), '应提示配置部署钩子');
});

await test('配置了钩子时触发成功', async () => {
  const originalFetch = globalThis.fetch;
  let called = null;
  globalThis.fetch = async (url, options) => {
    called = { url, method: options?.method };
    return new Response('ok', { status: 200 });
  };

  try {
    const ctx = makeContext(`${BASE}/publish`, { method: 'POST', env: baseEnv, headers: auth });
    const res = await onRequest(ctx);
    assert.equal(res.status, 200);
    assert.equal(called.url, 'https://example.com/hook');
    assert.equal(called.method, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await test('钩子上游报错时返回 502', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  try {
    const ctx = makeContext(`${BASE}/publish`, { method: 'POST', env: baseEnv, headers: auth });
    const res = await onRequest(ctx);
    assert.equal(res.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log('\n[登出与路由]');

await test('登出会清空 Cookie', async () => {
  const ctx = makeContext(`${BASE}/logout`, { method: 'POST', env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie.includes('Max-Age=0'), '应让 Cookie 立即失效');
});

await test('未知路由返回 404', async () => {
  const ctx = makeContext(`${BASE}/unknown-thing`, { env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.status, 404);
});

await test('响应带安全头', async () => {
  const ctx = makeContext(`${BASE}/posts`, { env: baseEnv, headers: auth });
  const res = await onRequest(ctx);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('strict-transport-security').includes('max-age='));
});

// =============================================================================
// 汇总
// =============================================================================

console.log(`\n=== 结果：${passed} 通过 / ${failed} 失败 ===\n`);
process.exit(failed > 0 ? 1 : 0);
