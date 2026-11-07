<script setup>
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import AppSheet from './AppSheet.vue'
import LevelScale from './LevelScale.vue'
import { MOCK_LABEL, OVERALL_SCALE, levelText } from '../../lib/sensoryDomain.js'
import { HOURLY_LABEL, slotLabel } from '../../lib/hourlyApi.js'

// 首頁感官概況卡片右側箭頭開啟的小視窗，樣式與四張感官卡片的說明視窗相同。
// 不放說明文字與資料來源（開發者 2026-11-08 決定）；以敏感圖層同款色帶加小箭頭標示目前級別，只保留模擬資料標示。
const props = defineProps({
  city: { type: Object, required: true },
  ssi: { type: Number, default: null }, // 首頁實際採用的環境刺激指數；null 代表無法計算，不畫箭頭
  described: Boolean, // 整體概況是否可判斷（資料足夠且未過期）
})
defineEmits(['close'])
const data = computed(() => props.city.overview.data.value)
const mock = computed(() => Boolean(props.city.overview.meta.value?.mock))
// 測試情境的模擬平均不計算 SSI，只說明時段與網格數。
const testMode = computed(() => props.city.overview.meta.value?.mode === 'test-only')
const summary = computed(() => {
  if (testMode.value) return props.described
    ? `${slotLabel(data.value)} 典型時段・附近 150 公尺 ${data.value.pointCount} 個網格平均；模擬資料不計算環境刺激指數 SSI。`
    : '附近 150 公尺內沒有可用的模擬資料；未知不代表環境安靜。'
  return props.ssi === null ? '近期資料不足或已過期，暫無法判斷；未知不代表環境安靜。' : `環境刺激指數 SSI ${props.ssi}／100（${levelText(props.ssi)}）`
})
</script>

<template>
  <AppSheet title="感官概況說明" dialog @close="$emit('close')">
    <div class="sense-info-value">
      <AppIcon name="cloud" :size="30" />
      <div>
        <strong>{{ described ? data?.headline : '資料不足' }}</strong>
        <span>{{ summary }}</span>
      </div>
    </div>
    <LevelScale :value="ssi" label="整體刺激程度" :ticks="OVERALL_SCALE" />
    <p v-if="mock" class="mock-note">{{ testMode ? HOURLY_LABEL : MOCK_LABEL }}</p>
  </AppSheet>
</template>

<style scoped>
.sense-info-value { display: flex; align-items: center; gap: 12px; margin: 4px 0 10px; padding: 12px; border-radius: 12px; background: #f1f8fa; color: #61adbf; }
.sense-info-value strong { display: block; color: var(--q-ink, #222c33); font-size: 22px; line-height: 1.3; }
.sense-info-value span { display: block; color: #4f5f69; font-size: 13px; line-height: 1.6; }
.mock-note { margin: 10px 0 0; padding: 6px 8px; border-radius: 6px; background: #fff4e8; color: #7a4a1f; font-size: 13px; line-height: 1.7; }
</style>
