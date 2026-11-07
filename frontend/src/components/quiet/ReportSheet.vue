<script setup>
import { computed, ref } from 'vue'
import AppSheet from './AppSheet.vue'
import AppIcon from '../AppIcon.vue'
import { sensoryApi } from '../../lib/sensoryApi.js'
import { createReportDraft } from '../../lib/sensorySubmission.js'
import { INTENSITY_DIMENSIONS, REPORT_INTENSITIES, SENSES } from '../../lib/sensoryDomain.js'
const props = defineProps({ kind: { type: Object, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['close', 'done'])
const note = ref(''), busy = ref(false), error = ref(''), intensity = ref(null)
const draft = createReportDraft()
// 強度不預選；只有四種刺激感受、且後端已宣告支援或使用模擬資料時才詢問。comfortable／other 不帶強度。
const dimension = computed(() => INTENSITY_DIMENSIONS[props.kind.id])
const askIntensity = computed(() => Boolean(dimension.value) && props.city.reportIntensityEnabled.value)
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
    <div class="q-location-box"><AppIcon name="pin" :size="20"/><div><strong>{{ city.reportLocation.value?.label || '尚未取得臺北市內的目前位置' }}</strong><p>{{ city.reportLocation.value ? '這次回報將包含已同意取得的座標。' : '回報只能使用目前定位；請重新定位後再送出。' }}</p></div></div>
    <button class="q-secondary full" :disabled="city.locating.value || busy" @click="city.locate"><AppIcon name="locate" :size="17"/>{{ city.locating.value ? '定位中…' : '重新定位' }}</button>
    <fieldset v-if="askIntensity" class="intensity-field" :disabled="busy">
      <legend>此刻的{{ dimensionLabel }}刺激有多強？<span>必選</span></legend>
      <div class="intensity-options">
        <label v-for="item in REPORT_INTENSITIES" :key="item.id" :class="{ selected: intensity === item.id }"><input v-model="intensity" type="radio" name="report-intensity" :value="item.id"/><span>{{ item.label }}</span></label>
      </div>
      <small>只描述{{ dimensionLabel }}這一項，其他感官不會因此變成低刺激。</small>
    </fieldset>
    <label class="q-field">補充說明 <span>選填</span><textarea v-model="note" :disabled="busy" maxlength="140" rows="3" placeholder="例如：靠近馬路的座位比較吵…"></textarea><small>{{ note.length }} / 140</small></label>
    <p class="q-helper">不需要提供姓名、疾病或診斷資訊。確認後將送出感受、時間與上方顯示的位置。</p>
    <p v-if="error" class="q-error" role="alert">{{ error }}</p>
    <p v-if="askIntensity && !intensity" class="q-helper">請先選擇強度，才能送出。</p>
    <button class="q-primary full" :disabled="busy || city.locating.value || !city.reportLocation.value || (askIntensity && !intensity)" @click="submit"><AppIcon :name="busy ? 'clock' : 'check'" :size="19"/>{{ busy ? '送出中…' : '確認送出' }}</button>
  </AppSheet>
</template>
<style scoped>
.intensity-field { margin: 18px 0 4px; padding: 0; border: 0; }
.intensity-field legend { padding: 0; margin-bottom: 9px; color: var(--q-ink); font-size: 16px; }
.intensity-field legend span { margin-left: 6px; color: var(--q-muted); font-size: 13px; }
.intensity-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.intensity-options label { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 10px; border: 1px solid #d1e0e8; border-radius: 10px; color: #3f5360; font-size: 15px; line-height: 1.35; cursor: pointer; }
.intensity-options label.selected { border-color: var(--q-brand); background: var(--q-mint); color: var(--q-deep); font-weight: 600; }
.intensity-options input { width: 18px; height: 18px; margin: 0; flex-shrink: 0; accent-color: var(--q-brand); }
.intensity-field small { display: block; margin-top: 7px; color: var(--q-muted); font-size: 12px; line-height: 1.6; }
</style>
