import { useEffect, useRef, useState } from 'react';

/**
 * DecryptedText —— identity 行「乱码解密」入场动画（ljj.world 同款）
 *
 * 规格来源：docs/redesign/ljj-clone-spec.md §2 / §6
 *  - SSR 直出最终文本：初始渲染即完整文案（无 JS / 爬虫 / reduced-motion 均可读），
 *    hydration 后才用 rAF 跑一遍「随机字符翻牌 → 从左到右逐字落定」的动画（约 1.2s）
 *  - prefers-reduced-motion: reduce 时不跑动画，保持最终态
 *
 * 样式（.decrypted-text）定义在 Cover.astro 的 is:global 样式块里。
 */
export interface DecryptedTextProps {
  /** 最终文本（SSR 直出 & aria-label） */
  text: string;
  /** 动画总时长（ms） */
  duration?: number;
  /** 解密用的乱码字符集 */
  glyphs?: string;
}

const DEFAULT_GLYPHS = 'luminoussss.xyz/#<>/\\|-_=+*?!~^';

export default function DecryptedText({
  text,
  duration = 1200,
  glyphs = DEFAULT_GLYPHS,
}: DecryptedTextProps) {
  const finalChars = useRef(Array.from(text));
  const [display, setDisplay] = useState(() => text);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const chars = finalChars.current;
    const start = performance.now();
    // 字符越靠前落定得越早；末尾 25% 留出「整行同时翻牌」的拖尾感
    const settleAt = (i: number) =>
      (i / Math.max(chars.length - 1, 1)) * duration * 0.75 + (duration * 0.25 * i) / chars.length;

    const tick = (now: number) => {
      const elapsed = now - start;
      let out = '';
      let done = true;
      for (let i = 0; i < chars.length; i++) {
        const settleTime = settleAt(i);
        if (elapsed >= settleTime) {
          out += chars[i];
        } else {
          done = false;
          // 只在「快落定前的窗口」里翻牌，避免整行从头闪到尾
          if (elapsed > settleTime - 260) {
            out += glyphs[Math.floor(Math.random() * glyphs.length)];
          } else {
            out += chars[i];
          }
        }
      }
      setDisplay(out);
      if (!done) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [duration, glyphs]);

  return (
    <span className="decrypted-text" aria-label={text}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
