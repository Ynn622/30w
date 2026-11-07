<script setup>
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlaceCard from './PlaceCard.vue'
import { AREAS, SENSES, REPORT_KINDS, formatTime, isFresh, levelText } from '../../lib/sensoryDomain.js'
const props = defineProps({ city: { type: Object, required: true } })
const canDescribe = computed(() => {
  const data = props.city.overview.data.value
  return data && data.confidence !== 'insufficient' && (data.reportCount > 0 || data.measurementCount > 0)
    && isFresh(data.observedAt, props.city.mode === 'demo' ? props.city.overview.meta.value?.referenceTime : Date.now())
})
defineEmits(['report', 'measure', 'explore', 'select', 'sources'])
</script>
<template>
  <section class="quiet-view quiet-home">
    <header class="quiet-home-header"><div class="quiet-wordmark"><span class="quiet-logo"><AppIcon name="wave" :size="22" /></span><span>城市靜音鍵<small>QUIET CITY, TAIPEI</small></span></div><span class="q-status-badge"><span></span>{{ city.mode === 'demo' ? '示範體驗' : '城市感官網路' }}</span></header>
    <div class="home-intro"><div><p class="q-eyebrow">在城市裡，留一點安靜給自己</p><h1>你的安靜，<br>其實<span>就在附近。</span></h1><p class="intro-caption">感受城市的溫度，找到舒服的角落。</p></div>
      <svg class="city-illustration" viewBox="0 0 150 160" fill="none" aria-hidden="true"><circle cx="84" cy="76" r="62" fill="#e0f0ed"/><path d="M21 135h116" stroke="#93bdb5"/><path d="M92 26V8m-7 33h14l-2 12H87Zm-1 14h14l3 17H83Zm-4 20h22l3 17H78Zm-4 20h30l-2 18H76Zm5 21h22l3 19H76Z" fill="#6ba99e"/><path d="M22 96h20v39H22Zm24-21h17v60H46Zm68 28h18v32h-18Z" fill="#b0d2ca"/><path d="M26 105h11m-11 9h11m-11 9h11M51 87h7m-7 10h7m-7 10h7m-7 10h7m61-4h8m-8 9h8" stroke="#eaf6ef" stroke-width="3"/><path d="M11 60h29a6 6 0 0 0 0-12h-3a9 9 0 0 0-17-3 8 8 0 0 0-9 15Zm106-20h19a5 5 0 0 0 0-10h-2a7 7 0 0 0-13-2 6 6 0 0 0-4 12Z" fill="#f2faf6"/><path d="M10 132q-2-19 9-17 9 4 2 17m111 0q-2-24 10-24 12 9 0 24" fill="#88b9a2"/></svg>
    </div>
    <div class="area-row"><label class="q-area-select"><AppIcon name="pin" :size="15" /><select v-model="city.areaId.value" aria-label="選擇探索區域"><option v-for="area in AREAS" :key="area.id" :value="area.id">臺北市・{{ area.name }}</option></select></label><button class="q-text-button" :disabled="city.locating.value" @click="city.locate"><AppIcon name="locate" :size="14" />{{ city.locating.value ? '定位中…' : city.deviceLocation.value ? '已使用目前位置' : '使用目前位置' }}</button></div>

    <AsyncState v-if="city.overview.state.value !== 'ready'" :state="city.overview.state.value" :message="city.overview.error.value" retry @retry="city.overview.reload" />
    <article v-else class="sensory-weather q-reveal">
      <div class="section-heading"><h2>今日感官天氣</h2><button class="q-text-button muted" @click="$emit('sources')"><AppIcon name="clock" :size="12" />{{ city.mode === 'demo' ? '固定情境' : '更新' }} {{ formatTime(city.overview.meta.value?.updatedAt) }}</button></div>
      <div class="weather-main"><div class="weather-symbol"><AppIcon name="cloud" :size="66" :stroke-width="1.4"/><div class="weather-waves"><i></i><i></i><i></i><i></i></div></div><div><span class="q-eyebrow">{{ city.mode === 'demo' ? '示範環境概況' : `${city.overview.data.value.area}環境概況` }}</span><h2>{{ canDescribe ? city.overview.data.value.headline : '資料不足，暫無法判斷' }}</h2><p>{{ canDescribe ? city.overview.data.value.description : '近期資料不足或已過期，歡迎分享感受。' }}</p></div></div>
      <div class="sense-grid"><div v-for="sense in SENSES" :key="sense.key" class="sense-tile" :class="sense.color"><AppIcon :name="sense.icon" :size="24"/><span>{{ sense.label }}</span><strong>{{ levelText(canDescribe || sense.key === 'air' ? city.overview.data.value.senses?.[sense.key] : null, sense.key === 'air') }}</strong></div></div>
      <button class="confidence-note" @click="$emit('sources')"><AppIcon name="shield" :size="15" /><span>附近 {{ city.overview.data.value.windowMinutes }} 分鐘內 <b>{{ city.overview.data.value.reportCount }} 筆回報</b>・{{ city.overview.data.value.measurementCount }} 筆裝置量測<br><small>{{ city.mode === 'demo' ? '以上皆為示範數據，非官方即時監測' : '主觀感受與裝置音量分開統計' }} · {{ { high: '資料信心高', medium: '資料信心中等', low: '資料信心低', insufficient: '資料不足' }[city.overview.data.value.confidence] || '信心未知' }}</small></span><AppIcon name="chevron" :size="14" /></button>
      <div v-if="city.overview.data.value.weather" class="weather-foot"><span><AppIcon name="sun" :size="15" />{{ city.overview.data.value.weather.temperatureC ?? '—' }}°C · {{ city.overview.data.value.weather.description }}</span><span>降雨 {{ city.overview.data.value.weather.rainProbability ?? '—' }}%</span></div>
    </article>

    <section class="quick-report-section q-reveal"><div class="section-heading"><h2>此刻，你感覺如何？</h2><span>兩步，讓城市更友善</span></div><div class="report-grid"><button v-for="kind in REPORT_KINDS" :key="kind.id" :class="kind.color" @click="$emit('report', kind)"><AppIcon :name="kind.icon" :size="25"/><span>{{ kind.label }}</span></button></div></section>
    <button class="measurement-cta q-reveal" @click="$emit('measure')"><span class="measurement-icon"><AppIcon name="wave" :size="24" /></span><span><strong>聽見此刻的環境</strong><small>開啟 15 秒環境音量量測</small></span><AppIcon name="arrow" :size="20"/></button>
    <p class="microcopy"><AppIcon name="shield" :size="12" /> 由你決定是否分享摘要，不儲存或上傳錄音。</p>

    <section class="nearby-section q-reveal"><div class="section-heading"><div><span class="q-eyebrow">A LITTLE ROOM TO BREATHE</span><h2>附近的安靜角落</h2></div><button class="q-text-button" @click="$emit('explore')">探索更多<AppIcon name="arrow" :size="15" /></button></div>
      <p class="q-helper">{{ city.mode === 'demo' ? '虛構場所與直線距離示範，請勿據此前往。' : '依偏好篩選；直線距離不等於步行距離。' }}</p>
      <AsyncState v-if="city.places.state.value !== 'ready'" :state="city.places.state.value" :message="city.places.error.value" retry @retry="city.places.reload" />
      <AsyncState v-else-if="!city.places.data.value?.places?.length" title="還沒找到符合偏好的角落" message="試著擴大探索距離，或在探索頁調整條件。" />
      <PlaceCard v-for="place in city.places.data.value?.places || []" v-else :key="place.id" :place="place" @select="$emit('select', $event)" />
    </section>
    <footer class="quiet-footer"><AppIcon name="leaf" :size="16" /><span>每一種感受，都值得被城市接住。</span></footer>
  </section>
</template>
