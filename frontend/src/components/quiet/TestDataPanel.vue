<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { DAY_TYPES, HOURLY_LABEL, hourLabel, slotLabel } from '../../lib/hourlyApi.js'

// 探索地圖左上的「模擬環境」：平常收起成一顆按鈕，點開可自選平日／週末與時段（Ynn622/30w#5）。
// 敏感圖層一律來自後端模擬網格；關閉時自動顯示臺北當下時段，開啟時改看自選時段，按鈕本身就是長駐標示。
// 只影響地圖的敏感圖層，推薦場所與其他頁面不受影響。
// 時段滑桿拖曳時只更新畫面上的時段文字，放開（change）才寫入偏好並查詢後端，避免拖過的每一小時都打 API。
const props = defineProps({ city: { type: Object, required: true } })
const open = ref(false)
const preferences = computed(() => props.city.preferences.value)
const remote = computed(() => props.city.remoteMock.value)
const draftHour = ref(preferences.value.hour)
watch(() => preferences.value.hour, hour => { draftHour.value = hour })
const draftSlot = computed(() => `${hourLabel(draftHour.value)}–${hourLabel((draftHour.value + 1) % 24)}`)
const hourly = computed(() => props.city.hourly)
function setRemote(event) { props.city.preferences.value.dataMode = event.target.checked ? 'remote-hourly' : 'live' }
function setDayType(id) { props.city.preferences.value.dayType = id }
function previewHour(event) { draftHour.value = Number(event.target.value) }
function commitHour(event) {
  const hour = Number(event.target.value)
  draftHour.value = hour
  if (hour !== preferences.value.hour) props.city.preferences.value.hour = hour
}
</script>

<template>
  <div class="test-data" :class="{ remote }">
    <button type="button" class="test-data-toggle" :aria-expanded="open" aria-controls="test-data-panel" @click="open = !open">
      <span class="toggle-text"><template v-if="remote"><strong>模擬環境：{{ slotLabel(preferences) }}</strong><span>{{ HOURLY_LABEL }}</span></template><strong v-else>模擬環境</strong></span>
      <AppIcon class="test-data-chevron" :class="{ open }" name="chevron" :size="15" />
    </button>
    <section v-show="open" id="test-data-panel" class="test-data-panel" aria-label="模擬環境設定">
      <label class="test-data-row switch-row"><span><strong>使用模擬環境</strong><small>開啟後敏感圖層改看你選的典型時段</small></span><input class="q-switch" type="checkbox" role="switch" :checked="remote" :aria-checked="remote" @change="setRemote"/></label>
      <template v-if="remote">
        <div class="test-data-row"><span id="test-day-label" class="row-label">日期類型</span>
          <div class="day-switch" role="group" aria-labelledby="test-day-label"><button v-for="item in DAY_TYPES" :key="item.id" type="button" :class="{ selected: preferences.dayType === item.id }" :aria-pressed="preferences.dayType === item.id" @click="setDayType(item.id)">{{ item.label }}</button></div>
        </div>
        <div class="test-data-row hour-row">
          <label for="test-hour" class="row-label">時段</label>
          <output for="test-hour" class="hour-value">{{ draftSlot }}</output>
          <input id="test-hour" class="q-range hour-range" type="range" min="0" max="23" step="1" :value="draftHour" :aria-valuetext="draftSlot" @input="previewHour" @change="commitHour"/>
          <span class="hour-ticks" aria-hidden="true"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></span>
        </div>
      </template>
      <p v-if="hourly?.state?.value === 'loading'" class="test-data-status" role="status">模擬網格載入中…</p>
      <p v-else-if="hourly?.state?.value === 'error'" class="test-data-status error" role="alert">{{ hourly.error.value }}<button type="button" class="q-text-button" @click="hourly.reload">重試</button></p>
    </section>
  </div>
</template>

<style scoped>
.test-data { pointer-events: auto; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; max-width: calc(100vw - 84px); }
.test-data-toggle { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 4px 10px 4px 14px; border: 1px solid #dce6ed; border-radius: 22px; background: #fffffff2; color: #34434c; font: inherit; font-size: 12px; line-height: 1.4; text-align: left; cursor: pointer; box-shadow: 0 2px 8px #2447561a; }
.test-data.remote .test-data-toggle { border-color: #f1dcc4; background: #fff4e8f5; color: #7a4a1f; }
.toggle-text { display: flex; flex-wrap: wrap; gap: 0 8px; }
.test-data-toggle strong { font-weight: 650; }
.test-data-chevron { flex: none; color: currentColor; transform: rotate(90deg); transition: transform .2s ease; }
.test-data-chevron.open { transform: rotate(-90deg); }
.test-data-panel { width: min(300px, calc(100vw - 84px)); max-height: 60dvh; overflow-y: auto; padding: 4px 12px 10px; border: 1px solid #dce6ed; border-radius: 12px; background: #fff; color: #34434c; box-shadow: 0 6px 18px #24475626; }
.test-data-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 14px; }
.switch-row { justify-content: space-between; cursor: pointer; }
.switch-row span { display: grid; gap: 2px; }
.switch-row small { color: #66747d; font-size: 12px; line-height: 1.5; }
.switch-row .q-switch { flex: none; margin: 0; }
.row-label { flex: none; width: 4.2em; font-weight: 600; }
.day-switch { display: grid; flex: 1; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 2px; border-radius: 22px; background: #eef2f4; }
.day-switch button { min-height: 44px; border: 0; border-radius: 22px; background: transparent; color: #56656e; font: inherit; font-size: 14px; cursor: pointer; }
.day-switch button.selected { background: #fff; color: var(--q-deep, #007a90); font-weight: 600; box-shadow: 0 1px 3px #1d3c4a24; }
.hour-row { display: grid; grid-template-columns: auto 1fr; row-gap: 2px; }
.hour-value { justify-self: end; color: var(--q-deep, #007a90); font-weight: 650; font-variant-numeric: tabular-nums; }
.hour-range { grid-column: 1 / -1; width: 100%; min-height: 44px; margin: 0; }
.hour-ticks { grid-column: 1 / -1; position: relative; height: 14px; color: #7a8790; font-size: 11px; }
.hour-ticks span { position: absolute; transform: translateX(-50%); }
.hour-ticks span:nth-child(1) { left: 0; transform: none; }
.hour-ticks span:nth-child(2) { left: calc(6 / 23 * 100%); }
.hour-ticks span:nth-child(3) { left: calc(12 / 23 * 100%); }
.hour-ticks span:nth-child(4) { left: calc(18 / 23 * 100%); }
.hour-ticks span:nth-child(5) { right: 0; left: auto; transform: none; }
.test-data-status { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 4px 0 0; padding: 6px 9px; border-radius: 8px; background: #eef6f9; color: #3f5d6b; font-size: 12px; line-height: 1.5; }
.test-data-status.error { background: #fdeceb; color: #9a3a2f; }
.test-data-status .q-text-button { min-height: 32px; padding: 0 6px; font-size: 12px; }
@media (prefers-reduced-motion: reduce) { .test-data-chevron { transition: none; } }
</style>
