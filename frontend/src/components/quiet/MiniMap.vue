<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { isCoordinate } from '../../lib/sensoryDomain.js'

// 回報用的小地圖：只顯示目前位置，不可拖曳縮放。沿用 MapLibre + OpenFreeMap Liberty，保留授權標示。
const props = defineProps({ location: { type: Object, default: null }, label: { type: String, default: '目前位置' } })
const container = ref(null), ready = ref(false), failed = ref(false)
let map, marker, disposed = false

async function initialize() {
  if (!isCoordinate(props.location) || !container.value) return
  try {
    // 地圖引擎與 worker 延遲載入，只有打開回報視窗時才下載。
    const [module, worker] = await Promise.all([
      import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'), import('maplibre-gl/dist/maplibre-gl.css'),
    ])
    if (disposed) return
    const maplibre = module.default || module
    maplibre.setWorkerUrl(worker.default)
    maplibre.setWorkerCount(1)
    map = new maplibre.Map({
      container: container.value, style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [props.location.lng, props.location.lat], zoom: 16, interactive: false, attributionControl: false,
    })
    map.addControl(new maplibre.AttributionControl({ compact: false }), 'bottom-right')
    const dot = document.createElement('div')
    dot.className = 'q-user-dot'
    dot.setAttribute('aria-hidden', 'true')
    marker = new maplibre.Marker({ element: dot }).setLngLat([props.location.lng, props.location.lat]).addTo(map)
    map.on('load', () => {
      if (disposed) return
      // 與探索頁地圖相同，標籤優先使用繁體中文名稱。
      for (const layer of map.getStyle().layers || []) {
        if (layer.type === 'symbol' && layer.layout?.['text-field']) {
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']])
        }
      }
      ready.value = true
    })
    map.on('error', () => { if (!ready.value) failed.value = true })
  } catch { failed.value = true }
}
watch(() => props.location, location => {
  if (!map || !isCoordinate(location)) return
  map.jumpTo({ center: [location.lng, location.lat] })
  marker?.setLngLat([location.lng, location.lat])
}, { deep: true })
onMounted(initialize)
onUnmounted(() => { disposed = true; marker?.remove(); map?.remove() })
</script>

<template>
  <div class="mini-map" role="img" :aria-label="`${label}的地圖位置`">
    <div ref="container" class="mini-map-canvas"></div>
    <p v-if="failed" class="mini-map-state">地圖暫時無法載入，仍會送出下方座標。</p>
    <p v-else-if="!ready" class="mini-map-state">正在載入地圖…</p>
  </div>
</template>

<style scoped>
.mini-map { position: relative; height: 150px; overflow: hidden; border: 1px solid #dce6ed; border-radius: 12px; background: #edf4f8; }
.mini-map-canvas { position: absolute; inset: 0; }
.mini-map-state { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 12px; color: #607988; font-size: 13px; text-align: center; background: #f2f8fcf2; }
.mini-map :deep(.maplibregl-ctrl-attrib) { padding: 1px 5px; font-size: 11px; line-height: 1.4; background: #ffffffe6; }
.mini-map :deep(.maplibregl-ctrl-attrib a) { color: #4f6472; }
</style>
