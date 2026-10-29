import type { CollectionEntry } from 'astro:content';

/**
 * 文章主题色 —— design-spec §6.23-B
 *
 * 只允许 5 个取值，且只允许出现在 3 个位置：卡片封面图内部、卡片 hover 左缘
 * 2px 实心条、文章详情页标题下方 48×2 短横线。
 *
 * **明确禁止**用作标题色、链接色、按钮底色、徽章底色、发光色 —— 否则整站会从
 * 「一个冷光源」变成「彩虹灯箱」。发光永远只有青/紫两种（§2.5）。
 *
 * indigo 用 #8b9dff 而不是文案侧原建议的 #3b5bdb：后者对页面底只有 3.41:1，
 * 不满足 §9.1 的 4.5:1；换色后 6.9:1，安全。
 */
export type ArticleAccent = 'cyan' | 'neutral' | 'magenta' | 'amber' | 'indigo';

/**
 * Blog post schema - matches the schema defined in content/config.ts
 * This is the OUTPUT type after Zod transforms are applied.
 */
export interface BlogSchema {
  title: string;
  description?: string;
  link?: string;
  date: Date;
  updated?: Date;
  cover?: string;
  tags?: string[];
  subtitle?: string;
  catalog?: boolean;
  categories?: string[] | string[][];
  sticky?: boolean;
  draft?: boolean;
  tocNumbering?: boolean;
  /** 文章主题色（§6.23-B），见 ArticleAccent 的使用约束 */
  accent?: ArticleAccent;
  /** Exclude this post from AI summary generation */
  excludeFromSummary?: boolean;
  /** Enable KaTeX math rendering for this post */
  math?: boolean;
  /** Enable quiz interaction for this post */
  quiz?: boolean;
  /** Password for encrypting the entire post content */
  password?: string;
  /** Keywords for SEO */
  keywords?: string[];
}

/**
 * Blog post schema INPUT type - before Zod transforms.
 * gray-matter parses YAML dates as Date objects, so date fields accept both.
 */
export interface BlogSchemaInput extends Omit<BlogSchema, 'date' | 'updated'> {
  date: string | Date;
  updated?: string | Date;
}

/**
 * Blog post type from Astro content collections
 */
export type BlogPost = CollectionEntry<'blog'>;

/**
 * 最小文章引用 - 用于导航（3 字段）
 */
export interface PostRef {
  slug: string;
  link?: string;
  title: string;
}

/**
 * 带分类的文章引用 - 用于列表展示（4 字段）
 */
export interface PostRefWithCategory extends PostRef {
  categoryName?: string;
}

/**
 * 文章卡片数据 - 用于卡片展示
 */
export interface PostCardData {
  slug: string;
  link?: string;
  title: string;
  description?: string;
  date: Date;
  cover?: string;
  tags?: string[];
  categories?: string[] | string[][];
  draft?: boolean;
  /** 文章主题色（§6.23-B），由 frontmatter accent 透传，用于卡片 data-accent */
  accent?: ArticleAccent;
  wordCount: number; // 预计算的字数
  readingTime: string; // 预计算的阅读时间
  postLocale?: string; // 文章的原始语言代码（用于 fallback 标记）
}
