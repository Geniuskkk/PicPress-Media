export interface PhotoSizePreset {
  id: string
  label: string
  widthMm: number
  heightMm: number
  widthPx: number
  heightPx: number
  dpi: number
}

export const photoSizePresets: PhotoSizePreset[] = [
  { id: 'small-one-inch', label: '小一寸', widthMm: 22, heightMm: 32, widthPx: 260, heightPx: 378, dpi: 300 },
  { id: 'one-inch', label: '一寸', widthMm: 25, heightMm: 35, widthPx: 295, heightPx: 413, dpi: 300 },
  { id: 'large-one-inch', label: '大一寸', widthMm: 33, heightMm: 48, widthPx: 389, heightPx: 566, dpi: 300 },
  { id: 'small-two-inch', label: '小二寸', widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531, dpi: 300 },
  { id: 'two-inch', label: '二寸', widthMm: 35, heightMm: 49, widthPx: 413, heightPx: 579, dpi: 300 },
  { id: 'large-two-inch', label: '大二寸', widthMm: 35, heightMm: 53, widthPx: 413, heightPx: 626, dpi: 300 },
  { id: 'three-inch', label: '三寸', widthMm: 55, heightMm: 84, widthPx: 649, heightPx: 991, dpi: 300 },
  { id: 'five-inch', label: '五寸', widthMm: 89, heightMm: 127, widthPx: 1050, heightPx: 1499, dpi: 300 },
  { id: 'id-card', label: '身份证 / 社保卡 / 居住证', widthMm: 26, heightMm: 32, widthPx: 307, heightPx: 378, dpi: 300 },
  { id: 'driver-license', label: '驾驶证', widthMm: 22, heightMm: 32, widthPx: 260, heightPx: 378, dpi: 300 },
  { id: 'teacher-cert', label: '教师资格证', widthMm: 30, heightMm: 40, widthPx: 354, heightPx: 472, dpi: 300 },
  { id: 'graduate-photo', label: '毕业生照', widthMm: 33, heightMm: 48, widthPx: 389, heightPx: 566, dpi: 300 },
  { id: 'cn-passport', label: '中国护照', widthMm: 33, heightMm: 48, widthPx: 389, heightPx: 566, dpi: 300 },
  { id: 'us-visa', label: '赴美签证', widthMm: 51, heightMm: 51, widthPx: 602, heightPx: 602, dpi: 300 },
]

export function findPhotoSizePreset(id: string) {
  return photoSizePresets.find((preset) => preset.id === id)
}

export function getPhotoSizeRatio(preset: PhotoSizePreset) {
  return preset.widthPx / preset.heightPx
}

export function formatPhotoSizeLabel(preset: PhotoSizePreset) {
  return `${preset.label} (${preset.widthPx}x${preset.heightPx}px / ${preset.widthMm}x${preset.heightMm}mm)`
}