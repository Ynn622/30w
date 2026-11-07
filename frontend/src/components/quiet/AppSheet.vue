<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
// dialog：置中小視窗；預設為底部 sheet。
defineProps({ title: { type: String, required: true }, busy: Boolean, dialog: Boolean })
const emit = defineEmits(['close'])
const panel = ref(null)
let previousFocus, previousOverflow
function trap(event) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab') return
  const elements = [...panel.value.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length)
  const first = elements[0], last = elements.at(-1)
  if (!first) { event.preventDefault(); return }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(() => {
  previousFocus = document.activeElement; previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  panel.value.focus()
})
onUnmounted(() => { document.body.style.overflow = previousOverflow; previousFocus?.focus?.() })
</script>
<template>
  <Teleport to="body">
    <div class="quiet-overlay" :class="{ dialog }" @click.self="!busy && emit('close')">
      <section ref="panel" class="quiet-sheet" :class="{ dialog }" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" @keydown="trap">
        <div v-if="!dialog" class="sheet-handle" aria-hidden="true"></div>
        <header class="sheet-header"><h2>{{ title }}</h2><button type="button" class="q-icon-button" :disabled="busy" aria-label="關閉" @click="emit('close')"><AppIcon name="close" :size="20" /></button></header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
