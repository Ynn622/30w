<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import AppSheet from './AppSheet.vue'
import AppIcon from '../AppIcon.vue'
import { sensoryApi } from '../../lib/sensoryApi.js'
import { createReportDraft } from '../../lib/sensorySubmission.js'
import { GEOCODE_ATTRIBUTION } from '../../lib/reverseGeocode.js'
import { INTENSITY_DIMENSIONS, REPORT_INTENSITIES, SENSES } from '../../lib/sensoryDomain.js'
// 小地圖延遲載入，避免首頁就下載地圖引擎。
const MiniMap = defineAsyncComponent(() => import('./MiniMap.vue'))
const props = defineProps({ kind: { type: Object, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['close', 'done'])
const note = ref(''), busy = ref(false), error = ref(''), intensity = ref(null)
const draft = createReportDraft()
// 強度不預選；只有四種刺激感受、且後端已宣告支援或使用模擬資料時才詢問。comfortable／other 不帶強度。
const dimension = computed(() => INTENSITY_DIMENSIONS[props.kind.id])
const askIntensity = computed(() => Boolean(dimension.value) && props.city.reportIntensityEnabled.value)
// 顯示到小數 5 位（約 1 公尺），送出的仍是原始座標。
const coordinateText = computed(() => {
  const location = props.city.reportLocation.value
  return location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : ''
})
const dimensionLabel = computed(() => SENSES.find(sense => sense.key === dimension.value)?.label)
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    // 失敗後原樣重送沿用同一份 payload（observedAt 不變）；改了內容或位置才是新事件。
    const body = draft.take({ kind: props.kind.id, note: note.value.trim(), location: props.city.reportLocation.value,
      ...(askIntensity.value ? { intensity: intensity.value } : {}) })
    const result = await sensoryApi.createReport(body)
    draft.clear()
    emit('done', result.meta?.mock ? '後端回報服務暫時無法連線，本次回報僅模擬完成，未上傳。' : '謝謝你，已收到你的環境感受。')
  } catch (reason) { error.value = reason.message }
  finally { busy.value = false }
}
</script>
<template>
  <AppSheet title="分享此刻的感受" :busy="busy" @close="!busy && $emit('close')">
    <div class="report-selection" :class="kind.color"><AppIcon :name="kind.icon" :size="34"/><div><span>你選擇了</span><h3>{{ kind.label }}</h3></div><span class="selection-check"><AppIcon name="check" :size="18"/></span></div>
    <template v-if="city.reportLocation.value">
      <MiniMap class="report-map" :location="city.reportLocation.value" />
      <div class="q-location-box"><AppIcon name="pin" :size="20"/><div><strong>{{ city.address?.value || `臺北市${city.area.value?.name || ''}` }}</strong><p v-if="city.addressState?.value === 'loading'">正在查詢地址…</p><p v-else-if="city.addressState?.value === 'error'">暫時查不到門牌地址，先顯示所在行政區。</p><p class="report-coordinates">經緯度 {{ coordinateText }}</p><p>這次回報會送出上方的經緯度。</p><p v-if="city.address?.value" class="report-attribution">{{ GEOCODE_ATTRIBUTION }}，地址為推估結果</p></div></div>
    </template>
    <div v-else class="q-location-box"><AppIcon name="pin" :size="20"/><div><strong>尚未取得臺北市內的目前位置</strong><p>回報只能使用目前定位；請重新定位後再送出。</p></div></div>
    <button class="q-secondary full" :disabled="city.locating.value || busy" @click="city.locate"><AppIcon name="locate" :size="17"/>{{ city.locating.value ? '定位中…' : '重新定位' }}</button>
    <fieldset v-if="askIntensity" class="intensity-field" :disabled="busy">
      <legend>此刻的{{ dimensionLabel }}刺激有多強？<span>必選</span></legend>
      <div class="intensity-options">
        <label v-for="item in REPORT_INTENSITIES" :key="item.id" :class="{ selected: intensity === item.id }"><input v-model="intensity" type="radio" name="report-intensity" :value="item.id"/><span>{{ item.label }}</span></label>
      </div>
      <small>只描述{{ dimensionLabel }}這一項，其他感官不會因此變成低刺激。</small>
    </fieldset>
    <label class="q-field">補充說明 <span>選填</span><textarea v-model="note" :disabled="busy" maxlength="140" rows="3" placeholder="例如：靠近馬路的座位比較吵…"></textarea><small>{{ note.length }} / 140</small></label>
    <p v-if="error" class="q-error" role="alert">{{ error }}</p>
    <p v-if="askIntensity && !intensity" class="q-helper">請先選擇強度，才能送出。</p>
    <button class="q-primary full" :disabled="busy || city.locating.value || !city.reportLocation.value || (askIntensity && !intensity)" @click="submit"><AppIcon :name="busy ? 'clock' : 'check'" :size="19"/>{{ busy ? '送出中…' : '確認送出' }}</button>
  </AppSheet>
</template>
<style scoped>
.report-map { margin-top: 18px; }
.report-map + .q-location-box { margin-top: 10px; }
.report-coordinates { color: #3f5360 !important; font-variant-numeric: tabular-nums; }
.report-attribution { font-size: 12px !important; }
.intensity-field { margin: 18px 0 4px; padding: 0; border: 0; }
.intensity-field legend { padding: 0; margin-bottom: 9px; color: var(--q-ink); font-size: 16px; }
.intensity-field legend span { margin-left: 6px; color: var(--q-muted); font-size: 13px; }
.intensity-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.intensity-options label { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 10px; border: 1px solid #d1e0e8; border-radius: 10px; color: #3f5360; font-size: 15px; line-height: 1.35; cursor: pointer; }
.intensity-options label.selected { border-color: var(--q-brand); background: var(--q-mint); color: var(--q-deep); font-weight: 600; }
.intensity-options input { width: 18px; height: 18px; margin: 0; flex-shrink: 0; accent-color: var(--q-brand); }
.intensity-field small { display: block; margin-top: 7px; color: var(--q-muted); font-size: 12px; line-height: 1.6; }
</style>
