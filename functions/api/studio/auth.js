/**
 * 鉴权模块 — PBKDF2 口令校验 / HMAC 会话 / 登录限流
 *
 * 从 edge-functions/api/studio.js 移植的平台无关业务逻辑。
 *
 * PBKDF2 参数（与 studio-hash-password.mjs 保持一致）：
 *   - 算法：PBKDF2-SHA256
 *   - 迭代：100,000 次
 *   - Salt：16 字节
 *   - Key：32 字节
 *
 * 会话：HMAC-SHA256 签名的 Cookie，7 天有效
 */

// ============================================================================
// PBKDF2 口令校验
// ============================================================================

/**
 * PBKDF2 参数（必须与 studio-hash-password.mjs 完全一致）
 */
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BYTES = 32;

/**
 * 恒定时间字符串比较（防时序攻击）
 * @param {string} a - 字符串 A
 * @param {string} b - 字符串 B
 * @returns {boolean} 是否相等
 */
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    // 仍然执行一次比较以消耗时间，防时序攻击
    const dummy = new Uint8Array(a.length);
    crypto.subtle.timingSafeEqual(dummy, dummy);
    return false;
  }

  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

/**
 * 验证口令（PBKDF2-SHA256）
 * @param {string} password - 明文口令
 * @param {string} storedHash - 存储的哈希，格式 pbkdf2$<iterations>$<salt_b64>$<hash_b64>
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false;
    }

    const iterations = parseInt(parts[1], 10);
    const salt = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));
    const expectedHash = Uint8Array.from(atob(parts[3]), (c) => c.charCodeAt(0));

    // 使用 Web Crypto API 派生密钥
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      PBKDF2_KEY_BYTES * 8 // 位数
    );

    const derivedHash = new Uint8Array(derivedBits);

    // 恒定时间比较
    return timingSafeEqual(
      Array.from(derivedHash).map((b) => b.toString(16).padStart(2, '0')).join(''),
      Array.from(expectedHash).map((b) => b.toString(16).padStart(2, '0')).join('')
    );
  } catch (error) {
    console.error('verifyPassword error:', error);
    return false;
  }
}

// ============================================================================
// HMAC 会话管理
// ============================================================================

/**
 * HMAC-SHA256 签名会话 Token
 * @param {string} username - 用户名
 * @param {string} secret - HMAC 密钥
 * @returns {Promise<string>} base64 编码的 token
 */
export async function signSession(username, secret) {
  const encoder = new TextEncoder();
  const payload = `${username}:${Date.now()}`;
  const encodedPayload = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encodedPayload);

  // token = base64(payload).base64(signature)
  const payloadB64 = btoa(String.fromCharCode(...encodedPayload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${payloadB64}.${sigB64}`;
}

/**
 * 验证会话 Token
 * @param {string} token - 会话 token
 * @param {string} secret - HMAC 密钥
 * @returns {Promise<string|null>} 验证成功返回用户名，失败返回 null
 */
export async function verifySession(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, sigB64] = parts;

    // 解码 payload
    const payloadStr = atob(payloadB64);
    const [username, timestampStr] = payloadStr.split(':');
    const timestamp = parseInt(timestampStr, 10);

    if (!username || !timestamp) return null;

    // 检查过期（7 天 = 604800000 毫秒）
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > maxAge) {
      return null;
    }

    // 重新计算签名
    const encoder = new TextEncoder();
    const expectedPayload = encoder.encode(payloadStr);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSig = await crypto.subtle.sign('HMAC', key, expectedPayload);
    const expectedSigB64 = btoa(String.fromCharCode(...new Uint8Array(expectedSig)));

    // 恒定时间比较签名
    if (!timingSafeEqual(sigB64, expectedSigB64)) {
      return null;
    }

    return username;
  } catch (error) {
    console.error('verifySession error:', error);
    return null;
  }
}

// ============================================================================
// 登录限流
// ============================================================================

const RATE_LIMIT_KEY_PREFIX = 'studio:login:';
const RATE_LIMIT_MAX_FAILURES = 8;
const RATE_LIMIT_TTL = 900; // 15 分钟

/**
 * 检查登录限流
 * @param {string} ip - 客户端 IP
 * @param {Object} store - 存储对象（store.js 返回）
 * @returns {Promise<boolean>} 是否被限流（true = 已达到阈值，应拒绝）
 */
export async function checkRateLimit(ip, store) {
  const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;
  const count = await store.get(key, { type: 'json' });

  if (count && typeof count === 'object' && count.count >= RATE_LIMIT_MAX_FAILURES) {
    return true;
  }

  return false;
}

/**
 * 记录登录失败
 * @param {string} ip - 客户端 IP
 * @param {Object} store - 存储对象
 */
export async function recordLoginFailure(ip, store) {
  const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;
  const existing = await store.get(key, { type: 'json' });

  const count = existing && typeof existing === 'object' ? (existing.count || 0) : 0;
  const nextCount = count + 1;

  await store.setWithTTL(
    key,
    JSON.stringify({ count: nextCount, ts: Date.now() }),
    RATE_LIMIT_TTL
  );
}

/**
 * 清除登录失败计数（登录成功后调用）
 * @param {string} ip - 客户端 IP
 * @param {Object} store - 存储对象
 */
export async function clearLoginFailures(ip, store) {
  const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;
  await store.delete(key);
}
