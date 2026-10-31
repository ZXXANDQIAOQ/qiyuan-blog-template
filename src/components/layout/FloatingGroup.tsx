/**
 * FloatingGroup Component
 *
 * 右侧悬浮工具组（design-spec §6.9）
 *
 * 收敛方案：原来的 3 个按钮（↑ / ↓ / ×）砍到 2 个，并删掉「× 收起」这个交互 ——
 * 「收起工具栏」是一个用户学不会、也想不起来的操作，留着只会占位。
 * 现在只剩：返回顶部 + 打开搜索（≤768 隐藏，移动端搜索在导航/抽屉里）。
 */

import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@/lib/iconify-react';
import { cn } from '@lib/utils';
import { useStore } from '@nanostores/react';
import { $isDrawerOpen, openSearch } from '@store/modal';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

const SHOW_AFTER_Y = 240;

export default function FloatingGroup() {
  const { t } = useTranslation();
  const isDrawerOpen = useStore($isDrawerOpen);
  const [isVisible, setIsVisible] = useState(false);

  // 出现条件：scrollY > 240；其余时间 pointer-events: none + opacity 0
  useEffect(() => {
    const onScroll = () => setIsVisible(window.scrollY > SHOW_AFTER_Y);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const isHidden = !isVisible || isDrawerOpen;

  return (
    <motion.div
      className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col gap-2 md:right-4 md:bottom-4"
      initial={false}
      animate={{
        x: isDrawerOpen ? 120 : 0,
        y: isHidden ? 8 : 0,
        opacity: isHidden ? 0 : 1,
      }}
      style={{ pointerEvents: isHidden ? 'none' : 'auto' }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <AnimatePresence initial={false}>
        {isVisible && !isDrawerOpen && (
          <motion.div
            className="flex flex-col gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={scrollToTop}
              aria-label={t('floating.backToTop')}
              className={cn(
                'flex size-10 items-center justify-center rounded-[10px] border border-white/10 text-primary',
                'bg-[rgba(14,18,26,0.72)] backdrop-blur-[12px]',
                'transition-[border-color,box-shadow,transform] duration-200',
                'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_18px_hsl(var(--primary)/0.22)]',
              )}
            >
              <Icon icon="ri:arrow-up-line" className="size-[18px]" />
            </button>

            {/* 移动端搜索在导航里，这里隐藏（§6.9） */}
            <button
              type="button"
              onClick={() => openSearch()}
              aria-label={t('common.search')}
              title={t('common.search')}
              className={cn(
                'flex size-10 items-center justify-center rounded-[10px] border border-white/10 text-primary md:hidden',
                'bg-[rgba(14,18,26,0.72)] backdrop-blur-[12px]',
                'transition-[border-color,box-shadow,transform] duration-200',
                'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_18px_hsl(var(--primary)/0.22)]',
              )}
            >
              <Icon icon="ri:search-line" className="size-[18px]" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
