import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Preset {
  ratio?: number
  maxSizeKB: number
  format: string
  label?: string
}

export const useImageStore = defineStore('image', () => {
  const currentFile = ref<File | null>(null)
  const currentVideoFile = ref<File | null>(null)
  const batchFiles = ref<File[]>([])
  const preset = ref<Preset | null>(null)

  function setSingleFile(file: File) {
    currentFile.value = file
    currentVideoFile.value = null
    batchFiles.value = []
  }

  function setVideoFile(file: File) {
    currentVideoFile.value = file
    currentFile.value = null
    batchFiles.value = []
  }

  function setBatchFiles(files: File[]) {
    batchFiles.value = files
    currentFile.value = null
    currentVideoFile.value = null
  }

  function setPreset(p: Preset) {
    preset.value = p
  }

  function clear() {
    currentFile.value = null
    currentVideoFile.value = null
    batchFiles.value = []
    preset.value = null
  }

  return { currentFile, currentVideoFile, batchFiles, preset, setSingleFile, setVideoFile, setBatchFiles, setPreset, clear }
})
