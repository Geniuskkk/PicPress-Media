<template>
  <div class="flex flex-col h-[calc(100vh-57px)]">
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
        <div class="relative max-w-full max-h-full">
          <img ref="imgEl" :src="imgSrc" class="max-w-full max-h-full block" style="max-height: calc(100vh - 160px)" @load="initCropper" />
        </div>
      </div>

      <!-- Panel -->
      <div class="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-white dark:bg-gray-900">
        <div class="p-4 space-y-5">
          <!-- 裁剪 -->
          <section>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold leading-none text-gray-700 dark:text-gray-300">
              <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <img :src="chiziIcon" alt="" class="block max-h-full max-w-full object-contain" />
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
                class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500"
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
                <input v-model.number="outputWidth" type="number" min="1" class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500" />
              </div>
              <div class="flex-1">
                <label class="text-xs text-gray-500 dark:text-gray-400">高 (px)</label>
                <input v-model.number="outputHeight" type="number" min="1" class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </section>

          <!-- 旋转翻转 -->
          <section>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold leading-none text-gray-700 dark:text-gray-300">
              <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <img :src="shuaxinIcon2" alt="" class="block max-h-full max-w-full object-contain" />
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
                <img :src="yaSuoIcon" alt="" class="block max-h-full max-w-full object-contain" />
              </span>
              <span>压缩设置</span>
            </h3>
            <label class="text-xs text-gray-500 dark:text-gray-400">目标体积 (KB，0=不限)</label>
            <input v-model.number="maxSizeKB" type="number" min="0" class="mt-0.5 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:border-blue-500" />
            <label class="text-xs text-gray-500 dark:text-gray-400 mt-2 block">质量: {{ quality }}%</label>
            <input v-model.number="quality" type="range" min="1" max="100" class="w-full mt-0.5" />
          </section>

          <!-- 格式 -->
          <section>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold leading-none text-gray-700 dark:text-gray-300">
              <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                <img :src="shuaxinIcon" alt="" class="block max-h-full max-w-full object-contain" />
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

          <button @click="process" :disabled="processing" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium transition-colors">
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
import 'cropperjs/dist/cropper.css'
import { useImageStore } from '@/stores/imageStore'
import { processImage } from '@/utils/api'
import { formatSize } from '@/utils/format'
import { findPhotoSizePreset, formatPhotoSizeLabel, getPhotoSizeRatio, photoSizePresets } from '@/utils/photoSizes'
import chiziIcon from '@/assets/chizi.svg'
import yaSuoIcon from '@/assets/yasuo.svg'
import shuaxinIcon from '@/assets/shuaxin_1.svg'
import shuaxinIcon2 from '@/assets/shuaxin.svg'
const store = useImageStore()
const imgEl = ref<HTMLImageElement>()
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
  cropper?.destroy()
  if (imgSrc.value) URL.revokeObjectURL(imgSrc.value)
})

function initCropper() {
  if (!imgEl.value) return
  cropper?.destroy()
  cropper = new Cropper(imgEl.value, {
    aspectRatio: currentRatio.value,
    viewMode: 1,
    autoCropArea: 1,
    ready() {
      const data = cropper!.getCropBoxData()
      outputWidth.value = Math.round(data.width)
      outputHeight.value = Math.round(data.height)
    },
    cropend() {
      const data = cropper!.getCropBoxData()
      outputWidth.value = Math.round(data.width)
      outputHeight.value = Math.round(data.height)
    },
  })
}

function setRatio(ratio: number | undefined) {
  currentRatio.value = ratio
  cropper?.setAspectRatio(ratio ?? NaN)
}

function applySizePreset(presetId: string) {
  const preset = findPhotoSizePreset(presetId)
  if (!preset) return

  outputWidth.value = preset.widthPx
  outputHeight.value = preset.heightPx
  setRatio(getPhotoSizeRatio(preset))
}

function rotate(deg: number) {
  cropper?.rotate(deg)
}

function flip(dir: 'h' | 'v') {
  if (!cropper) return
  const data = cropper.getData()
  if (dir === 'h') cropper.scaleX(data.scaleX === -1 ? 1 : -1)
  else cropper.scaleY(data.scaleY === -1 ? 1 : -1)
}

async function process() {
  if (!store.currentFile || !cropper) return
  processing.value = true
  processedBlob.value = null

  try {
    const cropData = cropper.getData(true)
    const rotateDeg = Math.round(cropData.rotate ?? 0)
    const isRightAngle = rotateDeg % 90 === 0

    // For arbitrary (non-90°) rotation or any flip, bake the transform into
    // the image pixels via Canvas first so the backend only needs to crop.
    // This guarantees WYSIWYG because the backend receives the exact visual
    // canvas the user sees in cropperjs.
    let fileToSend: File | Blob = store.currentFile
    let cropX = Math.round(cropData.x)
    let cropY = Math.round(cropData.y)
    let cropW = Math.round(cropData.width)
    let cropH = Math.round(cropData.height)

    if (!isRightAngle || cropData.scaleX === -1 || cropData.scaleY === -1) {
      const baked = await bakeTransform(store.currentFile, cropData)
      fileToSend = baked.file
      cropX = baked.cropX
      cropY = baked.cropY
      cropW = baked.cropW
      cropH = baked.cropH
    }

    const blob = await processImage({
      file: fileToSend as File,
      cropX,
      cropY,
      cropW,
      cropH,
      rotate: isRightAngle ? rotateDeg : 0,
      flipH: isRightAngle && cropData.scaleX === -1,
      flipV: isRightAngle && cropData.scaleY === -1,
      outputWidth: outputWidth.value || undefined,
      outputHeight: outputHeight.value || undefined,
      format: format.value,
      quality: quality.value,
      maxSizeKB: maxSizeKB.value || 0,
    })
    processedBlob.value = blob
    processedSize.value = blob.size
  } catch (e) {
    console.error(e)
    alert('处理失败，请重试')
  } finally {
    processing.value = false
  }
}

/**
 * Bake cropperjs rotation/flip into a new image via Canvas, and remap the
 * crop rectangle from the original image coordinate space to the baked
 * canvas coordinate space.
 */
async function bakeTransform(
  sourceFile: File,
  cropData: Cropper.Data,
): Promise<{ file: File; cropX: number; cropY: number; cropW: number; cropH: number }> {
  const img = await loadImage(sourceFile)
  const rad = ((cropData.rotate ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // Bounding box of the rotated image
  const w = img.naturalWidth
  const h = img.naturalHeight
  const newW = Math.ceil(w * Math.abs(cos) + h * Math.abs(sin))
  const newH = Math.ceil(w * Math.abs(sin) + h * Math.abs(cos))

  const canvas = document.createElement('canvas')
  canvas.width = newW
  canvas.height = newH
  const ctx = canvas.getContext('2d')!

  // Move origin to canvas center, apply rotation + flip, draw image centered
  ctx.translate(newW / 2, newH / 2)
  ctx.rotate(rad)
  ctx.scale(cropData.scaleX ?? 1, cropData.scaleY ?? 1)
  ctx.drawImage(img, -w / 2, -h / 2)

  // Map crop rect from original image space to baked canvas space
  const cx = cropData.x + cropData.width / 2
  const cy = cropData.y + cropData.height / 2
  const rx = cx * cos + cy * sin
  const ry = -cx * sin + cy * cos
  const scaleX = cropData.scaleX ?? 1
  const scaleY = cropData.scaleY ?? 1

  const bakedCx = newW / 2 + rx * scaleX
  const bakedCy = newH / 2 + ry * scaleY
  const bakedW = cropData.width * Math.abs(scaleX)
  const bakedH = cropData.height * Math.abs(scaleY)

  const cropX = Math.max(0, Math.round(bakedCx - bakedW / 2))
  const cropY = Math.max(0, Math.round(bakedCy - bakedH / 2))
  const cropW = Math.min(newW - cropX, Math.round(bakedW))
  const cropH = Math.min(newH - cropY, Math.round(bakedH))

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), sourceFile.type || 'image/png'),
  )
  if (!blob) throw new Error('Canvas toBlob failed')

  const name = sourceFile.name.replace(/\.[^.]+$/, '') + '_baked.' + (sourceFile.type.split('/')[1] || 'png')
  const file = new File([blob], name, { type: blob.type })
  return { file, cropX, cropY, cropW, cropH }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
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
