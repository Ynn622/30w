<script setup>
import { computed } from 'vue'
import { levelText } from '../../lib/sensoryDomain.js'
import { FIELD_GRADIENT_CSS } from '../../lib/sensoryField.js'

// 首頁說明視窗共用：敏感圖層同款色帶（0–100，左低右高），以小箭頭標示目前數值；null 不畫箭頭。刻度名稱依類別傳入。
const props = defineProps({
  value: { type: Number, default: null },
  label: { type: String, default: '刺激程度' },
  // 刻度名稱（左＝低、中、右＝高），依類別傳入，例如聲音：安靜／有點吵／吵雜。
  ticks: { type: Array, default: () => ['舒適', '普通', '刺激'] },
})
const marker = computed(() => props.value === null ? null : Math.max(0, Math.min(100, props.value)))
</script>

<template>
  <div class="level-scale" role="img" :aria-label="value === null ? `${label}：資料不足` : `${label}：${levelText(value)}，${value}／100`">
    <div class="level-track">
      <span v-if="marker !== null" class="level-marker" :style="{ left: `${marker}%` }" aria-hidden="true"></span>
      <div class="level-bar" :style="{ background: FIELD_GRADIENT_CSS }" aria-hidden="true"></div>
    </div>
    <span class="level-ticks" aria-hidden="true"><span v-for="tick in ticks" :key="tick">{{ tick }}</span></span>
  </div>
</template>

<style scoped>
/* 色帶與刻度同敏感圖層圖例（map-legend-bar），放大成對話框寬度。 */
.level-scale { margin: 14px 4px 8px; }
.level-track { position: relative; padding-top: 11px; }
.level-bar { height: 10px; border-radius: 10px; opacity: .85; }
.level-marker { position: absolute; top: 0; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid var(--q-ink, #222c33); transform: translateX(-50%); }
.level-ticks { position: relative; display: block; height: 18px; margin-top: 4px; color: var(--q-muted, #6c7c85); font-size: 12px; }
.level-ticks span { position: absolute; top: 0; }
.level-ticks span:nth-child(1) { left: 0; }
.level-ticks span:nth-child(2) { left: 50%; transform: translateX(-50%); }
.level-ticks span:nth-child(3) { right: 0; }
</style>
