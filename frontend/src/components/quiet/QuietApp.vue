<script setup>
import { onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import AppIcon from '../AppIcon.vue'
import QuietHome from './QuietHome.vue'
import ExploreView from './ExploreView.vue'
import QuietProfile from './QuietProfile.vue'
import PlaceDetail from './PlaceDetail.vue'
import ReportSheet from './ReportSheet.vue'
import NoiseSheet from './NoiseSheet.vue'
import { useQuietCity } from '../../composables/useQuietCity.js'
import '../../styles/quiet.css'
const emit = defineEmits(['notify'])
const city = useQuietCity(message => emit('notify', message))
const tab = ref('home'), placeId = ref(null), report = ref(null), measuring = ref(false)
const tabs = [{ id: 'home', label: '首頁', icon: 'home' }, { id: 'explore', label: '探索', icon: 'map' }, { id: 'profile', label: '我的', icon: 'sliders' }]
// sheet 透過 Teleport 掛在 body，低刺激模式需設在 body 才能一起套用。
watchEffect(() => { if (typeof document !== 'undefined') document.body.classList.toggle('q-low-stimulus', city.preferences.value.lowStimulus) })
onUnmounted(() => document.body.classList.remove('q-low-stimulus'))
// 服務只依目前定位提供，開啟時即請求定位。
onMounted(() => city.locate())
// 測試情境（remote-hourly）禁止正式回報與量測，避免出現假的上傳成功。
function openReport(kind) { if (city.writesEnabled.value) report.value = kind; else emit('notify', '測試情境模式不開放回報。') }
function openMeasure() { if (city.writesEnabled.value) measuring.value = true; else emit('notify', '測試情境模式不開放環境量測。') }
// 切換資料模式時關閉詳情與回報，避免正式與模擬的狀態互相殘留。
watch(() => city.preferences.value.dataMode, () => { placeId.value = null; report.value = null; measuring.value = false })
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
      <QuietHome v-else-if="tab === 'home'" key="home" :city="city" @report="openReport" @measure="openMeasure" @explore="navigate('explore')" @select="selected"/>
      <ExploreView v-else-if="tab === 'explore'" key="explore" :city="city" @select="selected" @notify="$emit('notify', $event)"/>
      <QuietProfile v-else key="profile" :city="city" @select="selected" @explore="navigate('explore')"/>
    </Transition>
    <nav class="quiet-bottom-nav" aria-label="主要導覽"><button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-current="tab === item.id ? 'page' : undefined" @click="navigate(item.id)"><span><AppIcon :name="item.icon" :size="22"/></span>{{ item.label }}<i v-if="tab === item.id"></i></button></nav>
    <ReportSheet v-if="report && city.writesEnabled.value" :kind="report" :city="city" @close="report = null" @done="reported"/>
    <NoiseSheet v-if="measuring && city.writesEnabled.value" :city="city" @close="measuring = false" @notify="$emit('notify', $event)" @shared="refresh"/>
  </div>
</template>
