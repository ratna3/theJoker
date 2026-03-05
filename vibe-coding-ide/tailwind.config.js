/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                app: {
                    bg: '#0a0e0c',
                    sidebar: '#0e1310',
                    panel: '#151b18',
                    accent: '#00d47b',
                    accentHover: '#00b868',
                    accentMuted: '#00d47b20',
                    success: '#10b981',
                    error: '#ef4444',
                    warning: '#f59e0b',
                    text: '#e2e8f0',
                    textMuted: '#64748b',
                    border: '#243028',
                }
            },
            fontFamily: {
                mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            animation: {
                'fade-slide-in': 'fadeSlideIn 200ms ease forwards',
                'build-step-complete': 'buildStepComplete 400ms ease',
                'thinking-dot': 'thinkingDot 1.4s infinite ease-in-out',
                'streaming-cursor': 'streamingCursor 800ms infinite',
                'pulse-glow': 'pulseGlow 2s infinite',
                'gradient-shift': 'gradientShift 3s ease infinite',
                'slide-in-right': 'slideInRight 300ms ease',
                'scale-fade-in': 'scaleFadeIn 150ms ease',
                'spin-slow': 'spin 2s linear infinite',
            },
            keyframes: {
                fadeSlideIn: {
                    'from': { opacity: '0', transform: 'translateY(8px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
                buildStepComplete: {
                    '0%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)', background: 'rgba(16, 185, 129, 0.125)' },
                    '100%': { transform: 'scale(1)' },
                },
                thinkingDot: {
                    '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.5' },
                    '40%': { transform: 'scale(1)', opacity: '1' },
                },
                streamingCursor: {
                    '0%, 50%': { opacity: '1' },
                    '51%, 100%': { opacity: '0' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 212, 123, 0)' },
                    '50%': { boxShadow: '0 0 12px 4px rgba(0, 212, 123, 0.3)' },
                },
                gradientShift: {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                slideInRight: {
                    'from': { transform: 'translateX(100%)', opacity: '0' },
                    'to': { transform: 'translateX(0)', opacity: '1' },
                },
                scaleFadeIn: {
                    'from': { transform: 'scale(0.95)', opacity: '0' },
                    'to': { transform: 'scale(1)', opacity: '1' },
                },
            }
        },
    },
    plugins: [],
}
