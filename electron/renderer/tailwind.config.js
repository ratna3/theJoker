/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                app: {
                    bg: '#0d0d1a',
                    sidebar: '#12122a',
                    panel: '#1a1a2e',
                    border: '#2d2d4e',
                    accent: '#7c3aed',
                    accentHover: '#6d28d9',
                    text: '#e2e8f0',
                    textMuted: '#8888a8',
                    success: '#22c55e',
                    error: '#ef4444',
                    warning: '#f59e0b',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            animation: {
                'fade-slide-in': 'fadeSlideIn 0.2s ease-out',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'scale-fade-in': 'scaleFadeIn 0.15s ease-out',
                'thinking-dot': 'thinkingDot 1.4s ease-in-out infinite',
            },
            keyframes: {
                fadeSlideIn: {
                    '0%': { opacity: 0, transform: 'translateY(8px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(124,58,237,0.15)' },
                    '50%': { boxShadow: '0 0 30px rgba(124,58,237,0.3)' },
                },
                scaleFadeIn: {
                    '0%': { opacity: 0, transform: 'scale(0.95)' },
                    '100%': { opacity: 1, transform: 'scale(1)' },
                },
                thinkingDot: {
                    '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
                    '40%': { transform: 'scale(1)', opacity: 1 },
                },
            },
        },
    },
    plugins: [],
};
