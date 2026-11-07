<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import PlaceCard from './PlaceCard.vue'
import SenseInfoDialog from './SenseInfoDialog.vue'
import OverviewInfoDialog from './OverviewInfoDialog.vue'
import QuietLogo from './QuietLogo.vue'
import CityIllustration from './CityIllustration.vue'
import LocationGate from './LocationGate.vue'
import { MOCK_LABEL, SENSES, REPORT_KINDS, formatTime, isFresh, senseLevel } from '../../lib/sensoryDomain.js'
import { estimateDb, noiseLevel, readDbOffset } from '../../lib/noiseLevel.js'
import { OVERVIEW_AGGREGATION_VERSION } from '../../lib/hourlyApi.js'
import { summarizeOverview } from '../../lib/overviewSummary.js'

const props = defineProps({ city: { type: Object, required: true } })
// 「附近的安靜角落」暫時隱藏；改回 true 即可恢復，推薦清單仍可在探索頁使用。
const SHOW_NEARBY = false
// 感官卡片下方的「點選卡片可查看說明」提示暫時隱藏；改回 true 即可恢復。
const SHOW_SENSE_HINT = false
// 首頁概況目前讀後端 test/mock/overview（目前位置 150 公尺內網格平均），先當正式資料呈現：
// 直接採用後端平均值（可為小數、0 為有效、各維獨立為 null），沒有觀測時間與樣本數，不套正式回報的新鮮度與 SSI 規則。
const gridOverview = computed(() => props.city.overview.meta.value?.aggregationVersion === OVERVIEW_AGGREGATION_VERSION)
const canDescribe = computed(() => {
  const data = props.city.overview.data.value
  if (gridOverview.value) return Boolean(data) && data.confidence !== 'insufficient'
  return data && data.confidence !== 'insufficient' && (data.reportCount > 0 || data.measurementCount > 0)
    && isFresh(data.observedAt, Date.now())
})
// 首頁四維與 SSI 只採有效觀測；空品 AQI 另列，不代替氣味。
const assessment = computed(() => props.city.overview.data.value && !gridOverview.value ? props.city.assess(props.city.overview.data.value, props.city.overview.meta.value) : null)
const senseValue = key => {
  if (!canDescribe.value) return null
  return gridOverview.value ? props.city.overview.data.value.senses?.[key] ?? null : assessment.value?.dimensions?.[key] ?? null
}
// 標題與說明不用後端固定文字，改由四維平均依「我的」感官敏感度加權計算（個人化指數，與敏感圖層一致）。
const personal = computed(() => gridOverview.value && canDescribe.value
  ? summarizeOverview(props.city.overview.data.value.senses, props.city.preferences.value.sensitivities) : null)
const weatherHeadline = computed(() => gridOverview.value ? personal.value?.headline : props.city.overview.data.value?.headline)
const weatherDescription = computed(() => gridOverview.value ? personal.value?.description : props.city.overview.data.value?.description)
const MISSING_TEXT = { no_points_within_radius: '附近 150 公尺內沒有資料。', no_valid_mock_values: '附近 150 公尺內的資料皆為未知。' }
const insufficientText = computed(() => gridOverview.value
  ? `${MISSING_TEXT[props.city.overview.data.value?.missingReason] || '附近沒有可用的資料。'}未知不代表環境安靜。`
  : '近期資料不足或已過期，歡迎分享感受。')
// 資料時間：正式資料用 meta.updatedAt，150 公尺平均用後端的 simulatedAt；只有內建模擬備援才標「模擬」。
const overviewTime = computed(() => props.city.overview.meta.value?.updatedAt || props.city.overview.data.value?.simulatedAt || null)
const fallbackMock = computed(() => Boolean(props.city.overview.meta.value?.mock) && !gridOverview.value)
// 首頁只列最近三次量測，完整紀錄保留在此裝置。
const recentNoise = computed(() => {
  const { offset } = readDbOffset()
  return (props.city.noiseHistory?.value ?? []).slice(0, 3).map(item => {
    const db = estimateDb(item.averageDbfs, offset)
    return { ...item, db, level: noiseLevel(db) }
  })
})
// 點選感官卡片時開啟的資料說明小視窗；概況卡片右側箭頭開啟整體說明（同樣式）。
const infoKey = ref(null), overviewOpen = ref(false)
// 最近的量測紀錄預設收起，點標題才展開。
const historyOpen = ref(false)
// 低刺激模式：標題旁的切換鈕可直接開關（不必到「我的」），快速回報的 8 個類型預設收起以降低畫面密度。
const lowStimulus = computed(() => Boolean(props.city.preferences.value.lowStimulus))
const reportOpen = ref(false)
function toggleLowStimulus() { props.city.preferences.value.lowStimulus = !lowStimulus.value }
// 首頁概況或清單還在載入，就視為重新整理中（敏感圖層的模擬網格只在換時段時重抓，不計入）。
const refreshing = computed(() => [props.city.overview, props.city.places].some(remote => remote?.state?.value === 'loading'))
const updatedClock = computed(() => {
  const value = overviewTime.value
  if (!value || !Number.isFinite(new Date(value).getTime())) return '時間未知'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
})
defineEmits(['report', 'measure', 'explore', 'select'])
</script>

<template>
  <section class="quiet-view quiet-home">
    <header class="home-heading">
      <div class="home-heading-copy">
        <div class="home-title">
          <QuietLogo :size="40" /><h1>聆靜</h1>
          <button type="button" class="low-stimulus-toggle" :class="{ on: lowStimulus }" :aria-pressed="lowStimulus" :aria-label="`低刺激模式，目前${lowStimulus ? '已開啟' : '已關閉'}`" @click="toggleLowStimulus">
            <span><AppIcon v-if="lowStimulus" name="check" :size="14" :stroke-width="2.4" />低刺激</span>
          </button>
        </div>
        <p>在台北，找到屬於你的安靜角落。</p>
      </div>
      <CityIllustration />
    </header>

    <!-- 目前只依裝置定位提供服務，不開放手動選擇區域。 -->
    <LocationGate v-if="!city.serviceAvailable.value" :city="city" />
    <template v-else>
    <!-- 地點前的定位圖示即「重新定位」按鈕（與分享感受的地址框相同）；右側為資料時間與重新整理圖示，點選即重新整理。 -->
    <div class="area-row">
      <span class="q-area-select" aria-live="polite">
        <button type="button" class="q-icon-button relocate-button" :class="{ locating: city.locating.value }" :disabled="city.locating.value" :aria-label="city.locating.value ? '定位中' : '重新定位'" :title="city.locating.value ? '定位中' : '重新定位'" @click="city.locate"><AppIcon name="locate" :size="20" /></button>
        <span class="area-city">{{ city.village?.value ? `${city.village.value.district}・${city.village.value.village}` : city.area.value.name }}</span>
        <small class="area-source">目前位置</small>
      </span>
      <!-- 重新整理期間資料會先清空，按鈕仍保留並顯示「更新中…」，避免整列跳動。 -->
      <button v-if="city.overview.state.value !== 'idle'" type="button" class="q-text-button muted updated-button" :class="{ refreshing }" :disabled="refreshing" :title="refreshing ? '更新中' : `資料時間 ${formatTime(overviewTime)}，點選重新整理`" :aria-label="refreshing ? '資料更新中' : `重新整理資料（${fallbackMock ? '模擬資料時間' : '資料更新時間'} ${formatTime(overviewTime)}）`" @click="city.refresh">
        <template v-if="refreshing">更新中…</template>
        <template v-else-if="city.overview.state.value === 'ready'">{{ fallbackMock ? '模擬' : '更新' }}：{{ updatedClock }}</template>
        <template v-else>重新整理</template>
        <AppIcon name="refresh" :size="14" />
      </button>
    </div>

    <AsyncState v-if="city.overview.state.value !== 'ready'" :state="city.overview.state.value" :message="city.overview.error.value" retry @retry="city.overview.reload" />
    <article v-else class="sensory-weather q-reveal" aria-label="目前位置的感官概況">
      <div class="weather-main">
        <div class="weather-symbol">
          <AppIcon name="cloud" :size="78" :stroke-width="1.4" />
          <div class="weather-waves" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="weather-copy">
          <h2 :class="{ 'insufficient-headline': !canDescribe }">{{ canDescribe ? weatherHeadline : '資料不足，暫無法判斷' }}</h2>
          <p>{{ canDescribe ? weatherDescription : insufficientText }}</p>
        </div>
        <button class="weather-more q-icon-button" aria-label="查看感官概況說明" @click="overviewOpen = true"><AppIcon name="chevron" :size="21" /></button>
      </div>
      <div class="sense-grid">
        <button v-for="sense in SENSES" :key="sense.key" type="button" class="sense-tile" :class="sense.color" :aria-label="`${sense.label}：${senseLevel(sense.key, senseValue(sense.key)).text}，查看說明與計算方式`" @click="infoKey = sense.key">
          <AppIcon :name="sense.icon" :size="29" />
          <span>{{ sense.label }}</span>
          <strong class="sense-level" :class="senseLevel(sense.key, senseValue(sense.key)).tone">{{ senseLevel(sense.key, senseValue(sense.key)).text }}</strong>
        </button>
      </div>
      <p v-if="SHOW_SENSE_HINT" class="sense-hint">點選卡片可查看說明與計算方式</p>
    </article>
    <OverviewInfoDialog v-if="overviewOpen" :city="city" :ssi="canDescribe ? (gridOverview ? personal?.stimulus : assessment?.ssi) ?? null : null" :headline="weatherHeadline" :described="canDescribe" @close="overviewOpen = false" />
    <SenseInfoDialog v-if="infoKey" :city="city" :sense-key="infoKey" :value="senseValue(infoKey)" :described="canDescribe" @close="infoKey = null" />

    <section class="quick-report-section q-reveal">
      <div class="section-heading"><h2>快速回報</h2><span>讓城市知道這裡的感受</span></div>
      <button v-if="lowStimulus" type="button" class="report-disclosure" :aria-expanded="reportOpen" aria-controls="report-grid" @click="reportOpen = !reportOpen">
        <span>選擇要回報的感受</span><AppIcon class="report-disclosure-chevron" :class="{ open: reportOpen }" name="chevron" :size="18" />
      </button>
      <div v-if="!lowStimulus || reportOpen" id="report-grid" class="report-grid">
        <button v-for="kind in REPORT_KINDS" :key="kind.id" :class="kind.color" :aria-label="`${kind.label}：${kind.hint}`" :title="kind.hint" @click="$emit('report', kind)">
          <AppIcon :name="kind.icon" :size="26" />
          <span>{{ kind.label }}</span>
        </button>
      </div>
      <button class="measurement-cta q-reveal" @click="$emit('measure')">
        <span class="measurement-icon"><AppIcon name="wave" :size="25" /></span>
        <strong>啟用環境量測（聲音）</strong>
        <AppIcon class="measurement-arrow" name="chevron" :size="21" />
      </button>
      <p class="microcopy"><AppIcon name="shield" :size="14" />由你決定是否分享摘要，不儲存或上傳錄音。</p>
      <section v-if="recentNoise.length" class="noise-history" aria-label="最近的量測紀錄">
        <h3><button type="button" class="noise-history-toggle" :aria-expanded="historyOpen" aria-controls="noise-history-list" @click="historyOpen = !historyOpen"><span>最近的量測紀錄<small>{{ recentNoise.length }} 筆</small></span><AppIcon class="noise-history-chevron" :class="{ open: historyOpen }" name="chevron" :size="18" /></button></h3>
        <ol v-show="historyOpen" id="noise-history-list">
          <li v-for="item in recentNoise" :key="item.id">
            <strong>{{ item.db === null ? '—' : `約 ${item.db}` }}<small>dB</small><span v-if="item.level" class="noise-history-level" :class="`level-${item.level.id}`">{{ item.level.label }}</span></strong>
            <span>{{ formatTime(item.measuredAt) }}{{ item.locationLabel ? ` · ${item.locationLabel}` : '' }}<br>原始 {{ item.averageDbfs }} dBFS</span>
          </li>
        </ol>
      </section>
    </section>
    </template>

    <section v-if="SHOW_NEARBY && city.serviceAvailable.value" class="nearby-section q-reveal">
      <div class="section-heading"><h2>附近的安靜角落</h2><button class="q-text-button" @click="$emit('explore')">探索更多<AppIcon name="chevron" :size="17" /></button></div>
      <p class="q-helper">{{ city.places.meta.value?.mock ? `${MOCK_LABEL}。` : '' }}依偏好篩選；直線距離不等於步行距離。{{ city.preferences.value.sort === 'fit' ? '依個人適配排序，完整資料優先。' : '依直線距離排序。' }}</p>
      <AsyncState v-if="city.places.state.value !== 'ready'" :state="city.places.state.value" :message="city.places.error.value" retry @retry="city.places.reload" />
      <AsyncState v-else-if="!city.recommendations.value.length" title="還沒找到符合偏好的角落" message="試著擴大探索距離，或在探索頁調整條件。" />
      <PlaceCard v-for="place in city.recommendations.value" v-else :key="place.id" :place="place" :mock="Boolean(city.places.meta.value?.mock)" @select="$emit('select', $event)" />
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
.home-title { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; }
/* 低刺激切換鈕：外框 44px 觸控區，內部為 30px 高的膠囊；開啟時顯示勾選並換底色。 */
.low-stimulus-toggle { display: inline-flex; align-items: center; min-height: 44px; margin-left: 2px; padding: 0; border: 0; background: transparent; font: inherit; cursor: pointer; }
.low-stimulus-toggle > span { display: inline-flex; align-items: center; gap: 3px; height: 30px; padding: 0 11px; border: 1px solid #cfdfe5; border-radius: 15px; background: #fff; color: #4d6a75; font-size: 13px; font-weight: 600; white-space: nowrap; }
.low-stimulus-toggle.on > span { border-color: var(--q-line); background: var(--q-mint); color: var(--q-deep); }
.report-disclosure { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 52px; padding: 0 14px; border: 1px solid var(--q-line); border-radius: 12px; background: var(--q-canvas, #f7f9fa); color: var(--q-ink); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
.report-disclosure-chevron { color: var(--q-muted); transform: rotate(90deg); }
.report-disclosure-chevron.open { transform: rotate(-90deg); }
.home-heading h1 { margin: 0; color: var(--q-ink, #222c33); font-size: 28px; line-height: 1.3; letter-spacing: -.035em; font-weight: 750; }
.home-heading p { max-width: 280px; margin: 0; color: #4c5961; font-size: 14px; line-height: 1.65; }
.city-illustration { position: absolute; top: -4px; right: -8px; bottom: auto; width: 124px; height: 106px; opacity: 1; }
.area-row { margin: 0 2px 8px; gap: 8px; }
.q-area-select { color: var(--q-brand, #0391A7); }
.area-city { color: #34434c; font-size: 14px; font-weight: 600; white-space: nowrap; }
.area-source { margin-left: 4px; padding: 2px 6px; border-radius: 5px; color: #4d6a75; background: #edf6f8; font-size: 12px; white-space: nowrap; }
.q-text-button { gap: 5px; font-size: 13px; }
.sensory-weather { padding: 0 14px; border: 1px solid #dce8ed; border-radius: 15px; background: linear-gradient(120deg, #eaf8fc 0%, #f8fcfe 70%, #fff 100%); box-shadow: none; }
.section-heading h2 { color: var(--q-ink, #222c33); font-size: 18px; font-weight: 700; }
.section-heading > span { color: #5c6870; font-size: 13px; line-height: 1.4; }
.updated-button { flex-shrink: 0; gap: 4px; min-height: 44px; color: #68747c; font-size: 12px; font-weight: 400; white-space: nowrap; }
.updated-button svg { color: var(--q-brand, #0391a7); }
.updated-button.refreshing svg { animation: q-relocate-spin 1s linear infinite; }
/* 地點前的定位圖示即「重新定位」按鈕，觸控區 44px（同分享感受的地址框）。 */
.relocate-button { flex-shrink: 0; width: 44px; min-height: 44px; margin: -6px -6px -6px -10px; padding: 0; border-radius: 50%; color: var(--q-brand, #0391a7); }
.relocate-button:hover:not(:disabled) { background: var(--q-mint, #edf8fc); }
.relocate-button.locating svg { animation: q-relocate-spin 1.2s linear infinite; }
@keyframes q-relocate-spin { to { transform: rotate(360deg); } }
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
/* 隱藏下方提示時，卡片是最後一個元素，補回與外框底部的間距。 */
.sense-grid:last-child { margin-bottom: 14px; }
.sense-tile { min-width: 0; gap: 5px; padding: 10px 3px 9px; border-color: #dbe6ec; border-radius: 10px; background: #ffffffba; }
.sense-tile > span { color: #29363f; font-size: 14px; line-height: 1.4; letter-spacing: -.03em; }
.sense-tile strong { color: #26343c; font-size: 16px; line-height: 1.35; font-weight: 600; }
.sense-tile.teal { color: var(--q-brand, #0391A7); }.sense-tile.amber { color: #e5b13e; }.sense-tile.blue { color: #3387a4; }.sense-tile.green { color: #2f7f39; }
.sense-tile { width: 100%; font: inherit; cursor: pointer; }
.sense-tile:hover { border-color: #9fd2dc; background: #fff; }
/* 級距文字依刺激程度配色（綠／黃／紅，與色帶一致；文字色加深以確保對比），未知維持中性色。 */
.sense-tile strong.low { color: #2b7d57; }
.sense-tile strong.mid { color: #9a6700; }
.sense-tile strong.high { color: #b8423a; }
.sense-hint { margin: 8px 0 12px; color: var(--q-muted); font-size: 12px; line-height: 1.5; text-align: center; }
.quick-report-section { margin-top: 12px; padding: 12px 13px 0; border: 1px solid #e5eaee; border-radius: 15px; background: #fff; }
.quick-report-section .section-heading { justify-content: flex-start; gap: 10px; margin-bottom: 11px; }
.report-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.report-grid button { min-height: 76px; padding: 8px 2px; gap: 5px; border: 1px solid #dde3e8; border-radius: 10px; background: linear-gradient(#fff, #fafbfc); box-shadow: none; }
.report-grid button:hover { border-color: #63b5c3; background: #eaf8fb; }
.report-grid button:focus-visible { outline-color: #0391a780; }
.report-grid button span { color: #303e47; font-size: 13px; line-height: 1.3; white-space: nowrap; }
.report-grid button.teal { color: #2197ac; }.report-grid button.amber { color: #dfad36; }.report-grid button.blue { color: #5c707e; }.report-grid button.purple { color: #83a3ae; }.report-grid button.coral { color: #cf6f55; }.report-grid button.slate { color: #5f7186; }.report-grid button.green { color: #3e8e49; }.report-grid button.muted { color: #50616d; }
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
  .city-illustration { right: -4px; width: 100px; height: 86px; }
  .area-row { gap: 4px; }
  .area-city { font-size: 12px; }
  .home-title { gap: 8px; }
  .area-row .q-text-button { font-size: 12px; }
  .sensory-weather { padding-inline: 10px; }
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
  .quick-report-section { padding-inline: 9px; }
  .quick-report-section .section-heading { gap: 7px; }
  .quick-report-section .section-heading h2 { font-size: 17px; }
  .quick-report-section .section-heading > span { font-size: 12px; }
  .report-grid { gap: 5px; }
  .report-grid button { min-height: 72px; }
  .report-grid button span { font-size: 12px; }
  .measurement-cta { gap: 6px; }
  .measurement-arrow { right: 7px; width: 18px; }
}
</style>
