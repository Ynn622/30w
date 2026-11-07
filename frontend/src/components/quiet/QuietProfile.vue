<script setup>
// 裝置已開啟「減少動態」時只提示可開啟低刺激模式，不自動替使用者開啟。
const prefersReducedMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
import AppIcon from '../AppIcon.vue'
import { MOCK_LABEL, MOCK_SCENARIOS } from '../../lib/mockApi.js'
defineProps({ city: { type: Object, required: true } })
defineEmits(['select', 'explore', 'sources'])
const sensitivities = [{ key: 'noise', label: '聲音', icon: 'sound' }, { key: 'light', label: '光線', icon: 'sun' }, { key: 'crowd', label: '人潮', icon: 'people' }, { key: 'odor', label: '氣味', icon: 'wind' }]
const levelWords = ['', '不太在意', '稍微在意', '普通', '在意', '非常在意']
</script>
<template>
  <section class="quiet-view profile-quiet-view"><header class="q-page-header"><h1>我的設定</h1><p>調整感官敏感度與介面，讓推薦更適合你。</p></header>
    <section class="q-settings-card"><div class="section-heading"><h2>感官敏感度</h2><span>僅在此裝置計算</span></div>
      <p class="q-helper sensitivity-help">數字越大代表越在意，用於計算個人適配分數（SFS）並排序推薦；不會改變環境刺激指數，也不會上傳。</p>
      <div v-for="item in sensitivities" :key="item.key" class="sensitivity-row">
        <label :for="`sensitivity-${item.key}`"><span class="setting-icon"><AppIcon :name="item.icon" :size="20"/></span><strong>{{ item.label }}</strong><output :for="`sensitivity-${item.key}`">{{ city.preferences.value.sensitivities[item.key] }}／5 {{ levelWords[city.preferences.value.sensitivities[item.key]] }}</output></label>
        <input :id="`sensitivity-${item.key}`" v-model.number="city.preferences.value.sensitivities[item.key]" class="q-range" type="range" min="1" max="5" step="1" :aria-valuetext="`${city.preferences.value.sensitivities[item.key]}，${levelWords[city.preferences.value.sensitivities[item.key]]}`"/>
      </div>
    </section>
    <section class="q-settings-card"><div class="section-heading"><h2>介面</h2></div><label class="q-setting-row"><span class="setting-icon"><AppIcon name="layers" :size="22"/></span><span><strong>低刺激模式</strong><small>柔和配色、停止動畫、加大按鈕並隱藏裝飾。</small></span><input v-model="city.preferences.value.lowStimulus" class="q-switch" type="checkbox"/></label><p v-if="prefersReducedMotion && !city.preferences.value.lowStimulus" class="q-helper motion-hint">你的裝置已開啟「減少動態」，可一併開啟低刺激模式。</p></section>
    <!-- 測試資料（Ynn622/30w#4）：明確切換正式資料與後端測試情境；情境資料為合成分數，不混入正式安靜程度。 -->
    <section class="q-settings-card test-data-card"><div class="section-heading"><h2>測試資料</h2><span>展示與測試用</span></div>
      <label class="q-setting-row"><span class="setting-icon"><AppIcon name="layers" :size="22"/></span><span><strong>使用測試情境</strong><small>改讀後端 60 個臺北設施的人工情境推估；回報與量測會停用。</small></span><input class="q-switch" type="checkbox" role="switch" :checked="city.remoteMock.value" :aria-checked="city.remoteMock.value" @change="city.preferences.value.dataMode = $event.target.checked ? 'remote-mock' : 'live'"/></label>
      <label v-if="city.remoteMock.value" class="scenario-row"><span>情境</span><select v-model="city.preferences.value.scenario" class="scenario-select"><option v-for="item in MOCK_SCENARIOS" :key="item.id" :value="item.id">{{ item.label }}（{{ item.detail }}）</option></select></label>
      <p class="q-helper test-data-note">{{ city.remoteMock.value ? `目前顯示：${MOCK_LABEL}。光線、人潮、氣味為合成分數，聲音另列推估 dB(A)。` : '目前顯示正式資料：即時回報、量測與開放資料。' }}</p>
    </section>
    <footer class="quiet-footer"><AppIcon name="wave" :size="18"/><span>聆靜・讓每一種感受，都有地方。</span></footer>
  </section>
</template>

<style scoped>
.scenario-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; color: #3a4850; font-size: 14px; }
.scenario-row span { flex: none; font-weight: 600; }
.scenario-select { flex: 1; min-width: 0; min-height: 44px; padding: 0 10px; border: 1px solid #d6e2e8; border-radius: 10px; background: #fff; color: var(--q-ink, #27323a); font: inherit; font-size: 14px; }
.test-data-note { margin: 8px 0 0; font-size: 12px; line-height: 1.6; }
</style>
