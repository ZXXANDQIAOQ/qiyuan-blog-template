import Popover from '@components/ui/popover';
import type { Router } from '@constants/router';
import { Icon } from '@/lib/iconify-react';
import { cn } from '@lib/utils';
import { memo, useCallback, useState } from 'react';
import { defaultLocale, localizedPath, resolveNavName, stripLocaleFromPath, t } from '@/i18n';

interface DropdownNavProps {
  item: Router;
  currentPath: string;
  className?: string;
  locale?: string;
}

const DropdownNavComponent = ({ item, currentPath, className, locale = defaultLocale }: DropdownNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { icon, children } = item;
  const name = resolveNavName(item.nameKey, item.name, locale);

  const strippedPath = stripLocaleFromPath(currentPath);

  const renderDropdownContent = useCallback(
    () => (
      /* 下拉面板（§6.1）：宽 200 / 玻璃 / 圆角 10 / 顶部 1px 高光 / --shadow-pop */
      <div
        className="flex w-[200px] flex-col gap-0.5 rounded-[10px] border border-white/10 bg-[var(--glass-bg-strong)] p-1 shadow-[var(--shadow-pop)] backdrop-blur-[20px]"
      >
        {children?.length
          ? children.map((child: Router) => {
              const childName = resolveNavName(child.nameKey, child.name, locale);
              const childUrl = child.path ? localizedPath(child.path, locale) : child.path;
              const isChildActive = child.path ? strippedPath === child.path : false;
              return (
                <a
                  key={child.path}
                  href={childUrl}
                  aria-current={isChildActive ? 'page' : undefined}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-md px-3 text-[13px] transition-colors duration-200',
                    isChildActive
                      ? 'bg-primary/[0.09] font-medium text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                  )}
                >
                  {child.icon && <Icon icon={child.icon} className="size-4 shrink-0" />}
                  {childName}
                </a>
              );
            })
          : null}
      </div>
    ),
    [children, strippedPath, locale],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} placement="bottom-start" trigger="hover" render={renderDropdownContent}>
      <button
        type="button"
        className={cn(
          'relative flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold tracking-[0.06em] whitespace-nowrap',
          'text-muted-foreground transition-colors duration-200 ease-in-out hover:bg-white/5 hover:text-foreground',
          isOpen && 'bg-white/5 text-foreground',
          className,
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t(locale, 'common.menuLabel', { name })}
      >
        {icon && <Icon icon={icon} className="mr-1 size-4 shrink-0" />}
        {name}
        <Icon
          icon="ri:arrow-down-s-line"
          className={cn('size-4 shrink-0 transition-transform duration-200', {
            'rotate-180': isOpen,
          })}
        />
      </button>
    </Popover>
  );
};

// Memoize component for performance
const DropdownNav = memo(DropdownNavComponent);

export default DropdownNav;
