<script setup>
import { computed } from 'vue'

// 個人化歷史折線圖：x 軸為一天中的時段（每 3 小時一點），y 軸為 0–100 個人刺激值（越高越刺激）。
// 33／66 虛線與敏感圖層的綠／黃／紅分界一致；未知時段不畫點、折線在該處斷開（不當作安靜）。
const props = defineProps({ points: { type: Array, default: () => [] }, stepHours: { type: Number, default: 3 } })
const W = 320, H = 168, PAD = { left: 30, right: 12, top: 12, bottom: 26 }
const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom
const x = hour => PAD.left + (hour / 24) * plotW + (props.stepHours / 24) * plotW / 2
const y = value => PAD.top + (1 - value / 100) * plotH
const hourLabel = hour => `${String(hour).padStart(2, '0')}:00`
const known = computed(() => props.points.filter(point => Number.isFinite(point.value)))
// 連續的已知點連成一段；遇到未知就斷開。
const segments = computed(() => {
  const result = []
  let current = []
  for (const point of props.points) {
    if (Number.isFinite(point.value)) current.push(`${x(point.hour).toFixed(1)},${y(point.value).toFixed(1)}`)
    else { if (current.length) result.push(current); current = [] }
  }
  if (current.length) result.push(current)
  return result.map(list => list.join(' '))
})
const levelOf = value => value <= 33 ? '安靜' : value <= 66 ? '注意' : '刺激'
const summary = computed(() => props.points.map(point => `${hourLabel(point.hour)} ${Number.isFinite(point.value) ? `${point.value}（${levelOf(point.value)}）` : '未知'}`).join('、'))
const peak = computed(() => known.value.reduce((best, point) => !best || point.value > best.value ? point : best, null))
const calmest = computed(() => known.value.reduce((best, point) => !best || point.value < best.value ? point : best, null))
</script>

<template>
  <figure class="history-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`個人化刺激值折線圖：${summary}`">
      <g class="history-grid" aria-hidden="true">
        <line v-for="level in [0, 33, 66, 100]" :key="level" :x1="PAD.left" :x2="W - PAD.right" :y1="y(level)" :y2="y(level)" :class="{ guide: level === 33 || level === 66 }" />
        <text v-for="level in [0, 33, 66, 100]" :key="`t${level}`" :x="PAD.left - 6" :y="y(level) + 4" text-anchor="end">{{ level }}</text>
        <text v-for="point in points" :key="`h${point.hour}`" :x="x(point.hour)" :y="H - 8" text-anchor="middle">{{ String(point.hour).padStart(2, '0') }}</text>
      </g>
      <polyline v-for="(segment, index) in segments" :key="index" class="history-line" :points="segment" />
      <circle v-for="point in known" :key="`p${point.hour}`" class="history-dot" :class="`level-${levelOf(point.value)}`" :cx="x(point.hour)" :cy="y(point.value)" r="4" />
    </svg>
    <figcaption>
      <span v-if="calmest">最安靜：{{ hourLabel(calmest.hour) }}（{{ calmest.value }}）</span>
      <span v-if="peak">最刺激：{{ hourLabel(peak.hour) }}（{{ peak.value }}）</span>
      <span v-if="!known.length">此日期類型的各時段資料皆為未知。</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.history-chart { margin: 0; }
.history-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.history-grid line { stroke: #e3e9ec; stroke-width: 1; }
.history-grid line.guide { stroke: #c9d3d8; stroke-dasharray: 4 4; }
.history-grid text { fill: #6b7a84; font-size: 10px; }
.history-line { fill: none; stroke: var(--q-brand, #0391a7); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.history-dot { stroke: #fff; stroke-width: 2; fill: var(--q-brand, #0391a7); }
.history-dot.level-安靜 { fill: #2b7d57; }
.history-dot.level-注意 { fill: #b88a1a; }
.history-dot.level-刺激 { fill: #b8423a; }
.history-chart figcaption { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; color: var(--q-muted, #64727d); font-size: 13px; line-height: 1.6; }
</style>
