/**
 * 标签芯片 —— design-spec §6.14「标签芯片（标签墙用）」
 *
 * 规格：高 28 / padding 0 12 / 圆角 6 / 13px 500；计数 11px mono 青，左距 6。
 *
 * 为什么只剩「青」和「中性」两种色调：
 *   旧实现是 `index % 4` 轮转四套渐变（蓝/粉/紫/天蓝），12 个标签就是一道彩虹墙，
 *   与 §2.1「全站只有一个冷光源」正面冲突。规范只授权「主标签青描边 / 其余中性描边」，
 *   层次靠描边强弱与文字明度表达，不靠色相。因此「按下标取模配色」的参数整体删除。
 *
 * 为什么不发光（连 hover 都不发）：
 *   §6.14 原文「hover 只提 border-color 与文字明度，不发光（避免给 20 个标签 20 处光）」。
 *   一屏 20 个芯片若各带一圈 glow，§2.5 的「每屏 ≤3 处」当场破功。状态改由
 *   「描边变亮 + 文字变实」表达，符合 §9.1「发光不得作为唯一状态指示」。
 *
 * 为什么用 after 透明外扩：
 *   §9.3 要求可点区最小 44×44。芯片视觉高度按规范是 28，缺口 16 → 上下各外扩 8px，
 *   与 `gap: 8px` 的间距正好等宽，相邻芯片的可点区刚好相接而不重叠（不会出现
 *   「点 A 命中 B」）。横向一并外扩，短标签（如 C#、Go）也不至于低于 44 宽。
 */
import { buildTagPath } from '@lib/content/tags';
import { defaultLocale, localizedPath, t } from '@/i18n';

/** 芯片色调：primary = 青描边（标签墙前 20），neutral = 中性描边 */
export type TagTone = 'primary' | 'neutral';

interface TagItemProps {
  tag: string;
  count: number;
  /** 不传按 neutral 处理，避免调用方漏传时误把全部标签点成青色 */
  tone?: TagTone;
  locale?: string;
}

/**
 * 色调只在这里定义一次：两个页面 + 折叠区共用同一份，
 * 避免「标签墙的青」和「折叠区的青」慢慢漂成两个值。
 */
const TONE_CLASS: Record<TagTone, string> = {
  // §6.14 青：底 0.12 / 文字 primary / 描边 0.30，hover 描边提到 0.55
  primary:
    'border-[hsl(var(--primary)/0.30)] bg-[hsl(var(--primary)/0.12)] text-primary hover:border-[hsl(var(--primary)/0.55)]',
  // §6.14 中性：底 rgba(255,255,255,.05) / 文字 muted / 描边 --border，hover 文字提到纯色
  neutral:
    'border-[hsl(var(--border))] bg-white/5 text-muted-foreground hover:border-[hsl(var(--primary)/0.55)] hover:text-foreground',
};

export function TagItem({ tag, count, tone = 'neutral', locale }: TagItemProps) {
  return (
    <a
      href={localizedPath(buildTagPath(tag), locale)}
      aria-label={t(locale ?? defaultLocale, 'tag.viewTagPosts', { tag, count })}
      className={[
        'relative inline-flex h-7 items-center rounded-md border px-3 text-[13px] leading-none font-medium',
        'transition-colors duration-200',
        // 44×44 触控区（§9.3）：透明外扩 8px，视觉尺寸不变
        "after:absolute after:-inset-2 after:content-['']",
        TONE_CLASS[tone],
      ].join(' ')}
    >
      <span className="truncate">{tag}</span>
      <span className="ml-1.5 font-mono text-[11px] leading-none tabular-nums text-primary">{count}</span>
    </a>
  );
}
