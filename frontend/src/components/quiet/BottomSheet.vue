<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

// 地圖上的底部抽屜：peek（只露標題）、half、full 三段停靠；可拖曳把手或標題列，
// 也可點擊／方向鍵切換。高度以父層（地圖區）為上限。
const props = defineProps({
  snap: { type: String, default: 'peek' },
  peek: { type: Number, default: 116 },
  label: { type: String, default: '底部面板' },
})
const emit = defineEmits(['update:snap'])
const SNAPS = ['peek', 'half', 'full']
const root = ref(null), header = ref(null), bounds = ref(0), headerHeight = ref(0), dragHeight = ref(null)
let observer, drag = null, suppressClick = false

// 收合高度至少要容納整個標題列（低刺激模式按鈕較大時會自動加高）。
const peekHeight = computed(() => Math.max(props.peek, Math.ceil(headerHeight.value)))
const heights = computed(() => {
  const peek = peekHeight.value
  const full = Math.max(peek, bounds.value)
  return { peek, half: Math.min(full, Math.max(peek + 80, Math.round(bounds.value * 0.55))), full }
})
const height = computed(() => dragHeight.value ?? heights.value[props.snap] ?? peekHeight.value)
const expanded = computed(() => props.snap !== 'peek')

function setSnap(value) { if (value !== props.snap) emit('update:snap', value) }
function step(direction) {
  const index = Math.max(0, SNAPS.indexOf(props.snap))
  setSnap(SNAPS[Math.min(SNAPS.length - 1, Math.max(0, index + direction))])
}
// 點標題列任一處（含把手、Enter／空白鍵）都會切換段落，觸控區不只把手本身；標題列內的其他按鈕不受影響。
function onHeaderClick(event) {
  if (suppressClick) { suppressClick = false; return }
  const interactive = event.target.closest?.('button, a, input, select, textarea')
  if (interactive && !interactive.classList.contains('bottom-sheet-grip')) return
  setSnap(props.snap === 'peek' ? 'half' : props.snap === 'half' ? 'full' : 'peek')
}
function onKey(event) {
  if (event.key === 'ArrowUp') { event.preventDefault(); step(1) }
  else if (event.key === 'ArrowDown') { event.preventDefault(); step(-1) }
}
function onPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return
  drag = { y: event.clientY, start: height.value, moved: false, id: event.pointerId }
  // 指標快速移出標題列時仍要追蹤，因此拖曳期間在 window 監聽。
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}
function stopListening() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}
function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.id) return
  const delta = drag.y - event.clientY
  if (!drag.moved && Math.abs(delta) < 6) return
  drag.moved = true
  dragHeight.value = Math.min(heights.value.full, Math.max(peekHeight.value, drag.start + delta))
}
function onPointerUp(event) {
  if (!drag || event.pointerId !== drag.id) return
  if (drag.moved) {
    // 放開後停靠到最近的段落；拖曳後不要再觸發把手的點擊切換。
    const current = dragHeight.value
    const nearest = SNAPS.reduce((best, key) => Math.abs(heights.value[key] - current) < Math.abs(heights.value[best] - current) ? key : best, 'peek')
    suppressClick = true
    setTimeout(() => { suppressClick = false }, 0)
    setSnap(nearest)
  }
  dragHeight.value = null; drag = null
  stopListening()
}
onMounted(() => {
  const parent = root.value?.parentElement
  if (!parent) return
  const measure = () => {
    bounds.value = Math.max(0, parent.clientHeight - 8)
    headerHeight.value = header.value?.offsetHeight || 0
    // 讓地圖區知道收合高度，地圖底緣與授權標示留在抽屜上方。
    parent.style.setProperty('--sheet-peek', `${peekHeight.value}px`)
  }
  measure()
  observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
  observer?.observe(parent)
  if (header.value) observer?.observe(header.value)
})
onUnmounted(() => { observer?.disconnect(); stopListening() })
</script>

<template>
  <section ref="root" class="bottom-sheet" :class="{ dragging: dragHeight !== null, expanded }" :style="{ height: `${height}px` }" :aria-label="label">
    <header ref="header" class="bottom-sheet-header" @pointerdown="onPointerDown" @click="onHeaderClick">
      <button type="button" class="bottom-sheet-grip" :aria-expanded="expanded" :aria-label="`${label}：${expanded ? '點擊繼續展開或收合' : '點擊展開'}，可用上下方向鍵調整`" @keydown="onKey"><span aria-hidden="true"></span></button>
      <slot name="header" />
    </header>
    <div class="bottom-sheet-body" :inert="!expanded || undefined">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.bottom-sheet { position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; max-height: 100%; background: #fff; border-radius: 18px 18px 0 0; box-shadow: 0 -6px 24px #1d3c4a24; transition: height .26s cubic-bezier(.2, .8, .2, 1); overflow: hidden; }
.bottom-sheet.dragging { transition: none; }
.bottom-sheet-header { flex: none; padding: 0 14px 6px; touch-action: none; cursor: grab; user-select: none; }
.bottom-sheet.dragging .bottom-sheet-header { cursor: grabbing; }
.bottom-sheet-grip { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 26px; margin: 0; padding: 0; border: 0; background: transparent; cursor: inherit; }
.bottom-sheet-grip span { display: block; width: 40px; height: 5px; border-radius: 5px; background: #bcc7cd; }
.bottom-sheet-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 14px 14px; }
</style>
