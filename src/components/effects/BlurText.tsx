import type { CSSProperties } from 'react';

/**
 * BlurText —— 逐词（中文逐字）模糊浮现动画（ljj.world hero-statement 同款）
 *
 * 规格来源：docs/redesign/ljj-clone-spec.md §2 / §6
 *  - 每个字符 blur(8px) + opacity:0 → 清晰，字符间隔 40~60ms，总时长约 1s
 *  - SSR 直出完整文本：动画完全由 CSS animation 驱动（animation-fill-mode: both
 *    提供初始隐藏态），不依赖 JS，脚本被禁用时文本照常可读
 *  - prefers-reduced-motion: reduce 时动画被关闭，直接显示最终态（见 Cover.astro 全局样式）
 *
 * 注意：.blur-text-* 的样式定义在 Cover.astro 的 is:global 样式块里
 * （React 渲染的子节点拿不到 Astro scoped 属性）。
 */
export interface BlurTextProps {
  /** 完整文本（SSR 直出 & aria-label） */
  text: string;
  /** 附加类名，例如 hero-line */
  className?: string;
  /** 首字符动画延迟（ms），第二行可传 260 之类错开 */
  delay?: number;
  /** 相邻字符间隔（ms） */
  step?: number;
}

export default function BlurText({
  text,
  className = '',
  delay = 0,
  step = 50,
}: BlurTextProps) {
  const chars = Array.from(text);

  return (
    <span className={`blur-text is-wrapping ${className}`.trim()} aria-label={text}>
      {chars.map((char, i) => {
        // 空格不参与动画，保持可换行的普通空白
        if (/\s/.test(char)) {
          return <span key={i} aria-hidden="true"> </span>;
        }
        const style: CSSProperties = { animationDelay: `${delay + i * step}ms` };
        return (
          <span key={i} className="blur-text-word" aria-hidden="true">
            <span className="blur-text-char" style={style}>
              {char}
            </span>
          </span>
        );
      })}
    </span>
  );
}
