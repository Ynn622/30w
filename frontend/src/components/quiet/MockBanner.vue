<script setup>
import { computed } from 'vue'
import { MOCK_LABEL, MOCK_SCENARIOS } from '../../lib/mockApi.js'

// 測試情境（remote-mock）長駐標示：情境與「人工情境推估・合成分數・非即時」。
const props = defineProps({ city: { type: Object, required: true }, compact: Boolean })
const scenario = computed(() => MOCK_SCENARIOS.find(item => item.id === props.city.preferences.value.scenario))
</script>

<template>
  <p v-if="city.remoteMock.value" class="mock-banner" :class="{ compact }" role="note">
    <strong>測試情境：{{ scenario?.label }}</strong><span>{{ MOCK_LABEL }}</span>
  </p>
</template>

<style scoped>
.mock-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; margin: 0 0 10px; padding: 7px 10px; border-radius: 8px; background: #fff4e8; color: #7a4a1f; font-size: 13px; line-height: 1.5; }
.mock-banner strong { font-weight: 650; }
.mock-banner.compact { margin: 0; padding: 4px 10px; border-radius: 0; font-size: 12px; }
</style>
