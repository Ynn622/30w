<script setup>
import { defineAsyncComponent, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlaceCard from './PlaceCard.vue'
import { AREAS, formatTime } from '../../lib/sensoryDomain.js'

const SensoryMap = defineAsyncComponent(() => import('./SensoryMap.vue'))
defineProps({ city: { type: Object, required: true } })
defineEmits(['select', 'sources'])
const mode = ref('map'), layer = ref('noise')
const senseFilters = [
  { key: 'noise', label: '聲音', selected: '低噪' },
  { key: 'light', label: '光線', selected: '柔光' },
  { key: 'crowd', label: '人潮', selected: '少人' },
]
</script>

<template>
  <section class="quiet-view explore-view">
    <header class="explore-title"><h1>探索・感官地圖與靜音推薦</h1></header>
    <div class="q-segment explore-tabs" role="group" aria-label="探索模式">
      <button type="button" :class="{ selected: mode === 'map' }" :aria-pressed="mode === 'map'" @click="mode = 'map'"><AppIcon name="map" :size="21"/>感官地圖</button>
      <button type="button" :class="{ selected: mode === 'quiet' }" :aria-pressed="mode === 'quiet'" @click="mode = 'quiet'"><AppIcon name="leaf" :size="21"/>靜音推薦</button>
    </div>

    <div class="explore-context">
      <label class="q-area-select"><AppIcon name="pin" :size="16"/><select v-model="city.areaId.value" aria-label="探索區域"><option v-for="area in AREAS" :key="area.id" :value="area.id">{{ area.name }}</option></select></label>
      <button type="button" class="indoor-filter" :class="{ selected: city.preferences.value.indoor }" :aria-pressed="city.preferences.value.indoor" @click="city.preferences.value.indoor = !city.preferences.value.indoor"><AppIcon name="home" :size="16"/>只看室內<AppIcon v-if="city.preferences.value.indoor" name="check" :size="14"/></button>
      <span class="current-layer">{{ { noise: '聲音', light: '光線', crowd: '人潮' }[layer] }}圖層</span>
    </div>
    <div class="explore-filters" role="group" aria-label="感官地圖圖層與推薦條件">
      <label v-for="sense in senseFilters" :key="sense.key" class="filter-select" :class="{ selected: city.preferences.value[sense.key], 'active-layer': layer === sense.key }">
        <select v-model="city.preferences.value[sense.key]" :aria-label="`${sense.label}刺激條件；開啟時顯示${sense.label}圖層`" @focus="layer = sense.key" @pointerdown="layer = sense.key" @change="layer = sense.key"><option :value="false">{{ sense.label }}</option><option :value="true">{{ sense.selected }}</option></select>
      </label>
      <label class="filter-select distance-filter"><select v-model.number="city.preferences.value.radius" aria-label="最多探索直線距離"><option :value="300">300 公尺</option><option :value="500">500 公尺</option><option :value="1000">1 公里</option></select></label>
    </div>

    <SensoryMap :places="city.places.data.value?.places || []" :cells="city.map.data.value?.cells || []" :center="city.center.value" :layer="layer" :reference-time="city.mode === 'demo' ? city.map.meta.value?.referenceTime : ''" :device-located="Boolean(city.deviceLocation.value)" @select="$emit('select', $event)" @locate="city.locate" />
    <div class="map-data-note"><span>{{ city.deviceLocation.value ? '目前位置' : '手動區域中心' }} · {{ city.mode === 'demo' ? '示範圖層' : '近期回報' }}</span><button type="button" class="q-text-button" @click="$emit('sources')"><AppIcon name="shield" :size="14"/>{{ formatTime(city.map.meta.value?.updatedAt) }}</button></div>
    <AsyncState v-if="city.map.state.value === 'error'" state="error" :message="city.map.error.value" retry @retry="city.map.reload" />

    <Transition name="quiet-fade" mode="out-in">
      <div :key="mode" class="recommendation-panel">
        <div class="panel-grip" aria-hidden="true"></div>
        <div class="section-heading"><h2>{{ mode === 'quiet' ? '符合你的靜音推薦' : '附近靜音推薦' }}<small>（{{ city.preferences.value.radius }} 公尺內）</small></h2><span class="count-badge">{{ city.places.data.value?.places?.length || 0 }} 處</span></div>
        <p v-if="mode === 'quiet'" class="q-helper preference-help">選擇低噪、柔光或少人，尋找同時符合偏好的休息空間。</p>
        <p v-if="city.mode === 'demo'" class="demo-inline">示範資料・虛構場所，距離為直線估算，請勿據此前往。</p>
        <AsyncState v-if="city.places.state.value !== 'ready'" :state="city.places.state.value" :message="city.places.error.value" retry @retry="city.places.reload" />
        <AsyncState v-else-if="!city.places.data.value?.places?.length" title="還沒有符合條件的場所" message="試著放寬感官條件或增加距離；資料不足不代表環境安靜。" />
        <PlaceCard v-for="place in city.places.data.value?.places || []" v-else :key="place.id" :place="place" @select="$emit('select', $event)" />
        <p class="q-helper list-footnote"><AppIcon name="shield" :size="15"/>開放與無障礙狀況以現場為準。</p>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.explore-view { padding: calc(15px + env(safe-area-inset-top)) 12px calc(94px + env(safe-area-inset-bottom)); background: #fff; }
.explore-title h1 { margin: 0 0 14px; font-size: 21px; line-height: 1.4; color: var(--q-ink, #27323a); letter-spacing: -.025em; }
.explore-tabs { gap: 0; padding: 0; background: #f1f3f5; border-radius: 10px 10px 0 0; overflow: hidden; }
.explore-tabs button { position: relative; gap: 9px; min-height: 49px; padding: 10px 6px; border: 0; border-radius: 0; background: transparent; color: #68727a; font-size: 16px; font-weight: 600; box-shadow: none; }
.explore-tabs button.selected { color: var(--q-deep, #007a90); background: #fff; box-shadow: none; }
.explore-tabs button.selected::after { position: absolute; content: ''; bottom: 0; left: 0; right: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--q-brand, #0391a7); }
.explore-context { display: flex; gap: 8px; align-items: center; justify-content: space-between; min-height: 44px; margin: 3px 0 0; }
.q-area-select { gap: 4px; font-size: 13px; color: var(--q-brand, #0391a7); }
.q-area-select select { min-height: 44px; max-width: 95px; padding: 4px 0; font-size: 13px; color: var(--q-ink, #27323a); }
.indoor-filter { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 5px 7px; border: 0; background: transparent; color: #697982; font-size: 13px; }
.indoor-filter.selected { color: var(--q-deep, #007a90); font-weight: 600; }
.current-layer { color: #74818a; font-size: 12px; white-space: nowrap; }
.explore-filters { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(95px, 1.35fr); gap: 6px; padding: 2px 0 10px; }
.filter-select { min-width: 0; position: relative; border: 1px solid #dfe4e8; border-radius: 22px; background: white; }
.filter-select::after { content: ''; position: absolute; right: 11px; top: 17px; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); color: #627079; pointer-events: none; }
.filter-select select { appearance: none; display: block; width: 100%; min-height: 44px; padding: 8px 23px 8px 11px; font: inherit; font-size: 14px; color: #33414a; border: 0; border-radius: inherit; background: transparent; cursor: pointer; }
.filter-select.selected { border-color: #86c8d2; background: #effafd; }
.filter-select.selected select, .filter-select.selected::after { color: #087d90; }
.filter-select.active-layer { box-shadow: inset 0 -2px 0 #0391a7; }
.distance-filter select { padding-left: 9px; }
:deep(.sensory-map-wrap) { height: 322px; border-radius: 11px 11px 0 0; border-color: #e1e7e9; }
.map-data-note { padding: 0 6px; min-height: 44px; font-size: 12px; color: #6f7c86; background: #f5fafc; }
.map-data-note .q-text-button { gap: 4px; color: #63757f; font-size: 12px; }
.recommendation-panel { padding: 0 0 8px; background: #fff; }
.panel-grip { width: 38px; height: 4px; margin: 8px auto 10px; border-radius: 5px; background: #c9d1d5; }
.section-heading { align-items: center; margin-bottom: 9px; }
.section-heading h2 { font-size: 17px; line-height: 1.5; color: #28343c; }
.section-heading h2 small { font-size: 13px; font-weight: 400; color: #63717a; white-space: nowrap; }
.count-badge { padding: 4px 7px; font-size: 12px; border-radius: 5px; color: #49727a; background: #edf8fb; white-space: nowrap; }
.preference-help { margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: #62737e; }
.demo-inline { margin: 0 0 8px; padding: 6px 8px; background: #f4f7f9; color: #65747d; border-radius: 6px; font-size: 12px; line-height: 1.6; }
.list-footnote { gap: 6px; margin: 15px 0 3px; font-size: 12px; line-height: 1.6; color: #6c7c85; }
@media (max-width: 359px) {
  .explore-view { padding-inline: 10px; }
  .explore-title h1 { font-size: 20px; }
  .explore-filters { gap: 5px; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(89px, 1.35fr); }
  .filter-select select { padding-left: 9px; padding-right: 18px; }
  .filter-select::after { right: 8px; }
  .current-layer { font-size: 12px; }
  .section-heading h2 small { font-size: 12px; }
}
</style>
