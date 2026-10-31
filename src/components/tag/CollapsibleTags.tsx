/**
 * 单次出现标签的折叠区 —— design-spec §5.5「单次出现标签默认折叠（沿用 CollapsibleTags）」
 *
 * 保留原有交互（0fr → 1fr 的 grid 行高动画，§7.2「折叠面板 300ms ease-in-out」），
 * 只是把视觉换成新规范：
 *   · 触发器 = §6.13「文字按钮」（无底无边 / --muted-foreground / hover 变青）；
 *   · 计数 = §6.14 中性芯片（高 22 / 12px 600），不再用 `bg-white/10` 的圆角胶囊；
 *   · 展开区 = 与标签墙同一套 `flex-wrap gap-2`，芯片一律中性色调 —— 单次出现的
 *     标签按定义就排在数量降序的尾部，落在「前 20」之外，不该再抢青色。
 *
 * 两个容易踩的点：
 *   1. 展开区必须 `overflow: hidden`，否则 0fr 时内容会溢出可见；但 `overflow: hidden`
 *      会裁掉芯片的 `:focus-visible` 焦点环（§9.2 明确不许裁焦点环）。所以展开区用
 *      `-m-1 p-1`：4px 内距刚好容下 `outline: 2px + offset: 2px`，负外边距再把 4px
 *      抵回去，芯片左缘与上方标签墙严格对齐。
 *   2. 折叠时给内容加 `inert`：`grid-template-rows: 0fr` 只是视觉收起了，里面的 <a>
 *      仍在 Tab 序列和无障碍树里，读屏会念出一串看不见的标签。
 *
 * 为什么把 @iconify/react 的箭头换成内联 SVG：
 *   client:only 组件里的 Icon 会在水合后再发一次图标请求，为 16px 的箭头多一跳网络不划算。
 */
import { useId, useState } from 'react';
import { useTranslation } from '@hooks/useTranslation';
import { TagItem } from './TagItem';

interface TagData {
  tag: string;
  count: number;
}

interface CollapsibleTagsProps {
  tags: TagData[];
  locale?: string;
}

export function CollapsibleTags({ tags, locale }: CollapsibleTagsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const { t } = useTranslation();

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-primary hover:underline [text-underline-offset:4px]"
      >
        <span>{isExpanded ? t('common.collapse') : t('tag.expandAll')}</span>
        {/* §6.14 中性芯片：高 22 / padding 0 8 / 圆角 6 / 12px 600 */}
        <span className="inline-flex h-[22px] items-center rounded-md border border-border bg-white/5 px-2 font-mono text-xs font-semibold tracking-[0.04em] text-muted-foreground">
          {tags.length}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
          className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        id={contentId}
        className="grid transition-[grid-template-rows] duration-300 [transition-timing-function:var(--ease-in-out)]"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        {/*
          内距必须按状态切换：`box-sizing: border-box` 不会把 padding 压到 0，
          折叠时元素的最小高度就是那 8px 内距，于是第一行芯片的顶部描边会在
          收起状态下露出一条虚线状的残影。展开时才给 `-m-1 p-1`（让出 4px 焦点环
          的空间、负外边距把芯片左缘抵回与上方标签墙对齐），折叠时彻底不留 padding。
        */}
        <div
          className={`flex min-h-0 flex-wrap gap-2 overflow-hidden ${isExpanded ? '-m-1 p-1' : ''}`}
          inert={!isExpanded}
        >
          {tags.map((props) => (
            <TagItem key={props.tag} tag={props.tag} count={props.count} tone="neutral" locale={locale} />
          ))}
        </div>
      </div>
    </div>
  );
}
