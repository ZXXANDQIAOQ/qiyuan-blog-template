/**
 * Cloudflare KV 存储层 — getContentStore()
 *
 * 职责：为 Studio 后台提供统一的数据存取接口，替换 EdgeOne 的 @edgeone/pages-blob。
 *
 * 绑定方式：Cloudflare Pages Functions 通过 env.STUDIO_KV 访问 KV Namespace。
 *
 * Key 结构（对齐 site-spec.md §6）：
 *   - posts/index.json          文章列表摘要数组（PostSummary[]）
 *   - posts/<slug>.json         单篇文章完整数据（PostData，11 字段）
 *   - images/<hash>.<ext>       图片二进制内容
 *   - studio:login:<ip>         登录失败计数（TTL 900s）
 *
 * KV 最终一致性说明：
 *   Cloudflare KV 为最终一致，写后读可能滞后。保存文章后响应中回传最新 post，
 *   前端不依赖立即回读，避免一致性问题。
 */

/**
 * 获取内容存储对象
 * @param {Object} env - Cloudflare Pages Functions 的环境变量对象
 * @returns {Object} 存储接口，方法签名与 @edgeone/pages-blob 的 getStore() 对齐
 */
export function getContentStore(env) {
  const kv = env.STUDIO_KV;

  if (!kv) {
    throw new Error('STUDIO_KV 绑定未配置，请在 Cloudflare Pages → Settings → Functions → KV namespace bindings 中绑定');
  }

  return {
    /**
     * 读取键值
     * @param {string} key - 键名（如 posts/index.json）
     * @param {Object} [options] - 选项
     * @param {string} [options.type] - 返回类型：'json' 返回解析后的 JSON，否则返回文本
     * @returns {Promise<any>} 解析后的数据或文本
     */
    async get(key, options = {}) {
      const value = await kv.get(key, { type: options.type === 'json' ? 'json' : 'text' });

      if (options.type === 'json') {
        return value || null;
      }
      return value || '';
    },

    /**
     * 读取二进制内容（用于图片）
     * @param {string} key - 键名（如 images/<hash>.<ext>）
     * @returns {Promise<ArrayBuffer|null>} 二进制数据，不存在返回 null
     */
    async getBinary(key) {
      return await kv.get(key, { type: 'arrayBuffer' });
    },

    /**
     * 写入 JSON 对象
     * @param {string} key - 键名
     * @param {any} value - JSON 可序列化对象
     */
    async setJSON(key, value) {
      await kv.put(key, JSON.stringify(value));
    },

    /**
     * 写入二进制内容（用于图片）
     * @param {string} key - 键名
     * @param {Uint8Array|ArrayBuffer} value - 二进制数据
     */
    async setBinary(key, value) {
      await kv.put(key, value);
    },

    /**
     * 写入带 TTL 的值（用于登录失败计数）
     * @param {string} key - 键名
     * @param {string|number} value - 值
     * @param {number} expirationTtl - 过期时间（秒）
     */
    async setWithTTL(key, value, expirationTtl) {
      await kv.put(key, String(value), { expirationTtl });
    },

    /**
     * 删除键
     * @param {string} key - 键名
     */
    async delete(key) {
      await kv.delete(key);
    },

    /**
     * 列出匹配前缀的键
     * @param {Object} [options] - 选项
     * @param {string} [options.prefix] - 键前缀过滤
     * @returns {Promise<Array<{name: string}>>} 键列表
     */
    async list(options = {}) {
      const listResult = await kv.list({ prefix: options.prefix || '' });
      return listResult.keys || [];
    },

    /**
     * 获取 TTL（用于检查登录失败计数剩余时间）
     * @param {string} key - 键名
     * @returns {Promise<number|null>} 剩余秒数，无 TTL 返回 null
     */
    async getTTL(key) {
      const value = await kv.getWithMetadata(key);
      if (!value || !value.expiration) return null;
      return Math.max(0, Math.floor(value.expiration / 1000) - Math.floor(Date.now() / 1000));
    },
  };
}
