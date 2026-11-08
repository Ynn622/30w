<script setup>
import AppIcon from '../AppIcon.vue'
import { computed } from 'vue'
import PlacePhoto from './PlacePhoto.vue'
import SensoryScore from './SensoryScore.vue'
import { SENSES, levelText } from '../../lib/sensoryDomain.js'
import { placeImage } from '../../lib/placeImage.js'

const props = defineProps({ place: { type: Object, required: true }, mock: Boolean })
// 卡片是按鈕，不能放連結：只列作者與授權的純文字，完整署名與來源連結在場所詳情。
const image = computed(() => placeImage(props.place))
// 距離：1 公里內以公尺顯示（取整到 10 公尺），以上以公里顯示到小數第一位（與場所詳情一致）。
const distanceText = computed(() => {
  const meters = props.place.distanceM
  if (!Number.isFinite(meters)) return '距離未知'
  return meters < 1000 ? `距離約 ${Math.max(10, Math.round(meters / 10) * 10)} 公尺` : `距離約 ${(meters / 1000).toFixed(1)} 公里`
})
defineEmits(['select'])
</script>

<template>
  <button class="q-place-card" type="button" @click="$emit('select', place.ref ?? place.id)">
    <div class="place-thumbnail"><PlacePhoto :place="place" /></div>
    <div class="place-card-copy">
      <div class="place-card-title"><h3>{{ place.name }}</h3><span class="q-tag">{{ place.tag || '候選休息點' }}</span></div>
      <p class="place-card-meta"><span class="place-category"><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="15" />{{ place.category }}</span><span class="place-distance">{{ distanceText }}</span></p>
      <div class="mini-senses"><span v-for="sense in SENSES" :key="sense.key"><AppIcon :name="sense.icon" :size="17" /><span class="sr-only">{{ sense.label }}</span>{{ levelText((place.assessment?.dimensions || place.senses)?.[sense.key]) }}</span></div>
      <SensoryScore v-if="place.assessment" :assessment="place.assessment" :mock="mock" compact />
      <p v-if="image" class="place-card-credit">{{ image.kind === 'reviewed' ? '照片' : '參考照片' }}：{{ image.author }}・{{ image.license }}</p>
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
.place-card-credit { margin: 4px 0 0; color: #6b7680; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
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
