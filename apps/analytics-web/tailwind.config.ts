import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Light mode — matches POS RestroBit palette
        background: '#F5F6F8',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        'card-hover': '#F9FAFB',
        'card-solid': '#FFFFFF',
        secondary: { DEFAULT: '#F3F4F6', foreground: '#111827' },
        // muted-foreground เข้มขึ้นเพื่ออ่านง่ายขึ้น (เดิม #6B7280 จางเกินบนพื้นสว่าง)
        muted: { DEFAULT: '#F3F4F6', foreground: '#4B5563' },
        border: '#E5E7EB',
        input: '#FFFFFF',
        foreground: '#111827',

        primary: {
          DEFAULT: '#FF6B35',
          foreground: '#FFFFFF',
          50: '#FFF4F0',
          100: '#FFE4D6',
          400: '#FF8A5C',
          500: '#FF6B35',
          600: '#F25525',
        },
        accent: { DEFAULT: '#F59E0B', foreground: '#FFFFFF' },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        // ใช้ CSS variable จาก next/font (ไม่งั้น font จะไม่ถูกใช้ → fallback เป็น font ระบบ)
        sans: ['var(--font-inter)', 'var(--font-thai)', 'system-ui', 'sans-serif'],
        thai: ['var(--font-thai)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      fontSize: {
        'metric-sm': ['1.5rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        'metric-md': ['2rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        'metric-lg': ['2.75rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.02)',
        'card-hover': '0 4px 12px -2px rgba(0,0,0,0.08)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-up': 'fade-up 0.25s ease-out' },
    },
  },
  plugins: [],
};
export default config;
