<script setup>
import { computed } from 'vue'
import { SENSES, levelText } from '../../lib/sensoryDomain.js'
import { SENSORY_KEYS } from '../../lib/sensoryIndex.js'

const props = defineProps({ assessment: { type: Object, default: null }, mock: Boolean, compact: Boolean })
const labels = Object.fromEntries(SENSES.map(sense => [sense.key, sense.label]))
const missing = computed(() => SENSORY_KEYS.filter(key => props.assessment?.dimensions?.[key] == null).map(key => labels[key]))
const partial = computed(() => props.assessment?.ssi != null && missing.value.length > 0)
const percent = value => `${Math.round((value || 0) * 100)}%`
// 舊版接口只有 senses，沒有版本化指數；此時不自行推造 SSI。
const unavailable = computed(() => props.assessment?.availableCount > 0 && !props.assessment?.scoreVersion && props.assessment?.basis !== 'typical_scenario' ? '尚無版本化指數' : '資料不足')
</script>

<template>
  <div v-if="compact" class="score-compact" :class="{ unknown: assessment?.ssi == null && assessment?.sfs == null }">
    <span v-if="assessment?.ssi != null" class="score-chip" :class="`level-${levelText(assessment.ssi)}`"><b>SSI {{ assessment.ssi }}</b>{{ levelText(assessment.ssi) }}刺激</span>
    <span v-if="assessment?.sfs != null" class="score-chip fit"><b>安靜程度 {{ assessment.sfs }}</b></span>
    <span v-if="assessment?.sfs != null && missing.length" class="score-partial">部分資料・缺{{ missing.join('、') }}</span>
    <span v-if="assessment?.ssi == null && assessment?.sfs == null" class="score-partial">刺激指數：{{ unavailable }}</span>
  </div>

  <section v-else class="score-panel" aria-label="感官指數">
    <div class="score-stats">
      <div class="score-stat">
        <span>環境刺激 SSI</span>
        <strong>{{ assessment?.ssi ?? '—' }}</strong>
        <small>{{ assessment?.ssi == null ? unavailable : `${levelText(assessment.ssi)}・越高越刺激` }}</small>
      </div>
      <div class="score-stat fit">
        <span>個人適配 SFS</span>
        <strong>{{ assessment?.sfs ?? '—' }}</strong>
        <small>{{ assessment?.sfs == null ? unavailable : '依你的敏感度・越高越適合' }}</small>
      </div>
    </div>
    <p class="score-coverage" :class="{ warn: partial || assessment?.ssi == null }">
      <template v-if="assessment?.ssi != null">
        {{ partial ? '部分資料：' : '完整四維：' }}涵蓋 {{ assessment.availableCount }}／4 維（環境權重 {{ percent(assessment.coverage) }}、個人權重 {{ percent(assessment.fitCoverage) }}）<template v-if="partial">，缺少{{ missing.join('、') }}，缺值不當作低刺激</template>。
      </template>
      <template v-else>沒有足夠的有效觀測可計算指數；未知或過期資料不代表環境安靜。</template>
    </p>
  </section>
</template>

<style scoped>
.score-compact { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin-top: 7px; font-size: 12px; line-height: 1.4; }
.score-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 5px; color: #2f6a59; background: #e8f5ef; }
.score-chip b { font-weight: 650; }
.score-chip.level-中等 { color: #7a5b12; background: #fbf2d9; }
.score-chip.level-偏高 { color: #8f3b44; background: #fbe7e8; }
.score-chip.fit { color: #075f6e; background: #e5f5f8; }
.score-partial { color: #7a5a2c; }
.score-compact.unknown .score-partial { color: #66747d; }
.score-panel { margin: 16px 0 6px; padding: 12px; border: 1px solid #dce8ed; border-radius: 10px; background: #fbfdfe; }
.score-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.score-stat { display: grid; gap: 2px; padding: 9px 10px; border-radius: 8px; background: #eff7f9; }
.score-stat.fit { background: #e9f6f2; }
.score-stat span { color: #44535c; font-size: 13px; }
.score-stat strong { color: #1f3a44; font-size: 28px; font-weight: 700; line-height: 1.2; }
.score-stat small { color: #5d6c75; font-size: 12px; line-height: 1.5; }
.score-coverage { margin: 10px 0 4px; color: #4f5f69; font-size: 13px; line-height: 1.65; }
.score-coverage.warn { padding: 7px 9px; border-radius: 7px; color: #7a4a1f; background: #fff4e8; }
</style>
