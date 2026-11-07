<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import AppSheet from './AppSheet.vue'
import AppIcon from '../AppIcon.vue'
import { sensoryApi } from '../../lib/sensoryApi.js'
import { createReportDraft } from '../../lib/sensorySubmission.js'
import { INTENSITY_KINDS, REPORT_INTENSITIES, REPORT_KINDS, REPORT_PERSISTENCE, REPORT_SETTINGS } from '../../lib/sensoryDomain.js'
// 小地圖延遲載入，避免首頁就下載地圖引擎。
const MiniMap = defineAsyncComponent(() => import('./MiniMap.vue'))
const props = defineProps({ kind: { type: Object, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['close', 'done'])
const note = ref(''), busy = ref(false), error = ref(''), intensity = ref(null)
// 第二層快速標籤（可複選、選填）、持續狀態與室內外（單選、選填），讓 5–10 秒完成回報。
const tags = ref([]), persistence = ref(null), setting = ref(null)
// 開啟後可點選上方的感受改成其他種；換種類時具體情況與強度需重新選擇（對應的感官不同）。
const currentKind = ref(props.kind), pickerOpen = ref(false)
function chooseKind(kind) {
  if (kind.id !== currentKind.value.id) { currentKind.value = kind; intensity.value = null; tags.value = []; error.value = '' }
  pickerOpen.value = false
}
function toggleTag(id) { tags.value = tags.value.includes(id) ? tags.value.filter(value => value !== id) : [...tags.value, id] }
// 單選但可再點一次取消，維持「選填」。
function choosePersistence(id) { persistence.value = persistence.value === id ? null : id }
function chooseSetting(id) { setting.value = setting.value === id ? null : id }
const draft = createReportDraft()
// 強度不預選；四種 SSI 刺激與溫度、動線，且後端已宣告支援或使用模擬資料時才詢問。舒適／其他不帶強度。
const askIntensity = computed(() => INTENSITY_KINDS.includes(currentKind.value.id) && props.city.reportIntensityEnabled.value)
const noteMissing = computed(() => Boolean(currentKind.value.noteRequired) && !note.value.trim())
// 位置框只顯示地址；查詢中或查不到時退回所在行政區。經緯度仍隨回報送出。
// 地址來自 OpenStreetMap，同一視窗的小地圖已標示 © OpenStreetMap。
const addressText = computed(() => props.city.address?.value
  || (props.city.addressState?.value === 'loading' ? '正在查詢地址…' : `臺北市${props.city.area.value?.name || ''}`))
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    // 失敗後原樣重送沿用同一份 payload（observedAt 不變）；改了內容或位置才是新事件。
    const body = draft.take({ kind: currentKind.value.id, note: note.value.trim(), location: props.city.reportLocation.value,
      tags: tags.value.length ? [...tags.value] : undefined, persistence: persistence.value || undefined, setting: setting.value || undefined,
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
    <button type="button" class="report-selection" :class="currentKind.color" :aria-expanded="pickerOpen" aria-controls="report-kind-picker" :disabled="busy" @click="pickerOpen = !pickerOpen">
      <AppIcon :name="currentKind.icon" :size="26"/>
      <div><span>你感受到什麼？</span><h3>{{ currentKind.label }}</h3></div>
      <span class="change-kind">更換<AppIcon name="chevron" :size="16" :class="{ open: pickerOpen }"/></span>
    </button>
    <div v-if="pickerOpen" id="report-kind-picker" class="kind-picker" role="group" aria-label="選擇其他感受">
      <button v-for="item in REPORT_KINDS" :key="item.id" type="button" :class="[item.color, { selected: item.id === currentKind.id }]" :aria-pressed="item.id === currentKind.id" @click="chooseKind(item)"><AppIcon :name="item.icon" :size="20"/><span>{{ item.label }}</span></button>
    </div>
    <template v-if="city.reportLocation.value">
      <MiniMap class="report-map" :location="city.reportLocation.value" />
      <div class="q-location-box"><button type="button" class="q-icon-button relocate-button" :class="{ locating: city.locating.value }" :disabled="city.locating.value || busy" :aria-label="city.locating.value ? '定位中' : '重新定位'" :title="city.locating.value ? '定位中' : '重新定位'" @click="city.locate"><AppIcon name="locate" :size="20"/></button><div><strong>{{ addressText }}</strong></div></div>
    </template>
    <div v-else class="q-location-box"><button type="button" class="q-icon-button relocate-button" :class="{ locating: city.locating.value }" :disabled="city.locating.value || busy" :aria-label="city.locating.value ? '定位中' : '重新定位'" :title="city.locating.value ? '定位中' : '重新定位'" @click="city.locate"><AppIcon name="locate" :size="20"/></button><div><strong>尚未取得臺北市內的目前位置</strong><p>回報只能使用目前定位；請重新定位後再送出。</p></div></div>
    <fieldset v-if="currentKind.tags.length" class="report-field" :disabled="busy">
      <legend>具體情況<span>可複選・選填</span></legend>
      <div class="choice-chips">
        <button v-for="item in currentKind.tags" :key="item.id" type="button" :class="{ selected: tags.includes(item.id) }" :aria-pressed="tags.includes(item.id)" @click="toggleTag(item.id)">{{ item.label }}</button>
      </div>
    </fieldset>
    <fieldset v-if="askIntensity" class="report-field intensity-field" :disabled="busy">
      <legend>此刻的{{ currentKind.intensityLabel }}有多強？<span>必選</span></legend>
      <div class="intensity-options">
        <label v-for="item in REPORT_INTENSITIES" :key="item.id" :class="{ selected: intensity === item.id }"><input v-model="intensity" type="radio" name="report-intensity" :value="item.id"/><span>{{ item.label }}</span></label>
      </div>
      <small>只描述{{ currentKind.label }}這一項，其他感官不會因此變成低刺激。</small>
    </fieldset>
    <fieldset class="report-field" :disabled="busy">
      <legend>持續狀態<span>選填</span></legend>
      <div class="choice-chips">
        <button v-for="item in REPORT_PERSISTENCE" :key="item.id" type="button" :class="{ selected: persistence === item.id }" :aria-pressed="persistence === item.id" @click="choosePersistence(item.id)">{{ item.label }}</button>
      </div>
    </fieldset>
    <fieldset class="report-field" :disabled="busy">
      <legend>在室內還是室外？<span>選填</span></legend>
      <div class="choice-chips">
        <button v-for="item in REPORT_SETTINGS" :key="item.id" type="button" :class="{ selected: setting === item.id }" :aria-pressed="setting === item.id" @click="chooseSetting(item.id)">{{ item.label }}</button>
      </div>
    </fieldset>
    <label class="q-field">補充說明 <span>{{ currentKind.noteRequired ? '必填' : '選填' }}</span><textarea v-model="note" :disabled="busy" maxlength="140" rows="3" :placeholder="currentKind.noteRequired ? '請描述你感受到的環境狀況…' : '例如：靠近馬路的座位比較吵…'"></textarea><small>{{ note.length }} / 140</small></label>
    <p v-if="error" class="q-error" role="alert">{{ error }}</p>
    <p v-if="askIntensity && !intensity" class="q-helper">請先選擇強度，才能送出。</p>
    <p v-else-if="noteMissing" class="q-helper">請在補充說明描述環境狀況，才能送出。</p>
    <button class="q-primary full" :disabled="busy || city.locating.value || !city.reportLocation.value || (askIntensity && !intensity) || noteMissing" @click="submit"><AppIcon :name="busy ? 'clock' : 'check'" :size="19"/>{{ busy ? '送出中…' : '確認送出' }}</button>
  </AppSheet>
</template>
<style scoped>
/* 選擇的感受：較矮的一列，點擊展開其他種類。 */
.report-selection { width: 100%; gap: 10px; padding: 9px 12px; margin-bottom: 12px; font: inherit; text-align: left; cursor: pointer; }
.report-selection > svg { flex-shrink: 0; }
.report-selection.teal > svg { color: #2197ac; }.report-selection.amber > svg { color: #dfad36; }.report-selection.blue > svg { color: #5c707e; }.report-selection.purple > svg { color: #83a3ae; }.report-selection.coral > svg { color: #cf6f55; }.report-selection.slate > svg { color: #5f7186; }.report-selection.green > svg { color: #3e8e49; }.report-selection.muted > svg { color: #50616d; }
.report-selection span:not(.change-kind) { font-size: 12px; }
.report-selection h3 { margin: 1px 0 0; font-size: 18px; line-height: 1.35; }
.change-kind { display: inline-flex; align-items: center; gap: 2px; color: var(--q-deep, #007a90); font-size: 13px; white-space: nowrap; }
.change-kind svg { transform: rotate(90deg); transition: transform .2s; }
.change-kind svg.open { transform: rotate(-90deg); }
.kind-picker { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: -4px 0 12px; }
.kind-picker button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 58px; padding: 6px 2px; border: 1px solid #dde3e8; border-radius: 10px; background: #fff; font: inherit; font-size: 12px; color: #303e47; cursor: pointer; }
.kind-picker button.selected { border-color: var(--q-brand, #0391a7); background: var(--q-mint, #edf8fc); font-weight: 600; }
.kind-picker button.teal svg { color: #2197ac; }.kind-picker button.amber svg { color: #dfad36; }.kind-picker button.blue svg { color: #5c707e; }.kind-picker button.purple svg { color: #83a3ae; }.kind-picker button.coral svg { color: #cf6f55; }.kind-picker button.slate svg { color: #5f7186; }.kind-picker button.green svg { color: #3e8e49; }.kind-picker button.muted svg { color: #50616d; }
.report-map { margin-top: 18px; }
.report-map + .q-location-box { margin-top: 10px; }
/* 地址旁的定位圖示即為「重新定位」按鈕，觸控區 44px。 */
.relocate-button { flex-shrink: 0; width: 44px; min-height: 44px; margin: -6px -4px -6px -10px; padding: 0; border-radius: 50%; color: var(--q-brand, #0391a7); }
.relocate-button:hover:not(:disabled) { background: var(--q-mint, #edf8fc); }
.relocate-button.locating svg { animation: q-relocate-spin 1.2s linear infinite; }
@keyframes q-relocate-spin { to { transform: rotate(360deg); } }
.report-field { margin: 16px 0 4px; padding: 0; border: 0; }
.report-field legend { padding: 0; margin-bottom: 8px; color: var(--q-ink); font-size: 16px; }
.report-field legend span { margin-left: 6px; color: var(--q-muted); font-size: 13px; }
/* 快速標籤與單選選項：可換行的膠囊按鈕，觸控高度 44px。 */
.choice-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.choice-chips button { min-height: 44px; padding: 8px 13px; border: 1px solid #d1e0e8; border-radius: 22px; background: #fff; color: #3f5360; font: inherit; font-size: 14px; line-height: 1.3; cursor: pointer; }
.choice-chips button.selected { border-color: var(--q-brand); background: var(--q-mint); color: var(--q-deep); font-weight: 600; }
.intensity-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.intensity-options label { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 8px 10px; border: 1px solid #d1e0e8; border-radius: 10px; color: #3f5360; font-size: 15px; line-height: 1.35; cursor: pointer; }
.intensity-options label.selected { border-color: var(--q-brand); background: var(--q-mint); color: var(--q-deep); font-weight: 600; }
.intensity-options input { width: 18px; height: 18px; margin: 0; flex-shrink: 0; accent-color: var(--q-brand); }
.intensity-field small { display: block; margin-top: 7px; color: var(--q-muted); font-size: 12px; line-height: 1.6; }
</style>
