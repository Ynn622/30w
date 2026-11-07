<script setup>
import AppIcon from '../AppIcon.vue'
import PlaceArtwork from './PlaceArtwork.vue'
import { levelText } from '../../lib/sensoryDomain.js'
defineProps({ place: { type: Object, required: true }, demo: Boolean })
defineEmits(['select'])
</script>
<template>
  <button class="q-place-card" type="button" @click="$emit('select', place.id)">
    <div class="place-thumbnail"><PlaceArtwork :kind="place.artwork" /></div>
    <div class="place-card-copy"><div class="place-card-title"><h3>{{ place.name }}</h3><span class="q-tag">{{ place.tag || '候選休息點' }}</span></div>
      <p><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="12" />{{ place.category }}<span>·</span>{{ place.distanceM == null ? '距離待確認' : `${place.distanceM} 公尺直線` }}</p>
      <div class="mini-senses"><span v-for="sense in [{ key: 'noise', icon: 'sound', label: '聲音' }, { key: 'light', icon: 'sun', label: '光線' }, { key: 'crowd', icon: 'people', label: '人潮' }]" :key="sense.key"><AppIcon :name="sense.icon" :size="14" /><span class="sr-only">{{ sense.label }}</span>{{ levelText(place.senses?.[sense.key]) }}</span></div>
    </div><AppIcon class="place-chevron" name="chevron" :size="17" />
  </button>
</template>
