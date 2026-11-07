<script setup>
import AppIcon from '../AppIcon.vue'
import PlaceArtwork from './PlaceArtwork.vue'
import SensoryScore from './SensoryScore.vue'
import MockPhoto from './MockPhoto.vue'
import { SENSES, levelText } from '../../lib/sensoryDomain.js'
// 測試情境（Mock）卡片：合成三維與推估聲音分開，休館／未知不當推薦。
const MOCK_SENSES = SENSES.filter(sense => sense.key !== 'noise')
const STATUS_TEXT = { open: '情境中開放', partial: '部分時段開放', closed: '情境中休館', unknown: '開放狀態未知' }

defineProps({ place: { type: Object, required: true }, mock: Boolean })
defineEmits(['select'])
</script>

<template>
  <button v-if="place.mock" class="q-place-card mock-card" :class="{ unavailable: ['closed', 'unknown'].includes(place.openStatus) }" type="button" @click="$emit('select', place.id)">
    <div class="place-thumbnail"><MockPhoto :place="place" /></div>
    <div class="place-card-copy">
      <div class="place-card-title"><h3>{{ place.name }}</h3><span class="q-tag status-tag" :class="place.openStatus">{{ STATUS_TEXT[place.openStatus] }}{{ place.openStatus === 'partial' && place.estimatedInterval ? ` ${place.estimatedInterval}` : '' }}</span></div>
      <p class="place-card-meta"><span class="place-category"><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="15" />{{ place.category }}</span><span class="place-distance">{{ place.distanceM == null ? '距離待確認' : `${place.distanceM} 公尺直線` }}</span></p>
      <div class="mini-senses"><span v-for="sense in MOCK_SENSES" :key="sense.key"><AppIcon :name="sense.icon" :size="17" /><span class="sr-only">{{ sense.label }}（合成）</span>{{ levelText(place.senses?.[sense.key]) }}</span><span><AppIcon name="sound" :size="17" /><span class="sr-only">聲音</span>{{ place.sound?.value == null ? '未知' : `推估 ${place.sound.value} dB(A)` }}</span></div>
      <p class="mock-card-score"><span v-if="place.mockAssessment?.quiet != null" class="score-chip">合成安靜度 {{ place.mockAssessment.quiet }}</span><span>合成分數・非即時</span></p>
      <p v-if="place.photo" class="mock-card-credit">照片：{{ place.photo.author }}・{{ place.photo.license }}（歷史影像）</p>
    </div>
    <AppIcon class="place-chevron" name="chevron" :size="19" />
  </button>
  <button v-else class="q-place-card" type="button" @click="$emit('select', place.id)">
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
.mock-card.unavailable { background: #f7f8f9; }
.mock-card.unavailable .place-thumbnail { opacity: .6; }
.status-tag.open { color: #337438; background: #e6f5df; }
.status-tag.partial { color: #7a5b12; background: #fbf2d9; }
.status-tag.closed, .status-tag.unknown { color: #55646d; background: #eef1f2; }
.mock-card-score { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin: 6px 0 0; color: #7a5a2c; font-size: 12px; }
.mock-card-score .score-chip { padding: 2px 6px; border-radius: 5px; color: #075f6e; background: #e5f5f8; font-weight: 600; }
.mock-card-credit { margin: 4px 0 0; color: #66747d; font-size: 11px; line-height: 1.5; }
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
