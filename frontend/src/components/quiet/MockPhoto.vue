<script setup>
import { computed, ref, watch } from 'vue'
import PlaceArtwork from './PlaceArtwork.vue'
import { mockPhotoUrl } from '../../lib/mockApi.js'

// 測試情境的場所照片：只載入同一筆 Mock 場所的精確 test 路徑（API origin）；無圖或載入失敗退回示意插畫。
// large 時顯示完整署名（作者、來源、授權、修改、拍攝年份），全部以純文字渲染，外連 noopener noreferrer。
const props = defineProps({ place: { type: Object, required: true }, large: Boolean })
const failed = ref(false)
watch(() => props.place?.id, () => { failed.value = false })
const url = computed(() => failed.value ? null : mockPhotoUrl(props.place))
const photo = computed(() => props.place?.photo || null)
const year = computed(() => String(photo.value?.capturedAt || '').slice(0, 4))
const httpsOnly = value => typeof value === 'string' && value.startsWith('https://') ? value : null
</script>

<template>
  <figure class="mock-photo" :class="{ large }">
    <div class="mock-photo-frame">
      <img v-if="url" :src="url" :alt="photo.alt || `${place.name}歷史照片`" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" decoding="async" @error="failed = true" />
      <PlaceArtwork v-else :kind="place.artwork" />
      <span class="mock-photo-tag">{{ url ? `歷史照片${year ? `・${year}` : ''}・非即時` : '示意插畫・非實景' }}</span>
    </div>
    <figcaption v-if="large && url" class="mock-photo-credit">
      <span>照片：{{ photo.author }}<template v-if="photo.credit">（{{ photo.credit }}）</template></span>
      <span>授權：<a v-if="httpsOnly(photo.licenseUrl)" :href="photo.licenseUrl" target="_blank" rel="noopener noreferrer">{{ photo.license }}</a><template v-else>{{ photo.license }}</template><template v-if="httpsOnly(photo.sourceUrl)">・<a :href="photo.sourceUrl" target="_blank" rel="noopener noreferrer">原始來源</a></template></span>
      <span v-if="photo.changes">修改：{{ photo.changes }}</span>
      <span>同設施的歷史影像，不代表推估的子區域或目前狀況。</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.mock-photo { margin: 0; }
.mock-photo-frame { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: inherit; background: #e9f1f4; }
.mock-photo-frame img { display: block; width: 100%; height: 100%; object-fit: cover; }
.mock-photo-tag { position: absolute; right: 4px; bottom: 4px; padding: 1px 5px; border-radius: 4px; background: #263b46c7; color: #fff; font-size: 10px; line-height: 1.5; white-space: nowrap; }
.mock-photo.large .mock-photo-frame { height: 170px; border-radius: 11px; }
.mock-photo.large .mock-photo-tag { right: 8px; bottom: 8px; padding: 3px 7px; font-size: 12px; }
.mock-photo-credit { display: grid; gap: 2px; margin-top: 6px; color: #5b6a74; font-size: 12px; line-height: 1.6; }
.mock-photo-credit a { color: var(--q-deep, #007a90); }
</style>
