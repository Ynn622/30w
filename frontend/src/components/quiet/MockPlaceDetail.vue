<script setup>
import { computed, onServerPrefetch, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import AsyncState from '../AsyncState.vue'
import MockPhoto from './MockPhoto.vue'
import { MOCK_LABEL, MOCK_SCENARIOS, assessMockPlace, mockApi } from '../../lib/mockApi.js'
import { distanceMeters, googleMapsDirectionsUrl, levelText } from '../../lib/sensoryDomain.js'
import { sendToNative } from '../../lib/webview.js'

// 測試情境的場所詳情：以同一個 Mock UUID 與情境查詢 test/mock/places/{id}，不查正式 places/{id}，
// 也不套用正式的新鮮度與 SSI 規則；三項分數標為「合成刺激」，聲音另列推估 dB(A)。
const props = defineProps({ id: { type: String, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['back', 'notify'])
const place = ref(null), meta = ref(null), state = ref('loading'), error = ref('')
let controller, serial = 0, loading = null
const scenario = computed(() => props.city.preferences.value.scenario)
const scenarioInfo = computed(() => MOCK_SCENARIOS.find(item => item.id === scenario.value))
const distance = computed(() => distanceMeters(props.city.center.value, place.value?.location))
const assessment = computed(() => place.value ? assessMockPlace(place.value, props.city.preferences.value.sensitivities) : null)
const STATUS_TEXT = { open: '情境中開放', partial: '情境中部分時段開放', closed: '情境中休館', unknown: '開放狀態未知' }
const SYNTHETIC = [{ key: 'light', label: '光線（合成）', icon: 'sun' }, { key: 'crowd', label: '人潮（合成）', icon: 'people' }, { key: 'odor', label: '氣味（合成）', icon: 'wind' }]
const httpsOnly = value => typeof value === 'string' && value.startsWith('https://') ? value : null
function load() { loading = fetchPlace(); return loading }
async function fetchPlace() {
  controller?.abort(); controller = new AbortController(); const current = ++serial
  state.value = 'loading'; error.value = ''; place.value = null; meta.value = null
  try {
    const result = await mockApi.getPlace(props.id, { scenario: scenario.value }, { signal: controller.signal })
    if (current !== serial) return
    place.value = result.data; meta.value = result.meta; state.value = 'ready'
  } catch (reason) {
    if (current !== serial || reason?.code === 'CANCELLED') return
    error.value = reason.message; state.value = 'error'
  }
}
watch(() => [props.id, scenario.value], load, { immediate: true })
// 伺服器端渲染（測試）時等第一次載入完成再輸出。
onServerPrefetch(() => loading)
onUnmounted(() => { serial++; controller?.abort() })
function navigate() {
  const url = googleMapsDirectionsUrl(place.value?.location)
  if (!url) { emit('notify', '此場所缺少有效座標，無法導航。'); return }
  const result = sendToNative('launch_map', url, window)
  if (result.delivered) emit('notify', '已請 App 開啟導航。')
  else window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <section class="quiet-view place-detail-view mock-detail">
    <header class="detail-header">
      <button type="button" class="q-icon-button" aria-label="返回上一頁" @click="$emit('back')"><AppIcon name="back" :size="23"/></button>
      <h1>場所詳情</h1>
      <span class="header-spacer" aria-hidden="true"></span>
    </header>
    <p class="mock-banner" role="note"><strong>測試情境：{{ scenarioInfo?.label }}</strong>（{{ scenarioInfo?.detail }}）・{{ MOCK_LABEL }}</p>
    <AsyncState v-if="state !== 'ready'" :state="state" :message="error" retry @retry="load" />
    <template v-else-if="place">
      <MockPhoto :place="place" large />
      <div class="detail-title">
        <div class="detail-title-copy"><h2>{{ place.name }}</h2><p class="detail-sub"><AppIcon :name="place.indoor ? 'book' : 'leaf'" :size="16"/>{{ place.category }}・{{ place.district }}</p></div>
        <div class="detail-distance"><AppIcon name="pin" :size="21"/><strong>{{ distance ?? '—' }}<small>公尺直線</small></strong></div>
      </div>
      <p class="status-line" :class="place.openStatus"><strong>{{ STATUS_TEXT[place.openStatus] }}</strong><template v-if="place.openStatus === 'partial' && place.estimatedInterval">：{{ place.estimatedInterval }}</template><template v-if="['closed', 'unknown'].includes(place.openStatus)">，不列為可前往的推薦。</template></p>
      <p v-if="meta?.notice" class="q-helper">{{ meta.notice }}</p>

      <h3>合成刺激 <small>0–100，越高越刺激</small></h3>
      <div class="sense-bars">
        <div v-for="sense in SYNTHETIC" :key="sense.key"><AppIcon :name="sense.icon" :size="22"/><span>{{ sense.label }}</span><div class="sense-track"><i v-if="Number.isInteger(place.senses[sense.key])" :style="{ width: `${place.senses[sense.key]}%` }"></i></div><strong>{{ place.senses[sense.key] ?? '未知' }}</strong></div>
      </div>
      <p class="sound-line"><AppIcon name="sound" :size="20"/><span v-if="place.sound.value != null">聲音推估 <b>{{ place.sound.value }} dB(A)</b>（人工容許帶 {{ place.sound.low }}–{{ place.sound.high }}，非實測）</span><span v-else>聲音：未知</span></p>
      <p v-if="assessment?.quiet != null" class="quiet-line">合成安靜度 <b>{{ assessment.quiet }}</b>・{{ levelText(100 - assessment.quiet) }}刺激（依你的敏感度加權三項合成刺激，非正式安靜程度）</p>
      <p class="q-helper">合成分數由原始 0–3 級別依各級鐘型分布換算，不是量測：光線非照度、人潮非人數、氣味非污染濃度。</p>

      <h3>情境與位置說明</h3>
      <dl class="mock-facts">
        <div><dt>推估位置</dt><dd>{{ place.sampleLocation || '—' }}</dd></div>
        <div><dt>座標</dt><dd>設施代表點，非實測點或入口</dd></div>
        <div v-if="place.address"><dt>地址</dt><dd>{{ place.address }}</dd></div>
        <div v-if="place.accessNote"><dt>通行說明</dt><dd>{{ place.accessNote }}</dd></div>
        <div v-if="place.assumptions"><dt>情境假設</dt><dd>{{ place.season }}・{{ place.assumptions }}</dd></div>
        <div v-if="place.uncertainty"><dt>不確定性</dt><dd>{{ place.uncertainty }}</dd></div>
      </dl>

      <h3>資料來源</h3>
      <ul class="mock-sources">
        <li v-for="source in meta?.sources || []" :key="source.id"><a v-if="httpsOnly(source.url)" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a><span v-else>{{ source.name }}</span><small>{{ source.attribution }}<template v-if="httpsOnly(source.licenseUrl)">・<a :href="source.licenseUrl" target="_blank" rel="noopener noreferrer">授權</a></template><template v-if="source.limitations">・{{ source.limitations }}</template></small></li>
      </ul>
      <div class="detail-actions"><button type="button" class="q-primary" @click="navigate"><AppIcon name="route" :size="21"/>步行導航</button></div>
    </template>
  </section>
</template>

<style scoped>
.place-detail-view { padding: calc(9px + env(safe-area-inset-top)) 12px calc(98px + env(safe-area-inset-bottom)); background: #fff; color: var(--q-ink, #27323a); }
.detail-header { display: flex; align-items: center; justify-content: space-between; gap: 5px; min-height: 46px; margin: 0 -5px 6px; }
.detail-header h1 { margin: 0; font-size: 19px; font-weight: 650; }
.header-spacer { width: 44px; }
.mock-banner { margin: 0 0 10px; padding: 8px 10px; border-radius: 8px; background: #fff4e8; color: #7a4a1f; font-size: 13px; line-height: 1.6; }
.detail-title { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 12px; margin: 13px 0 6px; }
.detail-title h2 { margin: 0 0 4px; font-size: 21px; font-weight: 650; line-height: 1.4; overflow-wrap: anywhere; }
.detail-sub { display: flex; align-items: center; gap: 5px; margin: 0; color: #66747d; font-size: 13px; }
.detail-distance { display: flex; align-items: flex-start; gap: 5px; color: var(--q-brand, #0391a7); }
.detail-distance strong { font-size: 17px; font-weight: 600; color: #38454e; text-align: right; }
.detail-distance small { display: block; color: #66747d; font-size: 12px; font-weight: 400; }
.status-line { margin: 4px 0 8px; padding: 7px 10px; border-radius: 8px; font-size: 14px; background: #e6f5df; color: #2f6a35; }
.status-line.partial { background: #fbf2d9; color: #7a5b12; }
.status-line.closed, .status-line.unknown { background: #eef1f2; color: #4f5f69; }
h3 { margin: 18px 0 8px; font-size: 17px; font-weight: 650; }
h3 small { margin-left: 5px; color: #66747d; font-size: 12px; font-weight: 400; }
.sense-bars > div { display: grid; grid-template-columns: 24px 92px minmax(0, 1fr) 34px; align-items: center; gap: 8px; margin: 10px 0; color: #3b87a2; font-size: 14px; }
.sense-bars span { color: #39434b; }
.sense-bars strong { color: #5c6a74; font-size: 14px; font-weight: 500; text-align: right; }
.sense-track { height: 9px; border-radius: 8px; overflow: hidden; background: #e7edf0; }
.sense-track i { display: block; height: 100%; border-radius: inherit; background: #c9a35a; }
.sound-line, .quiet-line { display: flex; align-items: center; gap: 6px; margin: 8px 0; color: #3f5360; font-size: 14px; line-height: 1.6; }
.quiet-line { display: block; }
.mock-facts { margin: 0; }
.mock-facts div { padding: 8px 0; border-bottom: 1px solid #edf1f4; }
.mock-facts dt { color: #66747d; font-size: 12px; }
.mock-facts dd { margin: 2px 0 0; color: #34434c; font-size: 14px; line-height: 1.7; }
.mock-sources { margin: 0; padding: 0; list-style: none; }
.mock-sources li { display: grid; gap: 2px; padding: 8px 0; border-bottom: 1px solid #edf1f4; font-size: 14px; }
.mock-sources a { color: var(--q-deep, #007a90); }
.mock-sources small { color: #66747d; font-size: 12px; line-height: 1.6; }
.detail-actions { display: grid; margin-top: 19px; }
.detail-actions .q-primary { width: 100%; min-height: 49px; border-radius: 10px; font-size: 19px; font-weight: 700; }
</style>
