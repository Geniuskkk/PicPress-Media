<template>
  <div class="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] p-6">
    <div class="w-full max-w-2xl">
      <h1 class="text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">图片处理 & 视频压缩</h1>
      <p class="text-center text-gray-500 dark:text-gray-400 mb-8">本地处理图片和视频，数据不离开你的电脑</p>

      <!-- Drop Zone -->
      <div
        class="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all"
        :class="dragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
        @paste.window="onPaste"
      >
        <div class="flex flex-col items-center gap-3 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-14 h-14 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <div>
            <p class="text-lg font-medium text-gray-700 dark:text-gray-300">拖拽图片到此处</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">或点击选择 / Ctrl+V 粘贴</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">支持 JPG · PNG · WebP · GIF · HEIC</p>
          </div>
        </div>
      </div>
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFileChange" />

      <div class="mt-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p class="text-base font-medium text-gray-800 dark:text-gray-200">单个视频压缩</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">支持 MP4 / MOV / WebM 等常见格式，使用本机 ffmpeg 压缩。</p>
        </div>
        <button
          @click="videoInput?.click()"
          class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
        >选择视频</button>
      </div>
      <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="onVideoChange" />

      <!-- 快捷场景 -->
      <div class="mt-8">
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 text-center">常用场景</p>
        <div class="flex flex-wrap gap-2 justify-center">
          <button
            v-for="preset in presets"
            :key="preset.label"
            @click="applyPreset(preset)"
            class="px-4 py-2 rounded-full text-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useImageStore } from '@/stores/imageStore'

const router = useRouter()
const store = useImageStore()
const fileInput = ref<HTMLInputElement>()
const videoInput = ref<HTMLInputElement>()
const dragging = ref(false)

const presets = [
  { label: '证件照 1:1', ratio: 1, maxSizeKB: 200, format: 'jpg' },
  { label: '微信头像', ratio: 1, maxSizeKB: 300, format: 'jpg' },
  { label: '电商主图 1:1', ratio: 1, maxSizeKB: 500, format: 'jpg' },
  { label: '横幅 16:9', ratio: 16 / 9, maxSizeKB: 500, format: 'jpg' },
  { label: '竖版封面 9:16', ratio: 9 / 16, maxSizeKB: 500, format: 'jpg' },
]

function onDrop(e: DragEvent) {
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  handleFiles(files)
}

function onFileChange(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  handleFiles(files)
}

function onPaste(e: ClipboardEvent) {
  const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (files.length) handleFiles(files)
}

function onVideoChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !file.type.startsWith('video/')) return
  store.setVideoFile(file)
  router.push('/video')
}

function handleFiles(files: File[]) {
  if (!files.length) return
  if (files.length === 1) {
    store.setSingleFile(files[0])
    router.push('/editor')
  } else {
    store.setBatchFiles(files)
    router.push('/batch')
  }
}

function applyPreset(preset: typeof presets[0]) {
  store.setPreset(preset)
  fileInput.value?.click()
}
</script>
