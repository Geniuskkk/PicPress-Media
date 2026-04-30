<template>
  <div :class="{ dark: isDark }" class="h-full">
    <div class="min-h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <!-- On macOS the traffic-light buttons (close/minimise/fullscreen) float over
           the window at x≈16 and span ~74 px. Add left padding so they don't overlap. -->
      <nav
        class="border-b border-gray-200 dark:border-gray-700 py-3 flex items-center justify-between"
        :class="isMacOS ? 'pl-24 pr-4' : 'px-4'"
      >
        <RouterLink to="/" class="flex items-center gap-2 font-bold text-lg text-blue-600 dark:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          PicPress Media
        </RouterLink>
        <div class="flex items-center gap-3">
          <RouterLink to="/" class="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">单图处理</RouterLink>
          <RouterLink to="/batch" class="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">批量处理</RouterLink>
          <RouterLink to="/video" class="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">视频压缩</RouterLink>
          <button @click="toggleDark" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" :title="isDark ? '切换浅色' : '切换深色'">
            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
      </nav>
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

// Detect macOS inside Electron (traffic-light buttons need extra nav padding)
const isMacOS =
  typeof window !== 'undefined' &&
  !!(window as unknown as { electronAPI?: unknown }).electronAPI &&
  navigator.userAgent.toLowerCase().includes('mac')

const isDark = ref(localStorage.getItem('theme') === 'dark')

function toggleDark() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
</script>

