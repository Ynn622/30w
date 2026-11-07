<script setup>
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import AppSheet from './AppSheet.vue'
import LevelScale from './LevelScale.vue'
import { SENSES, levelText } from '../../lib/sensoryDomain.js'

// 首頁感官卡片的小視窗：顯示此維度的數值，並以敏感圖層同款色帶加小箭頭標示目前級別（與概況說明視窗相同，不放說明文字）。
const props = defineProps({
  city: { type: Object, required: true },
  senseKey: { type: String, required: true },
  value: { type: Number, default: null }, // 首頁實際顯示的有效值；null 代表未知
  described: Boolean, // 整體概況是否可判斷（資料足夠且未過期）
})
defineEmits(['close'])
const sense = computed(() => SENSES.find(item => item.key === props.senseKey))
const data = computed(() => props.city.overview.data.value)
const dimension = computed(() => data.value?.sensoryIndex?.dimensionMeta?.[props.senseKey] || null)
const REASONS = { no_data: '近 30 分鐘沒有這一項的回報。', stale: '觀測已超過 30 分鐘，不採用。', insufficient_samples: '樣本數不足，暫不判斷。', incompatible_scale: '資料尺度無法比較，暫不採用。' }
// 測試情境的模擬平均：有效網格數不是人數或回報數。
const testMode = computed(() => props.city.overview.meta.value?.mode === 'test-only')
const validCount = computed(() => data.value?.validPointCounts?.[props.senseKey] ?? null)
const valueText = computed(() => testMode.value
  ? `模擬平均 ${props.value}／100・${validCount.value} 個有效網格（非人數）`
  : `刺激指數 ${props.value}／100`)
const missingText = computed(() => {
  if (props.value !== null) return ''
  if (testMode.value) return '附近 150 公尺內這一項沒有有效模擬網格；未知不代表環境安靜。'
  if (!props.described) return '附近整體資料不足或已過期，暫不判斷。'
  if (dimension.value?.missingReason) return REASONS[dimension.value.missingReason] || '目前沒有可採用的資料。'
  return '目前沒有可採用的資料；未知不代表環境安靜。'
})
</script>

<template>
  <AppSheet :title="`${sense?.label}資料說明`" dialog @close="$emit('close')">
    <div class="sense-info-value" :class="sense?.color">
      <AppIcon :name="sense?.icon || 'layers'" :size="30" />
      <div>
        <strong>{{ levelText(value) }}</strong>
        <span>{{ value === null ? missingText : valueText }}</span>
      </div>
    </div>
    <LevelScale :value="value" :label="`${sense?.label}刺激程度`" :ticks="sense?.scale" />
  </AppSheet>
</template>

<style scoped>
.sense-info-value { display: flex; align-items: center; gap: 12px; margin: 4px 0 10px; padding: 12px; border-radius: 12px; background: #f1f8fa; }
.sense-info-value.teal { color: var(--q-brand, #0391a7); }.sense-info-value.amber { color: #c9961f; }.sense-info-value.blue { color: #3387a4; }.sense-info-value.green { color: #2f7f39; }
.sense-info-value strong { display: block; color: var(--q-ink, #222c33); font-size: 22px; line-height: 1.3; }
.sense-info-value span { display: block; color: #4f5f69; font-size: 13px; line-height: 1.6; }
</style>
