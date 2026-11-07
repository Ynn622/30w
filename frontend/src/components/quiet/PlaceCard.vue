<script setup>
import AppIcon from '../AppIcon.vue'
import PlaceArtwork from './PlaceArtwork.vue'
import SensoryScore from './SensoryScore.vue'
import { SENSES, levelText } from '../../lib/sensoryDomain.js'

defineProps({ place: { type: Object, required: true }, mock: Boolean })
defineEmits(['select'])
</script>

<template>
  <button class="q-place-card" type="button" @click="$emit('select', place.id)">
    <div class="place-thumbnail"><PlaceArtwork :kind="place.artwork" /></div>
    <div class="place-card-copy">
      <div class="place-card-title"><h3>{{ place.name }}</h3><span class="q-tag">{{ place.tag || '候選休息點' }}</span></div>
      <p class="place-card-meta"><span class="place-category"><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="15" />{{ place.category }}</span><span class="place-distance">{{ place.distanceM == null ? '距離待確認' : `${place.distanceM} 公尺直線` }}</span></p>
      <div class="mini-senses"><span v-for="sense in SENSES" :key="sense.key"><AppIcon :name="sense.icon" :size="17" /><span class="sr-only">{{ sense.label }}</span>{{ levelText((place.assessment?.dimensions || place.senses)?.[sense.key]) }}</span></div>
      <SensoryScore v-if="place.assessment" :assessment="place.assessment" :mock="mock" compact />
    </div>
    <AppIcon class="place-chevron" name="chevron" :size="19" />
  </button>
</template>

<style scoped>
.q-place-card { position: relative; width: 100%; min-width: 0; gap: 10px; min-height: 109px; margin: 8px 0; padding: 10px; border: 1px solid #e3e7ea; border-radius: 11px; background: #fff; box-shadow: none; text-align: left; }
.q-place-card:hover { border-color: #a7d4dc; background: #fbfeff; box-shadow: none; }
.place-thumbnail { width: 75px; height: 83px; flex-shrink: 0; border-radius: 8px; overflow: hidden; }
.place-card-copy { min-width: 0; flex: 1; }
.place-card-title { display: flex; flex-wrap: wrap; gap: 4px 7px; align-items: center; }
.place-card-title h3 { margin: 0; font-size: 16px; font-weight: 650; line-height: 1.4; letter-spacing: -.02em; color: #26323a; }
.q-tag { padding: 3px 6px; border-radius: 5px; font-size: 12px; line-height: 1.4; font-weight: 500; color: #337438; background: #e6f5df; }
.place-card-copy .place-card-meta { display: flex; flex-wrap: wrap; column-gap: 8px; row-gap: 3px; margin: 6px 0 8px; font-size: 12px; line-height: 1.5; color: #6b7680; }
.place-category { display: inline-flex; align-items: center; gap: 4px; }
.place-category svg { color: #7b5f96; flex-shrink: 0; }
.place-distance { color: #6b7680; }
.mini-senses { display: flex; flex-wrap: wrap; column-gap: 12px; row-gap: 4px; font-size: 13px; line-height: 1.4; }
.mini-senses > span { display: inline-flex; align-items: center; gap: 5px; color: #486d81; }
.mini-senses > span:nth-child(2) { color: #4b5f6d; }
.mini-senses > span:nth-child(2) svg { color: #b38b2b; }
.mini-senses > span:nth-child(3) { color: #48778a; }
.mini-senses > span:nth-child(4) svg { color: #3c9f9d; }
.place-chevron { flex-shrink: 0; color: #58646c; }
@media (max-width: 359px) {
  .q-place-card { gap: 8px; padding: 9px; }
  .place-thumbnail { width: 62px; height: 85px; }
  .place-card-title h3 { font-size: 15px; }
  .q-tag { font-size: 12px; }
  .place-card-copy .place-card-meta { font-size: 12px; column-gap: 6px; }
  .mini-senses { column-gap: 8px; font-size: 13px; }
  .place-chevron { width: 15px; }
}
</style>
