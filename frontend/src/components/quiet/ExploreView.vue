<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlaceCard from './PlaceCard.vue'
import BottomSheet from './BottomSheet.vue'
import LocationGate from './LocationGate.vue'
import { MOCK_LABEL, searchPlaces } from '../../lib/sensoryDomain.js'
import { NO_DATA_AS_GREEN, buildSensoryField, zoneOf } from '../../lib/sensoryField.js'

const SensoryMap = defineAsyncComponent(() => import('./SensoryMap.vue'))
const props = defineProps({ city: { type: Object, required: true } })
defineEmits(['select', 'sources'])
const sheet = ref('peek')
const SHEET_PEEK = 72 // 最小收合高度，實際依標題列高度自動調整
// 抽屜展開時標題改為「符合你的靜音推薦」。
const mode = computed(() => sheet.value === 'peek' ? 'map' : 'quiet')
// 敏感圖層：依「我的」感官敏感度加權後畫成平滑色帶與等值線，地圖上只有這一個圖層開關。
const showLayer = ref(true)
// 地圖與清單共用同一個平面；敏感度或資料更新時重算（city.now 每次重新整理會更新，讓過期點及時排除）。
const field = computed(() => buildSensoryField(props.city.map.data.value?.cells, props.city.preferences.value.sensitivities, props.city.now.value))
// 文字搜尋：在目前載入的地點中比對名稱、類別、地址與標籤（地圖標記同步篩選）。
const searchText = ref('')
const visiblePlaces = computed(() => searchPlaces(props.city.recommendations.value, searchText.value))
// 敏感圖層開啟時，清單與地圖標記只列綠區內的地點；可切換「顯示全部」。
const greenOnly = ref(true)
const zoneFiltering = computed(() => showLayer.value && greenOnly.value)
const greenPlaces = computed(() => visiblePlaces.value.filter(place => zoneOf(field.value, place.location).green))
const listPlaces = computed(() => zoneFiltering.value ? greenPlaces.value : visiblePlaces.value)
const outsideCount = computed(() => visiblePlaces.value.length - greenPlaces.value.length)
// 排序：距離優先，或依使用者敏感度佔比加權的安靜程度優先（無感官資料的地點排在後面）。
const SORTS = [{ id: 'distance', label: '距離優先' }, { id: 'fit', label: '安靜程度優先' }]
const noQuietData = computed(() => visiblePlaces.value.length > 0 && visiblePlaces.value.every(place => place.assessment?.sfs == null))
</script>

<template>
  <section class="quiet-view explore-view">
    <h1 class="sr-only">探索・感官地圖與靜音推薦</h1>
    <LocationGate v-if="!city.serviceAvailable.value" :city="city" />
    <template v-else>
    <div class="explore-stage">
      <div class="map-switches">
        <label class="layer-switch"><span>敏感圖層</span><input v-model="showLayer" class="q-switch" type="checkbox" role="switch" :aria-checked="showLayer" aria-label="顯示依感官敏感度計算的敏感圖層"/></label>
      </div>
      <SensoryMap :places="listPlaces" :low-stimulus="city.preferences.value.lowStimulus" :field="field" :center="city.center.value" :layer-visible="showLayer" :mock="Boolean(city.map.meta.value?.mock)" :device-located="Boolean(city.deviceLocation.value)" @select="$emit('select', $event)" @locate="city.locate" @viewchange="city.setMapView" />
      <BottomSheet v-model:snap="sheet" :peek="SHEET_PEEK" label="附近靜音推薦">
        <template #header>
          <div class="section-heading"><h2>{{ mode === 'quiet' ? '符合你的靜音推薦' : '附近靜音推薦' }}<small>（{{ city.viewTruncated.value ? `地圖中心 ${city.searchCap / 1000} 公里內` : '地圖範圍內' }}）</small></h2><span class="count-badge">{{ city.searchAvailable.value ? listPlaces.length : 0 }} 處</span></div>
        </template>
        <div class="list-tools">
          <label class="place-search"><AppIcon name="search" :size="18"/><span class="sr-only">搜尋地點</span><input v-model="searchText" type="search" enterkeyhint="search" placeholder="搜尋地點名稱、類別或地址" autocomplete="off"/></label>
          <div class="sort-switch" role="group" aria-label="推薦排序">
            <button v-for="item in SORTS" :key="item.id" type="button" :class="{ selected: city.preferences.value.sort === item.id }" :aria-pressed="city.preferences.value.sort === item.id" @click="city.preferences.value.sort = item.id">{{ item.label }}</button>
          </div>
          <p v-if="city.preferences.value.sort === 'fit' && noQuietData" class="q-helper sort-note">目前地點尚無有效感官資料，暫依距離排列。</p>
          <p v-else-if="city.preferences.value.sort === 'fit'" class="q-helper sort-note">依你在「我的」設定的感官敏感度佔比，計算各地點的安靜程度。</p>
          <div v-if="showLayer" class="zone-note" role="status">
            <span v-if="greenOnly">只列敏感圖層綠區內的地點{{ outsideCount ? `（另有 ${outsideCount} 處不在綠區）` : '' }}{{ NO_DATA_AS_GREEN ? '；無資料處暫視為綠區' : '' }}。</span>
            <span v-else>顯示全部地點，含不在綠區的 {{ outsideCount }} 處。</span>
            <button type="button" class="zone-toggle" @click="greenOnly = !greenOnly">{{ greenOnly ? '顯示全部' : '只看綠區' }}</button>
          </div>
        </div>
        <AsyncState v-if="city.map.state.value === 'error'" state="error" :message="city.map.error.value" retry @retry="city.map.reload" />
        <p v-if="city.places.meta.value?.mock" class="mock-inline">{{ MOCK_LABEL }}</p>
        <p v-if="city.searchAvailable.value && city.viewTruncated.value" class="truncated-search" role="status">地圖範圍較大，只列出地圖中心 {{ city.searchCap / 1000 }} 公里內的地點；放大地圖可查看完整範圍。</p>
        <p v-if="!city.searchAvailable.value" class="outside-search" role="status">地圖中心不在臺北市內，無法提供此區域的地點；請把地圖移回臺北市。</p>
        <AsyncState v-else-if="city.places.state.value !== 'ready'" :state="city.places.state.value" :message="city.places.error.value" retry @retry="city.places.reload" />
        <AsyncState v-else-if="!city.recommendations.value.length" title="還沒有符合條件的場所" message="試著移動或放大地圖；資料不足不代表環境安靜。" />
        <AsyncState v-else-if="!visiblePlaces.length" :title="`找不到符合「${searchText.trim()}」的地點`" message="試試其他關鍵字，或清除搜尋。" />
        <AsyncState v-else-if="!listPlaces.length" title="目前範圍內沒有位於綠區的地點" message="可點「顯示全部」查看其他地點，或移動地圖、調整「我的」感官敏感度。" />
        <PlaceCard v-for="place in listPlaces" v-else :key="place.id" :place="place" :mock="Boolean(city.places.meta.value?.mock)" @select="$emit('select', $event)" />
        <p class="q-helper list-footnote"><AppIcon name="shield" :size="15"/>開放與無障礙狀況以現場為準。</p>
      </BottomSheet>
    </div>
    </template>
  </section>
</template>

<style scoped>
.explore-view { display: flex; flex-direction: column; height: 100dvh; min-height: 0; overflow: hidden; padding: env(safe-area-inset-top) 12px calc(70px + env(safe-area-inset-bottom)); background: #fff; }
.explore-view > :not(.explore-stage) { flex: none; }
/* 地圖填滿剩餘高度，底部抽屜覆蓋在地圖上；地圖底緣留給收合時的抽屜，確保授權標示不被遮住。 */
.explore-stage { position: relative; flex: 1; min-height: 240px; margin: 0 -12px; overflow: hidden; }
/* 地圖左上只有敏感圖層開關，圖例往下讓位。 */
.map-switches { position: absolute; z-index: 3; top: 12px; left: 12px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; pointer-events: none; }
.layer-switch { pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 6px 0 12px; border: 1px solid #dce6ed; border-radius: 22px; background: #fffffff2; color: #34434c; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; box-shadow: 0 2px 8px #2447561a; }
.layer-switch .q-switch { margin: 0; }
.explore-stage :deep(.map-legend) { top: 66px; }
.explore-stage :deep(.sensory-map-wrap) { position: absolute; inset: 0 0 calc(var(--sheet-peek, 124px) - 18px); height: auto; border: 0; border-radius: 0; }
.explore-stage :deep(.maplibregl-ctrl-bottom-left),
.explore-stage :deep(.maplibregl-ctrl-bottom-right) { margin-bottom: 18px; }
.list-tools { display: grid; gap: 8px; margin: 2px 0 10px; }
.place-search { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid #d6e2e8; border-radius: 22px; background: #f7fafb; color: #6a7a83; }
.place-search input { flex: 1; min-width: 0; min-height: 42px; border: 0; background: transparent; color: var(--q-ink, #27323a); font: inherit; font-size: 15px; outline: none; }
.place-search:focus-within { border-color: var(--q-brand, #0391a7); background: #fff; }
.sort-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 2px; border-radius: 22px; background: #eef2f4; }
.sort-switch button { min-height: 44px; border: 0; border-radius: 22px; background: transparent; color: #56656e; font: inherit; font-size: 14px; cursor: pointer; }
.sort-switch button.selected { background: #fff; color: var(--q-deep, #007a90); font-weight: 600; box-shadow: 0 1px 3px #1d3c4a24; }
.sort-note { margin: 0; font-size: 12px; line-height: 1.6; color: #62737e; }
.zone-note { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 4px 4px 11px; border-radius: 10px; background: #edf7f1; color: #2f5d47; font-size: 12px; line-height: 1.6; }
.zone-toggle { flex: none; min-height: 44px; padding: 0 12px; border: 0; border-radius: 22px; background: #fff; color: #2b7d57; font: inherit; font-weight: 600; cursor: pointer; box-shadow: 0 1px 3px #1d3c4a1f; }
.truncated-search { margin: 4px 0 10px; padding: 8px 11px; border-radius: 8px; background: #eef6f9; color: #3f5d6b; font-size: 13px; line-height: 1.6; }
.outside-search { margin: 4px 0 10px; padding: 9px 11px; border-radius: 8px; background: #fff4e8; color: #7a4a1f; font-size: 13px; line-height: 1.6; }
.section-heading { align-items: center; margin-bottom: 0; }
.section-heading h2 { font-size: 17px; line-height: 1.5; color: #28343c; }
.section-heading h2 small { font-size: 13px; font-weight: 400; color: #63717a; white-space: nowrap; }
.count-badge { padding: 4px 7px; font-size: 12px; border-radius: 5px; color: #49727a; background: #edf8fb; white-space: nowrap; }
.mock-inline { margin: 0 0 8px; padding: 6px 8px; background: #f4f7f9; color: #65747d; border-radius: 6px; font-size: 12px; line-height: 1.6; }
.list-footnote { gap: 6px; margin: 15px 0 3px; font-size: 12px; line-height: 1.6; color: #6c7c85; }
@media (max-width: 359px) {
    .explore-view { padding-inline: 10px; }
  .section-heading h2 small { font-size: 12px; }
}
</style>
