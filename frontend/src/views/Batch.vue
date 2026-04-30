<template>
  <div
    class="flex flex-col h-[calc(100vh-57px)] relative"
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
        <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p class="mt-3 text-lg font-semibold text-blue-600 dark:text-blue-400">松开以添加图片</p>
      </div>
    </div>
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <RouterLink to="/" class="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        返回
      </RouterLink>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500 dark:text-gray-400">
          共 {{ items.length }} 张<template v-if="selectedIndices.size > 0">，已选 {{ selectedIndices.size }} 张</template>
        </span>
        <template v-if="selectedIndices.size > 0">
          <button @click="clearSelection" class="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 transition-colors">取消选中</button>
          <button @click="deleteSelected" class="px-2.5 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">删除所选</button>
        </template>
        <template v-else>
          <button v-if="items.length > 0" @click="selectAll" class="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 transition-colors">全选</button>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="selectedIndices.size > 0" @click="downloadSelected" :disabled="!selectedAllDone || downloading"
          class="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
          {{ downloading ? '打包中...' : '下载选中 ZIP' }}
        </button>
        <button @click="downloadAll" :disabled="!allDone || downloading"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
          {{ downloading ? '打包中...' : '全部下载 ZIP' }}
        </button>
      </div>
    </div>

    <!-- Unified Settings Bar -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-wrap gap-4 items-end">
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">比例</label>
        <select v-model="batchRatio" class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none">
          <option :value="undefined">自由</option>
          <option :value="1">1:1</option>
          <option :value="4/3">4:3</option>
          <option :value="16/9">16:9</option>
          <option :value="9/16">9:16</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">常用尺寸</label>
        <select
          v-model="selectedSizePresetId"
          @change="applyBatchSizePreset(selectedSizePresetId)"
          class="w-64 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none"
        >
          <option value="">自定义</option>
          <option v-for="preset in photoSizePresets" :key="preset.id" :value="preset.id">
            {{ formatPhotoSizeLabel(preset) }}
          </option>
        </select>
      </div>
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">输出宽度 (px)</label>
        <input v-model.number="batchWidth" type="number" min="1" class="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none" />
      </div>
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">输出高度 (px)</label>
        <input v-model.number="batchHeight" type="number" min="1" class="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none" />
      </div>
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">目标体积 (KB，0=不限)</label>
        <input v-model.number="batchMaxKB" type="number" min="0" class="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none" />
        <p class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">设置后将优先满足体积限制。</p>
      </div>
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
          {{ isSizeLimitEnabled ? '质量上限' : '质量' }} {{ batchQuality }}%
        </label>
        <input
          v-model.number="batchQuality"
          type="range"
          min="1"
          max="100"
          :disabled="isSizeLimitEnabled"
          class="w-24 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <p class="mt-1 text-[11px]" :class="isSizeLimitEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'">
          {{ isSizeLimitEnabled ? '已启用目标体积，质量将由系统自动下调。' : '未限制体积时，按当前质量导出。' }}
        </p>
      </div>
      <div>
        <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">格式</label>
        <select v-model="batchFormat" class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none">
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
          <option value="avif">AVIF</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="selectedIndices.size > 0" @click="processSelected" :disabled="processing" class="px-4 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
          {{ processing ? '处理中...' : '处理选中' }}
        </button>
        <button @click="processAll" :disabled="processing" class="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
          {{ processing ? '处理中...' : '全部处理' }}
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="(item, i) in items"
          :key="i"
          class="relative rounded-xl overflow-hidden border-2 bg-white dark:bg-gray-800 shadow-sm cursor-pointer transition-all"
          :class="selectedIndices.has(i) ? 'border-blue-500 dark:border-blue-400' : 'border-gray-200 dark:border-gray-700'"
          @click="toggleSelect(i, $event)"
        >
          <div class="aspect-square bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
            <img :src="item.preview" class="object-cover w-full h-full" />
          </div>
          <div class="p-2">
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ item.file.name }}</p>
            <div class="flex items-center justify-between mt-1">
              <span class="text-xs" :class="{
                'text-gray-400': item.status === 'pending',
                'text-blue-500': item.status === 'processing',
                'text-green-600 dark:text-green-400': item.status === 'done',
                'text-red-500': item.status === 'error',
              }">
                <template v-if="item.status === 'pending'">{{ formatSize(item.file.size) }}</template>
                <template v-else-if="item.status === 'processing'">处理中...</template>
                <template v-else-if="item.status === 'done'">{{ formatSize(item.resultSize!) }} ✓</template>
                <template v-else>失败</template>
              </span>
              <button v-if="item.status === 'done'" @click.stop="downloadOne(item, i)" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">下载</button>
              <svg v-if="selectedIndices.has(i)" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import JSZip from 'jszip'
import { useImageStore } from '@/stores/imageStore'
import { processImage } from '@/utils/api'
import { formatSize } from '@/utils/format'
import { findPhotoSizePreset, formatPhotoSizeLabel, getPhotoSizeRatio, photoSizePresets } from '@/utils/photoSizes'

const store = useImageStore()

interface BatchItem {
  file: File
  preview: string
  status: 'pending' | 'processing' | 'done' | 'error'
  blob?: Blob
  resultSize?: number
}

const items = ref<BatchItem[]>([])
const pageDragging = ref(false)
const selectedIndices = ref<Set<number>>(new Set())
const lastClickedIndex = ref<number | null>(null)
const batchRatio = ref<number | undefined>(undefined)
const batchWidth = ref(0)
const batchHeight = ref(0)
const batchMaxKB = ref(300)
const batchQuality = ref(85)
const batchFormat = ref('jpg')
const selectedSizePresetId = ref('')
const processing = ref(false)
const downloading = ref(false)
const isSizeLimitEnabled = computed(() => batchMaxKB.value > 0)
const allDone = computed(() => items.value.length > 0 && items.value.every(i => i.status === 'done'))
const selectedAllDone = computed(() => selectedIndices.value.size > 0 && [...selectedIndices.value].every(i => items.value[i]?.status === 'done'))

onMounted(() => {
  items.value = store.batchFiles.map((f: File) => ({
    file: f,
    preview: URL.createObjectURL(f),
    status: 'pending',
  }))
})

onUnmounted(() => {
  items.value.forEach(i => URL.revokeObjectURL(i.preview))
})

function toggleSelect(i: number, e: MouseEvent) {
  const next = new Set(selectedIndices.value)
  if (e.shiftKey && lastClickedIndex.value !== null) {
    const from = Math.min(lastClickedIndex.value, i)
    const to = Math.max(lastClickedIndex.value, i)
    const allSelected = Array.from({ length: to - from + 1 }, (_, k) => from + k).every(idx => next.has(idx))
    for (let idx = from; idx <= to; idx++) {
      allSelected ? next.delete(idx) : next.add(idx)
    }
  } else {
    next.has(i) ? next.delete(i) : next.add(i)
    lastClickedIndex.value = i
  }
  selectedIndices.value = next
}

function selectAll() {
  selectedIndices.value = new Set(items.value.map((_, i) => i))
}

function clearSelection() {
  selectedIndices.value = new Set()
  lastClickedIndex.value = null
}

function deleteSelected() {
  const toDelete = selectedIndices.value
  items.value.filter((_, i) => toDelete.has(i)).forEach(item => URL.revokeObjectURL(item.preview))
  items.value = items.value.filter((_, i) => !toDelete.has(i))
  store.setBatchFiles(items.value.map(i => i.file))
  selectedIndices.value = new Set()
  lastClickedIndex.value = null
}

function onPageDrop(e: DragEvent) {
  pageDragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (!files.length) return
  const newItems: BatchItem[] = files.map(f => ({
    file: f,
    preview: URL.createObjectURL(f),
    status: 'pending',
  }))
  store.setBatchFiles([...store.batchFiles, ...files])
  items.value = [...items.value, ...newItems]
}

async function processSelected() {
  processing.value = true
  for (const i of selectedIndices.value) {
    const item = items.value[i]
    if (!item || item.status === 'done') continue
    item.status = 'processing'
    try {
      const blob = await processImage({
        file: item.file,
        outputWidth: batchWidth.value || undefined,
        outputHeight: batchHeight.value || undefined,
        format: batchFormat.value,
        quality: batchQuality.value,
        maxSizeKB: batchMaxKB.value,
      })
      item.blob = blob
      item.resultSize = blob.size
      item.status = 'done'
    } catch {
      item.status = 'error'
    }
  }
  processing.value = false
}

async function processAll() {
  processing.value = true
  for (const item of items.value) {
    if (item.status === 'done') continue
    item.status = 'processing'
    try {
      const blob = await processImage({
        file: item.file,
        outputWidth: batchWidth.value || undefined,
        outputHeight: batchHeight.value || undefined,
        format: batchFormat.value,
        quality: batchQuality.value,
        maxSizeKB: batchMaxKB.value,
      })
      item.blob = blob
      item.resultSize = blob.size
      item.status = 'done'
    } catch {
      item.status = 'error'
    }
  }
  processing.value = false
}

function applyBatchSizePreset(presetId: string) {
  const preset = findPhotoSizePreset(presetId)
  if (!preset) return

  batchWidth.value = preset.widthPx
  batchHeight.value = preset.heightPx
  batchRatio.value = getPhotoSizeRatio(preset)
}

function downloadOne(item: BatchItem, _i: number) {
  if (!item.blob) return
  const name = item.file.name.replace(/\.[^.]+$/, '') + `_picpress.${batchFormat.value}`
  const url = URL.createObjectURL(item.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadSelected() {
  downloading.value = true
  const zip = new JSZip()
  for (const i of selectedIndices.value) {
    const item = items.value[i]
    if (item?.blob) {
      const name = item.file.name.replace(/\.[^.]+$/, '') + `_picpress.${batchFormat.value}`
      zip.file(name, item.blob)
    }
  }
  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = 'picpress_selected.zip'
  a.click()
  URL.revokeObjectURL(url)
  downloading.value = false
}

async function downloadAll() {
  downloading.value = true
  const zip = new JSZip()
  for (const item of items.value) {
    if (item.blob) {
      const name = item.file.name.replace(/\.[^.]+$/, '') + `_picpress.${batchFormat.value}`
      zip.file(name, item.blob)
    }
  }
  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = 'picpress_batch.zip'
  a.click()
  URL.revokeObjectURL(url)
  downloading.value = false
}
</script>
