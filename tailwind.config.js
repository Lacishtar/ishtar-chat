/** @type {import('tailwindcss').Config} */
export default {
  content: ['./renderer-dashboard/index.html', './renderer-dashboard/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0E1013',
        panel: '#16191F',
        panelAlt: '#1B1F27',
        line: '#262B33',
        ink: '#EAECEF',
        inkMuted: '#8890A0',
        live: '#FF4D6D',
        connected: '#35E6B0',
        stale: '#F5A623',
        focusAccent: '#6E56F0',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
