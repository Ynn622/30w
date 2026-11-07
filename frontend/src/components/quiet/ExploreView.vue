<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlaceCard from './PlaceCard.vue'
import BottomSheet from './BottomSheet.vue'
import LocationGate from './LocationGate.vue'
import { MOCK_LABEL, SEARCH_RADIUS, formatTime } from '../../lib/sensoryDomain.js'

const SensoryMap = defineAsyncComponent(() => import('./SensoryMap.vue'))
defineProps({ city: { type: Object, required: true } })
defineEmits(['select', 'sources'])
const layer = ref('noise'), sheet = ref('peek')
const SHEET_PEEK = 116 // 最小收合高度，實際依標題列高度自動調整
// 「感官地圖／靜音推薦」對應底部抽屜收合／展開，兩者是同一份推薦清單。
const mode = computed(() => sheet.value === 'peek' ? 'map' : 'quiet')
function setMode(value) { sheet.value = value === 'map' ? 'peek' : sheet.value === 'peek' ? 'half' : sheet.value }
// 篩選條件改由「我的」頁設定，探索頁把空間留給地圖；聲音熱區可用開關顯示或隱藏。
const showLayer = ref(true)
</script>

<template>
  <section class="quiet-view explore-view">
    <h1 class="sr-only">探索・感官地圖與靜音推薦</h1>
    <LocationGate v-if="!city.serviceAvailable.value" :city="city" />
    <template v-else>
    <div class="q-segment explore-tabs" role="group" aria-label="探索模式">
      <button type="button" :class="{ selected: mode === 'map' }" :aria-pressed="mode === 'map'" @click="setMode('map')"><AppIcon name="map" :size="21"/>感官地圖</button>
      <button type="button" :class="{ selected: mode === 'quiet' }" :aria-pressed="mode === 'quiet'" @click="setMode('quiet')"><AppIcon name="leaf" :size="21"/>靜音推薦</button>
    </div>

    <div class="explore-context">
      <span class="q-area-select"><AppIcon name="pin" :size="16"/>{{ city.area.value.name }}<button type="button" class="q-icon-button relocate" :disabled="city.locating.value" :aria-label="city.locating.value ? '定位中' : '重新定位'" @click="city.locate"><AppIcon name="locate" :size="17"/></button></span>
      <label class="layer-switch"><span>聲音圖層</span><input v-model="showLayer" class="q-switch" type="checkbox" role="switch" :aria-checked="showLayer" aria-label="顯示聲音刺激圖層"/></label>
    </div>

    <div class="explore-stage">
      <SensoryMap :places="city.recommendations.value" :low-stimulus="city.preferences.value.lowStimulus" :cells="city.map.data.value?.cells || []" :center="city.center.value" :layer="layer" :layer-visible="showLayer" :device-located="Boolean(city.deviceLocation.value)" @select="$emit('select', $event)" @locate="city.locate" @viewchange="city.setMapCenter" />
      <BottomSheet v-model:snap="sheet" :peek="SHEET_PEEK" label="附近靜音推薦">
        <template #header>
          <div class="section-heading"><h2>{{ mode === 'quiet' ? '符合你的靜音推薦' : '附近靜音推薦' }}<small>（{{ city.searchingElsewhere.value ? '地圖中心 ' : '' }}{{ SEARCH_RADIUS }} 公尺內）</small></h2><span class="count-badge">{{ city.searchAvailable.value ? city.recommendations.value.length : 0 }} 處</span></div>
          <div class="map-data-note"><span>{{ city.searchingElsewhere.value ? `地圖中心・${city.searchArea.value?.name || '臺北市外'}` : '目前位置' }} · {{ city.map.meta.value?.mock ? '模擬圖層' : '近期回報' }}</span><button type="button" class="q-text-button" @click="$emit('sources')"><AppIcon name="shield" :size="14"/>{{ formatTime(city.map.meta.value?.updatedAt) }}</button></div>
        </template>
        <AsyncState v-if="city.map.state.value === 'error'" state="error" :message="city.map.error.value" retry @retry="city.map.reload" />
        <p class="q-helper preference-help">{{ SEARCH_RADIUS }} 公尺內的地點，{{ city.preferences.value.sort === 'fit' ? '依你在「我的」設定的敏感度排序，完整資料優先。' : '依直線距離排序。' }}未知或過期資料不會被當成低刺激。</p>
        <p v-if="city.places.meta.value?.mock" class="mock-inline">{{ MOCK_LABEL }}</p>
        <p v-if="!city.searchAvailable.value" class="outside-search" role="status">地圖中心不在臺北市內，無法提供此區域的地點；請把地圖移回臺北市。</p>
        <AsyncState v-else-if="city.places.state.value !== 'ready'" :state="city.places.state.value" :message="city.places.error.value" retry @retry="city.places.reload" />
        <AsyncState v-else-if="!city.recommendations.value.length" title="還沒有符合條件的場所" message="試著放寬感官條件或增加距離；資料不足不代表環境安靜。" />
        <PlaceCard v-for="place in city.recommendations.value" v-else :key="place.id" :place="place" :mock="Boolean(city.places.meta.value?.mock)" @select="$emit('select', $event)" />
        <p class="q-helper list-footnote"><AppIcon name="shield" :size="15"/>開放與無障礙狀況以現場為準。</p>
      </BottomSheet>
    </div>
    </template>
  </section>
</template>

<style scoped>
.explore-view { display: flex; flex-direction: column; height: 100dvh; min-height: 0; overflow: hidden; padding: calc(10px + env(safe-area-inset-top)) 12px calc(70px + env(safe-area-inset-bottom)); background: #fff; }
.explore-view > :not(.explore-stage) { flex: none; }
/* 地圖填滿剩餘高度，底部抽屜覆蓋在地圖上；地圖底緣留給收合時的抽屜，確保授權標示不被遮住。 */
.explore-stage { position: relative; flex: 1; min-height: 240px; margin: 0 -12px; overflow: hidden; }
.explore-stage :deep(.sensory-map-wrap) { position: absolute; inset: 0 0 calc(var(--sheet-peek, 124px) - 18px); height: auto; border: 0; border-radius: 0; }
.explore-stage :deep(.maplibregl-ctrl-bottom-left) { margin-bottom: 18px; }
.explore-tabs { gap: 0; padding: 0; background: #f1f3f5; border-radius: 10px 10px 0 0; overflow: hidden; }
.explore-tabs button { position: relative; gap: 9px; min-height: 49px; padding: 10px 6px; border: 0; border-radius: 0; background: transparent; color: #68727a; font-size: 16px; font-weight: 600; box-shadow: none; }
.explore-tabs button.selected { color: var(--q-deep, #007a90); background: #fff; box-shadow: none; }
.explore-tabs button.selected::after { position: absolute; content: ''; bottom: 0; left: 0; right: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--q-brand, #0391a7); }
.explore-context { display: flex; gap: 8px; align-items: center; justify-content: space-between; min-height: 44px; margin: 3px 0 0; }
.q-area-select { gap: 4px; font-size: 13px; color: var(--q-brand, #0391a7); }
.q-area-select { color: var(--q-ink, #27323a); font-weight: 600; }
.q-area-select svg { color: var(--q-brand, #0391a7); }
.relocate { width: 44px; min-height: 44px; padding: 0; color: var(--q-brand, #0391a7); }
.outside-search { margin: 4px 0 10px; padding: 9px 11px; border-radius: 8px; background: #fff4e8; color: #7a4a1f; font-size: 13px; line-height: 1.6; }
.layer-switch { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: #4f5f69; font-size: 13px; white-space: nowrap; cursor: pointer; }
.layer-switch .q-switch { margin: 0; }
.explore-context { margin-bottom: 6px; gap: 4px; }
.explore-context > * { white-space: nowrap; }
.q-area-select { flex-shrink: 0; }
.map-data-note { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 32px; font-size: 12px; color: #6f7c86; }
.map-data-note .q-text-button { gap: 4px; color: #63757f; font-size: 12px; }
.section-heading { align-items: center; margin-bottom: 0; }
.section-heading h2 { font-size: 17px; line-height: 1.5; color: #28343c; }
.section-heading h2 small { font-size: 13px; font-weight: 400; color: #63717a; white-space: nowrap; }
.count-badge { padding: 4px 7px; font-size: 12px; border-radius: 5px; color: #49727a; background: #edf8fb; white-space: nowrap; }
.preference-help { margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: #62737e; }
.mock-inline { margin: 0 0 8px; padding: 6px 8px; background: #f4f7f9; color: #65747d; border-radius: 6px; font-size: 12px; line-height: 1.6; }
.list-footnote { gap: 6px; margin: 15px 0 3px; font-size: 12px; line-height: 1.6; color: #6c7c85; }
@media (max-width: 359px) {
  .layer-switch { font-size: 12px; }
  .explore-view { padding-inline: 10px; }
  .section-heading h2 small { font-size: 12px; }
}
</style>
