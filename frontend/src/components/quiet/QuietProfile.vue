<script setup>
// 裝置已開啟「減少動態」時只提示可開啟低刺激模式，不自動替使用者開啟。
const prefersReducedMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
import AppIcon from '../AppIcon.vue'
import { DAY_TYPES, HOURLY_LABEL, HOURS, hourLabel } from '../../lib/hourlyApi.js'
const props = defineProps({ city: { type: Object, required: true } })
// 模擬網格的資料來源（後端 meta.sources）；部分項目只有 id，沒有名稱時顯示 id。
const hourlySources = () => props.city.hourly?.meta?.value?.sources || []
const httpsOnly = value => typeof value === 'string' && value.startsWith('https://') ? value : null
function setRemote(event) { props.city.preferences.value.dataMode = event.target.checked ? 'remote-hourly' : 'live' }
defineEmits(['select', 'explore'])
const sensitivities = [{ key: 'noise', label: '聲音', icon: 'sound' }, { key: 'light', label: '光線', icon: 'sun' }, { key: 'crowd', label: '人潮', icon: 'people' }, { key: 'odor', label: '氣味', icon: 'wind' }]
const levelWords = ['', '不太在意', '稍微在意', '普通', '在意', '非常在意']
</script>
<template>
  <section class="quiet-view profile-quiet-view"><header class="q-page-header"><h1>我的設定</h1><p>調整感官敏感度與介面，讓推薦更適合你。</p></header>
    <section class="q-settings-card"><div class="section-heading"><h2>感官敏感度</h2><span>僅在此裝置計算</span></div>
      <p class="q-helper sensitivity-help">數字越大代表越在意，用於計算個人適配分數（SFS）並排序推薦；不會改變環境刺激指數，也不會上傳。</p>
      <div v-for="item in sensitivities" :key="item.key" class="sensitivity-row">
        <label :for="`sensitivity-${item.key}`"><span class="setting-icon"><AppIcon :name="item.icon" :size="20"/></span><strong>{{ item.label }}</strong><output :for="`sensitivity-${item.key}`">{{ city.preferences.value.sensitivities[item.key] }}／5 {{ levelWords[city.preferences.value.sensitivities[item.key]] }}</output></label>
        <input :id="`sensitivity-${item.key}`" v-model.number="city.preferences.value.sensitivities[item.key]" class="q-range" type="range" min="1" max="5" step="1" :aria-valuetext="`${city.preferences.value.sensitivities[item.key]}，${levelWords[city.preferences.value.sensitivities[item.key]]}`"/>
      </div>
    </section>
    <section class="q-settings-card"><div class="section-heading"><h2>介面</h2></div><label class="q-setting-row"><span class="setting-icon"><AppIcon name="layers" :size="22"/></span><span><strong>低刺激模式</strong><small>柔和配色、停止動畫、加大按鈕並隱藏裝飾。</small></span><input v-model="city.preferences.value.lowStimulus" class="q-switch" type="checkbox"/></label><p v-if="prefersReducedMotion && !city.preferences.value.lowStimulus" class="q-helper motion-hint">你的裝置已開啟「減少動態」，可一併開啟低刺激模式。</p></section>
    <!-- 測試資料（Ynn622/30w#5）：明確切換正式資料與後端逐小時模擬網格；模擬網格只畫敏感圖層，不混入正式安靜程度。 -->
    <section class="q-settings-card test-data-card"><div class="section-heading"><h2>測試資料</h2><span>展示與測試用</span></div>
      <label class="q-setting-row"><span class="setting-icon"><AppIcon name="layers" :size="22"/></span><span><strong>使用模擬情境</strong><small>敏感圖層改用臺北 3 萬個模擬網格的典型時段；推薦場所仍為正式資料，回報與量測會停用。</small></span><input class="q-switch" type="checkbox" role="switch" :checked="city.remoteMock.value" :aria-checked="city.remoteMock.value" @change="setRemote"/></label>
      <template v-if="city.remoteMock.value">
        <div class="slot-row"><span id="day-type-label">日期類型</span>
          <div class="day-switch" role="group" aria-labelledby="day-type-label"><button v-for="item in DAY_TYPES" :key="item.id" type="button" :class="{ selected: city.preferences.value.dayType === item.id }" :aria-pressed="city.preferences.value.dayType === item.id" @click="city.preferences.value.dayType = item.id">{{ item.label }}</button></div>
        </div>
        <label class="slot-row"><span>時段</span><select v-model.number="city.preferences.value.hour" class="hour-select"><option v-for="hour in HOURS" :key="hour" :value="hour">{{ hourLabel(hour) }}–{{ hourLabel((hour + 1) % 24) }}</option></select></label>
      </template>
      <p class="q-helper test-data-note">{{ city.remoteMock.value ? `目前顯示：${HOURLY_LABEL}。所選時段代表臺北的典型平日或週末，不是實際日期；格網中心不是場所或可通行證明，無資料不代表安靜。` : '目前顯示正式資料：即時回報、量測與開放資料。' }}</p>
      <details v-if="city.remoteMock.value && hourlySources().length" class="hourly-sources"><summary>模擬網格資料來源</summary>
        <ul><li v-for="source in hourlySources()" :key="source.id"><a v-if="httpsOnly(source.url)" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name || source.id }}</a><span v-else>{{ source.name || source.id }}</span><small v-if="source.attribution || source.license">{{ [source.attribution, source.license].filter(Boolean).join('・') }}</small></li></ul>
      </details>
    </section>
    <footer class="quiet-footer"><AppIcon name="wave" :size="18"/><span>聆靜・讓每一種感受，都有地方。</span></footer>
  </section>
</template>

<style scoped>
.slot-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; color: #3a4850; font-size: 14px; }
.slot-row > span { flex: none; width: 4.5em; font-weight: 600; }
.day-switch { display: grid; flex: 1; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 2px; border-radius: 22px; background: #eef2f4; }
.day-switch button { min-height: 44px; border: 0; border-radius: 22px; background: transparent; color: #56656e; font: inherit; font-size: 14px; cursor: pointer; }
.day-switch button.selected { background: #fff; color: var(--q-deep, #007a90); font-weight: 600; box-shadow: 0 1px 3px #1d3c4a24; }
.hourly-sources { margin-top: 8px; color: #4f5f69; font-size: 13px; }
.hourly-sources summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--q-deep, #007a90); }
.hourly-sources ul { margin: 0; padding: 0; list-style: none; }
.hourly-sources li { display: grid; gap: 2px; padding: 6px 0; border-top: 1px solid #edf1f4; }
.hourly-sources a { color: var(--q-deep, #007a90); }
.hourly-sources small { color: #66747d; font-size: 12px; }
.hour-select { flex: 1; min-width: 0; min-height: 44px; padding: 0 10px; border: 1px solid #d6e2e8; border-radius: 10px; background: #fff; color: var(--q-ink, #27323a); font: inherit; font-size: 14px; }
.test-data-note { margin: 8px 0 0; font-size: 12px; line-height: 1.6; }
</style>
