/**
 * PixelTrail（ljj-clone-spec §1.2）
 *
 * 全局鼠标像素轨迹：鼠标移动时在 fixed canvas 上留下 3~4px 小方块，
 * 逐帧衰减消失（寿命 0.6~1.2s）。颜色 = 锈红 accent 与墨色混合。
 * client:only="react" 加载；prefers-reduced-motion 时不启动。
 */

import { useEffect, useRef } from 'react';

interface Pixel {
  x: number;
  y: number;
  size: number;
  age: number;
  life: number;
  color: string;
}

const MAX_PIXELS = 360;

export default function PixelTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const styleOf = getComputedStyle(document.documentElement);
    const accent = () => `hsl(${styleOf.getPropertyValue('--primary').trim() || '8 64% 44%'})`;
    const ink = () => `hsl(${styleOf.getPropertyValue('--foreground').trim() || '80 7% 8%'})`;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixels: Pixel[] = [];
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      // canvas 是 fixed inset-top 定位，clientWidth/Height 即可视绘制区
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };

    const spawn = (x: number, y: number) => {
      const life = 600 + Math.random() * 600; // 0.6 ~ 1.2s
      pixels.push({
        x,
        y,
        size: 3 + Math.random(), // 3~4px
        age: 0,
        life,
        // 锈红为主，混三成墨色
        color: Math.random() < 0.7 ? accent() : ink(),
      });
      if (pixels.length > MAX_PIXELS) pixels.splice(0, pixels.length - MAX_PIXELS);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      spawn(x, y);
      if (Math.random() < 0.5) spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10);
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      for (let i = pixels.length - 1; i >= 0; i--) {
        const p = pixels[i];
        p.age += dt;
        if (p.age >= p.life) {
          pixels.splice(i, 1);
          continue;
        }
        // 透明度衰减：先亮后灭
        ctx.globalAlpha = 1 - p.age / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };

    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="global-pixel-trail" aria-hidden="true" />;
}
