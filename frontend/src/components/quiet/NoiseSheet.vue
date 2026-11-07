<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppSheet from './AppSheet.vue'
import AppIcon from '../AppIcon.vue'
import { createNoiseSession } from '../../lib/noiseClient.js'
import { sensoryApi } from '../../lib/sensoryApi.js'
import { measurementPayload } from '../../lib/sensorySubmission.js'
import { createNoiseEntry } from '../../lib/noiseHistory.js'
import { estimateDb, noiseLevel, readDbOffset } from '../../lib/noiseLevel.js'
const props = defineProps({ city: { type: Object, required: true } })
const emit = defineEmits(['close', 'notify', 'shared'])
const status = ref('idle'), message = ref(''), sample = ref(null), samples = ref([]), summary = ref(null), consent = ref(false), uploading = ref(false), uploaded = ref(false)
// 位置在按下開始時凍結；之後更改位置不影響本次 session 的分享內容。
const sessionLocation = ref(null)
const running = computed(() => ['waiting', 'measuring'].includes(status.value))
const progress = computed(() => Math.min(100, (sample.value?.elapsedMs || 0) / 150))
// 真實環境多落在 -90～-10 dBFS；以這段範圍畫波形，變化才看得出來（低於下限畫最矮、高於上限畫滿）。
const WAVE_MIN_DBFS = -90, WAVE_MAX_DBFS = -10
function waveHeight(dbfs) {
  const ratio = Math.min(1, Math.max(0, (dbfs - WAVE_MIN_DBFS) / (WAVE_MAX_DBFS - WAVE_MIN_DBFS)))
  return `${Math.round(3 + ratio * 55)}px`
}
// dB 為 dBFS 加校準值的估計；安靜／普通／吵雜由估計 dB 自動判定。校準值可在測試工作台（#debug）調整。
const calibration = ref(readDbOffset())
const currentDbfs = computed(() => summary.value?.averageDbfs ?? sample.value?.averageDbfs ?? null)
const currentDb = computed(() => estimateDb(currentDbfs.value, calibration.value.offset))
const level = computed(() => noiseLevel(currentDb.value))
let session, observedAt, payload
function start() {
  if (running.value) return
  sample.value = null; samples.value = []; summary.value = null; message.value = ''; consent.value = false; uploaded.value = false
  status.value = 'waiting'; observedAt = null; payload = null; calibration.value = readDbOffset()
  sessionLocation.value = { ...props.city.reportLocation.value }
  try {
    session = createNoiseSession({ host: window, onStatus: result => {
      status.value = result.status; message.value = result.message || ''; summary.value = result.summary || null
      if (result.startedAt) observedAt = result.startedAt
      if (result.status === 'completed' && result.summary && observedAt) {
        // 量測完成即存到此裝置，關閉面板後首頁仍看得到。
        props.city.recordNoise(createNoiseEntry({ sessionId: session.sessionId, measuredAt: observedAt, summary: result.summary, locationLabel: sessionLocation.value?.label }))
      }
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
    <div class="noise-meter" :class="{ running }"><div class="noise-halo"></div><span class="q-eyebrow">{{ status === 'completed' ? '本次量測完成' : running ? '正在感受周圍的聲音' : '準備開始環境音量量測' }}</span><strong><span v-if="currentDb !== null" class="noise-approx">約</span>{{ currentDb ?? '—' }}<small>dB</small></strong><span v-if="level" class="noise-level" :class="`level-${level.id}`">周圍{{ level.label }}<small>{{ level.hint }}</small></span><p>{{ status === 'waiting' ? '等待麥克風權限…' : status === 'measuring' ? `${((sample?.elapsedMs || 0) / 1000).toFixed(1)} / 15 秒` : status === 'completed' ? `原始 ${summary.averageDbfs} dBFS · 峰值 ${summary.peakDbfs} dBFS · ${summary.sampleCount} 個樣本` : `估計值${calibration.calibrated ? '（已校準）' : '（未校準）'}` }}</p><div class="noise-wave" aria-hidden="true"><i v-for="(value, index) in samples" :key="index" :style="{ height: waveHeight(value.averageDbfs) }"></i><span v-if="!samples.length">量測開始後才會出現音量波形</span></div><div class="noise-progress" role="progressbar" aria-label="量測進度" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: `${progress}%` }"></i></div></div>
    <p class="noise-explanation"><AppIcon name="shield" :size="17"/><span>dB 由手機麥克風數值（dBFS）加上{{ calibration.calibrated ? '本機校準值' : '預設值' }} {{ calibration.offset }} 估算{{ calibration.calibrated ? '' : '，未經音量計校準，誤差可能達 ±10 dB 以上' }}；僅供參考，不是法規噪音量測。不保存或上傳錄音；數值摘要會留在此裝置。</span></p>
    <p v-if="message" class="q-error" role="status">{{ message }}</p>
    <button v-if="running" class="q-secondary full" @click="stop">停止量測</button><button v-else class="q-primary full" @click="start"><AppIcon name="wave" :size="19"/>{{ summary ? '重新量測 15 秒' : '開始量測 15 秒' }}</button>
    <div v-if="summary" class="noise-share"><label class="q-checkbox"><input v-model="consent" type="checkbox" :disabled="uploading || uploaded"/><span>我同意分享本次音量摘要與{{ sessionLocation?.label }}<small>只分享統計數值、樣本數、開始量測時間與開始時的位置，不含聲音。這與麥克風權限分開決定。</small></span></label><button class="q-secondary full" :disabled="!consent || uploading || uploaded" @click="upload">{{ uploaded ? '已完成分享' : uploading ? '分享中…' : '分享本次摘要' }}</button></div>
    <p class="microcopy">音量在手機上即時計算，只保留數值統計。城市通 App 內需允許麥克風權限。</p>
  </AppSheet>
</template>
