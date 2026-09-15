/**
 * EdgeOne Pages Edge Function —— Studio API（无头 CMS 后端）
 *
 * 路径前缀：/api/studio/*
 * 运行环境：EdgeOne Edge Functions（V8，**不是 Node.js**）
 *   - 不可用 Node 内置模块（fs / path / crypto 的 Node 版）、不可用 npm 包
 *   - **没有 Response.json()**，一律手写 new Response(JSON.stringify(...))
 *   - CPU 时间 200ms/次、代码包 5MB、请求体 1MB
 *   - KV 只能用 Edge Functions；Blob 通过 @edgeone/pages-blob 的 getStore()
 *
 * 需要的控制台环境变量：
 *   STUDIO_USERNAME        管理员账号
 *   STUDIO_PASSWORD_HASH   口令哈希，格式 pbkdf2$<iterations>$<saltB64>$<hashB64>
 *                          （用 scripts/studio-hash-password.mjs 生成）
 *   STUDIO_SESSION_SECRET  会话签名密钥，随便一串长随机字符
 *   EDGEONE_DEPLOY_HOOK    部署钩子 URL，点「发布」时 POST 它触发重新构建（可选）
 *
 * 需要的控制台绑定：
 *   Blob store：studio-content      —— 存文章 JSON 与上传的图片
 *   KV 命名空间（可选，做登录限流）：STUDIO_KV
 *
 * 未配置 STUDIO_USERNAME / STUDIO_PASSWORD_HASH 时，所有接口一律 404，
 * 后台等同不存在——避免误暴露一个没人管的登录入口。
 */

import { getStore } from '@edgeone/pages-blob';

// =============================================================================
// 常量
// =============================================================================

const STORE_NAME = 'studio-content';
const COOKIE_NAME = 'studio_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天
const MAX_LOGIN_ATTEMPTS = 8; // 每个 IP 每 15 分钟
const LOGIN_WINDOW_SECONDS = 60 * 15;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_BODY_BYTES = 1024 * 1024; // Edge Functions 请求体上限 1MB
const POSTS_PREFIX = 'posts/';
const INDEX_KEY = 'posts/index.json';
const IMAGES_PREFIX = 'images/';

// =============================================================================
// 基础工具
// =============================================================================

/** 手写 JSON 响应 —— V8 运行时没有 Response.json() */
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

/** 统一的安全响应头，与项目既有 API 保持一致的风格 */
function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    ...extra,
  };
}

function jsonSafe(data, status = 200, extraHeaders = {}) {
  return json(data, status, securityHeaders(extraHeaders));
}

// =============================================================================
// 编码 / 哈希
// =============================================================================

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 长度恒定的字节比较，避免时序侧信道 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function pbkdf2(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  return new Uint8Array(bits);
}

/**
 * 校验口令。格式：pbkdf2$<iterations>$<saltB64>$<hashB64>
 * 同时兼容该格式的 sha256 变体（sha256$<saltB64>$<hashB64>）以便降级使用。
 */
async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  const scheme = parts[0];

  if (scheme === 'pbkdf2' && parts.length === 4) {
    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const actual = await pbkdf2(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  }

  if (scheme === 'sha256' && parts.length === 3) {
    const salt = base64ToBytes(parts[1]);
    const expected = base64ToBytes(parts[2]);
    const digest = await crypto.subtle.digest('SHA-256', concatBytes(salt, new TextEncoder().encode(password)));
    return timingSafeEqual(new Uint8Array(digest), expected);
  }

  return false;
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// =============================================================================
// 会话（HMAC 签名的无状态 token）
// =============================================================================

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

async function signSession(payload, secret) {
  const body = bytesToBase64(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${bytesToBase64(new Uint8Array(sig))}`;
}

async function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, base64ToBytes(sig), new TextEncoder().encode(body));
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64ToBytes(body)));
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function sessionCookie(token, maxAge) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

// =============================================================================
// KV / Blob 访问（都做了缺失时的优雅降级）
// =============================================================================

/**
 * 取得 Blob store。命中不到绑定时返回 null，
 * 调用方统一回 503 并给出明确原因，而不是抛异常。
 */
function getContentStore(env) {
  try {
    return getStore(STORE_NAME);
  } catch {
    // 少数情况下 getStore 需要显式 projectId / token（本地或不带绑定的环境）
    try {
      if (env?.STUDIO_BLOB_PROJECT_ID && env?.STUDIO_BLOB_TOKEN) {
        return getStore({
          name: STORE_NAME,
          projectId: env.STUDIO_BLOB_PROJECT_ID,
          token: env.STUDIO_BLOB_TOKEN,
        });
      }
    } catch {
      return null;
    }
    return null;
  }
}

function getKv(env) {
  // KV 命名空间在控制台绑定后是**全局变量**，不是 context.env.KV。
  // 该变量由 EdgeOne 运行时注入，代码里无声明，故用 try/catch 兼容其不存在的情况。
  try {
    if (typeof STUDIO_KV !== 'undefined' && STUDIO_KV) return STUDIO_KV;
  } catch {
    // ignore
  }
  return env?.STUDIO_KV || null;
}

async function readJson(store, key, options = {}) {
  const raw = await store.get(key, { type: 'json', ...options });
  if (raw === null || raw === undefined) return null;
  // 部分实现下 type:'json' 可能仍返回字符串，这里兜一层
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

// =============================================================================
// 登录限流
// =============================================================================

async function checkRateLimit(env, ip) {
  const kv = getKv(env);
  if (!kv || !ip) return { limited: false };

  const key = `studio:login:${ip}`;
  try {
    const raw = await kv.get(key);
    const count = raw ? Number(raw) : 0;
    if (count >= MAX_LOGIN_ATTEMPTS) {
      return { limited: true, retryAfter: LOGIN_WINDOW_SECONDS };
    }
  } catch {
    return { limited: false };
  }
  return { limited: false };
}

async function recordLoginFailure(env, ip) {
  const kv = getKv(env);
  if (!kv || !ip) return;
  const key = `studio:login:${ip}`;
  try {
    const raw = await kv.get(key);
    const count = raw ? Number(raw) : 0;
    await kv.put(key, String(count + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });
  } catch {
    // 限流失败不应阻断登录流程
  }
}

async function clearLoginFailures(env, ip) {
  const kv = getKv(env);
  if (!kv || !ip) return;
  try {
    await kv.delete(`studio:login:${ip}`);
  } catch {
    // ignore
  }
}

function clientIp(request) {
  const eo = request.headers.get('eo-connecting-ip');
  if (eo) return eo;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return null;
}

// =============================================================================
// 文章 / 路径校验
// =============================================================================

function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9-_]{0,127}$/i.test(slug);
}

function isConfigured(env) {
  return Boolean(env?.STUDIO_USERNAME && env?.STUDIO_PASSWORD_HASH);
}

/** 只保留允许写入的字段，防止前端塞入任意键 */
function normalizePost(input, slug) {
  const now = new Date().toISOString();
  return {
    slug,
    title: String(input.title ?? '').slice(0, 300),
    description: input.description ? String(input.description).slice(0, 1000) : '',
    date: input.date ? String(input.date) : now.slice(0, 10),
    updated: now,
    tags: Array.isArray(input.tags) ? input.tags.map((t) => String(t).slice(0, 80)).slice(0, 30) : [],
    categories: Array.isArray(input.categories) ? input.categories.map((c) => String(c).slice(0, 80)).slice(0, 10) : [],
    cover: input.cover ? String(input.cover).slice(0, 2000) : '',
    draft: input.draft === true,
    sticky: input.sticky === true,
    body: String(input.body ?? ''),
    createdAt: input.createdAt ? String(input.createdAt) : now,
  };
}

// =============================================================================
// 各接口实现
// =============================================================================

async function handleLogin(env, request) {
  const ip = clientIp(request);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('请求格式错误', 400);
  }

  const username = String(body.username ?? '');
  const password = String(body.password ?? '');

  if (!username || !password) return fail('请输入账号与密码', 400);

  const rate = await checkRateLimit(env, ip);
  if (rate.limited) {
    return fail('尝试次数过多，请稍后再试', 429);
  }

  const userOk = username === env.STUDIO_USERNAME;
  const passOk = await verifyPassword(password, env.STUDIO_PASSWORD_HASH);

  // 两个条件都算完再判断，避免通过响应耗时区分「账号错」与「密码错」
  if (!userOk || !passOk) {
    await recordLoginFailure(env, ip);
    return jsonSafe({ ok: false, error: '账号或密码错误' }, 401);
  }

  await clearLoginFailures(env, ip);

  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ sub: username, iat: now, exp: now + SESSION_TTL_SECONDS }, env.STUDIO_SESSION_SECRET);

  return jsonSafe({ ok: true, username }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SECONDS) });
}

async function handleLogout() {
  return jsonSafe({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

async function handleSession(env, request) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const session = await verifySession(cookies[COOKIE_NAME], env.STUDIO_SESSION_SECRET);
  if (!session) return jsonSafe({ ok: false }, 401);
  return jsonSafe({ ok: true, username: session.sub });
}

async function handleListPosts(store) {
  const index = await readJson(store, INDEX_KEY, { consistency: 'strong' });
  const posts = Array.isArray(index) ? index : [];

  // Blob 不可用索引时退化为直接列目录
  if (!index) {
    const listed = await store.list({ prefix: POSTS_PREFIX });
    const items = [];
    for (const entry of listed.blobs || listed.keys || []) {
      const key = entry.key ?? entry.name;
      if (!key || key === INDEX_KEY) continue;
      const post = await readJson(store, key, { consistency: 'strong' });
      if (post) items.push(summarize(post));
    }
    items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return jsonSafe({ ok: true, posts: items });
  }

  return jsonSafe({ ok: true, posts });
}

function summarize(post) {
  const { body, ...meta } = post;
  return { ...meta, words: typeof body === 'string' ? body.length : 0 };
}

async function handleGetPost(store, slug) {
  const post = await readJson(store, `${POSTS_PREFIX}${slug}.json`, { consistency: 'strong' });
  if (!post) return fail('文章不存在', 404);
  return jsonSafe({ ok: true, post });
}

async function handleSavePost(store, slug, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('请求格式错误', 400);
  }

  const existing = await readJson(store, `${POSTS_PREFIX}${slug}.json`, { consistency: 'strong' });
  const post = normalizePost({ ...body, createdAt: existing?.createdAt }, slug);

  if (!post.title.trim()) return fail('标题不能为空', 400);

  await store.setJSON(`${POSTS_PREFIX}${slug}.json`, post);
  await updateIndex(store, post);

  return jsonSafe({ ok: true, post });
}

async function updateIndex(store, post) {
  const index = (await readJson(store, INDEX_KEY, { consistency: 'strong' })) || [];
  const summary = summarize(post);
  const next = Array.isArray(index) ? index.filter((p) => p.slug !== post.slug) : [];
  next.push(summary);
  next.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  await store.setJSON(INDEX_KEY, next);
}

async function handleDeletePost(store, slug) {
  const key = `${POSTS_PREFIX}${slug}.json`;
  const existing = await readJson(store, key, { consistency: 'strong' });
  if (!existing) return fail('文章不存在', 404);

  await store.delete(key);

  const index = (await readJson(store, INDEX_KEY, { consistency: 'strong' })) || [];
  if (Array.isArray(index)) {
    await store.setJSON(
      INDEX_KEY,
      index.filter((p) => p.slug !== slug),
    );
  }

  return jsonSafe({ ok: true });
}

async function handleUploadImage(store, request) {
  const form = await request.formData();
  const file = form.get('file');

  if (!file || typeof file === 'string') return fail('没有收到文件', 400);
  if (file.size > MAX_IMAGE_BYTES) return fail('图片不能超过 5MB', 413);

  const type = file.type || '';
  if (!type.startsWith('image/')) return fail('只允许上传图片', 415);

  const ext = (type.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = bytesToHex(new Uint8Array(digest)).slice(0, 16);
  const key = `${IMAGES_PREFIX}${hash}.${ext}`;

  await store.set(key, buffer, { contentType: type });

  return jsonSafe({ ok: true, key, url: `/api/studio/media/${key.slice(IMAGES_PREFIX.length)}` });
}

async function handleGetImage(store, filename) {
  if (!/^[a-z0-9]+\.[a-z0-9]{1,8}$/i.test(filename)) return fail('路径非法', 400);

  const key = `${IMAGES_PREFIX}${filename}`;
  const result = await store.getWithHeaders(key, { type: 'blob' });

  if (!result?.data) return fail('图片不存在', 404);

  return new Response(result.data, {
    headers: securityHeaders({
      'Content-Type': result.headers?.get?.('content-type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }),
  });
}

async function handlePublish(env) {
  if (!env.EDGEONE_DEPLOY_HOOK) {
    return fail('尚未配置部署钩子，请先在 EdgeOne 控制台创建并填入 EDGEONE_DEPLOY_HOOK', 501);
  }

  try {
    const res = await fetch(env.EDGEONE_DEPLOY_HOOK, { method: 'POST' });
    if (!res.ok) {
      return fail(`触发构建失败（上游返回 ${res.status}）`, 502);
    }
    return jsonSafe({ ok: true, message: '已触发构建，几分钟后网站即为最新内容' });
  } catch (error) {
    return fail(`触发构建失败：${error?.message || '网络错误'}`, 502);
  }
}

// =============================================================================
// 路由
// =============================================================================

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/studio\/?/, '').replace(/\/$/, '');
  const method = request.method.toUpperCase();

  // 未配置时彻底隐身，连 404 都不泄露这是个后台
  if (!isConfigured(env)) {
    return fail('Not Found', 404);
  }

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: securityHeaders({
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
      }),
    });
  }

  // ---- 无需登录的接口 ----
  if (route === 'login' && method === 'POST') {
    return handleLogin(env, request);
  }
  if (route === 'logout' && method === 'POST') {
    return handleLogout();
  }
  if (route === 'session' && method === 'GET') {
    return handleSession(env, request);
  }

  // ---- 以下全部需要有效会话 ----
  const cookies = parseCookies(request.headers.get('cookie'));
  const session = await verifySession(cookies[COOKIE_NAME], env.STUDIO_SESSION_SECRET);
  if (!session) {
    return jsonSafe({ ok: false, error: '未登录或登录已过期' }, 401);
  }

  const store = getContentStore(env);
  if (!store) {
    return fail('内容存储未绑定：请在 EdgeOne 控制台创建 Blob store「studio-content」并绑定到本项目', 503);
  }

  // 公共图片读取
  if (route.startsWith('media/') && method === 'GET') {
    return handleGetImage(store, route.slice('media/'.length));
  }

  if (route === 'posts' && method === 'GET') {
    return handleListPosts(store);
  }

  if (route === 'posts' && method === 'POST') {
    const slug = url.searchParams.get('slug');
    if (!isValidSlug(slug)) return fail('slug 非法：只允许字母、数字、短横线与下划线', 400);
    return handleSavePost(store, slug, request);
  }

  const postMatch = route.match(/^posts\/([^/]+)$/);
  if (postMatch) {
    const slug = decodeURIComponent(postMatch[1]);
    if (!isValidSlug(slug)) return fail('slug 非法', 400);
    if (method === 'GET') return handleGetPost(store, slug);
    if (method === 'PUT') return handleSavePost(store, slug, request);
    if (method === 'DELETE') return handleDeletePost(store, slug);
  }

  if (route === 'upload' && method === 'POST') {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_BODY_BYTES * 6) return fail('图片过大', 413);
    return handleUploadImage(store, request);
  }

  if (route === 'publish' && method === 'POST') {
    return handlePublish(env);
  }

  return fail('Not Found', 404);
}
