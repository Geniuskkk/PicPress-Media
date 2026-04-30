// When running inside Electron, the Go sidecar listens on a dynamic port
// that is injected by the preload script. Fall back to '' (relative path,
// handled by Vite's dev-server proxy) when running in a plain browser.
const BASE: string = window.electronAPI?.apiPort
  ? `http://127.0.0.1:${window.electronAPI.apiPort}`
  : ''

export interface ProcessParams {
  file: File
  cropX?: number
  cropY?: number
  cropW?: number
  cropH?: number
  rotate?: number
  flipH?: boolean
  flipV?: boolean
  outputWidth?: number
  outputHeight?: number
  format?: string
  quality?: number
  maxSizeKB?: number
}

export interface VideoProcessParams {
  file: File
  format?: string
  quality?: number
  maxSizeMB?: number
}

export async function processImage(params: ProcessParams): Promise<Blob> {
  const form = new FormData()
  form.append('file', params.file)

  if (params.cropX !== undefined) form.append('crop_x', String(params.cropX))
  if (params.cropY !== undefined) form.append('crop_y', String(params.cropY))
  if (params.cropW !== undefined) form.append('crop_w', String(params.cropW))
  if (params.cropH !== undefined) form.append('crop_h', String(params.cropH))
  if (params.rotate) form.append('rotate', String(params.rotate))
  if (params.flipH) form.append('flip_h', '1')
  if (params.flipV) form.append('flip_v', '1')
  if (params.outputWidth) form.append('output_width', String(params.outputWidth))
  if (params.outputHeight) form.append('output_height', String(params.outputHeight))
  if (params.format) form.append('format', params.format)
  if (params.quality !== undefined) form.append('quality', String(params.quality))
  if (params.maxSizeKB !== undefined) form.append('max_size_kb', String(params.maxSizeKB))

  const resp = await fetch(BASE + '/api/process', { method: 'POST', body: form })
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText)
    throw new Error(msg)
  }
  return resp.blob()
}

export async function processVideo(params: VideoProcessParams): Promise<Blob> {
  const form = new FormData()
  form.append('file', params.file)

  if (params.format) form.append('format', params.format)
  if (params.quality !== undefined) form.append('quality', String(params.quality))
  if (params.maxSizeMB !== undefined) form.append('max_size_mb', String(params.maxSizeMB))

  const resp = await fetch(BASE + '/api/video/process', { method: 'POST', body: form })
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText)
    throw new Error(msg)
  }
  return resp.blob()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const resp = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(2000) })
    return resp.ok
  } catch {
    return false
  }
}
