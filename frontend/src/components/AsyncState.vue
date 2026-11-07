<script setup>
defineProps({
  state: { type: String, default: 'empty' },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  retry: { type: Boolean, default: false },
})
defineEmits(['retry'])
</script>

<template>
  <div class="async-state" :class="state" :role="state === 'error' ? 'alert' : 'status'" aria-live="polite">
    <span v-if="state === 'loading'" class="async-spinner" aria-hidden="true"></span>
    <strong>{{ title || ({ loading: '載入中…', error: '暫時無法取得資料', empty: '目前沒有資料' }[state]) }}</strong>
    <p v-if="message">{{ message }}</p>
    <button v-if="retry && state === 'error'" type="button" @click="$emit('retry')">重新嘗試</button>
  </div>
</template>

<style scoped>
.async-state { display: grid; justify-items: center; gap: 10px; padding: 25px 16px; border: 1px dashed var(--line); border-radius: 16px; margin-block: 15px; text-align: center; }
strong { font-size: 16px; } p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.8; overflow-wrap: anywhere; }
.error { border-color: #e9c7bf; color: #a43d30; }
button { min-height: 44px; padding: 0 16px; border: 0; border-radius: 12px; background: var(--brand); color: white; cursor: pointer; }
.async-spinner { width: 24px; height: 24px; border: 3px solid var(--line); border-top-color: var(--brand); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
