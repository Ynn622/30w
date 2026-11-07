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
</script>
<template>
  <section class="quiet-view explore-view">
    <header class="q-page-header"><span class="q-eyebrow">FIND YOUR QUIET</span><h1>探索城市的<span>另一種節奏</span></h1><p>走一小段，找回舒服的自己。</p></header>
    <div class="q-segment" role="group" aria-label="探索模式"><button :class="{ selected: mode === 'map' }" :aria-pressed="mode === 'map'" @click="mode = 'map'"><AppIcon name="map" :size="18"/>感官地圖</button><button :class="{ selected: mode === 'quiet' }" :aria-pressed="mode === 'quiet'" @click="mode = 'quiet'"><AppIcon name="leaf" :size="18"/>靜音推薦</button></div>
    <div class="explore-area-row"><label class="q-area-select"><AppIcon name="pin" :size="14"/><select v-model="city.areaId.value" aria-label="探索區域"><option v-for="area in AREAS" :key="area.id" :value="area.id">{{ area.name }}</option></select></label><label class="radius-select">距離<select v-model.number="city.preferences.value.radius" aria-label="最多探索直線距離"><option :value="300">300 公尺</option><option :value="500">500 公尺</option><option :value="1000">1 公里</option></select></label></div>
    <div class="map-layer-row" role="group" aria-label="感官地圖圖層"><button v-for="item in [{ key: 'noise', label: '聲音', icon: 'sound' }, { key: 'light', label: '光線', icon: 'sun' }, { key: 'crowd', label: '人潮', icon: 'people' }]" :key="item.key" :class="{ selected: layer === item.key }" :aria-pressed="layer === item.key" @click="layer = item.key"><AppIcon :name="item.icon" :size="15"/>{{ item.label }}</button><span>{{ city.mode === 'demo' ? '示範圖層' : '近期回報' }}</span></div>
    <SensoryMap :places="city.places.data.value?.places || []" :cells="city.map.data.value?.cells || []" :center="city.center.value" :layer="layer" :reference-time="city.mode === 'demo' ? city.map.meta.value?.referenceTime : ''" :device-located="Boolean(city.deviceLocation.value)" @select="$emit('select', $event)" @locate="city.locate" />
    <div class="map-data-note"><span>{{ city.deviceLocation.value ? '目前位置' : '手動區域中心' }} · {{ city.mode === 'demo' ? '示例感官資料' : '回報圖層' }}</span><button class="q-text-button" @click="$emit('sources')">{{ formatTime(city.map.meta.value?.updatedAt) }}<AppIcon name="shield" :size="13"/></button></div>
    <AsyncState v-if="city.map.state.value === 'error'" state="error" :message="city.map.error.value" retry @retry="city.map.reload" />
    <Transition name="quiet-fade" mode="out-in"><div :key="mode" class="recommendation-panel">
      <div class="panel-grip" aria-hidden="true"></div>
      <div class="section-heading"><div><span class="q-eyebrow">{{ mode === 'quiet' ? 'MADE FOR YOUR SENSES' : 'NEARBY QUIET SPOTS' }}</span><h2>{{ mode === 'quiet' ? '依照你的感受，找個地方' : '附近的安靜推薦' }}</h2></div><span class="count-badge">{{ city.places.data.value?.places?.length || 0 }} 處</span></div>
      <p class="q-helper">{{ mode === 'quiet' ? '選擇你想減少的刺激，同時符合才會列入。' : '你可以調整偏好，看看城市還有哪些可能。' }}</p>
      <div class="preference-chips" role="group" aria-label="推薦條件"><button v-for="item in [{ key: 'noise', label: '減少噪音', icon: 'sound' }, { key: 'light', label: '柔和光線', icon: 'sun' }, { key: 'crowd', label: '避開人潮', icon: 'people' }, { key: 'indoor', label: '室內空間', icon: 'home' }]" :key="item.key" :class="{ selected: city.preferences.value[item.key] }" :aria-pressed="city.preferences.value[item.key]" @click="city.preferences.value[item.key] = !city.preferences.value[item.key]"><AppIcon :name="item.icon" :size="14"/>{{ item.label }}<AppIcon v-if="city.preferences.value[item.key]" name="check" :size="12"/></button></div>
      <p v-if="city.mode === 'demo'" class="demo-inline">示範模式・場所為虛構插畫情境，距離為直線估算。</p>
      <AsyncState v-if="city.places.state.value !== 'ready'" :state="city.places.state.value" :message="city.places.error.value" retry @retry="city.places.reload" />
      <AsyncState v-else-if="!city.places.data.value?.places?.length" title="給安靜多一點範圍" message="目前沒有符合條件且資料足夠的場所，試著放寬偏好或增加距離。" />
      <PlaceCard v-for="place in city.places.data.value?.places || []" v-else :key="place.id" :place="place" @select="$emit('select', $event)" />
      <p class="q-helper list-footnote"><AppIcon name="shield" :size="13"/>資訊不足不代表安靜；開放與無障礙狀況以現場為準。</p>
    </div></Transition>
  </section>
</template>
