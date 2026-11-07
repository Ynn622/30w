<script setup>
import { computed, ref } from 'vue'
import { readNoiseHistory } from '../lib/noiseHistory.js'
import { DEFAULT_DB_OFFSET, MAX_DB_OFFSET, NOISE_OFFSET_KEY, MIN_DB_OFFSET, estimateDb, offsetFromReference, readDbOffset, writeDbOffset } from '../lib/noiseLevel.js'

// 校準：在同一地點、同一時間用標準音量計（或已校準的 App）讀數，與最近一次 15 秒量測的平均 dBFS 相減得到校準值。
let storage = null
try { storage = window.localStorage } catch { /* 無法存取時只能使用預設值 */ }
const calibration = ref(readDbOffset(storage))
const latest = ref(readNoiseHistory(storage)[0] ?? null)
const reference = ref('')
const manual = ref(String(calibration.value.offset))
const message = ref('')
const preview = computed(() => (latest.value ? estimateDb(latest.value.averageDbfs, calibration.value.offset) : null))

function reload() {
  calibration.value = readDbOffset(storage)
  latest.value = readNoiseHistory(storage)[0] ?? null
  manual.value = String(calibration.value.offset)
}
function save(offset, note) {
  if (!writeDbOffset(offset, storage)) { message.value = `無法儲存；校準值需介於 ${MIN_DB_OFFSET}～${MAX_DB_OFFSET}。`; return }
  reload()
  message.value = note
}
function applyReference() {
  if (!latest.value) { message.value = '請先完成一次 15 秒量測。'; return }
  const offset = offsetFromReference(reference.value, latest.value.averageDbfs)
  if (offset === null) { message.value = `算出的校準值超出 ${MIN_DB_OFFSET}～${MAX_DB_OFFSET}，請確認參考讀數。`; return }
  save(offset, `已套用校準值 ${offset}。`)
}
function applyManual() { save(Number(manual.value), `已套用校準值 ${Number(manual.value)}。`) }
function reset() { save(null, `已回到預設值 ${DEFAULT_DB_OFFSET}。`) }
</script>

<template>
  <section class="calibration-panel" aria-labelledby="noise-calibration-title">
    <h2 id="noise-calibration-title">噪音 dB 校準</h2>
    <p class="hint">估計 dB = 平均 dBFS + 校準值。每支手機麥克風不同，建議用標準音量計在同一地點同時量測後校準。校準值只存在此裝置（<code>{{ NOISE_OFFSET_KEY }}</code>）。</p>
    <dl>
      <div><dt>目前校準值</dt><dd>{{ calibration.offset }}{{ calibration.calibrated ? '（已校準）' : '（預設）' }}</dd></div>
      <div><dt>最近一次量測</dt><dd>{{ latest ? `${latest.averageDbfs} dBFS → 約 ${preview} dB` : '尚無紀錄' }}</dd></div>
    </dl>
    <label>參考音量計讀數（dB）<input v-model="reference" type="number" inputmode="decimal" step="0.1" placeholder="例如 55" /></label>
    <button type="button" :disabled="!latest || reference === ''" @click="applyReference">以最近一次量測校準</button>
    <label>直接輸入校準值<input v-model="manual" type="number" inputmode="decimal" step="0.1" :min="MIN_DB_OFFSET" :max="MAX_DB_OFFSET" /></label>
    <div class="actions">
      <button type="button" @click="applyManual">套用</button>
      <button type="button" @click="reset">回到預設 {{ DEFAULT_DB_OFFSET }}</button>
      <button type="button" @click="reload">重新讀取</button>
    </div>
    <p v-if="message" class="hint" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.calibration-panel { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 20px; background: white; }
h2 { margin: 0; font-size: 18px; }
.hint { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
dl { display: grid; gap: 6px; margin: 0; }
dl div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
dt { color: var(--muted); } dd { margin: 0; font-weight: 600; text-align: right; }
label { display: grid; gap: 6px; font-size: 13px; }
input { min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; font-size: 16px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
button { min-height: 44px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 12px; background: white; color: var(--brand); cursor: pointer; font-size: 12px; }
button:disabled { opacity: .5; cursor: not-allowed; }
</style>
