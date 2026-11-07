<script setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import QuietApp from './components/quiet/QuietApp.vue'
import { startVersionChecker } from './lib/versionChecker.js'
const DebugView = defineAsyncComponent(() => import('./components/DebugView.vue'))
const debugOpen = ref(window.location.hash === '#debug')
const toastMessage = ref('')
const updateAvailable = ref(false)
const debugCommands = Object.freeze({ open: openDebug, close: closeDebug })
let previousDebugCommand, toastTimer, reloadTimer
let stopVersionCheck = () => {}
function syncDebugHash() { debugOpen.value = window.location.hash === '#debug' }
function openDebug() { window.location.hash = 'debug'; debugOpen.value = true }
function closeDebug() {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  debugOpen.value = false
}
function handleDebugShortcut(event) {
  if (event.ctrlKey && event.altKey && event.code === 'KeyD' && !event.repeat) {
    event.preventDefault()
    if (debugOpen.value) closeDebug()
    else openDebug()
  }
}
function showToast(message) {
  clearTimeout(toastTimer); toastMessage.value = message
  toastTimer = setTimeout(() => { toastMessage.value = '' }, 3500)
}
onMounted(() => {
  window.addEventListener('hashchange', syncDebugHash)
  window.addEventListener('keydown', handleDebugShortcut)
  previousDebugCommand = window.cityDebug; window.cityDebug = debugCommands
  stopVersionCheck = startVersionChecker({ onVersionMismatch: () => {
    updateAvailable.value = true
    reloadTimer = window.setTimeout(() => window.location.reload(), 10_000)
  } })
})
onUnmounted(() => {
  window.removeEventListener('hashchange', syncDebugHash)
  window.removeEventListener('keydown', handleDebugShortcut)
  if (window.cityDebug === debugCommands) {
    if (previousDebugCommand === undefined) delete window.cityDebug
    else window.cityDebug = previousDebugCommand
  }
  clearTimeout(toastTimer); clearTimeout(reloadTimer); stopVersionCheck()
})
</script>
<template>
  <main class="app-shell">
    <DebugView v-if="debugOpen" @close="closeDebug" />
    <QuietApp v-else @notify="showToast" />
    <div v-if="updateAvailable" class="toast" role="status" aria-live="polite">偵測到新版本，10 秒後自動重新整理頁面。</div>
    <Transition name="toast"><div v-if="toastMessage && !updateAvailable" class="toast" role="status" aria-live="polite">{{ toastMessage }}</div></Transition>
  </main>
</template>
