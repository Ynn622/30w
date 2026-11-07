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
const updatedClock = computed(() => {
  const value = props.city.overview.meta.value?.updatedAt
  if (!value || !Number.isFinite(new Date(value).getTime())) return '時間未知'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
})
defineEmits(['report', 'measure', 'explore', 'select', 'sources'])
</script>

<template>
  <section class="quiet-view quiet-home">
    <header class="home-heading">
      <div class="home-heading-copy">
        <h1>城市靜音鍵</h1>
        <p>看見城市的感官環境，找到屬於你的安靜角落</p>
      </div>
      <svg class="city-illustration" viewBox="0 0 150 130" fill="none" aria-hidden="true">
        <path d="M3 119h142" stroke="#b9e0e7" stroke-width="2" />
        <path d="M96 17V2m-7 28h14l-2 10H91Zm-1 13h14l3 16H87Zm-4 19h22l3 16H82Zm-4 19h30l-2 16H80Zm5 19h22l3 19H80Z" fill="#0391A7" />
        <path d="M16 91h20v28H16Zm25-26h17v54H41Zm73 18h18v36h-18Z" fill="#9bd5e1" />
        <path d="M62 82h14v37H62Zm-1-2 8-9 8 9M5 105h7v14H5Zm132-4h9v18h-9Z" fill="#c3e8ef" />
        <path d="M21 99h10m-10 8h10m15-29h7m-7 9h7m-7 9h7m-7 9h7m66-12h8m-8 10h8M91 50h12m-14 18h16m-19 18h20m-20 22h20" stroke="#eaf9fc" stroke-width="2.5" />
        <path d="M5 40h28a6 6 0 0 0 0-12h-2a9 9 0 0 0-17-3A8 8 0 0 0 5 40Zm111-19h18a5 5 0 0 0 0-10h-2a7 7 0 0 0-13-2 6 6 0 0 0-3 12Z" fill="#e2f4f8" />
      </svg>
    </header>

    <div class="area-row">
      <label class="q-area-select">
        <AppIcon name="pin" :size="17" />
        <select v-model="city.areaId.value" aria-label="選擇探索區域">
          <option v-for="area in AREAS" :key="area.id" :value="area.id">臺北市・{{ area.name }}</option>
        </select>
      </label>
      <button class="q-text-button" :disabled="city.locating.value" @click="city.locate">
        <AppIcon name="locate" :size="17" />
        {{ city.locating.value ? '定位中…' : city.deviceLocation.value ? '已使用目前位置' : '使用目前位置' }}
      </button>
    </div>

    <AsyncState v-if="city.overview.state.value !== 'ready'" :state="city.overview.state.value" :message="city.overview.error.value" retry @retry="city.overview.reload" />
    <article v-else class="sensory-weather q-reveal">
      <div class="section-heading weather-heading">
        <h2>今日感官天氣・臺北市</h2>
        <button class="q-text-button muted" :title="formatTime(city.overview.meta.value?.updatedAt)" :aria-label="`${city.mode === 'demo' ? '示範資料時間' : '資料更新時間'}：${formatTime(city.overview.meta.value?.updatedAt)}`" @click="$emit('sources')">
          {{ city.mode === 'demo' ? '示範' : '更新' }}：{{ updatedClock }}
        </button>
      </div>
      <div class="weather-main">
        <div class="weather-symbol">
          <AppIcon name="cloud" :size="78" :stroke-width="1.4" />
          <div class="weather-waves" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="weather-copy">
          <h2 :class="{ 'insufficient-headline': !canDescribe }">{{ canDescribe ? city.overview.data.value.headline : '資料不足，暫無法判斷' }}</h2>
          <p>{{ canDescribe ? city.overview.data.value.description : '近期資料不足或已過期，歡迎分享感受。' }}</p>
        </div>
        <button class="weather-more q-icon-button" aria-label="查看感官資料來源" @click="$emit('sources')"><AppIcon name="chevron" :size="21" /></button>
      </div>
      <div class="sense-grid">
        <div v-for="sense in SENSES" :key="sense.key" class="sense-tile" :class="sense.color">
          <AppIcon :name="sense.icon" :size="29" />
          <span>{{ sense.label }}</span>
          <strong :class="{ 'high-stimulus': sense.key !== 'air' && canDescribe && city.overview.data.value.senses?.[sense.key] > 66, 'good-air': sense.key === 'air' && levelText(city.overview.data.value.senses?.air, true) === '良好' }">{{ levelText(canDescribe || sense.key === 'air' ? city.overview.data.value.senses?.[sense.key] : null, sense.key === 'air') }}</strong>
        </div>
      </div>
      <button class="confidence-note" @click="$emit('sources')">
        <AppIcon name="shield" :size="17" />
        <span>附近 {{ city.overview.data.value.windowMinutes }} 分鐘內 <b>{{ city.overview.data.value.reportCount }} 筆回報</b>・{{ city.overview.data.value.measurementCount }} 筆裝置量測<br><small>{{ city.mode === 'demo' ? '以上皆為示範數據，非官方即時監測' : '主觀感受與裝置音量分開統計' }} · {{ { high: '資料信心高', medium: '資料信心中等', low: '資料信心低', insufficient: '資料不足' }[city.overview.data.value.confidence] || '信心未知' }}</small></span>
        <AppIcon name="chevron" :size="16" />
      </button>
      <div v-if="city.overview.data.value.weather" class="weather-foot">
        <span><AppIcon name="sun" :size="17" />{{ city.overview.data.value.weather.temperatureC ?? '—' }}°C · {{ city.overview.data.value.weather.description }}</span>
        <span>降雨 {{ city.overview.data.value.weather.rainProbability ?? '—' }}%</span>
      </div>
    </article>

    <section class="quick-report-section q-reveal">
      <div class="section-heading"><h2>快速回報</h2><span>讓城市知道這裡的感受</span></div>
      <div class="report-grid">
        <button v-for="kind in REPORT_KINDS" :key="kind.id" :class="kind.color" @click="$emit('report', kind)">
          <AppIcon :name="kind.icon" :size="29" />
          <span>{{ kind.label }}</span>
        </button>
      </div>
      <button class="measurement-cta q-reveal" @click="$emit('measure')">
        <span class="measurement-icon"><AppIcon name="wave" :size="25" /></span>
        <strong>啟用環境量測（聲音）</strong>
        <AppIcon class="measurement-arrow" name="chevron" :size="21" />
      </button>
      <p class="microcopy"><AppIcon name="shield" :size="14" />由你決定是否分享摘要，不儲存或上傳錄音。</p>
    </section>

    <section class="nearby-section q-reveal">
      <div class="section-heading"><h2>附近的安靜角落</h2><button class="q-text-button" @click="$emit('explore')">探索更多<AppIcon name="chevron" :size="17" /></button></div>
      <p class="q-helper">{{ city.mode === 'demo' ? '虛構場所與直線距離示範，請勿據此前往。' : '依偏好篩選；直線距離不等於步行距離。' }}</p>
      <AsyncState v-if="city.places.state.value !== 'ready'" :state="city.places.state.value" :message="city.places.error.value" retry @retry="city.places.reload" />
      <AsyncState v-else-if="!city.places.data.value?.places?.length" title="還沒找到符合偏好的角落" message="試著擴大探索距離，或在探索頁調整條件。" />
      <PlaceCard v-for="place in city.places.data.value?.places || []" v-else :key="place.id" :place="place" @select="$emit('select', $event)" />
    </section>
    <footer class="quiet-footer"><AppIcon name="leaf" :size="16" /><span>每一種感受，都值得被城市接住。</span></footer>
  </section>
</template>

<style scoped>
.quiet-home {
  padding: calc(18px + env(safe-area-inset-top)) 14px calc(100px + env(safe-area-inset-bottom));
  background: #fff;
}
.home-heading { position: relative; display: flex; align-items: flex-start; min-height: 98px; padding: 0 96px 8px 4px; }
.home-heading-copy { position: relative; z-index: 1; }
.home-heading h1 { margin: 0 0 8px; color: var(--q-ink, #222c33); font-size: 28px; line-height: 1.3; letter-spacing: -.035em; font-weight: 750; }
.home-heading p { max-width: 280px; margin: 0; color: #4c5961; font-size: 14px; line-height: 1.65; }
.city-illustration { position: absolute; top: -10px; right: -8px; bottom: auto; width: 106px; height: 112px; opacity: 1; }
.area-row { margin: 0 2px 8px; gap: 8px; }
.q-area-select { color: var(--q-brand, #0391A7); }
.q-area-select select { max-width: 170px; padding-inline: 2px; color: #4b5962; font-size: 13px; }
.q-text-button { gap: 5px; font-size: 13px; }
.sensory-weather { padding: 0 14px; border: 1px solid #dce8ed; border-radius: 15px; background: linear-gradient(120deg, #eaf8fc 0%, #f8fcfe 70%, #fff 100%); box-shadow: none; }
.section-heading h2 { color: var(--q-ink, #222c33); font-size: 18px; font-weight: 700; }
.section-heading > span { color: #5c6870; font-size: 13px; line-height: 1.4; }
.weather-heading { gap: 4px 10px; min-height: 48px; flex-wrap: wrap; }
.weather-heading h2 { font-size: 17px; }
.weather-heading .q-text-button { color: #68747c; font-size: 12px; font-weight: 400; }
.weather-main { position: relative; gap: 14px; padding: 16px 0 20px; }
.weather-symbol { flex-shrink: 0; width: 82px; height: 76px; color: #61adbf; }
.weather-symbol > svg { margin-top: -4px; }
.weather-waves { top: 34px; left: 28px; height: 28px; gap: 4px; padding-inline: 4px; background: #eff9fc; }
.weather-waves i { width: 4px; background: #4aa5b9; }
.weather-waves i:nth-child(2) { height: 25px; }
.weather-waves i:nth-child(3) { height: 19px; }
.weather-copy { flex: 1; min-width: 0; padding-right: 24px; }
.weather-main h2 { margin: 0 0 7px; color: #222b31; font-size: 28px; font-weight: 750; line-height: 1.25; letter-spacing: -.03em; }
.weather-main h2.insufficient-headline { font-size: 22px; }
.weather-main p { margin: 0; color: #58666f; font-size: 14px; line-height: 1.55; }
.weather-more { position: absolute; right: -10px; top: 18px; width: 44px; min-height: 44px; padding: 8px; color: #29353d; }
.sense-grid { gap: 7px; }
.sense-tile { min-width: 0; gap: 5px; padding: 10px 3px 9px; border-color: #dbe6ec; border-radius: 10px; background: #ffffffba; }
.sense-tile > span { color: #29363f; font-size: 14px; line-height: 1.4; letter-spacing: -.03em; }
.sense-tile strong { color: #26343c; font-size: 16px; line-height: 1.35; font-weight: 600; }
.sense-tile.teal { color: var(--q-brand, #0391A7); }.sense-tile.amber { color: #e5b13e; }.sense-tile.blue { color: #3387a4; }.sense-tile.green { color: #2f7f39; }
.sense-tile strong.high-stimulus { color: #b45761; }.sense-tile strong.good-air { color: #2f7f39; }
.confidence-note { align-items: flex-start; min-height: 62px; padding: 11px 0 9px; gap: 6px; color: #97a9b3; }
.confidence-note > svg { flex-shrink: 0; margin-top: 3px; }
.confidence-note > span { color: #6a7780; font-size: 12px; line-height: 1.7; }
.confidence-note small { color: var(--q-muted); font-size: 12px; }
.weather-foot { border-color: #dce9ee; padding: 10px 0 11px; color: #657783; font-size: 13px; }
.quick-report-section { margin-top: 12px; padding: 12px 13px 0; border: 1px solid #e5eaee; border-radius: 15px; background: #fff; }
.quick-report-section .section-heading { justify-content: flex-start; gap: 10px; margin-bottom: 11px; }
.report-grid { gap: 9px; }
.report-grid button { min-height: 80px; gap: 6px; border: 1px solid #dde3e8; border-radius: 10px; background: linear-gradient(#fff, #fafbfc); box-shadow: none; }
.report-grid button:hover { border-color: #63b5c3; background: #eaf8fb; }
.report-grid button:focus-visible { outline-color: #0391a780; }
.report-grid button span { color: #303e47; font-size: 15px; line-height: 1.3; }
.report-grid button.teal { color: #2197ac; }.report-grid button.amber { color: #dfad36; }.report-grid button.blue { color: #5c707e; }.report-grid button.purple { color: #83a3ae; }.report-grid button.green { color: #3e8e49; }.report-grid button.muted { color: #50616d; }
.measurement-cta { justify-content: center; gap: 8px; min-height: 48px; margin-top: 15px; padding: 10px 36px 10px 14px; border-radius: 28px; background: var(--q-brand, #0391A7); color: #fff; box-shadow: none; }
.measurement-icon { width: 26px; height: 26px; border: 0; border-radius: 0; }
.measurement-cta > strong { min-width: 0; font-size: 19px; font-weight: 700; line-height: 1.4; letter-spacing: .02em; }
.measurement-arrow { position: absolute; right: 12px; }
.measurement-cta { position: relative; }
.microcopy { align-items: flex-start; gap: 4px; margin: 8px 0 9px; color: #6b7a84; font-size: 12px; line-height: 1.5; text-align: center; }
.microcopy > svg { flex-shrink: 0; margin-top: 2px; }
.nearby-section { margin-top: 20px; }
.nearby-section > .q-helper { color: var(--q-muted); font-size: 12px; line-height: 1.6; margin-block: 4px 10px; }
.quiet-footer { margin-top: 24px; color: var(--q-muted); font-size: 12px; line-height: 1.7; }
@media (max-width: 359px) {
  .quiet-home { padding-inline: 10px; }
  .home-heading { min-height: 100px; padding-right: 78px; }
  .home-heading h1 { font-size: 26px; }
  .home-heading p { font-size: 13px; }
  .city-illustration { right: -4px; width: 88px; height: 100px; }
  .area-row { gap: 4px; }
  .q-area-select select { max-width: 145px; font-size: 12px; }
  .area-row .q-text-button { font-size: 12px; }
  .sensory-weather { padding-inline: 10px; }
  .weather-heading { min-height: 49px; padding-top: 6px; }
  .weather-heading h2 { font-size: 16px; }
  .weather-heading .q-text-button { min-height: 44px; }
  .weather-main { gap: 10px; padding-top: 12px; }
  .weather-symbol { width: 72px; }
  .weather-symbol > svg { width: 72px; }
  .weather-waves { left: 25px; top: 34px; }
  .weather-main h2 { font-size: 26px; }
  .weather-main h2.insufficient-headline { font-size: 20px; }
  .weather-copy { padding-right: 18px; }
  .weather-main p { font-size: 14px; }
  .sense-grid { gap: 5px; }
  .sense-tile { padding-inline: 2px; }
  .sense-tile > span { font-size: 14px; }
  .confidence-note > span, .confidence-note small { font-size: 12px; }
  .quick-report-section { padding-inline: 9px; }
  .quick-report-section .section-heading { gap: 7px; }
  .quick-report-section .section-heading h2 { font-size: 17px; }
  .quick-report-section .section-heading > span { font-size: 12px; }
  .report-grid { gap: 7px; }
  .report-grid button { min-height: 78px; }
  .report-grid button span { font-size: 14px; }
  .measurement-cta { gap: 6px; }
  .measurement-arrow { right: 7px; width: 18px; }
}
</style>
