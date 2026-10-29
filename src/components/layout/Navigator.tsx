/**
 * Navigator Component
 *
 * Navigation header with scroll-based visibility control.
 * Uses useScrollTrigger hook for optimized scroll handling.
 *
 * 视觉（design-spec §6.1）：
 * - 菜单项 14px / 600 / 字距 0.06em，padding 8×12，圆角 6
 * - hover：底色白 5%，无位移
 * - 激活：文字青 + 青底 9% + 下缘 2px 青条（60% 宽）+ 12px 青光
 * - 右侧图标组：3 个 32×32 圆角 8 的图标按钮
 */

import ThemeToggle from '@components/theme/ThemeToggle';
import { RESERVED_ROUTES } from '@constants/router';
import { configuredSeriesSlugs, enabledSeriesSlugs, routers } from '@constants/site-config';
import { useIsTablet } from '@hooks/useMediaQuery';
import { useScrollTrigger } from '@hooks/useScrollTrigger';
import { Icon } from '@/lib/iconify-react';
import { cn, filterNavItems } from '@lib/utils';
import { memo, useEffect, useRef } from 'react';
import { defaultLocale, isI18nEnabled, localeEntries, localizedPath, resolveNavName, stripLocaleFromPath } from '@/i18n';
import DropdownNav from './DropdownNav';
import LanguageSwitcher from './LanguageSwitcher';
import { SearchTrigger } from './SearchDialog';

interface NavigatorProps {
  currentPath: string;
  locale?: string;
}

// Pre-filter navigation items at module load (config is static)
const filteredRouters = filterNavItems(routers, configuredSeriesSlugs, enabledSeriesSlugs, RESERVED_ROUTES);

// Icon component for navigation items - uses @iconify/react for dynamic icons
function NavIcon({ name }: { name: string }) {
  return <Icon icon={name} className="mr-1.5 h-4 w-4 shrink-0" />;
}

// 归一化路径用于激活态比较：忽略末尾斜杠（Astro trailingSlash:'ignore' 下
// 页面以 /drive/ 形式提供，而导航配置写的是 /drive，严格 === 会失配）
function normalizePath(p: string | undefined): string {
  if (!p) return '/';
  const s = p.replace(/\/+$/, '');
  return s === '' ? '/' : s;
}

// Button link component
interface ButtonLinkProps {
  url: string;
  label: string;
  isActive: boolean;
  children: React.ReactNode;
}

function ButtonLink({ url, label, isActive, children }: ButtonLinkProps) {
  return (
    <a
      href={url}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex items-center rounded-md px-3 py-2 text-sm font-semibold tracking-[0.06em] whitespace-nowrap',
        'transition-colors duration-200 ease-in-out',
        'hover:bg-white/5 hover:text-foreground',
        isActive ? 'bg-primary/[0.09] text-primary' : 'text-muted-foreground',
        // 下缘 2px 条：hover 只出 30% 短条（「我在这里」），激活才是 60% + 光（「你现在在这」）
        'after:absolute after:bottom-0.5 after:left-1/2 after:block after:h-0.5 after:w-0 after:-translate-x-1/2',
        'after:rounded-full after:bg-primary after:transition-[width] after:duration-200',
        'after:ease-[cubic-bezier(0.25,1,0.5,1)]',
        'hover:after:w-[30%]',
        // 光值走统一档位（12px / 0.18），不手写透明度
        isActive && 'after:w-[60%] after:shadow-[var(--glow-cyan-sm)]',
      )}
    >
      {children}
    </a>
  );
}

const Navigator = memo(function Navigator({ currentPath, locale = defaultLocale }: NavigatorProps) {
  const { isBeyond, direction } = useScrollTrigger({
    triggerDistance: 0.45,
    throttleMs: 80,
  });

  const isTablet = useIsTablet();
  const strippedPath = stripLocaleFromPath(currentPath);
  const isPostPageMobile = isTablet && strippedPath.startsWith('/post/');

  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrollingRef = useRef(false);
  const firstScrollRef = useRef(true);

  // Apply with-background class based on scroll position
  useEffect(() => {
    document.getElementById('site-header')?.classList.toggle('with-background', isBeyond);
  }, [isBeyond]);

  // Handle header visibility based on scroll
  useEffect(() => {
    const siteHeader = document.getElementById('site-header');
    const mobileMenuContainer = document.getElementById('mobile-menu-container');

    // Skip first scroll
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      return;
    }

    // Post page mobile: keep header visible during scroll
    if (isPostPageMobile) {
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
      isScrollingRef.current = true;

      // Ensure header is visible
      siteHeader?.classList.remove('-translate-y-full');
      mobileMenuContainer?.classList.remove('-translate-y-full');

      scrollEndTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 800);
      return;
    }

    // Normal behavior: hide on scroll down, show on scroll up
    if (direction === 'down') {
      siteHeader?.classList.add('-translate-y-full');
      mobileMenuContainer?.classList.add('-translate-y-full');
    } else if (direction === 'up') {
      siteHeader?.classList.remove('-translate-y-full');
      mobileMenuContainer?.classList.remove('-translate-y-full');
    }
  }, [direction, isPostPageMobile]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, []);

  return (
    // ≤992 时不要让导航容器抢宽度，否则中间的移动端 logo 会被推到左半边
    <div className="flex grow items-center tablet:grow-0">
      {/* Desktop navigation */}
      <div className="flex grow items-center gap-0.5 tablet:hidden">
        {filteredRouters.map((item) => {
          const displayName = resolveNavName(item.nameKey, item.name, locale);
          if (item.children?.length) {
            return <DropdownNav key={item.path ?? item.name} item={item} currentPath={currentPath} locale={locale} />;
          }
          if (!item.path || !displayName) return null;
          const localizedUrl = localizedPath(item.path, locale);
          return (
            <ButtonLink
              key={item.path}
              url={localizedUrl}
              label={displayName}
              isActive={normalizePath(item.path) === normalizePath(strippedPath)}
            >
              {item.icon && <NavIcon name={item.icon} />}
              {displayName}
            </ButtonLink>
          );
        })}
      </div>

      {/* 右侧图标组：搜索 / 语言 / 主题，统一 32×32（§6.1） */}
      <div className="ml-auto flex items-center gap-1">
        <div className="cyber-iconbtn">
          <SearchTrigger />
        </div>
        {isI18nEnabled && localeEntries.length > 1 && (
          <div className="cyber-iconbtn tablet:hidden">
            <LanguageSwitcher locale={locale} />
          </div>
        )}
        <div className="cyber-iconbtn">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
});

export default Navigator;
