<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlaceArtwork from './PlaceArtwork.vue'
import SensoryScore from './SensoryScore.vue'
import { MOCK_NOTICE, sensoryApi } from '../../lib/sensoryApi.js'
import { MOCK_LABEL, distanceMeters, formatTime, isFresh, levelText } from '../../lib/sensoryDomain.js'
import { sendToNative } from '../../lib/webview.js'
const props = defineProps({ id: { type: String, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['back', 'notify'])
const place = ref(null), meta = ref(null), state = ref('loading'), error = ref(''), tab = ref('sensory')
let controller, serial = 0
const distance = computed(() => distanceMeters(props.city.center.value, place.value?.location))
// 長條與指數只採有效觀測；過期、不足或未知維度不畫長條。
const assessment = computed(() => place.value ? props.city.assess(place.value, meta.value) : null)
const fresh = computed(() => isFresh(place.value?.updatedAt, Date.now()))
async function load() {
  controller?.abort(); controller = new AbortController(); const current = ++serial
  state.value = 'loading'; error.value = ''; place.value = null
  try { const result = await sensoryApi.getPlace(props.id, { signal: controller.signal }); if (current !== serial) return; place.value = result.data; meta.value = result.meta; state.value = 'ready'; if (result.meta?.mock && !props.city.usingMock.value) emit('notify', MOCK_NOTICE) }
  catch (reason) { if (current === serial) { error.value = reason.message; state.value = 'error' } }
}
watch(() => props.id, load, { immediate: true })
onUnmounted(() => { serial++; controller?.abort() })
function navigate() {
  if (meta.value?.mock) { emit('notify', '模擬場所沒有實際位置，不提供導航。'); return }
  const url = `https://maps.apple.com/?daddr=${place.value.location.lat},${place.value.location.lng}&dirflg=w`
  const result = sendToNative('launch_map', url, window)
  if (result.delivered) emit('notify', '已請 App 開啟導航。')
  else window.open(url, '_blank', 'noopener,noreferrer')
}
async function share() {
  try {
    const text = `${place.value.name}｜城市靜音鍵${meta.value?.mock ? '（模擬資料）' : ''}`
    if (navigator.share) await navigator.share({ title: '城市靜音鍵場所', text })
    else if (navigator.clipboard) { await navigator.clipboard.writeText(text); emit('notify', '已複製場所名稱，可分享給朋友。') }
    else emit('notify', '此瀏覽器不支援分享，請手動複製場所名稱。')
  } catch (reason) { if (reason.name !== 'AbortError') emit('notify', '分享未完成，請稍後再試。') }
}
</script>

<template>
  <section class="quiet-view place-detail-view">
    <header class="detail-header">
      <button type="button" class="q-icon-button" aria-label="返回上一頁" @click="$emit('back')"><AppIcon name="back" :size="23"/></button>
      <h1>場所詳情</h1>
      <div><button type="button" class="q-icon-button" aria-label="分享場所" :disabled="!place" @click="share"><AppIcon name="share" :size="22"/></button></div>
    </header>
    <AsyncState v-if="state !== 'ready'" :state="state" :message="error" retry @retry="load" />
    <template v-else-if="place">
      <div class="detail-art"><PlaceArtwork :kind="place.artwork"/><span>原創示意插畫・非實景</span></div>
      <div class="detail-title">
        <div class="detail-title-copy"><h2>{{ place.name }}</h2><div class="detail-tags"><span><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="17"/>{{ place.category }}</span><span class="q-tag">{{ place.tag || '候選休息點' }}</span></div></div>
        <div class="detail-distance"><AppIcon name="pin" :size="21"/><strong>{{ distance ?? '—' }}<small>公尺直線</small></strong></div>
      </div>
      <p v-if="meta.mock" class="mock-inline">{{ MOCK_LABEL }}，場所與地址為虛構。</p>
      <div class="q-segment detail-tabs" role="group" aria-label="場所資訊分頁"><button v-for="item in [{ id: 'sensory', label: '感官資訊' }, { id: 'info', label: '基本資訊' }, { id: 'reviews', label: '回報摘要' }]" :key="item.id" type="button" :class="{ selected: tab === item.id }" :aria-pressed="tab === item.id" @click="tab = item.id">{{ item.label }}</button></div>
      <Transition name="quiet-fade" mode="out-in">
        <div :key="tab" class="detail-content">
          <template v-if="tab === 'sensory'">
            <h3>感官概況 <small>資料整理摘要</small></h3>
            <div class="sensory-summary"><AppIcon name="leaf" :size="30"/><p>{{ place.summary || '目前尚無足夠資料提供摘要。' }}</p></div>
            <p v-if="!fresh" class="q-error">感官資訊已超過 30 分鐘或時間未知，請勿視為目前狀況。</p>
            <div class="sense-bars">
              <div v-for="sense in [{ key: 'noise', label: '聲音刺激', icon: 'sound' }, { key: 'light', label: '光線刺激', icon: 'sun' }, { key: 'crowd', label: '人潮密度', icon: 'people' }, { key: 'odor', label: '氣味刺激', icon: 'wind' }]" :key="sense.key"><AppIcon :name="sense.icon" :size="23"/><span>{{ sense.label }}</span><div class="sense-track"><i v-if="Number.isFinite(assessment?.dimensions[sense.key])" :style="{ width: `${assessment.dimensions[sense.key]}%` }"></i></div><strong>{{ levelText(assessment?.dimensions[sense.key]) }}</strong></div>
            </div>
            <SensoryScore :assessment="assessment" :mock="Boolean(meta.mock)" />
            <p class="q-helper">刺激指數為 0–100 相對尺度，非分貝、照度或人數。</p>
          </template>
          <template v-else-if="tab === 'info'">
            <h3>基本資訊</h3><p class="detail-description">{{ place.description || '暫無場所介紹。' }}</p>
            <div class="info-list"><div><AppIcon name="pin" :size="22"/><p><strong>地址</strong>{{ place.address || '地址待確認' }}</p></div><div><AppIcon name="clock" :size="22"/><p><strong>開放時間</strong>{{ place.hours || '開放時間待確認' }}</p></div><div><AppIcon name="shield" :size="22"/><p><strong>可進入性與無障礙資訊</strong>{{ place.accessibility || '尚未取得可進入性資訊，請先向管理單位確認。' }}</p></div></div>
          </template>
          <template v-else>
            <h3>回報摘要</h3><div class="review-count"><strong>{{ place.reportCount ?? 0 }}</strong><span>近期主觀回報<br><small>不等於裝置音量量測</small></span></div><p class="detail-description">{{ place.summary || '回報數量不足，暫無摘要。' }}</p>
            <AsyncState v-if="!place.reviews?.length" title="尚無可公開的文字回報" message="不公開個人資料，待後端提供匿名摘要。"/>
            <div v-for="(review, i) in place.reviews || []" :key="i" class="review-item"><p>{{ review.text }}</p><small>{{ formatTime(review.observedAt) }}</small></div>
          </template>
        </div>
      </Transition>
      <section class="detail-sources"><AppIcon name="shield" :size="19"/><div><strong>資料來源與時間</strong><p>{{ place.reportCount ?? 0 }} 筆主觀回報 · {{ { high: '信心高', medium: '信心中等', low: '信心低', insufficient: '資料不足' }[place.confidence] || '信心未知' }}<br>{{ formatTime(place.updatedAt) }} {{ meta.mock ? '模擬資料' : '更新' }}</p><template v-for="(source, index) in place.sources || meta.sources" :key="index"><a v-if="source.url?.startsWith('https://')" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a><span v-else>{{ source.name }}</span></template></div></section>
      <div class="detail-actions"><button type="button" class="q-primary" @click="navigate"><AppIcon name="route" :size="21"/>步行導航</button></div>
    </template>
  </section>
</template>

<style scoped>
.place-detail-view { padding: calc(9px + env(safe-area-inset-top)) 12px calc(98px + env(safe-area-inset-bottom)); background: #fff; color: var(--q-ink, #27323a); }
.detail-header { gap: 5px; min-height: 46px; margin: 0 -5px 9px; }
.detail-header h1 { margin: 0; font-size: 19px; font-weight: 650; line-height: 1.4; color: #27323a; }
.detail-header .q-icon-button { min-width: 44px; min-height: 44px; padding: 9px; color: #34434c; }
.detail-art { height: 145px; position: relative; border-radius: 11px; overflow: hidden; background: #e9f1f4; }
.detail-art > span { bottom: 8px; right: 8px; padding: 4px 7px; font-size: 12px; line-height: 1.4; border-radius: 5px; color: #fff; background: #263b46c7; }
.detail-title { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 12px; margin: 13px 0 11px; }
.detail-title-copy { min-width: 0; }
.detail-title h2 { margin: 0 0 7px; font-size: 21px; font-weight: 650; line-height: 1.4; letter-spacing: -.025em; color: #26323a; overflow-wrap: anywhere; }
.detail-tags { gap: 8px; flex-wrap: wrap; }
.detail-tags > span:first-child { display: inline-flex; align-items: center; gap: 5px; color: #66747d; font-size: 13px; }
.detail-tags > span:first-child svg { color: #8b609e; }
.detail-tags .q-tag { padding: 3px 7px; border-radius: 6px; color: #367d39; background: #e5f4de; font-size: 13px; line-height: 1.4; }
.detail-distance { display: flex; align-items: flex-start; gap: 5px; color: var(--q-brand, #0391a7); }
.detail-distance strong { padding-top: 1px; font-size: 17px; font-weight: 600; line-height: 1.2; color: #38454e; text-align: right; }
.detail-distance small { margin-top: 6px; color: #66747d; font-size: 12px; line-height: 1.3; font-weight: 400; }
.mock-inline { margin: 0 0 11px; padding: 7px 9px; background: #f4f7f9; color: #65747d; border-radius: 6px; font-size: 12px; line-height: 1.6; }
.detail-tabs { gap: 0; padding: 0; margin: 0 0 19px; background: #f1f3f5; border-radius: 9px; overflow: hidden; }
.detail-tabs button { position: relative; min-height: 47px; padding: 9px 4px; border: 0; border-radius: 0; color: #606d76; background: transparent; box-shadow: none; font-size: 15px; font-weight: 500; }
.detail-tabs button.selected { color: var(--q-deep, #007a90); background: #fff; box-shadow: none; font-weight: 650; }
.detail-tabs button.selected::after { position: absolute; content: ''; height: 3px; bottom: 0; right: 0; left: 0; background: var(--q-brand, #0391a7); border-radius: 3px 3px 0 0; }
.detail-tabs button:not(:last-child)::before { position: absolute; content: ''; height: 16px; width: 1px; right: 0; top: 15px; background: #dfe5e8; }
.detail-content { min-height: 0; padding-inline: 4px; }
.detail-content h3 { margin: 0 0 10px; font-size: 17px; font-weight: 650; line-height: 1.5; color: #2c3941; }
.detail-content h3 small { margin-left: 5px; color: #66747d; font-size: 12px; font-weight: 400; }
.sensory-summary { gap: 12px; padding: 12px; background: #eefaFE; border-radius: 9px; }
.sensory-summary > svg { flex-shrink: 0; color: #398749; }
.sensory-summary p { margin: 0; color: #394852; font-size: 15px; line-height: 1.65; }
.sense-bars { margin: 17px 0 14px; }
.sense-bars > div { display: grid; grid-template-columns: 25px 73px minmax(0, 1fr) 32px; align-items: center; gap: 10px; margin: 13px 0; color: #54879b; font-size: 15px; line-height: 1.4; }
.sense-bars > div:nth-child(2) { color: #c99a26; }
.sense-bars > div:nth-child(3) { color: #3f8299; }
.sense-bars > div:nth-child(4) { color: #38a2a8; }
.sense-bars > div > span { width: auto; color: #39434b; font-size: 15px; }
.sense-bars strong { width: auto; color: #5c6a74; font-size: 14px; font-weight: 500; text-align: right; }
.sense-track { width: 100%; height: 10px; border-radius: 8px; overflow: hidden; background: #e7edf0; }
.sense-track i { background: linear-gradient(90deg, #41b7c3, #269fb0); }
.detail-content > .q-helper { margin: 9px 0 0; color: #66747d; font-size: 12px; line-height: 1.65; }
.detail-content .q-error { color: #97572e; font-size: 13px; line-height: 1.6; }
.detail-sources { gap: 9px; margin-top: 17px; padding: 12px; border-radius: 9px; background: #eff6f9; color: #8d9ca6; }
.detail-sources > svg { flex-shrink: 0; margin-top: 1px; }
.detail-sources strong { color: #50626e; font-size: 14px; font-weight: 600; line-height: 1.4; }
.detail-sources p { margin: 5px 0; font-size: 12px; line-height: 1.65; color: #5e6d78; }
.detail-sources span, .detail-sources a { color: #637681; font-size: 12px; line-height: 1.5; }
.detail-sources a { color: var(--q-deep, #007a90); min-height: 44px; }
.detail-actions { display: grid; margin-top: 19px; }
.detail-actions .q-secondary { min-height: 49px; padding: 10px; color: var(--q-deep, #007a90); border-color: var(--q-brand, #0391a7); border-radius: 10px; background: #fff; font-size: 16px; font-weight: 600; }
.detail-actions .q-primary { width: 100%; min-height: 49px; padding: 10px; color: #fff; background: var(--q-brand, #0391a7); border-radius: 10px; font-size: 19px; font-weight: 700; line-height: 1.35; }
.detail-description { margin: 0 0 9px; color: #556671; font-size: 15px; line-height: 1.8; }
.info-list > div { gap: 11px; padding: 13px 0; color: var(--q-deep, #007a90); border-color: #e5ebee; }
.info-list p { color: #5c6d77; font-size: 15px; line-height: 1.7; }
.info-list strong { margin-bottom: 4px; color: #35444d; font-size: 15px; font-weight: 600; }
.review-count { gap: 14px; color: var(--q-deep, #007a90); }
.review-count > strong { font-size: 38px; }
.review-count > span { font-size: 15px; line-height: 1.6; }
.review-count small { color: #66747d; font-size: 12px; }
.review-item { padding: 12px 0; font-size: 15px; color: #4c606c; border-color: #e5ebee; }
.review-item small { color: #66747d; font-size: 12px; }
@media (max-width: 359px) {
  .place-detail-view { padding-inline: 10px; }
  .detail-art { height: 132px; }
  .detail-title { column-gap: 8px; }
  .detail-title h2 { font-size: 20px; }
  .detail-distance strong { font-size: 16px; }
  .sense-bars > div { grid-template-columns: 24px 66px minmax(0, 1fr) 30px; gap: 8px; }
  .detail-actions { display: grid; grid-template-columns: minmax(0, 1fr); }
  .detail-actions .q-primary, .detail-actions .q-secondary { width: 100%; }
}
</style>
