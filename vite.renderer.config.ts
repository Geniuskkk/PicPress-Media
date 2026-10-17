import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: fileURLToPath(new URL('./frontend', import.meta.url)),
  base: './',
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./frontend/src', import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL('./.vite/renderer/main_window', import.meta.url)),
    emptyOutDir: true,
  },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true } } },
})
