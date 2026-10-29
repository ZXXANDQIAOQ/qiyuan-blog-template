import { animation as animationTokens, borderRadius, colors, shadows } from './src/constants/design-tokens.ts';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    screens: {
      xs: { max: '480px' },
      md: { max: '768px' },
      lg: { max: '1440px' },
      tablet: { max: '992px' },
      desktop: { min: '1480px' },
    },
    extend: {
      colors: {
        // Design token colors
        ...colors,
        // Existing custom colors (for backward compatibility)
        'gradient-start': 'var(--gradient-bg-start)',
        'gradient-end': 'var(--gradient-bg-end)',
        'gradient-shoka-button-start': 'var(--gradient-shoka-button-start)',
        'gradient-shoka-button-end': 'var(--gradient-shoka-button-end)',
        blue: {
          DEFAULT: 'hsl(var(--shoka-blue))',
        },
        gray: {
          400: 'hsl(var(--grey-4))',
        },
        logo: 'hsl(var(--primary))',
        /* 原粉色系（mandy）保留类名，色相整体换成青 —— 见 design-spec §2.4 */
        mandy: {
          50: '#eafdff',
          100: '#c9f8ff',
          200: '#9bf0ff',
          300: '#5fe5ff',
          400: '#2ed6f7',
          500: '#1ae8ff',
          600: '#0bb6d4',
          700: '#0a8fa8',
          800: '#0d6f83',
          900: '#0f5b6c',
          950: '#032f3a',
        },
        /* 赛博霓虹三色（供页面层直接使用 text-neon-cyan 等） */
        neon: {
          cyan: 'hsl(var(--neon-cyan))',
          'cyan-soft': 'hsl(var(--neon-cyan-soft))',
          violet: 'hsl(var(--neon-violet))',
          'violet-soft': 'hsl(var(--neon-violet-soft))',
          amber: 'hsl(var(--neon-amber))',
        },
        /* 底色三阶 */
        surface: {
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        // shoka migrate
        pink: {
          a3: 'var(--color-pink-a3)',
          DEFAULT: 'var(--color-pink)',
        },
      },
      borderRadius: {
        ...borderRadius,
        // Existing custom radius (for backward compatibility)
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        ...shadows,
      },
      keyframes: {
        'vertical-shake': {
          '0%': { transform: 'scale(1)' },
          '10%': { transform: 'scale(.9) rotate(3deg)' },
          '20%': { transform: 'scale(.9) rotate(3deg)' },
          '30%': { transform: 'scale(1.1) rotate(-3deg)' },
          '40%': { transform: 'scale(1.1) rotate(3deg)' },
          '50%': { transform: 'scale(1.1) rotate(-3deg)' },
          '60%': { transform: 'scale(1.1) rotate(3deg)' },
          '70%': { transform: 'scale(1.1) rotate(-3deg)' },
          '80%': { transform: 'scale(1.1) rotate(3deg)' },
          '90%': { transform: 'scale(1.1) rotate(-3deg)' },
          '100%': { transform: 'scale(1)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in-from-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-to-left': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(-12px)' },
        },
      },
      animation: {
        shake: 'shake 2s ease',
        'vertical-shake': 'vertical-shake 1s',
        'slide-down': 'slide-down 0.2s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in-from-right': 'slide-in-from-right 0.2s ease-in-out',
        'slide-out-to-left': 'slide-out-to-left 0.2s ease-in-out',
      },
      transitionDuration: {
        fast: `${animationTokens.duration.fast}ms`,
        normal: `${animationTokens.duration.normal}ms`,
        ui: `${animationTokens.duration.ui}ms`,
        slow: `${animationTokens.duration.slow}ms`,
        slower: `${animationTokens.duration.slower}ms`,
        enter: `${animationTokens.duration.enter}ms`,
      },
      transitionTimingFunction: {
        ...animationTokens.easing,
      },
      backgroundImage: {
        gradient: 'var(--gradient-bg)',
        'gradient-pink': 'var(--gradient-pink)',
        'gradient-header': 'var(--gradient-header)',
        'gradient-shoka-button': 'var(--gradient-shoka-button)',
        'shoka-card-mask': 'linear-gradient(135deg,#434343 0,#000 100%)',
      },
      fontSize: {
        '4.5xl': '2.5rem',
        '5.5xl': '3.5rem',
      },
      fontFamily: {
        /* §3.1：全部系统字体，不新增下载 */
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
        /* 兼容旧类名：原「寒蝉全圆体」，现映射到 display 栈 */
        'chill-round': ['var(--font-display)'],
      },
      clipPath: {
        'post-img-left': 'polygon(0 0,92% 0%,100% 100%,0% 100%)',
        'post-img-right': 'polygon(0 0%,100% 0%,100% 100%,8% 100%)',
      },
      spacing: {
        7.5: '1.875rem',
        8.5: '2.125rem',
        14.5: '3.625rem',
        15: '3.75rem',
        16.5: '4.125rem',
        17: '4.25rem',
        19: '4.75rem',
      },
      maxWidth: {
        '8xl': '87.5rem',
      },
      borderWidth: {
        16: '16px',
      },
    },
  },
  plugins: [require('@tailwindcss/container-queries'), require('tailwindcss-animate'), require('@tailwindcss/typography')],
};
