/**
 * Studio 后台 API 路由总入口 — Cloudflare Pages Functions
 *
 * 职责：按 request.method + 路径分发到具体接口处理函数。
 *
 * 路由（对齐 site-spec.md §5.1）：
 *   POST   /api/studio/login           登录
 *   POST   /api/studio/logout          登出
 *   GET    /api/studio/session         会话探测
 *   GET    /api/studio/posts           文章列表
 *   GET    /api/studio/posts/:slug     文章详情
 *   POST   /api/studio/posts?slug=...  保存文章（新建/更新共用）
 *   DELETE /api/studio/posts/:slug     删除文章
 *   POST   /api/studio/upload          图片上传
 *   GET    /api/studio/media/:filename 图片读取
 *   POST   /api/studio/publish         触发发布
 *
 * 环境变量（Cloudflare Pages → Settings → Environment variables）：
 *   - STUDIO_USERNAME          管理员账号（必填）
 *   - STUDIO_PASSWORD_HASH     PBKDF2 口令哈希（必填）
 *   - STUDIO_SESSION_SECRET    HMAC 会话密钥（必填）
 *   - CF_DEPLOY_HOOK           部署钩子 URL（可选）
 *
 * KV 绑定：
 *   - env.STUDIO_KV → Cloudflare KV Namespace（必填）
 */

import { getContentStore } from './store.js';
import {
  verifyPassword,
  signSession,
  verifySession,
  checkRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from './auth.js';
import { normalizePost, extractSummary } from './normalize.js';

// ============================================================================
// 安全响应头
// ============================================================================

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成 JSON 响应
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...headers,
    },
  });
}

/**
 * 生成错误响应
 */
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

/**
 * 检查环境变量是否已配置
 * 未配置 STUDIO_USERNAME 或 STUDIO_PASSWORD_HASH 时，所有接口返回 404
 */
function isConfigured(env) {
  if (!env) return false;
  return Boolean(env.STUDIO_USERNAME && env.STUDIO_PASSWORD_HASH);
}

/**
 * 提取客户端 IP
 */
function getClientIP(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    request.headers.get('X-Real-IP') ||
    'unknown'
  );
}

/**
 * 从 Cookie 中提取会话 token
 */
function getSessionToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/studio_session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * 校验会话并返回用户名，无效返回 null
 */
async function requireAuth(request, env) {
  const token = getSessionToken(request);
  if (!token) return null;

  return await verifySession(token, env.STUDIO_SESSION_SECRET);
}

// ============================================================================
// 主路由入口
// ============================================================================

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const method = request.method;
  // Cloudflare Pages Functions 的 [[path]] 捕获组传进来的是**数组**（如 ['posts','abc']），
  // 不是字符串。之前直接对其调用 .split() 会抛 TypeError，导致所有接口 500。
  // 这里同时兼容数组与字符串两种形态。
  const rawPath = params?.path;
  const pathString = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath ?? '');
  const pathSegments = pathString.split('/').filter(Boolean);

  // 未配置环境变量时，所有接口返回 404（放在路径解析之后、业务之前，
  // 保证即使路径异常也不会暴露「后台存在」的信息）
  if (!isConfigured(env)) {
    return errorResponse('Not Found', 404);
  }

  try {
    const store = getContentStore(env);

    // 解析路由
    const [resource, identifier] = pathSegments;

    // POST /api/studio/login
    if (method === 'POST' && resource === 'login' && !identifier) {
      return await handleLogin(request, env, store);
    }

    // POST /api/studio/logout
    if (method === 'POST' && resource === 'logout' && !identifier) {
      return await handleLogout(request, env, store);
    }

    // GET /api/studio/session
    if (method === 'GET' && resource === 'session' && !identifier) {
      return await handleSession(request, env);
    }

    // /api/studio/posts*
    if (resource === 'posts') {
      // GET /api/studio/posts
      if (method === 'GET' && !identifier) {
        return await handleListPosts(request, env, store);
      }

      // GET /api/studio/posts/:slug
      if (method === 'GET' && identifier) {
        return await handleGetPost(request, env, store, identifier);
      }

      // POST /api/studio/posts?slug=...
      if (method === 'POST' && !identifier) {
        return await handleSavePost(request, env, store, url);
      }

      // DELETE /api/studio/posts/:slug
      if (method === 'DELETE' && identifier) {
        return await handleDeletePost(request, env, store, identifier);
      }
    }

    // POST /api/studio/upload
    if (method === 'POST' && resource === 'upload' && !identifier) {
      return await handleUpload(request, env, store);
    }

    // GET /api/studio/media/:filename
    if (method === 'GET' && resource === 'media' && identifier) {
      return await handleMedia(request, store, identifier);
    }

    // POST /api/studio/publish
    if (method === 'POST' && resource === 'publish' && !identifier) {
      return await handlePublish(request, env);
    }

    // 未匹配的路由
    return errorResponse('Not Found', 404);
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse('服务器错误', 500);
  }
}

// ============================================================================
// 登录
// ============================================================================

async function handleLogin(request, env, store) {
  const ip = getClientIP(request);

  // 检查限流
  if (await checkRateLimit(ip, store)) {
    return errorResponse('登录尝试过于频繁，请稍后再试', 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('请求体格式错误', 400);
  }

  const { username, password } = body;

  if (!username || !password) {
    return errorResponse('请输入账号和密码', 400);
  }

  // 恒定时间比较：即使账号错误也执行一次哈希比较
  const passwordValid = await verifyPassword(password, env.STUDIO_PASSWORD_HASH);
  const usernameValid = username === env.STUDIO_USERNAME;

  if (!usernameValid || !passwordValid) {
    await recordLoginFailure(ip, store);
    return errorResponse('账号或密码错误', 401);
  }

  // 登录成功
  await clearLoginFailures(ip, store);
  const token = await signSession(username, env.STUDIO_SESSION_SECRET);

  return jsonResponse(
    { ok: true },
    200,
    {
      'Set-Cookie': `studio_session=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/`,
    }
  );
}

// ============================================================================
// 登出
// ============================================================================

async function handleLogout(request, env, store) {
  // 幂等：无需验证会话，直接返回成功
  return jsonResponse(
    { ok: true },
    200,
    {
      'Set-Cookie': 'studio_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
    }
  );
}

// ============================================================================
// 会话探测
// ============================================================================

async function handleSession(request, env) {
  const username = await requireAuth(request, env);

  if (!username) {
    return errorResponse('未登录', 401);
  }

  return jsonResponse({ username });
}

// ============================================================================
// 文章列表
// ============================================================================

async function handleListPosts(request, env, store) {
  const username = await requireAuth(request, env);

  if (!username) {
    return errorResponse('未登录', 401);
  }

  const index = await store.get('posts/index.json', { type: 'json' });
  const posts = Array.isArray(index) ? index : [];

  // 按 date 降序
  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return jsonResponse({ posts });
}

// ============================================================================
// 文章详情
// ============================================================================

async function handleGetPost(request, env, store, slug) {
  const username = await requireAuth(request, env);

  if (!username) {
    return errorResponse('未登录', 401);
  }

  const post = await store.get(`posts/${slug}.json`, { type: 'json' });

  if (!post) {
    return errorResponse('文章不存在', 404);
  }

  return jsonResponse({ post });
}

// ============================================================================
// 保存文章（新建/更新）
// ============================================================================

async function handleSavePost(request, env, store, url) {
  const username = await requireAuth(request, env);

  if (!username) {
    return errorResponse('未登录', 401);
  }

  // 获取 slug（优先 query，其次 body）
  const querySlug = url.searchParams.get('slug');
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('请求体格式错误', 400);
  }

  const slug = (querySlug || body.slug || '').trim();

  // 校验 slug 格式
  if (!slug || !/^[a-z0-9][a-z0-9-_]*$/i.test(slug)) {
    return errorResponse('URL 短名只能包含字母、数字、短横线和下划线', 400);
  }

  // 校验 title
  if (!body.title || !body.title.trim()) {
    return errorResponse('标题不能为空', 400);
  }

  try {
    // 检查是否已存在
    const existing = await store.get(`posts/${slug}.json`, { type: 'json' });
    const isNew = !existing;

    // 规范化文章数据
    const post = normalizePost({ ...body, slug }, { isNew });

    // 保存文章
    await store.setJSON(`posts/${slug}.json`, post);

    // 更新索引
    const index = (await store.get('posts/index.json', { type: 'json' })) || [];
    const summary = extractSummary(post);
    const existingIndex = index.findIndex((p) => p.slug === slug);

    if (existingIndex >= 0) {
      index[existingIndex] = summary;
    } else {
      index.push(summary);
    }

    // 按 date 降序排序
    index.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    await store.setJSON('posts/index.json', index);

    // 返回最新 post（避免前端依赖立即回读）
    return jsonResponse({ ok: true, post });
  } catch (error) {
    console.error('Save post error:', error);
    return errorResponse('保存失败', 500);
  }
}

// ============================================================================
// 删除文章
// ============================================================================

async function handleDeletePost(request, env, store, slug) {
  const username = await requireAuth(request, env);

  if (!username) {
    return errorResponse('未登录', 401);
  }

  // 检查文章是否存在
  const post = await store.get(`posts/${slug}.json`, { type: 'json' });

  if (!post) {
    return errorResponse('文章不存在', 404);
  }

  try {
    // 删除文章
    await store.delete(`posts/${slug}.json`);

    // 更新索引
    const index = (await store.get('posts/index.json', { type: 'json' })) || [];
    const newIndex = index.filter((p) => p.slug !== slug);
    await store.setJSON('posts/index.json', newIndex);

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Delete post error:', error);
    return errorResponse('删除失败', 500);
  }
}

// ============================================================================
// 图片上传
// ============================================================================

async function handleUpload(request, env, store) {
  const username = await requireAuth(request, env);

  if (!username) {
    return errorResponse('未登录', 401);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return errorResponse('缺少文件', 400);
    }

    const buffer = await file.arrayBuffer();

    // 计算内容哈希（SHA-256 前 16 hex）
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

    // 获取扩展名
    const filename = file.name || 'image';
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';

    // 存储文件名
    const storageKey = `images/${hashHex}.${ext}`;

    // 保存图片
    await store.setBinary(storageKey, buffer);

    // 返回 URL
    return jsonResponse({ url: `/api/studio/media/${hashHex}.${ext}` });
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('上传失败', 500);
  }
}

// ============================================================================
// 图片读取
// ============================================================================

async function handleMedia(request, store, filename) {
  // 公开读，无需鉴权

  // 校验文件名格式（防路径遍历）
  if (!/^[a-z0-9][a-z0-9-]*\.[a-z0-9]+$/i.test(filename)) {
    return errorResponse('Not Found', 404);
  }

  const storageKey = `images/${filename}`;
  const buffer = await store.getBinary(storageKey);

  if (!buffer) {
    return errorResponse('Not Found', 404);
  }

  // 根据扩展名确定 Content-Type
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...SECURITY_HEADERS,
    },
  });
}

// ============================================================================
// 触发发布
// ============================================================================

async function handlePublish(request, env) {
  const username = await requireAuth(request, env);

  if (!username) {
    return errorResponse('未登录', 401);
  }

  // 未配置部署钩子时返回提示（不报错）
  if (!env.CF_DEPLOY_HOOK) {
    return jsonResponse({ message: '尚未配置部署钩子' });
  }

  try {
    const response = await fetch(env.CF_DEPLOY_HOOK, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Deploy hook failed: ${response.status}`);
    }

    return jsonResponse({ message: '已触发构建' });
  } catch (error) {
    console.error('Publish error:', error);
    return errorResponse('发布失败', 500);
  }
}
