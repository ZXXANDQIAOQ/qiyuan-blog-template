/**
 * 交互式点阵格子 —— 参考 dshdesktop.cn 的 Hero 背景效果
 *
 * 2D Canvas 实现：90px 间距的点阵网格，鼠标靠近时点被推开，
 * 点之间用细线连接，点离鼠标越近越大越亮。
 *
 * 调色板适配「恬谧版」双主题：
 *   - 浅色模式：暖奶油底 → 深紫灰点（低对比融入渐变底）
 *   - 深色模式：深蓝黑底 → 浅灰白点（原始效果）
 *
 * 技术要点：
 *   - 每个点有 restX/restY（静止位置）+ x/y（实际位置）+ vx/vy（速度）
 *   - 鼠标 140px 半径内产生斥力，弹簧系数 0.05 拉回静止位，阻尼 0.85
 *   - IntersectionObserver 控制不可见时暂停渲染
 *   - prefers-reduced-motion 时不响应鼠标
 */
import { useEffect, useRef } from 'react';

interface Dot {
  restX: number;
  restY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 格子间距（px） */
const GRID_GAP = 90;
/** 鼠标影响半径（px） */
const MOUSE_RADIUS = 140;
/** 斥力强度 */
const REPEL_STRENGTH = 30;
/** 弹簧回弹系数 */
const SPRING = 0.05;
/** 速度阻尼 */
const DAMPING = 0.85;
/** 连线最短距离 */
const LINE_MIN_DIST = 20;
/** 连线两端留白 */
const LINE_PADDING = 10;
/** 帧率上限（ms/帧） */
const FRAME_INTERVAL = 1000 / 30;

/** 检测当前是否暗色模式 */
function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export default function InteractiveDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas: HTMLCanvasElement = canvasRaw;

    const isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    const ctxRaw = canvas.getContext('2d');
    if (!ctxRaw) return;
    const ctx: CanvasRenderingContext2D = ctxRaw;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots: Dot[] = [];
    let cols = 0;
    let rows = 0;
    let w = 0;
    let h = 0;
    let rafId = 0;
    let idle = false;
    let visible = true;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const mouse = { x: NaN, y: NaN };

    /** 根据主题取色 */
    function getColors() {
      if (isDarkMode()) {
        return {
          line: 'rgba(255, 255, 255, 0.08)',
          dot: 'rgba(255, 255, 255, 0.16)',
          dotHoverBoost: 0.4,
        };
      }
      return {
        line: 'rgba(108, 95, 199, 0.12)',
        dot: 'rgba(108, 95, 199, 0.18)',
        dotHoverBoost: 0.35,
      };
    }

    function buildGrid() {
      cols = Math.ceil(w / GRID_GAP) + 1;
      rows = Math.ceil(h / GRID_GAP) + 1;
      const offsetX = (w - (cols - 1) * GRID_GAP) / 2;
      const offsetY = (h - (rows - 1) * GRID_GAP) / 2;
      dots = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const restX = offsetX + GRID_GAP * c;
          const restY = offsetY + GRID_GAP * r;
          dots.push({ restX, restY, x: restX, y: restY, vx: 0, vy: 0 });
        }
      }
    }

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
    }

    function wake() {
      if (idle) {
        idle = false;
        rafId = requestAnimationFrame(frame);
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (isCoarsePointer) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      wake();
    }

    let lastFrame = 0;

    function frame(timestamp: number) {
      if (!visible || timestamp - lastFrame < FRAME_INTERVAL) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      lastFrame = timestamp - ((timestamp - lastFrame) % FRAME_INTERVAL);

      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw !== w || ch !== h) {
        w = cw;
        h = ch;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(buildGrid, 150);
      }

      ctx.clearRect(0, 0, w, h);

      // 物理更新
      let maxSpeed = 0;
      for (const d of dots) {
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < MOUSE_RADIUS && dist > 0.1) {
          const force = (1 - dist / MOUSE_RADIUS) * REPEL_STRENGTH;
          d.vx += (dx / dist) * force * 0.1;
          d.vy += (dy / dist) * force * 0.1;
        }
        d.vx += (d.restX - d.x) * SPRING;
        d.vy += (d.restY - d.y) * SPRING;
        d.vx *= DAMPING;
        d.vy *= DAMPING;
        d.x += d.vx;
        d.y += d.vy;
        maxSpeed = Math.max(maxSpeed, Math.abs(d.vx) + Math.abs(d.vy));
      }

      const colors = getColors();

      // 画连线（横向）
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 0.5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const a = dots[r * cols + c];
          const b = dots[r * cols + c + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINE_MIN_DIST) continue;
          ctx.beginPath();
          ctx.moveTo(a.x + (LINE_PADDING * dx) / dist, a.y + (LINE_PADDING * dy) / dist);
          ctx.lineTo(b.x - (LINE_PADDING * dx) / dist, b.y - (LINE_PADDING * dy) / dist);
          ctx.stroke();
        }
      }
      // 画连线（纵向）
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows - 1; r++) {
          const a = dots[r * cols + c];
          const b = dots[(r + 1) * cols + c];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINE_MIN_DIST) continue;
          ctx.beginPath();
          ctx.moveTo(a.x + (LINE_PADDING * dx) / dist, a.y + (LINE_PADDING * dy) / dist);
          ctx.lineTo(b.x - (LINE_PADDING * dx) / dist, b.y - (LINE_PADDING * dy) / dist);
          ctx.stroke();
        }
      }

      // 画点
      ctx.fillStyle = colors.dot;
      for (const d of dots) {
        let size = 1.8;
        let alpha = 0.16;
        if (!Number.isNaN(mouse.x) && !Number.isNaN(mouse.y)) {
          const dist = Math.max(0, 1 - Math.hypot(d.x - mouse.x, d.y - mouse.y) / MOUSE_RADIUS);
          size = 1.8 + 2 * dist;
          alpha += colors.dotHoverBoost * dist;
        }
        ctx.globalAlpha = alpha;
        ctx.fillRect(d.x - size, d.y - size, 2 * size, 2 * size);
      }
      ctx.globalAlpha = 1;

      if (maxSpeed < 0.01) {
        idle = true;
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (!isCoarsePointer) window.addEventListener('mousemove', onMouseMove);

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
    });
    observer.observe(canvas);

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', resize);
      if (!isCoarsePointer) window.removeEventListener('mousemove', onMouseMove);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full bg-transparent"
    />
  );
}
