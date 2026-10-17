<template>
  <div class="flex flex-col h-[calc(100vh-61px)]">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <RouterLink to="/" class="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        返回
      </RouterLink>
      <div class="flex items-center gap-2">
        <span v-if="originalSize" class="text-xs text-gray-400">
          原图: {{ formatSize(originalSize) }}
          <template v-if="processedSize"> → 处理后: <span class="text-green-600 dark:text-green-400 font-medium">{{ formatSize(processedSize) }}</span></template>
        </span>
        <button
          @click="download"
          :disabled="!processedBlob && !store.currentFile"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
        >下载</button>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Cropper Canvas -->
      <div class="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-hidden p-4">
        <div ref="cropperHost" class="relative w-full h-full min-w-0 min-h-0">
          <img ref="imgEl" :src="imgSrc" class="max-w-full max-h-full block" style="max-height: calc(100vh - 160px)" @load="initCropper" />
        </div>
      </div>

      <!-- Panel -->
      <div class="w-72 shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900">
        <div class="p-4 space-y-5">
          <!-- 裁剪 -->
          <section>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold leading-none text-gray-700 dark:text-gray-300">
              <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <Crop class="h-4 w-4" aria-hidden="true" />
              </span>
              <span>裁剪比例</span>
            </h3>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="r in ratios" :key="r.label" @click="setRatio(r.value)"
                class="px-2.5 py-1 text-xs rounded border transition-colors"
                :class="currentRatio === r.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'"
              >{{ r.label }}</button>
            </div>
            <div class="mt-2">
              <label class="text-xs text-gray-500 dark:text-gray-400">常用尺寸</label>
              <select
                v-model="selectedSizePresetId"
                @change="applySizePreset(selectedSizePresetId)"
                class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-hidden focus:border-blue-500"
              >
                <option value="">自定义</option>
                <option v-for="preset in photoSizePresets" :key="preset.id" :value="preset.id">
                  {{ formatPhotoSizeLabel(preset) }}
                </option>
              </select>
            </div>
            <div class="mt-2 flex gap-2">
              <div class="flex-1">
                <label class="text-xs text-gray-500 dark:text-gray-400">宽 (px)</label>
                <input v-model.number="outputWidth" type="number" min="1" class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-hidden focus:border-blue-500" />
              </div>
              <div class="flex-1">
                <label class="text-xs text-gray-500 dark:text-gray-400">高 (px)</label>
                <input v-model.number="outputHeight" type="number" min="1" class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-hidden focus:border-blue-500" />
              </div>
            </div>
          </section>

          <!-- 旋转翻转 -->
          <section>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold leading-none text-gray-700 dark:text-gray-300">
              <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <RotateCw class="h-4 w-4" aria-hidden="true" />
              </span>
              <span>旋转 / 翻转</span>
            </h3>
            <div class="flex gap-2">
              <button @click="rotate(-90)" class="flex-1 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:border-blue-400 transition-colors">↺ 逆时针</button>
              <button @click="rotate(90)"  class="flex-1 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:border-blue-400 transition-colors">↻ 顺时针</button>
            </div>
            <div class="flex gap-2 mt-1.5">
              <button @click="flip('h')" class="flex-1 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:border-blue-400 transition-colors">↔ 水平</button>
              <button @click="flip('v')" class="flex-1 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:border-blue-400 transition-colors">↕ 垂直</button>
            </div>
          </section>

          <!-- 压缩 -->
          <section>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold leading-none text-gray-700 dark:text-gray-300">
              <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <Minimize2 class="h-4 w-4" aria-hidden="true" />
              </span>
              <span>压缩设置</span>
            </h3>
            <label class="text-xs text-gray-500 dark:text-gray-400">目标体积 (KB，0=不限)</label>
            <input v-model.number="maxSizeKB" type="number" min="0" class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-hidden focus:border-blue-500" />
            <label class="text-xs text-gray-500 dark:text-gray-400 mt-2 block">质量: {{ quality }}%</label>
            <input v-model.number="quality" type="range" min="1" max="100" class="w-full mt-0.5" />
          </section>

          <!-- 格式 -->
          <section>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold leading-none text-gray-700 dark:text-gray-300">
              <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <FileImage class="h-4 w-4" aria-hidden="true" />
              </span>
              <span>输出格式</span>
            </h3>
            <div class="flex gap-1.5">
              <button v-for="f in formats" :key="f" @click="format = f"
                class="flex-1 py-1.5 text-xs rounded border transition-colors uppercase font-medium"
                :class="format === f ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'"
              >{{ f }}</button>
            </div>
          </section>

          <p v-if="errorMessage" role="alert" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
          <button @click="process" :disabled="processing || !cropperReady" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors">
            {{ processing ? '处理中...' : '立即处理' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import Cropper from 'cropperjs'
import { useImageStore } from '@/stores/imageStore'
import { processImage } from '@/utils/api'
import { formatSize } from '@/utils/format'
import { findPhotoSizePreset, formatPhotoSizeLabel, getPhotoSizeRatio, photoSizePresets } from '@/utils/photoSizes'
import { Crop, FileImage, Minimize2, RotateCw } from '@lucide/vue'
const store = useImageStore()
const imgEl = ref<HTMLImageElement>()
const cropperHost = ref<HTMLDivElement>()
const cropperReady = ref(false)
const errorMessage = ref('')
const imgSrc = ref('')
const processing = ref(false)
const processedBlob = ref<Blob | null>(null)
const originalSize = ref(0)
const processedSize = ref(0)

// Cropper params
const currentRatio = ref<number | undefined>(undefined)
const outputWidth = ref(0)
const outputHeight = ref(0)
const selectedSizePresetId = ref('')
let cropper: Cropper | null = null
let cropperResizeObserver: ResizeObserver | null = null

// Compression
const quality = ref(85)
const maxSizeKB = ref(0)
const format = ref('jpg')
const formats = ['jpg', 'png', 'webp', 'avif']

const ratios = [
  { label: '自由', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '3:4', value: 3 / 4 },
]

onMounted(() => {
  if (!store.currentFile) return
  originalSize.value = store.currentFile.size
  imgSrc.value = URL.createObjectURL(store.currentFile)

  if (store.preset) {
    currentRatio.value = store.preset.ratio
    maxSizeKB.value = store.preset.maxSizeKB
    format.value = store.preset.format
  }
})

onUnmounted(() => {
  cropperResizeObserver?.disconnect()
  cropper?.destroy()
  cropper = null
  if (imgSrc.value) URL.revokeObjectURL(imgSrc.value)
})

async function initCropper() {
  if (!imgEl.value || !cropperHost.value) return
  cropperResizeObserver?.disconnect()
  cropper?.destroy()
  cropperReady.value = false
  errorMessage.value = ''
  const instance = new Cropper(imgEl.value, { container: cropperHost.value })
  cropper = instance
  const image = instance.getCropperImage()!
  const selection = instance.getCropperSelection()!
  image.rotatable = true
  image.scalable = true
  image.translatable = false
  image.initialFit = 'contain'
  selection.precise = true
  selection.aspectRatio = currentRatio.value ?? NaN
  try {
    await image.$ready()
    if (cropper !== instance || !cropperHost.value?.isConnected) return
    centerImage()
    fitSelection()
    let resizing = false
    const relativeCrop = () => {
      const bounds = imageBounds()!
      return { x: (selection.x - bounds.x) / bounds.width, y: (selection.y - bounds.y) / bounds.height,
        width: selection.width / bounds.width, height: selection.height / bounds.height }
    }
    let crop = relativeCrop()
    selection.addEventListener('change', (event) => {
      if (resizing) return
      const detail = (event as CustomEvent<{ x: number; y: number; width: number; height: number }>).detail
      const bounds = imageBounds()
      if (!bounds) return
      // Keep the selection inside the visible image, including after rotation.
      const tolerance = 0.5
      if (detail.x < bounds.x - tolerance || detail.y < bounds.y - tolerance ||
          detail.x + detail.width > bounds.x + bounds.width + tolerance ||
          detail.y + detail.height > bounds.y + bounds.height + tolerance) {
        event.preventDefault()
        return
      }
      crop = { x: (detail.x - bounds.x) / bounds.width, y: (detail.y - bounds.y) / bounds.height,
        width: detail.width / bounds.width, height: detail.height / bounds.height }
      if (!selectedSizePresetId.value) {
        const scale = imageScale()
        outputWidth.value = Math.max(1, Math.round(detail.width / scale))
        outputHeight.value = Math.max(1, Math.round(detail.height / scale))
      }
    })
    cropperReady.value = true
    const canvas = instance.getCropperCanvas()!
    let previousWidth = canvas.clientWidth
    let previousHeight = canvas.clientHeight
    cropperResizeObserver = new ResizeObserver(() => {
      const width = canvas.clientWidth, height = canvas.clientHeight
      if (!width || !height || (width === previousWidth && height === previousHeight)) return
      previousWidth = width
      previousHeight = height
      // Resize the preview without changing the crop in source coordinates or
      // the user's requested export dimensions.
      resizing = true
      const output = [outputWidth.value, outputHeight.value] as const
      centerImage()
      const after = imageBounds()!
      selection.$change(after.x + crop.x * after.width, after.y + crop.y * after.height,
        crop.width * after.width, crop.height * after.height)
      ;[outputWidth.value, outputHeight.value] = output
      resizing = false
    })
    cropperResizeObserver.observe(canvas)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '无法加载图片'
  }
}

function centerImage() {
  const image = cropper?.getCropperImage()
  if (!image) return
  // Cropper's $center uses $move, which is disabled by translatable=false.
  // Allow programmatic centering while keeping mouse image dragging disabled.
  const translatable = image.translatable
  image.translatable = true
  image.$center('contain')
  image.translatable = translatable
}

function imageScale() {
  const matrix = cropper?.getCropperImage()?.$getTransform()
  return matrix ? Math.hypot(matrix[0]!, matrix[1]!) || 1 : 1
}

function imageBounds() {
  const image = cropper?.getCropperImage()?.getBoundingClientRect()
  const canvas = cropper?.getCropperCanvas()?.getBoundingClientRect()
  if (!image || !canvas) return null
  return { x: image.left - canvas.left, y: image.top - canvas.top, width: image.width, height: image.height }
}

function fitSelection() {
  const bounds = imageBounds()
  const selection = cropper?.getCropperSelection()
  if (!bounds || !selection) return
  let { width, height } = bounds
  const ratio = currentRatio.value
  if (ratio) {
    if (width / height > ratio) width = height * ratio
    else height = width / ratio
  }
  selection.$change(bounds.x + (bounds.width - width) / 2, bounds.y + (bounds.height - height) / 2, width, height)
  if (!selectedSizePresetId.value) {
    outputWidth.value = Math.max(1, Math.round(width / imageScale()))
    outputHeight.value = Math.max(1, Math.round(height / imageScale()))
  }
}

function setRatio(ratio: number | undefined) {
  currentRatio.value = ratio
  const selection = cropper?.getCropperSelection()
  if (selection) selection.aspectRatio = ratio ?? NaN
  fitSelection()
}

function applySizePreset(presetId: string) {
  const preset = findPhotoSizePreset(presetId)
  if (!preset) return

  outputWidth.value = preset.widthPx
  outputHeight.value = preset.heightPx
  setRatio(getPhotoSizeRatio(preset))
}

function rotate(deg: number) {
  const image = cropper?.getCropperImage()
  image?.$rotate(`${deg}deg`)
  centerImage()
  fitSelection()
}

function flip(dir: 'h' | 'v') {
  const image = cropper?.getCropperImage()
  if (!image) return
  // Flip in screen coordinates, even after a quarter-turn rotation.
  const [a, b, c, d, e, f] = image.$getTransform() as [number, number, number, number, number, number]
  image.$setTransform(dir === 'h' ? -a : a, dir === 'v' ? -b : b,
    dir === 'h' ? -c : c, dir === 'v' ? -d : d, e, f)
}

async function process() {
  const selection = cropper?.getCropperSelection()
  if (!store.currentFile || !selection || !cropperReady.value) return
  processing.value = true
  processedBlob.value = null
  processedSize.value = 0
  errorMessage.value = ''

  try {
    // Export at source resolution, not CSS preview resolution. PNG avoids a
    // lossy intermediate encode. The backend only resizes/converts/compresses;
    // rotation, flip and crop are already represented by Cropper's canvas.
    const canvas = await selection.$toCanvas({
      width: Math.max(1, Math.round(selection.width / imageScale())),
      height: Math.max(1, Math.round(selection.height / imageScale())),
    })
    const cropped = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法导出裁剪区域')), 'image/png')
    })
    const blob = await processImage({
      file: new File([cropped], 'crop.png', { type: 'image/png' }),
      outputWidth: outputWidth.value || undefined,
      outputHeight: outputHeight.value || undefined,
      format: format.value,
      quality: quality.value,
      maxSizeKB: maxSizeKB.value || 0,
    })
    processedBlob.value = blob
    processedSize.value = blob.size
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '处理失败，请重试'
  } finally {
    processing.value = false
  }
}

function download() {
  const blob = processedBlob.value
  if (!blob && store.currentFile) {
    // download original if not processed yet
    const url = URL.createObjectURL(store.currentFile)
    triggerDownload(url, store.currentFile.name)
    URL.revokeObjectURL(url)
    return
  }
  if (!blob) return
  const ext = format.value
  const name = (store.currentFile?.name.replace(/\.[^.]+$/, '') ?? 'image') + `_picpress.${ext}`
  const url = URL.createObjectURL(blob)
  triggerDownload(url, name)
  URL.revokeObjectURL(url)
}

function triggerDownload(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}
</script>
