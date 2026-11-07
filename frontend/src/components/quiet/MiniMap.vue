<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { isCoordinate } from '../../lib/sensoryDomain.js'
import { isNoisySymbolLayer, mapStyleUrl } from '../../lib/mapStyle.js'

// 回報用的小地圖：顯示目前位置，可用 +／− 按鈕、兩指或 Ctrl＋滾輪縮放（單指仍可捲動視窗）。
// 沿用 MapLibre + OpenFreeMap（低刺激模式改用灰階 Positron 並隱藏 POI），保留授權標示。
const props = defineProps({ location: { type: Object, default: null }, label: { type: String, default: '目前位置' } })
const container = ref(null), ready = ref(false), failed = ref(false)
let map, marker, disposed = false
const lowStimulus = () => document.body.classList.contains('q-low-stimulus')
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || lowStimulus()
const zoom = direction => map?.[direction > 0 ? 'zoomIn' : 'zoomOut']({ duration: reduced() ? 0 : 200 })

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
      container: container.value, style: mapStyleUrl(lowStimulus()),
      center: [props.location.lng, props.location.lat], zoom: 16, minZoom: 12, maxZoom: 19, attributionControl: false,
      // 單指拖曳交給視窗捲動；兩指或 Ctrl／⌘＋滾輪才操作地圖，避免卡住回報視窗。
      cooperativeGestures: true, dragRotate: false, pitchWithRotate: false,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': '按住 Ctrl 並滾動滑鼠滾輪來縮放地圖',
        'CooperativeGesturesHandler.MacHelpText': '按住 ⌘ 並滾動滑鼠滾輪來縮放地圖',
        'CooperativeGesturesHandler.MobileHelpText': '請用兩指移動或縮放地圖',
      },
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibre.AttributionControl({ compact: false }), 'bottom-right')
    const dot = document.createElement('div')
    dot.className = 'q-user-dot'
    dot.setAttribute('aria-hidden', 'true')
    marker = new maplibre.Marker({ element: dot }).setLngLat([props.location.lng, props.location.lat]).addTo(map)
    map.on('load', () => {
      if (disposed) return
      // 與探索頁地圖相同，標籤優先使用繁體中文名稱。
      for (const layer of map.getStyle().layers || []) {
        if (lowStimulus() && isNoisySymbolLayer(layer)) { map.setLayoutProperty(layer.id, 'visibility', 'none'); continue }
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
  <div class="mini-map" role="region" :aria-label="`${label}的地圖位置，可縮放`">
    <div ref="container" class="mini-map-canvas"></div>
    <div v-if="ready" class="mini-map-tools">
      <button type="button" class="q-icon-button" aria-label="放大地圖" @click="zoom(1)"><AppIcon name="plus" :size="19"/></button>
      <button type="button" class="q-icon-button" aria-label="縮小地圖" @click="zoom(-1)"><span class="minus-icon" aria-hidden="true">−</span></button>
    </div>
    <p v-if="failed" class="mini-map-state">地圖暫時無法載入，仍會送出下方座標。</p>
    <p v-else-if="!ready" class="mini-map-state">正在載入地圖…</p>
  </div>
</template>

<style scoped>
.mini-map { position: relative; height: 200px; overflow: hidden; border: 1px solid #dce6ed; border-radius: 12px; background: #edf4f8; }
.mini-map-canvas { position: absolute; inset: 0; }
.mini-map-tools { position: absolute; z-index: 2; top: 8px; right: 8px; display: grid; gap: 6px; }
.mini-map-tools .q-icon-button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid #dce6ed; border-radius: 50%; background: #fff; color: #385c6e; box-shadow: 0 2px 6px #2447561a; }
.minus-icon { font-size: 22px; line-height: 1; }
.mini-map-state { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 12px; color: #607988; font-size: 13px; text-align: center; background: #f2f8fcf2; }
.mini-map :deep(.maplibregl-ctrl-attrib) { padding: 1px 5px; font-size: 11px; line-height: 1.4; background: #ffffffe6; }
.mini-map :deep(.maplibregl-ctrl-attrib a) { color: #4f6472; }
</style>
