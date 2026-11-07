<script setup>
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import AppSheet from './AppSheet.vue'
import { MOCK_LABEL, SENSES, formatTime, levelText } from '../../lib/sensoryDomain.js'
import { SSI_WEIGHTS } from '../../lib/sensoryIndex.js'

// 首頁感官卡片的小視窗：說明此維度的數值、計算方式與資料來源。
const props = defineProps({
  city: { type: Object, required: true },
  senseKey: { type: String, required: true },
  value: { type: Number, default: null }, // 首頁實際顯示的有效值；null 代表未知
  described: Boolean, // 整體概況是否可判斷（資料足夠且未過期）
})
defineEmits(['close'])
const sense = computed(() => SENSES.find(item => item.key === props.senseKey))
const data = computed(() => props.city.overview.data.value)
const meta = computed(() => props.city.overview.meta.value)
const dimension = computed(() => data.value?.sensoryIndex?.dimensionMeta?.[props.senseKey] || null)
const NOTES = {
  noise: '不是分貝；手機量測的 dBFS 只作同裝置相對音量，不直接計入。',
  light: '不是照度；天氣、日照或 UV 不能代替現場刺眼程度。',
  crowd: '不是人數；捷運歷史進出量不會當成現在的人潮。',
  odor: '空氣品質 AQI 不能代替氣味，兩者分開計算。',
}
const REASONS = { no_data: '近 30 分鐘沒有這一項的回報。', stale: '觀測已超過 30 分鐘，不採用。', insufficient_samples: '樣本數不足，暫不判斷。', incompatible_scale: '資料尺度無法比較，暫不採用。' }
const missingText = computed(() => {
  if (props.value !== null) return ''
  if (!props.described) return '附近整體資料不足或已過期，暫不判斷。'
  if (dimension.value?.missingReason) return REASONS[dimension.value.missingReason] || '目前沒有可採用的資料。'
  return '目前沒有可採用的資料；未知不代表環境安靜。'
})
const confidenceText = value => ({ high: '高', medium: '中等', low: '低', insufficient: '不足' })[value] || '未知'
const sources = computed(() => meta.value?.sources || [])
</script>

<template>
  <AppSheet :title="`${sense?.label}資料說明`" dialog @close="$emit('close')">
    <div class="sense-info-value" :class="sense?.color">
      <AppIcon :name="sense?.icon || 'layers'" :size="30" />
      <div>
        <strong>{{ levelText(value) }}</strong>
        <span>{{ value === null ? missingText : `刺激指數 ${value}／100` }}</span>
      </div>
    </div>
    <h3>怎麼計算</h3>
    <p>彙整附近 30 分鐘內的主觀回報，換算成 0–100 相對刺激尺度（越高越刺激）：0–33 低、34–66 中等、67–100 偏高。{{ NOTES[senseKey] }}</p>
    <p>在環境刺激指數 SSI 中占 {{ Math.round((SSI_WEIGHTS[senseKey] || 0) * 100) }}%；你設定的敏感度為 {{ city.preferences.value.sensitivities?.[senseKey] ?? '—' }}／5，只用於個人適配排序。</p>
    <dl v-if="dimension" class="sense-info-list">
      <div><dt>觀測時間</dt><dd>{{ formatTime(dimension.observedAt) }}</dd></div>
      <div><dt>有效至</dt><dd>{{ formatTime(dimension.validUntil) }}</dd></div>
      <div><dt>採用樣本</dt><dd>{{ dimension.sampleCount ?? '未知' }} 筆</dd></div>
      <div><dt>資料信心</dt><dd>{{ confidenceText(dimension.confidence) }}</dd></div>
    </dl>
    <h3>資料來源</h3>
    <p v-if="meta?.mock" class="sense-info-mock">{{ MOCK_LABEL }}</p>
    <ul v-if="sources.length" class="sense-info-sources">
      <li v-for="(source, index) in sources" :key="index"><a v-if="source.url?.startsWith('https://')" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.name }}</a><span v-else>{{ source.name }}</span><small>{{ source.license || '授權資訊尚待提供' }}</small></li>
    </ul>
    <p v-else>尚未取得來源資料。</p>
  </AppSheet>
</template>

<style scoped>
.sense-info-value { display: flex; align-items: center; gap: 12px; margin: 4px 0 10px; padding: 12px; border-radius: 12px; background: #f1f8fa; }
.sense-info-value.teal { color: var(--q-brand, #0391a7); }.sense-info-value.amber { color: #c9961f; }.sense-info-value.blue { color: #3387a4; }.sense-info-value.green { color: #2f7f39; }
.sense-info-value strong { display: block; color: var(--q-ink, #222c33); font-size: 22px; line-height: 1.3; }
.sense-info-value span { display: block; color: #4f5f69; font-size: 13px; line-height: 1.6; }
h3 { margin: 14px 0 6px; color: var(--q-ink, #222c33); font-size: 15px; }
p { margin: 0 0 8px; color: #4f5f69; font-size: 13px; line-height: 1.7; }
.sense-info-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 8px 0 0; }
.sense-info-list div { padding: 7px 9px; border-radius: 8px; background: #f6f9fa; }
.sense-info-list dt { color: #66747d; font-size: 12px; }
.sense-info-list dd { margin: 2px 0 0; color: #2c3a42; font-size: 13px; }
.sense-info-mock { padding: 6px 9px; border-radius: 7px; background: #fff4e8; color: #7a4a1f; }
.sense-info-sources { margin: 0; padding: 0; list-style: none; }
.sense-info-sources li { display: grid; gap: 2px; padding: 6px 0; font-size: 13px; color: #3f5360; }
.sense-info-sources a { color: var(--q-deep, #007a90); display: inline-flex; align-items: center; min-height: 44px; }
.sense-info-sources small { color: var(--q-muted); font-size: 12px; }
</style>
