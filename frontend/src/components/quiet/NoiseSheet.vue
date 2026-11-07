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
// 真實環境多落在 -90～-10 dBFS；以這段範圍換算 0–1，波形與脈動的變化才看得出來（超出範圍取兩端）。
const WAVE_MIN_DBFS = -90, WAVE_MAX_DBFS = -10, WAVE_BARS = 30
const waveRatio = dbfs => Math.min(1, Math.max(0, (dbfs - WAVE_MIN_DBFS) / (WAVE_MAX_DBFS - WAVE_MIN_DBFS)))
// 波形固定 30 格，由右往左填入最新樣本；尚無樣本的格子畫成小圓點。
const bars = computed(() => {
  const values = samples.value.slice(-WAVE_BARS).map(value => waveRatio(value.averageDbfs))
  return [...Array(WAVE_BARS - values.length).fill(null), ...values]
})
// 量測中依最新音量讓中心圓微微放大，搭配外圈漣漪；其他狀態不脈動。
const pulse = computed(() => status.value === 'measuring' && sample.value ? waveRatio(sample.value.averageDbfs) : 0)
// 外圈進度環：15 秒填滿，完成時維持滿圈。
const RING_RADIUS = 92, RING_LENGTH = 2 * Math.PI * RING_RADIUS
const ringOffset = computed(() => RING_LENGTH * (1 - (status.value === 'completed' ? 100 : progress.value) / 100))
const STATE_TEXT = { idle: '準備好了', waiting: '等待麥克風權限…', completed: '量測完成' }
const stateText = computed(() => status.value === 'measuring'
  ? `${((sample.value?.elapsedMs || 0) / 1000).toFixed(1)} / 15 秒`
  : STATE_TEXT[status.value] || '無法量測')
const detailText = computed(() => status.value === 'completed' && summary.value
  ? `原始 ${summary.value.averageDbfs}／峰值 ${summary.value.peakDbfs} dBFS`
  : `估計值${calibration.value.calibrated ? '（已校準）' : ''}`)
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
    // 分享完成即收起面板（與回報相同）；結果以通知顯示，量測紀錄已存在此裝置。失敗時保留面板與錯誤訊息供重試。
    emit('close')
  } catch (reason) { message.value = reason.message }
  finally { uploading.value = false }
}
onMounted(() => { document.addEventListener('visibilitychange', background); window.addEventListener('pagehide', stop) })
onUnmounted(() => { stop(); document.removeEventListener('visibilitychange', background); window.removeEventListener('pagehide', stop) })
</script>
<template>
  <AppSheet title="聽見此刻的環境" :busy="uploading" @close="!uploading && $emit('close')">
    <p class="noise-intro">留 15 秒，感受周圍的聲音<small>按下開始才會請求麥克風權限</small></p>
    <!-- 中心圓顯示估計 dB；外圈為 15 秒進度環，量測中有漣漪並依音量微微脈動；顏色依安靜／普通／吵雜變化。 -->
    <div class="noise-stage" :class="[`is-${status}`, level ? `tone-${level.id}` : '']" :style="{ '--pulse': pulse }">
      <div class="noise-orb">
        <span v-for="n in 3" :key="n" class="noise-ripple" :style="{ animationDelay: `${(n - 1) * 0.9}s` }" aria-hidden="true"></span>
        <svg class="noise-ring" viewBox="0 0 200 200" aria-hidden="true">
          <circle class="noise-ring-track" cx="100" cy="100" :r="RING_RADIUS" />
          <circle class="noise-ring-bar" cx="100" cy="100" :r="RING_RADIUS" :stroke-dasharray="RING_LENGTH" :stroke-dashoffset="ringOffset" />
        </svg>
        <div class="noise-core" role="status" aria-live="polite">
          <span class="noise-state">{{ stateText }}</span>
          <strong class="noise-value"><span v-if="currentDb !== null" class="noise-approx">約</span>{{ currentDb ?? '—' }}<small>dB</small></strong>
          <span class="noise-detail">{{ detailText }}</span>
        </div>
      </div>
      <!-- 等級只在第一次出現時淡入；之後音量在等級間變動只換文字與顏色，避免標籤反覆閃爍。保留固定高度避免版面跳動。 -->
      <div class="noise-level-slot">
        <Transition name="noise-fade">
          <p v-if="level" class="noise-level"><b>周圍{{ level.label }}</b><span>{{ level.hint }}</span></p>
        </Transition>
      </div>
      <div class="noise-wave" aria-hidden="true">
        <i v-for="(value, index) in bars" :key="index" :class="{ empty: value === null }" :style="value === null ? null : { transform: `scaleY(${0.08 + value * 0.92})` }"></i>
      </div>
    </div>
    <p v-if="message" class="q-error" role="status">{{ message }}</p>
    <button v-if="running" class="q-secondary full" @click="stop">停止量測</button><button v-else class="q-primary full" @click="start"><AppIcon name="wave" :size="19"/>{{ summary ? '重新量測 15 秒' : '開始量測 15 秒' }}</button>
    <div v-if="summary" class="noise-share"><label class="q-checkbox"><input v-model="consent" type="checkbox" :disabled="uploading || uploaded"/><span>我同意分享本次音量摘要與目前位置<small>只分享統計數值、樣本數、開始量測時間與開始時的位置，不含聲音。</small></span></label><button class="q-secondary full" :disabled="!consent || uploading || uploaded" @click="upload">{{ uploaded ? '已完成分享' : uploading ? '分享中…' : '分享本次摘要' }}</button></div>
    <p class="microcopy">台北通 App 內需允許麥克風權限。</p>
  </AppSheet>
</template>

<style scoped>
/* 語調色：預設品牌藍綠，依量測結果切換安靜（綠）／普通（琥珀）／吵雜（紅）。 */
.noise-stage { --tone: var(--q-brand, #0391a7); --tone-soft: #dff2f7; position: relative; display: flex; flex-direction: column; align-items: center; margin: 14px 0 16px; padding: 18px 12px 14px; border-radius: 20px; background: radial-gradient(circle at 50% 38%, #f3fbfd 0%, #fff 72%); transition: background .6s ease; }
.noise-stage.tone-quiet { --tone: #2e9a6c; --tone-soft: #dcf2e6; }
.noise-stage.tone-moderate { --tone: #c98f12; --tone-soft: #f8edcf; }
.noise-stage.tone-noisy { --tone: #cf5b52; --tone-soft: #f9dfdc; }
.noise-intro { margin: 0; color: #4f6672; font-size: 15px; line-height: 1.7; text-align: center; }
.noise-intro small { display: block; color: var(--q-muted, #6c7c85); font-size: 12px; }

/* 中心圓與外圈 */
.noise-orb { position: relative; display: grid; place-items: center; width: 212px; height: 212px; }
.noise-ripple { position: absolute; inset: 22px; border-radius: 50%; background: var(--tone-soft); opacity: 0; }
.is-measuring .noise-ripple { animation: noise-ripple 2.7s cubic-bezier(.2, .6, .35, 1) infinite; }
.noise-ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.noise-ring circle { fill: none; stroke-width: 6; }
.noise-ring-track { stroke: #e4f0f4; }
.noise-ring-bar { stroke: var(--tone); stroke-linecap: round; transition: stroke-dashoffset .3s linear, stroke .6s ease; }
.is-idle .noise-ring-bar, .is-denied .noise-ring-bar, .is-unsupported .noise-ring-bar, .is-error .noise-ring-bar { opacity: 0; }
/* 等待權限：進度環變成旋轉的短弧。 */
.is-waiting .noise-ring { animation: noise-spin 1.2s linear infinite; }
.is-waiting .noise-ring-bar { stroke-dashoffset: 430; opacity: .9; }
.noise-core { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 164px; height: 164px; border-radius: 50%; background: #fff; box-shadow: 0 10px 28px #1f556124, inset 0 0 0 1px #e3f0f4; transform: scale(calc(1 + var(--pulse, 0) * .07)); transition: transform .25s ease-out; }
.is-idle .noise-core { animation: noise-breathe 4.2s ease-in-out infinite; }
.noise-state { color: #5b7684; font-size: 12px; letter-spacing: .02em; }
.noise-value { display: flex; align-items: baseline; margin: 2px 0 0; color: var(--tone); font-size: 50px; font-weight: 600; line-height: 1.1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; transition: color .6s ease; }
.noise-value small { margin-left: 4px; color: #6a8692; font-size: 15px; font-weight: 500; letter-spacing: 0; }
.noise-approx { margin-right: 4px; color: #6a8692; font-size: 16px; font-weight: 500; letter-spacing: 0; }
.noise-detail { max-width: 150px; margin-top: 2px; color: #6a8692; font-size: 11px; line-height: 1.4; text-align: center; }

/* 等級標籤與波形 */
.noise-level-slot { min-height: 44px; margin: 10px 0 6px; }
.noise-level { display: flex; flex-direction: column; align-items: center; margin: 0; color: var(--tone); text-align: center; transition: color .6s ease; }
.noise-level b { font-size: 17px; font-weight: 700; }
.noise-level span { color: #6a7c86; font-size: 12px; }
.noise-fade-enter-active, .noise-fade-leave-active { transition: opacity .3s ease, transform .3s ease; }
.noise-fade-enter-from, .noise-fade-leave-to { opacity: 0; transform: translateY(4px); }
.noise-wave { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; height: 44px; }
.noise-wave i { width: 4px; height: 100%; border-radius: 4px; background: var(--tone); opacity: .75; transform-origin: center; transition: transform .25s ease-out, background .6s ease; }
.noise-wave i.empty { height: 4px; background: #d3e5ec; opacity: 1; }

@keyframes noise-ripple { 0% { transform: scale(.82); opacity: .75; } 100% { transform: scale(1.32); opacity: 0; } }
@keyframes noise-breathe { 50% { transform: scale(1.025); } }
@keyframes noise-spin { to { transform: rotate(270deg); } }
@media (max-width: 359px) {
  .noise-orb { width: 192px; height: 192px; }
  .noise-core { width: 148px; height: 148px; }
  .noise-value { font-size: 44px; }
}
/* 系統減少動態與低刺激模式由全域規則停用 .quiet-overlay 內所有動畫；這裡再保險關閉。 */
@media (prefers-reduced-motion: reduce) {
  .noise-ripple, .noise-core, .noise-ring, .noise-wave i, .noise-ring-bar { animation: none !important; transition: none !important; }
}
</style>
