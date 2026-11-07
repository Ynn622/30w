<script setup>
import { ref } from 'vue'
import ApiTestView from './ApiTestView.vue'
import NativeMethodsPanel from './NativeMethodsPanel.vue'
import AsyncState from './AsyncState.vue'
defineEmits(['close'])
const tab = ref('api')
const previewState = ref('loading')
</script>

<template>
  <section class="view debug-view">
    <header class="debug-header">
      <div><span class="section-kicker">DEVELOPER TOOLS</span><h1>測試工作台</h1></div>
      <button type="button" @click="$emit('close')">離開測試</button>
    </header>
    <p class="debug-intro">手動測試 API、原生介接與共用畫面狀態。</p>
    <div class="debug-tabs" role="group" aria-label="測試類別">
      <button v-for="item in [{ id: 'api', label: '後端 API' }, { id: 'native', label: 'WebView' }, { id: 'ui', label: '畫面狀態' }]" :key="item.id" type="button" :aria-pressed="tab === item.id" @click="tab = item.id">{{ item.label }}</button>
    </div>
    <ApiTestView v-if="tab === 'api'" embedded />
    <NativeMethodsPanel v-else-if="tab === 'native'" />
    <section v-else class="debug-preview">
      <h2>共用狀態預覽</h2>
      <div class="debug-tabs">
        <button v-for="state in ['loading', 'error', 'empty']" :key="state" type="button" :aria-pressed="previewState === state" @click="previewState = state">{{ { loading: '載入中', error: '錯誤', empty: '空資料' }[state] }}</button>
      </div>
      <AsyncState :state="previewState" message="這是 UI 預覽，不會呼叫後端。" retry @retry="previewState = 'loading'" />
    </section>
  </section>
</template>

<style scoped>
.debug-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 15px; }
h1 { margin: 6px 0; font-size: 27px; } h2 { font-size: 18px; }
.debug-intro { color: var(--muted); font-size: 12px; line-height: 1.8; }
button { min-height: 44px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 12px; background: white; color: var(--brand); cursor: pointer; font-size: 12px; }
.debug-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
button[aria-pressed='true'] { background: var(--brand); color: white; border-color: var(--brand); }
.debug-preview { padding: 16px; border: 1px solid var(--line); border-radius: 20px; background: white; }
</style>
