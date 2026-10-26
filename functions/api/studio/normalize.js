/**
 * 文章字段规范化 — normalizePost()
 *
 * 严格按 site-spec.md §5.0 的 11 字段实现。
 *
 * 字段冻结（PostData）：
 *   1.  slug        string    URL 短名
 *   2.  title       string    标题
 *   3.  description string?   摘要
 *   4.  date        string    发布日期 YYYY-MM-DD
 *   5.  updated     string?   最后更新时间（服务端维护）
 *   6.  tags        string[]? 标签数组
 *   7.  categories  string[]? 分类数组
 *   8.  cover       string?   封面图 URL
 *   9.  draft       boolean?  草稿标记
 *   10. sticky      boolean?  置顶标记
 *   11. body        string?   Markdown 正文
 *   12. createdAt   string?   创建时间（服务端写入，新建时生成）
 */

/**
 * 规范化文章数据（服务端保存前调用）
 * @param {Object} input - 原始输入（前端提交或已有文章）
 * @param {Object} [options] - 选项
 * @param {boolean} [options.isNew] - 是否新建文章
 * @returns {Object} 规范化后的 PostData 对象
 */
export function normalizePost(input, options = {}) {
  const now = new Date().toISOString();

  // 提取允许的字段
  const {
    slug,
    title,
    description,
    date,
    updated,
    tags,
    categories,
    cover,
    draft,
    sticky,
    body,
    createdAt,
  } = input;

  // 构建规范化对象（11 字段 + createdAt）
  const post = {
    // slug：必填，已在路由层校验格式
    slug: typeof slug === 'string' ? slug.trim() : '',

    // title：必填
    title: typeof title === 'string' ? title.trim() : '',

    // description：可选字符串
    description: typeof description === 'string' ? description.trim() : '',

    // date：必填，格式 YYYY-MM-DD
    date: typeof date === 'string' ? date.trim() : now.slice(0, 10),

    // updated：服务端保存时维护（ISO 日期）
    updated: now,

    // tags：可选字符串数组
    tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()) : [],

    // categories：可选字符串数组
    categories: Array.isArray(categories) ? categories.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim()) : [],

    // cover：可选字符串（URL）
    cover: typeof cover === 'string' ? cover.trim() : '',

    // draft：可选布尔，默认 false
    draft: draft === true,

    // sticky：可选布尔，默认 false
    sticky: sticky === true,

    // body：可选字符串（Markdown）
    body: typeof body === 'string' ? body : '',
  };

  // createdAt：仅新建时服务端写入
  if (options.isNew) {
    post.createdAt = now;
  } else if (typeof createdAt === 'string' && createdAt.trim()) {
    // 更新时保留原有 createdAt（从输入中恢复）
    post.createdAt = createdAt.trim();
  }

  return post;
}

/**
 * 从完整 PostData 提取 PostSummary（用于列表）
 * @param {Object} post - 完整文章对象
 * @returns {Object} PostSummary 对象（8 字段）
 */
export function extractSummary(post) {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    updated: post.updated,
    draft: post.draft,
    sticky: post.sticky,
    categories: post.categories,
    tags: post.tags,
  };
}
