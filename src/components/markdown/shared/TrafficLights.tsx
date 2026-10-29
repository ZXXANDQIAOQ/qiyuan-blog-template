/**
 * Mac window traffic light dots (red, yellow, green).
 * When handlers are provided, dots become interactive buttons with hover icons.
 *
 * 图标从 mingcute 换成 ri：mingcute 集合没装在 node_modules/@iconify-json 里，
 * 这两个图标只能走运行时 API，网络一慢就留白 + 刷 console error。
 * ri 里的 close-line / fullscreen-line 视觉足够接近，而且已经随离线注册表打包。
 */

import { useTranslation } from '@hooks/useTranslation';
import { Icon } from '@/lib/iconify-react';
import { cn } from '@lib/utils';

interface TrafficLightsProps {
  onClose?: () => void;
  onFullscreen?: () => void;
}

export function TrafficLights({ onClose, onFullscreen }: TrafficLightsProps) {
  const { t } = useTranslation();
  const interactive = !!(onClose || onFullscreen);
  return (
    <div className={cn('flex gap-2', interactive && 'group')}>
      <TrafficDot
        color="bg-[#ff5f56]"
        onClick={onClose}
        aria-label={t('common.close')}
        icon={onClose ? <Icon icon="ri:close-line" className="text-black" /> : null}
      />
      <TrafficDot color="bg-[#ffbd2e]" icon={null} />
      <TrafficDot
        color="bg-[#27c93f]"
        onClick={onFullscreen}
        aria-label={t('code.fullscreen')}
        icon={onFullscreen ? <Icon icon="ri:fullscreen-line" className="text-black" /> : null}
      />
    </div>
  );
}

function TrafficDot({
  color,
  onClick,
  'aria-label': ariaLabel,
  icon,
}: {
  color: string;
  onClick?: () => void;
  'aria-label'?: string;
  icon: React.ReactNode;
}) {
  const base = cn('relative size-3 rounded-full', color);

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, 'cursor-default')} aria-label={ariaLabel}>
        <span className="absolute inset-0 flex items-center justify-center p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {icon}
        </span>
      </button>
    );
  }

  return (
    <span className={base}>
      {icon && (
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          {icon}
        </span>
      )}
    </span>
  );
}
