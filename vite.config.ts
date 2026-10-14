/// <reference types="vitest/config" />
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'

import {
  assertApiBaseUrl,
  buildContentSecurityPolicy,
} from './src/features/shared/lib/csp.ts'

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
          assertApiBaseUrl(env.VITE_API_BASE_URL)
          if (ctx.server) return html
          const csp = buildContentSecurityPolicy({
            apiBaseUrl: env.VITE_API_BASE_URL,
            production: mode === 'production',
          })
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
        '/audit': { target: proxyTarget, changeOrigin: true },
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
