import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'development-csp', apply: 'serve',
    // Vite 的热更新预加载脚本仅用于本地开发；打包后的页面保留严格 CSP。
    transformIndexHtml: (html) => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
  }],
  // 本地前端开发服务器把 /api 请求转给 Node 后端。
  server: {
    watch: { ignored: ['**/.test-profiles/**', '**/release/**', '**/test-results/**', '**/playwright-report/**'] },
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
