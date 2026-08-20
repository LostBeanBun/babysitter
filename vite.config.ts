import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages / Cloudflare Pages 部署时需通过 --base 指定子路径
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '宝宝日记 - 喂养记录',
        short_name: '宝宝日记',
        description: '温馨简约的宝宝喂养、睡眠、纸尿裤记录与统计工具',
        theme_color: '#FDF6EF',
        background_color: '#FDF6EF',
        display: 'standalone',
        lang: 'zh-CN',
        start_url: './',
        categories: ['lifestyle', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // echarts vendor 包约 590KB，属预期（长缓存 + 按需加载），放宽警告阈值
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // ECharts 单独拆包，利用浏览器长缓存（体积大但只在统计页加载）
            {
              name: 'echarts',
              test: /node_modules[\\/](echarts|zrender)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
})
