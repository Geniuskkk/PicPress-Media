<template>
  <div
    class="relative"
    @dragover.prevent="pageDragging = true"
    @dragleave.self="pageDragging = false"
    @drop.prevent="onPageDrop"
  >
    <!-- Drag overlay -->
    <div
      v-if="pageDragging"
      class="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/20 border-2 border-dashed border-blue-500 pointer-events-none"
    >
      <div class="text-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 10l5 2-5 2V10z"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>
        <p class="mt-3 text-lg font-semibold text-blue-600 dark:text-blue-400">{{ store.currentVideoFile ? '松开以替换视频' : '松开以载入视频' }}</p>
      </div>
    </div>

  <div v-if="store.currentVideoFile" class="flex flex-col h-[calc(100vh-57px)] relative">
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <RouterLink to="/" class="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        返回
      </RouterLink>
      <div class="flex items-center gap-2">
        <span v-if="originalSize" class="text-xs text-gray-400">
          原视频: {{ formatSize(originalSize) }}
          <template v-if="processedSize"> → 压缩后: <span class="text-green-600 dark:text-green-400 font-medium">{{ formatSize(processedSize) }}</span></template>
        </span>
        <button
          @click="download"
          :disabled="!processedBlob"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
        >下载</button>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <div class="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-hidden p-4">
        <div class="w-full max-w-4xl">
          <video :src="activePreviewSrc" controls class="w-full rounded-2xl bg-black shadow-lg max-h-[calc(100vh-180px)]" />
          <div class="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <button
              class="px-3 py-1 rounded-full border transition-colors"
              :class="previewMode === 'original' ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'"
              @click="previewMode = 'original'"
            >原始预览</button>
            <button
              class="px-3 py-1 rounded-full border transition-colors disabled:opacity-40"
              :class="previewMode === 'processed' ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'"
              :disabled="!processedSrc"
              @click="previewMode = 'processed'"
            >压缩结果</button>
            <span>输出为本地处理，视频不会上传到外部服务。</span>
          </div>
        </div>
      </div>

      <div class="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900">
        <div class="p-4 space-y-5">
          <section>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">视频信息</h3>
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/70 space-y-2 text-sm">
              <p class="break-all text-gray-700 dark:text-gray-200">{{ store.currentVideoFile.name }}</p>
              <p class="text-gray-500 dark:text-gray-400">格式: {{ store.currentVideoFile.type || '未知' }}</p>
              <p class="text-gray-500 dark:text-gray-400">大小: {{ formatSize(originalSize) }}</p>
            </div>
          </section>

          <section>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">压缩设置</h3>
            <label class="text-xs text-gray-500 dark:text-gray-400">目标体积 (MB，0=不限)</label>
            <input v-model.number="maxSizeMB" type="number" min="0" step="1" class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500" />
            <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">设置后将优先按目标体积估算码率压缩。</p>

            <label class="text-xs text-gray-500 dark:text-gray-400 mt-3 block">
              {{ isSizeLimitEnabled ? '质量上限' : '质量' }} {{ quality }}%
            </label>
            <input
              v-model.number="quality"
              type="range"
              min="1"
              max="100"
              :disabled="isSizeLimitEnabled"
              class="w-full mt-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <p class="mt-1 text-[11px]" :class="isSizeLimitEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'">
              {{ isSizeLimitEnabled ? '已启用目标体积，质量将转为自动估算码率。' : '未限制体积时，按当前质量输出。' }}
            </p>
          </section>

          <section>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">输出格式</h3>
            <div class="flex gap-2">
              <button
                v-for="item in formats"
                :key="item"
                @click="format = item"
                class="flex-1 py-2 text-xs rounded border transition-colors uppercase font-medium"
                :class="format === item ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'"
              >{{ item }}</button>
            </div>
          </section>

          <div class="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/70 leading-5">
            使用系统 ffmpeg 执行转码。MP4 输出为 H.264 + AAC，WebM 输出为 VP9 + Opus。
          </div>

          <button @click="process" :disabled="processing" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors">
            {{ processing ? '压缩中...' : '开始压缩' }}
          </button>
          <button
            v-if="processing"
            @click="cancelProcess"
            class="w-full mt-2 py-2 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >取消压缩</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="min-h-[calc(100vh-57px)] flex items-center justify-center p-6">
    <div class="text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="14" height="10" rx="2"/><path d="M16 9.5l6-2.5v10l-6-2.5V9.5z"/></svg>
      <p class="text-lg font-medium text-gray-700 dark:text-gray-200">还没有选择视频</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">拖拽视频到此处，或返回首页选择文件。</p>
      <RouterLink to="/" class="inline-flex mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors">返回首页</RouterLink>
    </div>
  </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useImageStore } from '@/stores/imageStore'
import { processVideo } from '@/utils/api'
import { formatSize } from '@/utils/format'

const store = useImageStore()
const processing = ref(false)
const processedBlob = ref<Blob | null>(null)
const originalSize = ref(0)
const processedSize = ref(0)
const originalSrc = ref('')
const processedSrc = ref('')
const previewMode = ref<'original' | 'processed'>('original')

const quality = ref(72)
const maxSizeMB = ref(0)
const format = ref<'mp4' | 'webm'>('mp4')
const formats: Array<'mp4' | 'webm'> = ['mp4', 'webm']
const pageDragging = ref(false)
const isSizeLimitEnabled = computed(() => maxSizeMB.value > 0)
const activePreviewSrc = computed(() => {
  if (previewMode.value === 'processed' && processedSrc.value) return processedSrc.value
  return originalSrc.value
})

let abortController: AbortController | null = null

onMounted(() => {
  if (!store.currentVideoFile) return
  originalSize.value = store.currentVideoFile.size
  originalSrc.value = URL.createObjectURL(store.currentVideoFile)
})

onUnmounted(() => {
  if (originalSrc.value) URL.revokeObjectURL(originalSrc.value)
  if (processedSrc.value) URL.revokeObjectURL(processedSrc.value)
  store.clear()
})

function onPageDrop(e: DragEvent) {
  pageDragging.value = false
  const file = Array.from(e.dataTransfer?.files ?? []).find(f => f.type.startsWith('video/'))
  if (!file) return
  store.setVideoFile(file)
  // Reset state
  processedBlob.value = null
  processedSize.value = 0
  if (processedSrc.value) URL.revokeObjectURL(processedSrc.value)
  processedSrc.value = ''
  previewMode.value = 'original'
  if (originalSrc.value) URL.revokeObjectURL(originalSrc.value)
  originalSize.value = file.size
  originalSrc.value = URL.createObjectURL(file)
}

async function process() {
  if (!store.currentVideoFile) return
  processing.value = true
  abortController = new AbortController()

  try {
    const blob = await processVideo({
      file: store.currentVideoFile,
      format: format.value,
      quality: quality.value,
      maxSizeMB: maxSizeMB.value || 0,
      signal: abortController.signal,
    })
    processedBlob.value = blob
    processedSize.value = blob.size
    if (processedSrc.value) URL.revokeObjectURL(processedSrc.value)
    processedSrc.value = URL.createObjectURL(blob)
    previewMode.value = 'processed'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('Video processing cancelled by user')
    } else {
      console.error(error)
      alert(error instanceof Error ? error.message : '视频压缩失败，请重试')
    }
  } finally {
    processing.value = false
    abortController = null
  }
}

function cancelProcess() {
  abortController?.abort()
}

function download() {
  if (!processedBlob.value || !store.currentVideoFile) return
  const name = store.currentVideoFile.name.replace(/\.[^.]+$/, '') + `_picpress.${format.value}`
  const url = URL.createObjectURL(processedBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
</script>