<script setup>
import { onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import AppIcon from '../AppIcon.vue'
import QuietHome from './QuietHome.vue'
import ExploreView from './ExploreView.vue'
import QuietProfile from './QuietProfile.vue'
import PlaceDetail from './PlaceDetail.vue'
import ReportSheet from './ReportSheet.vue'
import NoiseSheet from './NoiseSheet.vue'
import AppSheet from './AppSheet.vue'
import { useQuietCity } from '../../composables/useQuietCity.js'
import { formatTime } from '../../lib/sensoryDomain.js'
import '../../styles/quiet.css'
const emit = defineEmits(['notify'])
const city = useQuietCity(message => emit('notify', message))
const tab = ref('home'), placeId = ref(null), report = ref(null), measuring = ref(false), sources = ref(false)
const tabs = [{ id: 'home', label: '首頁', icon: 'home' }, { id: 'explore', label: '探索', icon: 'map' }, { id: 'profile', label: '我的', icon: 'sliders' }]
// sheet 透過 Teleport 掛在 body，低刺激模式需設在 body 才能一起套用。
watchEffect(() => { if (typeof document !== 'undefined') document.body.classList.toggle('q-low-stimulus', city.preferences.value.lowStimulus) })
onUnmounted(() => document.body.classList.remove('q-low-stimulus'))
// 服務只依目前定位提供，開啟時即請求定位。
onMounted(() => city.locate())
function navigate(id) { tab.value = id; placeId.value = null }
function selected(id) { placeId.value = id }
watch([tab, placeId], () => window.scrollTo({ top: 0, behavior: 'auto' }))
function refresh() { city.refresh() }
function reported(message) { report.value = null; emit('notify', message); refresh() }
</script>
<template>
  <div class="quiet-app" :data-low-stimulus="city.preferences.value.lowStimulus || undefined">
    <Transition name="quiet-page" mode="out-in">
      <PlaceDetail v-if="placeId" :key="`place-${placeId}`" :id="placeId" :city="city" @back="placeId = null" @notify="$emit('notify', $event)"/>
      <QuietHome v-else-if="tab === 'home'" key="home" :city="city" @report="report = $event" @measure="measuring = true" @explore="navigate('explore')" @select="selected" @sources="sources = true"/>
      <ExploreView v-else-if="tab === 'explore'" key="explore" :city="city" @select="selected" @sources="sources = true"/>
      <QuietProfile v-else key="profile" :city="city" @select="selected" @explore="navigate('explore')" @sources="sources = true"/>
    </Transition>
    <nav class="quiet-bottom-nav" aria-label="主要導覽"><button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-current="tab === item.id ? 'page' : undefined" @click="navigate(item.id)"><span><AppIcon :name="item.icon" :size="22"/></span>{{ item.label }}<i v-if="tab === item.id"></i></button></nav>
    <ReportSheet v-if="report" :kind="report" :city="city" @close="report = null" @done="reported"/>
    <NoiseSheet v-if="measuring" :city="city" @close="measuring = false" @notify="$emit('notify', $event)" @shared="refresh"/>
    <AppSheet v-if="sources" title="關於這些城市感受" @close="sources = false">
      <span class="q-status-badge">{{ city.usingMock.value ? '目前使用模擬資料' : '已連線後端' }}</span>
      <p class="source-explainer">{{ city.usingMock.value ? '後端感官服務暫時無法連線，天氣、空氣品質、回報、刺激指數與場所改用專案自製的模擬資料，並非官方即時監測；場所與地址為虛構。每分鐘會重試後端，連上後自動切換。' : '資料由後端整合，請依各來源時間與信心判斷。沒有資料或過期資訊不代表環境安靜。' }}</p>
      <p v-if="city.usingMock.value && city.fallbackReason.value" class="q-helper">後端回應：{{ city.fallbackReason.value }}</p>
      <div class="source-info-row"><AppIcon name="clock" :size="20"/><span><strong>{{ city.usingMock.value ? '模擬資料產生時間' : '最近資料更新' }}</strong>{{ formatTime(city.overview.meta.value?.updatedAt) }}</span></div>
      <h3 class="source-subtitle">資料來源</h3><div v-for="(source, index) in city.overview.meta.value?.sources || []" :key="index" class="source-entry"><strong>{{ source.name }}</strong><span>{{ source.license || '授權資訊尚待提供' }}</span><a v-if="source.url?.startsWith('https://')" :href="source.url" target="_blank" rel="noopener noreferrer">查看原始資料</a></div>
      <p v-if="!city.overview.meta.value?.sources?.length" class="q-helper">尚未取得來源資料，請稍後重試。</p>
      <h3 class="source-subtitle">感官指數 SSI 與個人適配 SFS</h3><p class="q-helper">SSI（0–100，越高越刺激）只採 30 分鐘內有效的聲音、光線、人潮、氣味四維，缺值不當作低刺激，並標示涵蓋維度；空氣品質 AQI 另列，不納入。SFS（越高越適合）依你在此裝置設定的敏感度計算與排序，不上傳。{{ city.usingMock.value ? '模擬資料的指數由模擬數值計算。' : '後端尚未提供版本化指數時，只顯示各維度，不自行推算 SSI。' }}</p>
      <h3 class="source-subtitle">如何看待資料信心</h3><p class="q-helper">依回報數、觀測新鮮度與資料涵蓋度由後端判定。主觀感受、手機音量及官方資料分別標示；超過 30 分鐘的感官資訊不列入低刺激推薦。手機 dBFS 不是校準的環境分貝。</p>
      <h3 class="source-subtitle">地址查詢</h3><p class="q-helper">定位成功後，會把目前座標送到 OpenStreetMap Nominatim 查詢門牌地址（每次定位最多查一次，結果只存在記憶體）。地址為推估結果，資料 © OpenStreetMap contributors（ODbL）。</p>
      <h3 class="source-subtitle">地圖授權</h3><p class="source-map-links"><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p>
    </AppSheet>
  </div>
</template>
