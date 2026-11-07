<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlaceArtwork from './PlaceArtwork.vue'
import { sensoryApi } from '../../lib/sensoryApi.js'
import { distanceMeters, formatTime, isFresh, levelText } from '../../lib/sensoryDomain.js'
import { sendToNative } from '../../lib/webview.js'
const props = defineProps({ id: { type: String, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['back', 'notify'])
const place = ref(null), meta = ref(null), state = ref('loading'), error = ref(''), tab = ref('sensory')
let controller, serial = 0
const distance = computed(() => distanceMeters(props.city.center.value, place.value?.location))
const fresh = computed(() => isFresh(place.value?.updatedAt, props.city.mode === 'demo' ? meta.value?.referenceTime : Date.now()))
async function load() {
  controller?.abort(); controller = new AbortController(); const current = ++serial
  state.value = 'loading'; error.value = ''; place.value = null
  try { const result = await sensoryApi.getPlace(props.id, { signal: controller.signal }); if (current !== serial) return; place.value = result.data; meta.value = result.meta; state.value = 'ready' }
  catch (reason) { if (current === serial) { error.value = reason.message; state.value = 'error' } }
}
watch(() => props.id, load, { immediate: true })
onUnmounted(() => { serial++; controller?.abort() })
function navigate() {
  if (meta.value?.demo) { emit('notify', '這是虛構示例場所，不提供實際導航。'); return }
  const url = `https://maps.apple.com/?daddr=${place.value.location.lat},${place.value.location.lng}&dirflg=w`
  const result = sendToNative('launch_map', url, window)
  if (result.delivered) emit('notify', '已請 App 開啟導航。')
  else window.open(url, '_blank', 'noopener,noreferrer')
}
async function share() {
  try {
    const text = `${place.value.name}｜城市靜音鍵${meta.value?.demo ? '（虛構示例場所）' : ''}`
    if (navigator.share) await navigator.share({ title: '我的安靜角落', text })
    else if (navigator.clipboard) { await navigator.clipboard.writeText(text); emit('notify', '已複製場所名稱，可分享給朋友。') }
    else emit('notify', '此瀏覽器不支援分享，請手動複製場所名稱。')
  } catch (reason) { if (reason.name !== 'AbortError') emit('notify', '分享未完成，請稍後再試。') }
}
</script>
<template>
  <section class="quiet-view place-detail-view">
    <header class="detail-header"><button class="q-icon-button" aria-label="返回上一頁" @click="$emit('back')"><AppIcon name="back" :size="21"/></button><h1>場所詳情</h1><div><button class="q-icon-button" aria-label="分享場所" :disabled="!place" @click="share"><AppIcon name="share" :size="20"/></button><button class="q-icon-button" :aria-label="city.favorites.value.includes(id) ? '取消收藏' : '收藏場所'" :aria-pressed="city.favorites.value.includes(id)" :class="{ 'is-saved': city.favorites.value.includes(id) }" :disabled="!place" @click="city.toggleFavorite(id)"><AppIcon name="heart" :size="22"/></button></div></header>
    <AsyncState v-if="state !== 'ready'" :state="state" :message="error" retry @retry="load" />
    <template v-else-if="place">
      <div class="detail-art"><PlaceArtwork :kind="place.artwork"/><span>原創示意插畫・非實景</span></div>
      <div class="detail-title"><div><span class="q-eyebrow">A QUIET CORNER FOR YOU</span><h2>{{ place.name }}</h2><div class="detail-tags"><span><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="14"/>{{ place.category }}</span><span class="q-tag">{{ place.tag || '候選休息點' }}</span></div></div><div class="detail-distance"><AppIcon name="pin" :size="18"/><strong>{{ distance ?? '—' }}<small>公尺直線</small></strong></div></div>
      <p v-if="meta.demo" class="demo-inline">虛構示例場所，請勿據此前往；不是即時推薦結果。</p>
      <div class="q-segment detail-tabs" role="group" aria-label="場所資訊分頁"><button v-for="item in [{ id: 'sensory', label: '感官資訊' }, { id: 'info', label: '基本資訊' }, { id: 'reviews', label: '回報摘要' }]" :key="item.id" :class="{ selected: tab === item.id }" :aria-pressed="tab === item.id" @click="tab = item.id">{{ item.label }}</button></div>
      <Transition name="quiet-fade" mode="out-in"><div :key="tab" class="detail-content">
        <template v-if="tab === 'sensory'">
          <h3>感官概況 <small>{{ meta.demo ? '固定示範描述' : '資料整理摘要' }}</small></h3><div class="sensory-summary"><AppIcon name="leaf" :size="28"/><p>{{ place.summary || '目前尚無足夠資料提供摘要。' }}</p></div>
          <p v-if="!fresh" class="q-error">感官資訊已超過 30 分鐘或時間未知，請勿視為目前狀況。</p>
          <div class="sense-bars"><div v-for="sense in [{ key: 'noise', label: '聲音刺激', icon: 'sound' }, { key: 'light', label: '光線刺激', icon: 'sun' }, { key: 'crowd', label: '人潮密度', icon: 'people' }, { key: 'odor', label: '氣味刺激', icon: 'wind' }]" :key="sense.key"><AppIcon :name="sense.icon" :size="21"/><span>{{ sense.label }}</span><div class="sense-track"><i v-if="Number.isFinite(place.senses?.[sense.key])" :style="{ width: `${Math.max(0, Math.min(100, place.senses[sense.key]))}%` }"></i></div><strong>{{ levelText(place.senses?.[sense.key]) }}</strong></div></div>
          <p class="q-helper">刺激指數 0–100 是整理後的相對尺度，非分貝、照度或人數。</p>
        </template>
        <template v-else-if="tab === 'info'"><h3>在這裡，慢一下</h3><p class="detail-description">{{ place.description || '暫無場所介紹。' }}</p><div class="info-list"><div><AppIcon name="pin" :size="20"/><p><strong>地址</strong>{{ place.address || '地址待確認' }}</p></div><div><AppIcon name="clock" :size="20"/><p><strong>開放時間</strong>{{ place.hours || '開放時間待確認' }}</p></div><div><AppIcon name="shield" :size="20"/><p><strong>可進入性與無障礙資訊</strong>{{ place.accessibility || '尚未取得可進入性資訊，請先向管理單位確認。' }}</p></div></div></template>
        <template v-else><h3>大家的感受，分開看見</h3><div class="review-count"><strong>{{ place.reportCount ?? 0 }}</strong><span>近期主觀回報<br><small>不等於裝置音量量測</small></span></div><p class="detail-description">{{ place.summary || '回報數量不足，暫無摘要。' }}</p><AsyncState v-if="!place.reviews?.length" title="尚無可公開的文字回報" message="不公開個人資料，待後端提供匿名摘要。"/><div v-for="(review, i) in place.reviews || []" :key="i" class="review-item"><p>{{ review.text }}</p><small>{{ formatTime(review.observedAt) }}</small></div></template>
      </div></Transition>
      <section class="detail-sources"><AppIcon name="shield" :size="16"/><div><strong>資料來源與時間</strong><p>{{ place.reportCount ?? 0 }} 筆主觀回報 · {{ { high: '信心高', medium: '信心中等', low: '信心低', insufficient: '資料不足' }[place.confidence] || '信心未知' }}<br>{{ formatTime(place.updatedAt) }} {{ meta.demo ? '固定示範情境' : '更新' }}</p><template v-for="(source, index) in place.sources || meta.sources" :key="index"><a v-if="source.url?.startsWith('https://')" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a><span v-else>{{ source.name }}</span></template></div></section>
      <div class="detail-actions"><button class="q-secondary" @click="navigate"><AppIcon name="route" :size="19"/>{{ meta.demo ? '導航說明' : '步行導航' }}</button><button class="q-primary" @click="city.toggleFavorite(id)"><AppIcon :name="city.favorites.value.includes(id) ? 'check' : 'leaf'" :size="19"/>{{ city.favorites.value.includes(id) ? '已在我的安靜角落' : '設為我的安靜角落' }}</button></div>
    </template>
  </section>
</template>
