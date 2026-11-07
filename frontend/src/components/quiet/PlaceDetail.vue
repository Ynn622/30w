<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlacePhoto from './PlacePhoto.vue'
import SensoryScore from './SensoryScore.vue'
import { MOCK_NOTICE } from '../../lib/sensoryApi.js'
import { MOCK_LABEL, distanceMeters, formatTime, googleMapsDirectionsUrl, isFresh, levelText } from '../../lib/sensoryDomain.js'
import { sendToNative } from '../../lib/webview.js'
const props = defineProps({ id: { type: String, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['back', 'notify'])
const place = ref(null), meta = ref(null), state = ref('loading'), error = ref(''), tab = ref('sensory')
let controller, serial = 0
const distance = computed(() => distanceMeters(props.city.center.value, place.value?.location))
// 直線距離以公里顯示到小數第一位（例如 0.4、1.2 公里）；無法計算時顯示「距離未知」。
const distanceText = computed(() => distance.value === null ? '距離未知' : `距離 ${(distance.value / 1000).toFixed(1)} 公里`)
// 長條與指數只採有效觀測；過期、不足或未知維度不畫長條。
const assessment = computed(() => place.value ? props.city.assess(place.value, meta.value) : null)
const fresh = computed(() => isFresh(place.value?.updatedAt, Date.now()))
// 只有內建模擬備援才是虛構場所；後端 test-only 接口（目前的場所資料）當正式資料呈現。
const builtinMock = computed(() => Boolean(meta.value?.mock) && meta.value?.mode !== 'test-only')
// 基本資訊的設施：依開放資料標示 true／false；null 為未知，不顯示（不把未知當成沒有）。
const FACILITY_LABELS = { airConditioning: '冷氣', seating: '座位', toilet: '廁所', drinkingWater: '飲水', accessibleSeating: '無障礙座位' }
const facilities = computed(() => Object.entries(FACILITY_LABELS)
  .map(([key, label]) => ({ key, label, value: place.value?.facilities?.[key] ?? null }))
  .filter(item => item.value !== null)
  .sort((a, b) => Number(b.value) - Number(a.value)))
async function load() {
  controller?.abort(); controller = new AbortController(); const current = ++serial
  state.value = 'loading'; error.value = ''; place.value = null
  try { const result = await props.city.getPlace(props.id, { signal: controller.signal }); if (current !== serial) return; place.value = result.data; meta.value = result.meta; state.value = 'ready'; if (result.meta?.mock && result.meta.mode !== 'test-only' && !props.city.usingMock.value) emit('notify', MOCK_NOTICE) }
  catch (reason) { if (current === serial) { error.value = reason.message; state.value = 'error' } }
}
watch(() => props.id, load, { immediate: true })
onUnmounted(() => { serial++; controller?.abort() })
function navigate() {
  if (builtinMock.value) { emit('notify', '模擬場所沒有實際位置，不提供導航。'); return }
  const url = googleMapsDirectionsUrl(place.value.location)
  if (!url) { emit('notify', '此場所缺少有效座標，無法導航。'); return }
  const result = sendToNative('launch_map', url, window)
  if (result.delivered) emit('notify', '已請 App 開啟導航。')
  else window.open(url, '_blank', 'noopener,noreferrer')
}
async function share() {
  try {
    const text = `${place.value.name}｜聆靜${builtinMock.value ? '（模擬資料）' : ''}`
    if (navigator.share) await navigator.share({ title: '聆靜場所', text })
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
      <!-- 有後端照片時顯示照片與完整署名，否則為原創示意插畫（Ynn622/30w#7）。 -->
      <PlacePhoto :place="place" large />
      <div class="detail-title">
        <div class="detail-title-copy"><h2>{{ place.name }}</h2><div class="detail-tags"><span><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="17"/>{{ place.category }}</span><span class="q-tag">{{ place.tag || '候選休息點' }}</span></div></div>
        <!-- 距離與導航放在名稱右側：距離一行，下方為導航按鈕。 -->
        <div class="detail-nav"><span class="detail-distance">{{ distanceText }}</span><button type="button" class="detail-nav-button" @click="navigate"><span><AppIcon name="route" :size="15"/>導航</span></button></div>
      </div>
      <p v-if="builtinMock" class="mock-inline">{{ MOCK_LABEL }}，場所與地址為虛構。</p>
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
            <SensoryScore :assessment="assessment" :mock="builtinMock" />
            <p class="q-helper">刺激指數為 0–100 相對尺度，非分貝、照度或人數。</p>
          </template>
          <template v-else-if="tab === 'info'">
            <!-- 介紹卡片 → 地址與開放時間 → 設施標籤 → 可進入性提醒。 -->
            <p v-if="place.description" class="info-intro">{{ place.description }}</p>
            <p v-else class="info-empty">暫無場所介紹。</p>
            <div class="info-card">
              <div class="info-row"><span class="info-icon"><AppIcon name="pin" :size="19"/></span><div><small>地址</small><p>{{ place.address || '地址待確認' }}</p></div></div>
              <div class="info-row"><span class="info-icon"><AppIcon name="clock" :size="19"/></span><div><small>開放時間</small><p>{{ place.hours || '開放時間待確認' }}</p></div></div>
            </div>
            <h4 class="info-subtitle">設施</h4>
            <ul v-if="facilities.length" class="info-facilities">
              <li v-for="item in facilities" :key="item.key" :class="{ off: !item.value }"><AppIcon v-if="item.value" name="check" :size="14"/>{{ item.value ? item.label : `未提供${item.label}` }}</li>
            </ul>
            <p v-else class="info-empty">設施資訊待確認。</p>
            <div class="info-access"><AppIcon name="shield" :size="18"/><div><strong>可進入性與無障礙</strong><p>{{ place.accessibility || '尚未取得可進入性資訊，請先向管理單位確認。' }}</p></div></div>
          </template>
          <template v-else>
            <h3>回報摘要</h3><div class="review-count"><strong>{{ place.reportCount ?? 0 }}</strong><span>近期主觀回報<br><small>不等於裝置音量量測</small></span></div><p class="detail-description">{{ place.summary || '回報數量不足，暫無摘要。' }}</p>
            <AsyncState v-if="!place.reviews?.length" title="尚無可公開的文字回報" message="不公開個人資料，待後端提供匿名摘要。"/>
            <div v-for="(review, i) in place.reviews || []" :key="i" class="review-item"><p>{{ review.text }}</p><small>{{ formatTime(review.observedAt) }}</small></div>
          </template>
        </div>
      </Transition>
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
.detail-nav { display: flex; flex-direction: column; align-items: flex-end; gap: 0; }
.detail-distance { color: #5d6c75; font-size: 13px; white-space: nowrap; }
/* 按鈕本身保留 44px 觸控區（透明），內層小膠囊才是看得到的按鈕。 */
.detail-nav-button { display: inline-flex; align-items: center; justify-content: flex-end; min-width: 44px; min-height: 44px; margin-right: -2px; padding: 0 2px; border: 0; background: transparent; font: inherit; cursor: pointer; }
.detail-nav-button > span { display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px; border-radius: 15px; background: var(--q-brand, #0391a7); color: #fff; font-size: 13px; font-weight: 700; box-shadow: 0 2px 6px #0391a72e; }
.detail-nav-button:active > span { transform: scale(.96); }
.detail-title h2 { margin: 0 0 7px; font-size: 21px; font-weight: 650; line-height: 1.4; letter-spacing: -.025em; color: #26323a; overflow-wrap: anywhere; }
.detail-tags { gap: 8px; flex-wrap: wrap; }
.detail-tags > span:first-child { display: inline-flex; align-items: center; gap: 5px; color: #66747d; font-size: 13px; }
.detail-tags > span:first-child svg { color: #8b609e; }
.detail-tags .q-tag { padding: 3px 7px; border-radius: 6px; color: #367d39; background: #e5f4de; font-size: 13px; line-height: 1.4; }
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
.detail-description { margin: 0 0 9px; color: #556671; font-size: 15px; line-height: 1.8; }
/* 基本資訊 */
.info-intro { margin: 0 0 14px; padding: 13px 14px; border-radius: 14px; background: linear-gradient(135deg, #eef8fb, #f7fbfc); color: #3f525d; font-size: 15px; line-height: 1.75; }
.info-empty { margin: 0 0 12px; color: #7a8a93; font-size: 13px; }
.info-card { overflow: hidden; border: 1px solid #e3ecf0; border-radius: 14px; background: #fff; }
.info-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; }
.info-row + .info-row { border-top: 1px solid #eef3f5; }
.info-icon { display: grid; flex: none; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: #edf7fa; color: var(--q-brand, #0391a7); }
.info-row small { display: block; color: #7a8a93; font-size: 12px; line-height: 1.5; }
.info-row p { margin: 1px 0 0; color: #2f3d45; font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
.info-subtitle { margin: 18px 0 8px; color: #2c3941; font-size: 15px; font-weight: 650; }
.info-facilities { display: flex; flex-wrap: wrap; gap: 7px; margin: 0; padding: 0; list-style: none; }
.info-facilities li { display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 999px; background: #e9f6ef; color: #2b7d57; font-size: 13px; font-weight: 600; }
.info-facilities li.off { background: #f1f4f5; color: #8a979e; font-weight: 500; }
.info-access { display: flex; align-items: flex-start; gap: 10px; margin-top: 16px; padding: 12px 14px; border-radius: 14px; background: #f6f8f9; color: #5f6f78; }
.info-access > svg { flex: none; margin-top: 2px; color: var(--q-brand, #0391a7); }
.info-access strong { display: block; color: #3a4850; font-size: 14px; font-weight: 600; }
.info-access p { margin: 2px 0 0; font-size: 13px; line-height: 1.65; }
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
  .sense-bars > div { grid-template-columns: 24px 66px minmax(0, 1fr) 30px; gap: 8px; }
}
</style>
