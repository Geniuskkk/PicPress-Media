import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import Home from './views/Home.vue'
import Editor from './views/Editor.vue'
import Batch from './views/Batch.vue'
import Video from './views/Video.vue'

const router = createRouter({
  // Electron packages the renderer as file://.../index.html, so hash history
  // keeps the default route stable in both dev and production builds.
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/editor', component: Editor },
    { path: '/batch', component: Batch },
    { path: '/video', component: Video },
  ],
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

