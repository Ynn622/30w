<script setup>
import { computed } from 'vue'
import AppIcon from '../AppIcon.vue'

// 服務只依目前定位提供：尚未定位、定位失敗或不在臺北市時顯示此狀態，取代頁面內容。
const props = defineProps({ city: { type: Object, required: true } })
const view = computed(() => ({
  locating: { icon: 'locate', title: '正在取得目前位置…', text: '聆靜依你的目前位置提供附近的感官資訊。' },
  outside: { icon: 'pin', title: '此區域非台北市內，無法提供服務', text: '目前僅提供臺北市範圍的感官資訊。移動到臺北市後，請重新定位。' },
  error: { icon: 'locate', title: '無法取得目前位置', text: props.city.locationError.value || '請允許定位權限後重試。' },
  idle: { icon: 'locate', title: '需要使用目前位置', text: '聆靜依你的目前位置提供附近的感官資訊，請允許定位。' },
}[props.city.locationStatus.value] || null))
</script>

<template>
  <section v-if="view" class="location-gate" role="status" aria-live="polite">
    <span class="location-gate-icon"><AppIcon :name="view.icon" :size="30" /></span>
    <h2>{{ view.title }}</h2>
    <p>{{ view.text }}</p>
    <button v-if="city.locationStatus.value !== 'locating'" type="button" class="q-primary" :disabled="city.locating.value" @click="city.locate">
      <AppIcon name="locate" :size="19" />{{ city.locating.value ? '定位中…' : city.locationStatus.value === 'outside' ? '重新定位' : '使用目前位置' }}
    </button>
  </section>
</template>

<style scoped>
.location-gate { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 18px 0; padding: 28px 18px; border: 1px solid #dce8ed; border-radius: 15px; background: #f6fbfd; text-align: center; }
.location-gate-icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; color: var(--q-brand, #0391a7); background: #e3f4f8; }
.location-gate h2 { margin: 4px 0 0; color: var(--q-ink, #222c33); font-size: 19px; line-height: 1.45; }
.location-gate p { margin: 0; color: #56656e; font-size: 14px; line-height: 1.7; }
.location-gate .q-primary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 48px; margin-top: 6px; padding: 10px 22px; border-radius: 26px; font-size: 16px; }
</style>
