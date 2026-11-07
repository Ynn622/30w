<script setup>
import { computed, ref, useId, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import PlaceArtwork from './PlaceArtwork.vue'
import { photoTag, placeImage } from '../../lib/placeImage.js'

// 場所照片：後端內嵌的 image（reviewed／linked／nearby）以 API origin 載入，失敗或沒有照片時退回原創插畫。
// 載入失敗（404／429／網路／解碼錯誤）只換成插畫，不重試；換到新的圖片網址（場所或版本變了）才重新嘗試。
// 小標（歷史照片／參考照片／示意插畫）只在 large（詳情）顯示，卡片縮圖不顯示。
// large 時照片右下角有 info 按鈕，點擊才在照片下方展開完整署名（作者、授權、原始來源、修改說明），一律純文字插值，外連 noopener noreferrer。
const props = defineProps({ place: { type: Object, required: true }, large: Boolean })
const image = computed(() => placeImage(props.place))
const failed = ref(false), creditOpen = ref(false)
const creditId = useId()
watch(() => image.value?.src, () => { failed.value = false; creditOpen.value = false })
const shown = computed(() => failed.value ? null : image.value)
</script>

<template>
  <figure class="place-photo" :class="{ large }">
    <div class="place-photo-frame">
      <img v-if="shown" :src="shown.src" :alt="shown.alt" crossorigin="anonymous" referrerpolicy="no-referrer" loading="lazy" decoding="async" @error="failed = true" />
      <PlaceArtwork v-else :kind="place.artwork" />
      <span v-if="large" class="place-photo-tag">{{ photoTag(shown) }}</span>
      <button v-if="large && shown" type="button" class="place-photo-info" :aria-expanded="creditOpen" :aria-controls="creditId" :aria-label="creditOpen ? '收起照片來源與授權' : '查看照片來源與授權'" @click="creditOpen = !creditOpen"><span><AppIcon name="info" :size="17" /></span></button>
    </div>
    <figcaption v-if="large && shown" v-show="creditOpen" :id="creditId" class="place-photo-credit">
      <span v-if="shown.reference?.name">附近參考照片：{{ shown.reference.name }}{{ shown.reference.distance != null ? `（約 ${shown.reference.distance} 公尺）` : '' }}，非此場所實景。</span>
      <span>照片：{{ shown.author }}<template v-if="shown.credit">（{{ shown.credit }}）</template></span>
      <span>授權：<a v-if="shown.licenseUrl" :href="shown.licenseUrl" target="_blank" rel="noopener noreferrer">{{ shown.license }}</a><template v-else>{{ shown.license }}</template><template v-if="shown.sourceUrl">・<a :href="shown.sourceUrl" target="_blank" rel="noopener noreferrer">原始來源</a></template></span>
      <span v-if="shown.changes">修改：{{ shown.changes }}</span>
      <span v-if="shown.notice">{{ shown.notice }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.place-photo { width: 100%; height: 100%; margin: 0; border-radius: inherit; }
.place-photo-frame { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: inherit; background: #e9f1f4; }
.place-photo-frame img { display: block; width: 100%; height: 100%; object-fit: cover; }
.place-photo-tag { position: absolute; right: 4px; bottom: 4px; padding: 1px 5px; border-radius: 4px; background: #263b46c7; color: #fff; font-size: 10px; line-height: 1.5; white-space: nowrap; }
/* 詳情固定高度，圖片載入前後版面不跳動。 */
.place-photo.large { height: auto; }
.place-photo.large .place-photo-frame { height: 145px; border-radius: 11px; }
/* 詳情：小標放左下，右下角留給 info 按鈕。 */
.place-photo.large .place-photo-tag { left: 8px; right: auto; bottom: 8px; padding: 4px 7px; font-size: 12px; line-height: 1.4; border-radius: 5px; }
/* info 按鈕：44px 透明觸控區，內層 30px 半透明圓形才是看得到的按鈕。 */
.place-photo-info { position: absolute; right: 2px; bottom: 2px; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.place-photo-info > span { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #263b46c7; color: #fff; }
.place-photo-info[aria-expanded="true"] > span { background: var(--q-brand, #0391a7); }
.place-photo-info:focus-visible > span { outline: 2px solid #fff; outline-offset: 1px; }
.place-photo-credit { display: grid; gap: 2px; margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: #f4f7f9; color: #5b6a74; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.place-photo-credit a { color: var(--q-deep, #007a90); }
@media (max-width: 359px) { .place-photo.large .place-photo-frame { height: 132px; } }
/* 低刺激模式與原本的詳情插畫一樣隱藏（卡片縮圖由全域 .place-thumbnail 規則隱藏）。 */
:global(.q-low-stimulus) .quiet-app .place-photo.large { display: none; }
</style>
