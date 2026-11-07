<script setup>
import AppIcon from '../AppIcon.vue'
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
    <section class="q-settings-card"><div class="section-heading"><h2>介面</h2></div><label class="q-setting-row"><span class="setting-icon"><AppIcon name="layers" :size="22"/></span><span><strong>低刺激模式</strong><small>柔和配色、停止動畫、加大按鈕並隱藏裝飾；警示仍以文字顯示。</small></span><input v-model="city.preferences.value.lowStimulus" class="q-switch" type="checkbox"/></label></section>
    <footer class="quiet-footer"><AppIcon name="wave" :size="18"/><span>聆靜・讓每一種感受，都有地方。</span></footer>
  </section>
</template>
