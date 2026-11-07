<script setup>
import { ref, watch } from 'vue'
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
function navigate(id) { tab.value = id; placeId.value = null }
function selected(id) { placeId.value = id }
watch([tab, placeId], () => window.scrollTo({ top: 0, behavior: 'auto' }))
function refresh() { if (city.mode === 'api') { city.overview.reload(); city.map.reload(); city.places.reload() } }
function reported(message) { report.value = null; emit('notify', message); refresh() }
</script>
<template>
  <div class="quiet-app">
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
      <span class="q-status-badge">{{ city.mode === 'demo' ? '目前為示範體驗' : '目前為後端串接模式' }}</span>
      <p class="source-explainer">{{ city.mode === 'demo' ? '天氣、空氣品質、回報、刺激指數與場所均為固定示例，沒有串接官方即時監測。插畫不是場所實景，請勿依虛構場所規劃行程。' : '資料由後端整合，請依各來源時間與信心判斷。沒有資料或過期資訊不代表環境安靜。' }}</p>
      <div class="source-info-row"><AppIcon name="clock" :size="20"/><span><strong>{{ city.mode === 'demo' ? '固定示範時間' : '最近資料更新' }}</strong>{{ formatTime(city.overview.meta.value?.updatedAt) }}</span></div>
      <h3 class="source-subtitle">資料來源</h3><div v-for="(source, index) in city.overview.meta.value?.sources || []" :key="index" class="source-entry"><strong>{{ source.name }}</strong><span>{{ source.license || '授權資訊尚待提供' }}</span><a v-if="source.url?.startsWith('https://')" :href="source.url" target="_blank" rel="noopener noreferrer">查看原始資料</a></div>
      <p v-if="!city.overview.meta.value?.sources?.length" class="q-helper">尚未取得來源資料，請稍後重試。</p>
      <h3 class="source-subtitle">如何看待資料信心</h3><p class="q-helper">依回報數、觀測新鮮度與資料涵蓋度由後端判定。主觀感受、手機音量及官方資料分別標示；超過 30 分鐘的感官資訊不列入低刺激推薦。手機 dBFS 不是校準的環境分貝。</p>
      <h3 class="source-subtitle">開源地圖</h3><p class="q-helper">採用指定 Yuzen 地圖相同的 MapLibre 與 OpenFreeMap Liberty 底圖，不複製該網站程式或圖片。</p><p class="source-map-links"><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p>
    </AppSheet>
  </div>
</template>
