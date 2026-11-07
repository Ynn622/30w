<script setup>
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'
import AppSheet from './AppSheet.vue'
import { MOCK_LABEL, formatTime, levelText } from '../../lib/sensoryDomain.js'
import { SSI_WEIGHTS } from '../../lib/sensoryIndex.js'

// 首頁感官概況卡片右側箭頭開啟的小視窗，樣式與四張感官卡片的說明視窗相同。
// 取代原本的「關於這些城市感受」資料來源頁；依開發者決定（2026-11-08）不列資料來源，只保留模擬資料標示。
const props = defineProps({
  city: { type: Object, required: true },
  ssi: { type: Number, default: null }, // 首頁實際採用的環境刺激指數；null 代表無法計算
  described: Boolean, // 整體概況是否可判斷（資料足夠且未過期）
})
defineEmits(['close'])
const data = computed(() => props.city.overview.data.value)
const meta = computed(() => props.city.overview.meta.value)
const mock = computed(() => Boolean(meta.value?.mock))
const weights = computed(() => Object.entries({ 聲音: SSI_WEIGHTS.noise, 光線: SSI_WEIGHTS.light, 人潮: SSI_WEIGHTS.crowd, 氣味: SSI_WEIGHTS.odor })
  .map(([label, weight]) => `${label} ${Math.round(weight * 100)}%`).join('、'))
</script>

<template>
  <AppSheet title="感官概況說明" dialog @close="$emit('close')">
    <div class="sense-info-value">
      <AppIcon name="cloud" :size="30" />
      <div>
        <strong>{{ described ? data?.headline : '資料不足' }}</strong>
        <span>{{ ssi === null ? '近期資料不足或已過期，暫無法判斷；未知不代表環境安靜。' : `環境刺激指數 SSI ${ssi}／100（${levelText(ssi)}）` }}</span>
      </div>
    </div>
    <h3>怎麼計算</h3>
    <p>彙整目前位置附近 30 分鐘內的主觀回報，聲音、光線、人潮、氣味各自換算成 0–100 相對刺激尺度（越高越刺激）。環境刺激指數 SSI 依 {{ weights }} 加權，缺資料的項目不列入、不算 0。</p>
    <p>{{ mock ? '模擬資料時間' : '資料更新時間' }}：{{ formatTime(meta?.updatedAt) }}。每 2 分鐘自動更新，點時間旁的重新整理圖示可立即更新。</p>
    <p v-if="mock" class="mock-note">{{ MOCK_LABEL }}</p>
  </AppSheet>
</template>

<style scoped>
.sense-info-value { display: flex; align-items: center; gap: 12px; margin: 4px 0 10px; padding: 12px; border-radius: 12px; background: #f1f8fa; color: #61adbf; }
.sense-info-value strong { display: block; color: var(--q-ink, #222c33); font-size: 22px; line-height: 1.3; }
.sense-info-value span { display: block; color: #4f5f69; font-size: 13px; line-height: 1.6; }
h3 { margin: 14px 0 6px; color: var(--q-ink, #222c33); font-size: 15px; }
p { margin: 0 0 8px; color: #4f5f69; font-size: 13px; line-height: 1.7; }
.mock-note { padding: 6px 8px; border-radius: 6px; background: #fff4e8; color: #7a4a1f; }
</style>
