<script setup>
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
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
// placeTarget：場所詳情的目標，雙來源場所為 { origin, liveId, testId, scenario }，舊資料為字串 id。
const tab = ref('home'), placeTarget = ref(null), report = ref(null), measuring = ref(false)
const placeKey = computed(() => placeTarget.value == null ? '' : typeof placeTarget.value === 'string' ? placeTarget.value : JSON.stringify(placeTarget.value))
const tabs = [{ id: 'home', label: '首頁', icon: 'home' }, { id: 'explore', label: '探索', icon: 'map' }, { id: 'profile', label: '我的', icon: 'sliders' }]
// sheet 透過 Teleport 掛在 body，低刺激模式需設在 body 才能一起套用。
watchEffect(() => { if (typeof document !== 'undefined') document.body.classList.toggle('q-low-stimulus', city.preferences.value.lowStimulus) })
onUnmounted(() => document.body.classList.remove('q-low-stimulus'))
// 服務只依目前定位提供，開啟時即請求定位。
onMounted(() => city.locate())
// 測試情境只影響探索地圖的敏感圖層，回報與量測照常可用。
function openReport(kind) { report.value = kind }
function openMeasure() { measuring.value = true }
function navigate(id) { tab.value = id; placeTarget.value = null }
function selected(target) { placeTarget.value = target }
watch([tab, placeKey], () => window.scrollTo({ top: 0, behavior: 'auto' }))
function refresh() { city.refresh() }
function reported(message) { report.value = null; emit('notify', message); refresh() }
</script>
<template>
  <div class="quiet-app" :data-low-stimulus="city.preferences.value.lowStimulus || undefined">
    <Transition name="quiet-page" mode="out-in">
      <PlaceDetail v-if="placeTarget" :key="`place-${placeKey}`" :target="placeTarget" :city="city" @back="placeTarget = null" @notify="$emit('notify', $event)"/>
      <QuietHome v-else-if="tab === 'home'" key="home" :city="city" @report="openReport" @measure="openMeasure" @explore="navigate('explore')" @select="selected"/>
      <ExploreView v-else-if="tab === 'explore'" key="explore" :city="city" @select="selected" @notify="$emit('notify', $event)"/>
      <QuietProfile v-else key="profile" :city="city" @select="selected" @explore="navigate('explore')"/>
    </Transition>
    <nav class="quiet-bottom-nav" aria-label="主要導覽"><button v-for="item in tabs" :key="item.id" :class="{ active: tab === item.id }" :aria-current="tab === item.id ? 'page' : undefined" @click="navigate(item.id)"><span><AppIcon :name="item.icon" :size="22"/></span>{{ item.label }}<i v-if="tab === item.id"></i></button></nav>
    <ReportSheet v-if="report" :kind="report" :city="city" @close="report = null" @done="reported"/>
    <NoiseSheet v-if="measuring" :city="city" @close="measuring = false" @notify="$emit('notify', $event)" @shared="refresh"/>
  </div>
</template>
