<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppSheet from './AppSheet.vue'
import AppIcon from '../AppIcon.vue'
import { createNoiseSession } from '../../lib/noiseClient.js'
import { sensoryApi } from '../../lib/sensoryApi.js'
import { measurementPayload } from '../../lib/sensorySubmission.js'
const props = defineProps({ city: { type: Object, required: true } })
const emit = defineEmits(['close', 'notify', 'shared'])
const status = ref('idle'), message = ref(''), sample = ref(null), samples = ref([]), summary = ref(null), consent = ref(false), uploading = ref(false), uploaded = ref(false)
// 位置在按下開始時凍結；之後更改位置不影響本次 session 的分享內容。
const sessionLocation = ref(null)
const running = computed(() => ['waiting', 'measuring'].includes(status.value))
const progress = computed(() => Math.min(100, (sample.value?.elapsedMs || 0) / 150))
let session, observedAt, payload
function start() {
  if (running.value) return
  sample.value = null; samples.value = []; summary.value = null; message.value = ''; consent.value = false; uploaded.value = false
  status.value = 'waiting'; observedAt = null; payload = null
  sessionLocation.value = { ...props.city.reportLocation.value }
  try {
    session = createNoiseSession({ host: window, onStatus: result => {
      status.value = result.status; message.value = result.message || ''; summary.value = result.summary || null
      if (result.startedAt) observedAt = result.startedAt
    }, onSample: value => { sample.value = value; samples.value = [...samples.value.slice(-29), value] } })
  } catch (reason) { status.value = 'unsupported'; message.value = reason.message }
}
function stop() { session?.stop() }
function background() { if (document.hidden && running.value) { stop(); message.value = '頁面進入背景，已停止麥克風。' } }
async function upload() {
  if (!consent.value || !summary.value || !observedAt || uploading.value || uploaded.value) return
  uploading.value = true; message.value = ''
  try {
    // 同一 session 重送沿用同一份 payload，後端可依 sessionId 冪等。
    payload ||= measurementPayload({ sessionId: session.sessionId, location: sessionLocation.value, observedAt, summary: summary.value })
    const result = await sensoryApi.createMeasurement(payload)
    uploaded.value = true
    emit('notify', result.meta?.mock ? '後端量測服務暫時無法連線，本次摘要僅模擬分享，未上傳。' : '已分享音量摘要，謝謝你的參與。')
    emit('shared')
  } catch (reason) { message.value = reason.message }
  finally { uploading.value = false }
}
onMounted(() => { document.addEventListener('visibilitychange', background); window.addEventListener('pagehide', stop) })
onUnmounted(() => { stop(); document.removeEventListener('visibilitychange', background); window.removeEventListener('pagehide', stop) })
</script>
<template>
  <AppSheet title="聽見此刻的環境" :busy="uploading" @close="!uploading && $emit('close')">
    <p class="noise-intro">留 15 秒，感受周圍的聲音。<br>只有你按下開始，才會請求麥克風權限。</p>
    <div class="noise-meter" :class="{ running }"><div class="noise-halo"></div><span class="q-eyebrow">{{ status === 'completed' ? '本次量測完成' : running ? '正在感受周圍的聲音' : '準備開始環境音量量測' }}</span><strong>{{ summary?.averageDbfs ?? sample?.averageDbfs ?? '—' }}<small>dBFS</small></strong><p>{{ status === 'waiting' ? '等待麥克風權限…' : status === 'measuring' ? `${((sample?.elapsedMs || 0) / 1000).toFixed(1)} / 15 秒` : status === 'completed' ? `${summary.sampleCount} 個有效樣本 · 峰值 ${summary.peakDbfs} dBFS` : '裝置音量尺度・未校準' }}</p><div class="noise-wave" aria-hidden="true"><i v-for="(value, index) in samples" :key="index" :style="{ height: `${Math.max(3, (value.averageDbfs + 160) / 160 * 58)}px` }"></i><span v-if="!samples.length">量測開始後才會出現音量波形</span></div><div class="noise-progress" role="progressbar" aria-label="量測進度" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${progress}%` }"></i></div></div>
    <p class="noise-explanation"><AppIcon name="shield" :size="17"/><span>這是未校準的 <b>dBFS</b>，無法代表環境分貝 dBA，也不與其他手機直接比較。不保存或上傳錄音。</span></p>
    <p v-if="message" class="q-error" role="status">{{ message }}</p>
    <button v-if="running" class="q-secondary full" @click="stop">停止量測</button><button v-else class="q-primary full" @click="start"><AppIcon name="wave" :size="19"/>{{ summary ? '重新量測 15 秒' : '開始量測 15 秒' }}</button>
    <div v-if="summary" class="noise-share"><label class="q-checkbox"><input v-model="consent" type="checkbox" :disabled="uploading || uploaded"/><span>我同意分享本次音量摘要與{{ sessionLocation?.label }}<small>只分享統計數值、樣本數、開始量測時間與開始時的位置，不含聲音。這與麥克風權限分開決定。</small></span></label><button class="q-secondary full" :disabled="!consent || uploading || uploaded" @click="upload">{{ uploaded ? '已完成分享' : uploading ? '分享中…' : '分享本次摘要' }}</button></div>
    <p class="microcopy">音量在手機上即時計算，只保留數值統計。城市通 App 內需允許麥克風權限。</p>
  </AppSheet>
</template>
