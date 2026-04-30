import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: resolve(__dirname, 'electron/main/index.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      lib: {
        entry: resolve(__dirname, 'electron/preload/index.ts'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'frontend'),
    build: {
      outDir: resolve(__dirname, 'dist/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'frontend/index.html'),
      },
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'frontend/src'),
      },
    },
    css: {
      postcss: resolve(__dirname, 'frontend/postcss.config.js'),
    },
    // Proxy is used when renderer is opened in a standalone browser (e.g. npm run dev in frontend/).
    // In Electron, the frontend calls http://127.0.0.1:{apiPort} directly via contextBridge.
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  },
})
