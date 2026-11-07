<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { cellSquare, distanceMeters, isCoordinate, stimulusLevel } from '../../lib/sensoryDomain.js'
import { sensoryValues } from '../../lib/sensoryIndex.js'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
const props = defineProps({ places: { type: Array, default: () => [] }, cells: { type: Array, default: () => [] }, center: { type: Object, required: true }, layer: { type: String, default: 'noise' }, deviceLocated: Boolean, lowStimulus: Boolean, layerVisible: { type: Boolean, default: true }, mock: Boolean })
const emit = defineEmits(['select', 'locate', 'viewchange'])
const container = ref(null), ready = ref(false), error = ref(''), shownCells = ref(0)
// 每個格網畫成 200m 方塊，顏色只看該格自己的分數（三段），不像熱圖會因點的疏密疊加而失真。
const LEVELS = [
  { id: 'low', label: '低', range: '0–33', fill: '#4fae84', line: '#2f8a62' },
  { id: 'mid', label: '中等', range: '34–66', fill: '#e3c158', line: '#b8962c' },
  { id: 'high', label: '偏高', range: '67–100', fill: '#da735f', line: '#b4513e' },
]
const byLevel = key => ['match', ['get', 'level'], ...LEVELS.flatMap(level => [level.id, level[key]]), '#9aa5ab']
const CELL_LAYERS = ['sensory-cells', 'sensory-cells-outline']
let map, maplibre, markers = [], centerMarker, observer, timer, moveTimer, disposed = false, generation = 0
const reduced = () => props.lowStimulus || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const layerLabels = { noise: '聲音', light: '光線', crowd: '人潮', odor: '氣味' }
// 低刺激模式只影響介面，不改變地圖內容；lowStimulus 僅用來取消地圖移動動畫（同系統減少動態）。
function applyVisibility() {
  if (!ready.value || !map) return
  const visibility = props.layerVisible ? 'visible' : 'none'
  for (const id of CELL_LAYERS) map.setLayoutProperty(id, 'visibility', visibility)
}
// 場所標記：水滴形圖釘（依類型配色＋白底小圖示）與下方小字名稱。
// 圖示是固定的 SVG 字串，不含 API 資料；名稱來自 API，一律用 textContent。
const PIN_KINDS = {
  park: { color: '#3c8a4a', icon: '<path d="M20 3C10 2 3 6 4 13s14 11 16-10Z"/><path d="M3 22 16 9"/>' },
  library: { color: '#7b5ea7', icon: '<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4Z"/><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6Z"/>' },
  hall: { color: '#0391A7', icon: '<path d="M3 11 12 4l9 7v9H3Z"/><path d="M10 20v-5h4v5"/>' },
}
const PIN_HEIGHT = 36
function pinElement(place) {
  const kind = PIN_KINDS[place.artwork] || PIN_KINDS.hall
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'q-map-pin'
  button.setAttribute('aria-label', `查看${place.name}`)
  const icon = document.createElement('span')
  icon.className = 'q-map-pin-icon'
  icon.setAttribute('aria-hidden', 'true')
  icon.innerHTML = `<svg width="28" height="${PIN_HEIGHT}" viewBox="0 0 28 36"><path d="M14 35s11-11.6 11-20.5A11 11 0 0 0 3 14.5C3 23.4 14 35 14 35Z" fill="${kind.color}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14.5" r="7.5" fill="#fff"/><g transform="translate(8.5 9) scale(.46)" fill="none" stroke="${kind.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${kind.icon}</g></svg>`
  const label = document.createElement('span')
  label.className = 'q-map-pin-label'
  label.setAttribute('aria-hidden', 'true')
  label.textContent = place.name
  button.append(icon, label)
  button.addEventListener('click', () => emit('select', place.id))
  return button
}
// 縮小到街廓以外時隱藏名稱，避免標籤互相重疊。
function updateLabelVisibility() { container.value?.classList.toggle('q-pin-labels-hidden', (map?.getZoom() ?? 15) < 14) }
function clearMarkers() { markers.forEach(marker => marker.remove()); markers = [] }
function sync() {
  if (!ready.value || !map) return
  const now = Date.now()
  // 與清單共用有效觀測規則：過期、不足、未知或版本不符的格網不繪製。
  const features = props.cells.filter(cell => isCoordinate(cell?.location))
    .map(cell => ({ cell, value: sensoryValues(cell, now)[props.layer] }))
    .filter(({ value }) => value !== null)
    .map(({ cell, value }) => ({ cell, level: stimulusLevel(value), coordinates: cellSquare(cell.location) }))
    .filter(({ level, coordinates }) => level && coordinates)
    .map(({ cell, level, coordinates }) => ({ type: 'Feature', properties: { id: String(cell.id ?? ''), level }, geometry: { type: 'Polygon', coordinates } }))
  map.getSource('sensory')?.setData({ type: 'FeatureCollection', features })
  shownCells.value = features.length
  clearMarkers()
  props.places.filter(place => isCoordinate(place.location)).forEach(place => {
    // 元素頂端為圖釘頂端，往上位移圖釘高度，讓尖端對準座標、名稱在下方。
    markers.push(new maplibre.Marker({ element: pinElement(place), anchor: 'top', offset: [0, -PIN_HEIGHT] }).setLngLat([place.location.lng, place.location.lat]).addTo(map))
  })
  centerMarker?.remove()
  const dot = document.createElement('div'); dot.className = props.deviceLocated ? 'q-user-dot' : 'q-area-dot'
  dot.setAttribute('aria-label', props.deviceLocated ? '目前位置' : '手動區域中心')
  centerMarker = new maplibre.Marker({ element: dot }).setLngLat([props.center.lng, props.center.lat]).addTo(map)
}
async function initialize() {
  const current = ++generation
  ready.value = false; error.value = ''; clearTimeout(timer); clearTimeout(moveTimer); observer?.disconnect(); clearMarkers(); centerMarker?.remove(); map?.remove(); map = null
  try {
    const module = await import('maplibre-gl')
    if (disposed || current !== generation) return
    maplibre = module.default || module
    maplibre.setWorkerUrl(workerUrl)
    maplibre.setWorkerCount(1)
    map = new maplibre.Map({ container: container.value, style: 'https://tiles.openfreemap.org/styles/liberty', center: [props.center.lng, props.center.lat], zoom: 15, attributionControl: false, pitchWithRotate: false, dragRotate: false })
    map.addControl(new maplibre.AttributionControl({ compact: false }), 'bottom-left')
    timer = setTimeout(() => { if (!ready.value) error.value = '底圖載入逾時，請確認網路連線。' }, 20_000)
    map.on('load', () => {
      if (disposed || current !== generation) return
      clearTimeout(timer); error.value = ''
      for (const layer of map.getStyle().layers || []) {
        if (layer.type === 'symbol' && layer.layout?.['text-field']) {
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']])
        }
      }
      map.addSource('sensory', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      // 方塊畫在底圖文字之下，街名與地標仍清楚可讀；無觀測處沒有方塊，不代表安靜。
      const beforeId = map.getStyle().layers?.find(layer => layer.type === 'symbol')?.id
      map.addLayer({ id: 'sensory-cells', type: 'fill', source: 'sensory', paint: { 'fill-color': byLevel('fill'), 'fill-opacity': .42 } }, beforeId)
      map.addLayer({ id: 'sensory-cells-outline', type: 'line', source: 'sensory', paint: { 'line-color': byLevel('line'), 'line-width': 1, 'line-opacity': .7 } }, beforeId)
      ready.value = true; applyVisibility(); sync()
    })
    // 停止拖曳／縮放 0.5 秒後回報地圖中心，讓上層抓取該處附近的地點與熱區。
    map.on('zoom', updateLabelVisibility)
    // 停止移動 0.5 秒後回報地圖中心與可視半徑（中心到上緣、右緣中點的較大距離）。
    const emitView = () => {
      if (disposed || current !== generation || !map) return
      const { lat, lng } = map.getCenter()
      const bounds = map.getBounds()
      const radius = Math.max(distanceMeters({ lat, lng }, { lat: bounds.getNorth(), lng }), distanceMeters({ lat, lng }, { lat, lng: bounds.getEast() }))
      emit('viewchange', { lat, lng, radius })
    }
    map.on('moveend', () => { clearTimeout(moveTimer); moveTimer = setTimeout(emitView, 500) })
    map.once('idle', emitView)
    map.on('error', () => { if (!ready.value) error.value = '底圖資源暫時無法取得，仍可使用下方場所清單。' })
    observer = new ResizeObserver(() => map?.resize()); observer.observe(container.value)
  } catch { error.value = '此裝置無法啟用地圖，請使用下方場所清單。' }
}
watch(() => [props.places, props.cells, props.layer, props.deviceLocated], sync, { deep: true })
watch(() => props.layerVisible, applyVisibility)
watch(() => props.center, center => {
  if (map && isCoordinate(center)) map.flyTo({ center: [center.lng, center.lat], duration: reduced() ? 0 : 700 })
  sync()
}, { deep: true })
onMounted(initialize)
onUnmounted(() => { disposed = true; generation++; clearTimeout(timer); clearTimeout(moveTimer); observer?.disconnect(); clearMarkers(); centerMarker?.remove(); map?.remove() })
</script>
<template>
  <div class="sensory-map-wrap">
    <div ref="container" class="sensory-map" role="region" aria-label="城市感官互動地圖，可拖曳縮放"></div>
    <div v-if="!ready || error" class="q-map-state" role="status"><AppIcon :name="error ? 'map' : 'layers'" :size="28"/><strong>{{ error || '正在展開城市地圖…' }}</strong><button v-if="error" class="q-secondary" @click="initialize">重新載入地圖</button></div>
    <div v-if="ready && !error && layerVisible" class="map-legend"><strong>{{ layerLabels[layer] }}刺激示意</strong><em v-if="mock" class="map-legend-mock">模擬資料</em><ul class="map-legend-scale"><li v-for="level in LEVELS" :key="level.id"><i :style="{ background: level.fill, borderColor: level.line }"></i>{{ level.label }}<small>{{ level.range }}</small></li></ul><small class="map-legend-note">每格 200m，無色塊處為無資料</small><small v-if="!shownCells" class="map-legend-empty">附近 30 分鐘內回報尚未達公開門檻，暫無熱區</small></div>
    <div class="map-tools"><button class="q-icon-button" aria-label="使用目前位置並移至地圖中心" @click="$emit('locate')"><AppIcon name="locate" :size="21"/></button><button class="q-icon-button" aria-label="放大地圖" @click="map?.zoomIn({ duration: reduced() ? 0 : 200 })"><AppIcon name="plus" :size="21"/></button><button class="q-icon-button" aria-label="縮小地圖" @click="map?.zoomOut({ duration: reduced() ? 0 : 200 })"><span class="minus-icon">−</span></button></div>
  </div>
</template>

<style scoped>
/* MapLibre 的 CSS 會在探索頁延遲載入；此規則不可被其 position: relative 覆蓋。
   容器本身也需有尺寸，不能只依賴外層的高度或內部絕對定位的 canvas。 */
.map-legend-mock { display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 4px; background: #fff1e3; color: #8a4f1d; font-size: 11px; font-style: normal; vertical-align: 1px; }
.map-legend-empty { display: block; margin-top: 6px; color: var(--q-muted); font-size: 12px; line-height: 1.5; }
.sensory-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
