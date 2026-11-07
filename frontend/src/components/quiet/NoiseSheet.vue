<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppSheet from './AppSheet.vue'
import AppIcon from '../AppIcon.vue'
import { createNoiseSession } from '../../lib/noiseClient.js'
import { sensoryApi } from '../../lib/sensoryApi.js'
const props = defineProps({ city: { type: Object, required: true } })
const emit = defineEmits(['close', 'notify', 'shared'])
const status = ref('idle'), message = ref(''), sample = ref(null), samples = ref([]), summary = ref(null), consent = ref(false), uploading = ref(false), uploaded = ref(false)
const running = computed(() => ['waiting', 'measuring'].includes(status.value))
const progress = computed(() => Math.min(100, (sample.value?.elapsedMs || 0) / 150))
let session, observedAt
function start() {
  if (running.value) return
  sample.value = null; samples.value = []; summary.value = null; message.value = ''; consent.value = false; uploaded.value = false
  status.value = 'waiting'; observedAt = new Date().toISOString()
  try {
    session = createNoiseSession({ host: window, onStatus: result => {
      status.value = result.status; message.value = result.message || ''; summary.value = result.summary || null
    }, onSample: value => { sample.value = value; samples.value = [...samples.value.slice(-29), value] } })
  } catch (reason) { status.value = 'unsupported'; message.value = reason.message }
}
function stop() { session?.stop() }
function background() { if (document.hidden && running.value) { stop(); message.value = '頁面進入背景，已請 App 停止麥克風。' } }
async function upload() {
  if (!consent.value || !summary.value || uploading.value || uploaded.value) return
  uploading.value = true; message.value = ''
  try {
    await sensoryApi.createMeasurement({ protocolVersion: 1, sessionId: session.sessionId, source: 'native_microphone', location: props.city.reportLocation.value, observedAt, consent: true, ...summary.value })
    uploaded.value = true
    emit('notify', props.city.mode === 'demo' ? '已完成摘要分享示範，沒有上傳資料。' : '已分享音量摘要，謝謝你的參與。')
    emit('shared')
  } catch (reason) { message.value = reason.message }
  finally { uploading.value = false }
}
onMounted(() => { document.addEventListener('visibilitychange', background); window.addEventListener('pagehide', stop) })
onUnmounted(() => { stop(); document.removeEventListener('visibilitychange', background); window.removeEventListener('pagehide', stop) })
</script>
<template>
  <AppSheet title="聽見此刻的環境" :busy="uploading" @close="!uploading && $emit('close')">
    <p class="noise-intro">留 15 秒，感受周圍的聲音。<br>只有你按下開始，App 才會請求麥克風權限。</p>
    <div class="noise-meter" :class="{ running }"><div class="noise-halo"></div><span class="q-eyebrow">{{ status === 'completed' ? 'MEASUREMENT COMPLETE' : running ? 'LISTENING TO YOUR SURROUNDINGS' : 'A MOMENT TO LISTEN' }}</span><strong>{{ summary?.averageDbfs ?? sample?.averageDbfs ?? '—' }}<small>dBFS</small></strong><p>{{ status === 'waiting' ? '等待 App 與麥克風權限…' : status === 'measuring' ? `${((sample?.elapsedMs || 0) / 1000).toFixed(1)} / 15 秒` : status === 'completed' ? `${summary.sampleCount} 個有效樣本 · 峰值 ${summary.peakDbfs} dBFS` : '裝置音量尺度・未校準' }}</p><div class="noise-wave" aria-hidden="true"><i v-for="(value, index) in samples" :key="index" :style="{ height: `${Math.max(3, (value.averageDbfs + 160) / 160 * 58)}px` }"></i><span v-if="!samples.length">量測開始後才會出現音量波形</span></div><div class="noise-progress" role="progressbar" aria-label="量測進度" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${progress}%` }"></i></div></div>
    <p class="noise-explanation"><AppIcon name="shield" :size="17"/><span>這是未校準的 <b>dBFS</b>，無法代表環境分貝 dBA，也不與其他手機直接比較。不保存或上傳錄音。</span></p>
    <p v-if="message" class="q-error" role="status">{{ message }}</p>
    <button v-if="running" class="q-secondary full" @click="stop">停止量測</button><button v-else class="q-primary full" @click="start"><AppIcon name="wave" :size="19"/>{{ summary ? '重新量測 15 秒' : '開始量測 15 秒' }}</button>
    <div v-if="summary" class="noise-share"><label class="q-checkbox"><input v-model="consent" type="checkbox" :disabled="uploading || uploaded"/><span>我同意分享本次音量摘要與{{ city.reportLocation.value.label }}<small>只分享統計數值、樣本數、時間與上方位置，不含聲音。這與麥克風權限分開決定。</small></span></label><button class="q-secondary full" :disabled="!consent || uploading || uploaded" @click="upload">{{ uploaded ? '已完成分享' : uploading ? '分享中…' : city.mode === 'demo' ? '示範分享摘要' : '分享本次摘要' }}</button></div>
    <p class="microcopy">需要 Flutter App 實作感測 handler，網頁不會產生假音量。</p>
  </AppSheet>
</template>
