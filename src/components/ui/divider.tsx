import { cn } from '@lib/utils';
import type { ReactNode } from 'react';

/**
 * 带标题的分割线 —— design-spec §6.15
 *
 * 结构：6×6 青色菱形（旋转 45°）→ 26px 标题 → 1px 青→透明渐变横线延伸到容器右边界。
 *
 * 相比旧的 Shoka 分割线（两侧等长横线 + 居中文字）：
 *   · 标题改为**左对齐**，成为区块的视觉锚点，与 Hero 标题、卡片标题共享同一条阅读轴线；
 *   · 右侧只剩一条线，不再对称居中 —— 那样会把视线锁死在中间。
 *
 * 发光：**零发光**。
 * §6.15 的示例 CSS 给菱形加了 `0 0 10px / 0.55`，但 §2.5 的发光白名单
 * （当前导航项 / hover 中的卡片与按钮 / Hero 主标题 / 激活的目录项 /
 * 空状态图标 / 年份时间线节点）里没有「分割线菱形」，而且 0.55 也超出了
 * 0.14–0.28 的参数区间。首页首屏已经有 Hero 标题 + 导航激活两项常驻发光，
 * 再加每个区块标题一颗发光的菱形，一屏直接超到 4–5 处。
 * 6×6 的实心青菱形本身对深底就是 12.91:1，不靠发光也足够当锚点。
 *
 * 首页 / 列表页 / 分类页 / 标签页共用，改这一处全站生效。
 */
export default function Divider({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <span
        aria-hidden="true"
        style={{
          flex: 'none',
          width: 6,
          height: 6,
          background: 'hsl(var(--primary))',
          transform: 'rotate(45deg)',
        }}
      />
      {children ? (
        <h2
          style={{
            // 桌面 26px，随视口线性收敛到 20px（§8.1 用 clamp 而非多断点）
            fontSize: 'clamp(20px, 2.2vw + 12px, 26px)',
            fontWeight: 700,
            lineHeight: 1.35,
            letterSpacing: '-0.02em',
            color: 'hsl(var(--foreground))',
            fontFamily: 'var(--font-display)',
            whiteSpace: 'nowrap',
          }}
        >
          {children}
        </h2>
      ) : null}
      <span
        aria-hidden="true"
        style={{
          flex: 1,
          minWidth: 0,
          height: 1,
          background: 'linear-gradient(90deg, hsl(var(--primary) / 0.35), transparent)',
        }}
      />
    </div>
  );
}
