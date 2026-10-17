import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: { entry: 'electron/main/index.ts', formats: ['cjs'], fileName: () => 'main.cjs' },
    rollupOptions: {
      external: ['electron', 'electron-squirrel-startup', 'ffmpeg-static', 'ffprobe-static',
        ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
    },
  },
})
