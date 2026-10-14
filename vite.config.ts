/// <reference types="vitest/config" />
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'
  const bindAllInterfaces =
    env.VITE_DEV_HOST === '1' || env.VITE_DEV_HOST === 'true'

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      {
        name: 'csp-meta',
        transformIndexHtml(html, ctx) {
          if (ctx.server) return html
          const csp = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self'",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            'upgrade-insecure-requests',
          ].join('; ')
          return html.replace(
            '<meta name="referrer" content="no-referrer" />',
            `<meta name="referrer" content="no-referrer" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          )
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 5173,
      ...(bindAllInterfaces ? { host: true } : {}),
      proxy: {
        '/auth': { target: proxyTarget, changeOrigin: true },
        '/clients': { target: proxyTarget, changeOrigin: true },
        '/users': { target: proxyTarget, changeOrigin: true },
        '/invitations': { target: proxyTarget, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      css: false,
    },
  }
})
