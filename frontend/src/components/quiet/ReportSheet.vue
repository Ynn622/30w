<script setup>
import { ref } from 'vue'
import AppSheet from './AppSheet.vue'
import AppIcon from '../AppIcon.vue'
import { sensoryApi } from '../../lib/sensoryApi.js'
const props = defineProps({ kind: { type: Object, required: true }, city: { type: Object, required: true } })
const emit = defineEmits(['close', 'done'])
const note = ref(''), busy = ref(false), error = ref('')
async function submit() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try {
    await sensoryApi.createReport({ kind: props.kind.id, note: note.value.trim(), location: props.city.reportLocation.value, observedAt: new Date().toISOString() })
    emit('done', props.city.mode === 'demo' ? '示範回報完成，沒有上傳或儲存到後端。' : '謝謝你，已收到你的環境感受。')
  } catch (reason) { error.value = reason.message }
  finally { busy.value = false }
}
</script>
<template>
  <AppSheet title="分享此刻的感受" :busy="busy" @close="!busy && $emit('close')">
    <div class="report-selection" :class="kind.color"><AppIcon :name="kind.icon" :size="34"/><div><span>你選擇了</span><h3>{{ kind.label }}</h3></div><span class="selection-check"><AppIcon name="check" :size="18"/></span></div>
    <div class="q-location-box"><AppIcon name="pin" :size="20"/><div><strong>{{ city.reportLocation.value.label }}</strong><p>{{ city.reportLocation.value.source === 'manual' ? '使用區域中心，並非你的精確位置。' : '這次回報將包含已同意取得的座標。' }}</p></div></div>
    <button class="q-secondary full" :disabled="city.locating.value || busy" @click="city.locate"><AppIcon name="locate" :size="17"/>{{ city.locating.value ? '定位中…' : '另行同意使用目前位置' }}</button>
    <label class="q-field">補充說明 <span>選填</span><textarea v-model="note" :disabled="busy" maxlength="140" rows="3" placeholder="例如：靠近馬路的座位比較吵…"></textarea><small>{{ note.length }} / 140</small></label>
    <p class="q-helper">不需要提供姓名、疾病或診斷資訊。{{ city.mode === 'demo' ? '目前是示範模式，確認後不會上傳資料。' : '確認後將送出感受、時間與上方顯示的位置。' }}</p>
    <p v-if="error" class="q-error" role="alert">{{ error }}</p>
    <button class="q-primary full" :disabled="busy || city.locating.value" @click="submit"><AppIcon :name="busy ? 'clock' : 'check'" :size="19"/>{{ busy ? '送出中…' : city.mode === 'demo' ? '確認示範回報' : '確認送出' }}</button>
  </AppSheet>
</template>
