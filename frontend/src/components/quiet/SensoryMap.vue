<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { TAIPEI_MAX_BOUNDS, distanceMeters, isCoordinate } from '../../lib/sensoryDomain.js'
import { CONTOUR_LEVELS, FIELD_GRADIENT_CSS, NO_DATA_AS_GREEN, contourSegments, fieldColor } from '../../lib/sensoryField.js'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
// field 由探索頁以 buildSensoryField 建立（地圖與清單共用），這裡只負責畫。
const props = defineProps({ places: { type: Array, default: () => [] }, field: { type: Object, default: null }, center: { type: Object, required: true }, deviceLocated: Boolean, lowStimulus: Boolean, layerVisible: { type: Boolean, default: true }, mock: Boolean })
const emit = defineEmits(['select', 'locate', 'viewchange'])
const container = ref(null), ready = ref(false), error = ref(''), hasField = ref(false)
// 敏感圖層：每個點依使用者敏感度算出個人刺激值，再內插成像氣壓圖的平滑色帶（raster）與 33／66 等值線（line）。
const FIELD_LAYERS = ['sensory-field', 'sensory-contours']
const FIELD_MAX_OPACITY = 0.6
let map, maplibre, markers = [], centerMarker, observer, timer, moveTimer, disposed = false, generation = 0
const reduced = () => props.lowStimulus || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// 低刺激模式只影響介面，不改變地圖內容；lowStimulus 僅用來取消地圖移動動畫（同系統減少動態）。
function applyVisibility() {
  if (!ready.value || !map) return
  const visibility = props.layerVisible ? 'visible' : 'none'
  for (const id of FIELD_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility)
}
// 把內插平面畫成圖片：每個網格點一個像素，MapLibre 以線性取樣放大，呈現平滑漸層。
function fieldImage(field) {
  const canvas = document.createElement('canvas')
  canvas.width = field.width; canvas.height = field.height
  const context = canvas.getContext('2d')
  const image = context.createImageData(field.width, field.height)
  for (let i = 0; i < field.values.length; i++) {
    const color = fieldColor(field.values[i])
    if (!color) continue
    image.data.set([...color, Math.round(255 * FIELD_MAX_OPACITY * field.alpha[i])], i * 4)
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
function syncField() {
  if (!ready.value || !map) return
  drawField(props.field)
  hasField.value = Boolean(props.field)
  applyVisibility()
}
function beforeLabels() { return map.getStyle().layers?.find(layer => layer.type === 'symbol')?.id }
function drawField(field) {
  map.getSource('sensory-contours')?.setData({ type: 'FeatureCollection', features: field ? CONTOUR_LEVELS.map(level => ({
    type: 'Feature', properties: { level }, geometry: { type: 'MultiLineString', coordinates: contourSegments(field, level) },
  })) : [] })
  if (!field) {
    if (map.getLayer('sensory-field')) map.removeLayer('sensory-field')
    if (map.getSource('sensory-field')) map.removeSource('sensory-field')
    return
  }
  // 影像四角以像素邊緣為準（網格點在像素中心），各往外半格。
  const halfLng = field.dLng / 2, halfLat = field.dLat / 2
  const coordinates = [[field.west - halfLng, field.north + halfLat], [field.east + halfLng, field.north + halfLat], [field.east + halfLng, field.south - halfLat], [field.west - halfLng, field.south - halfLat]]
  const url = fieldImage(field)
  const source = map.getSource('sensory-field')
  if (source) { source.updateImage({ url, coordinates }); return }
  map.addSource('sensory-field', { type: 'image', url, coordinates })
  map.addLayer({ id: 'sensory-field', type: 'raster', source: 'sensory-field', paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': 0 }, layout: { visibility: props.layerVisible ? 'visible' : 'none' } }, 'sensory-contours')
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
  syncField()
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
    map = new maplibre.Map({ container: container.value, style: 'https://tiles.openfreemap.org/styles/liberty', center: [props.center.lng, props.center.lat], zoom: 15, attributionControl: false, pitchWithRotate: false, dragRotate: false, maxBounds: TAIPEI_MAX_BOUNDS })
    map.addControl(new maplibre.AttributionControl({ compact: false }), 'bottom-left')
    // 公制比例尺，讓使用者判斷直線距離。
    map.addControl(new maplibre.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-right')
    timer = setTimeout(() => { if (!ready.value) error.value = '底圖載入逾時，請確認網路連線。' }, 20_000)
    map.on('load', () => {
      if (disposed || current !== generation) return
      clearTimeout(timer); error.value = ''
      for (const layer of map.getStyle().layers || []) {
        if (layer.type === 'symbol' && layer.layout?.['text-field']) {
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']])
        }
      }
      // 臺北市界：使用底圖 OpenMapTiles 既有的 OpenStreetMap 行政界線（admin_level 4 為直轄市），不新增資料來源。
      map.addLayer({ id: 'taipei-boundary', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0391A7', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 4], 'line-opacity': .8 } }, beforeLabels())
      // 色帶與等值線畫在底圖文字之下，街名與地標仍清楚可讀；遠離資料處透明，不代表安靜。
      map.addSource('sensory-contours', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'sensory-contours', type: 'line', source: 'sensory-contours', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: {
        'line-color': ['match', ['get', 'level'], 33, '#2b7d57', '#b3533f'], 'line-width': 1.6, 'line-opacity': .85,
      } }, beforeLabels())
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
watch(() => [props.places, props.deviceLocated], sync, { deep: true })
// 平面含大型陣列，只比對參考（探索頁每次重算都產生新物件），不做深度比對。
watch(() => props.field, syncField)
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
    <div v-if="ready && !error && layerVisible" class="map-legend"><strong>敏感圖層</strong><em v-if="mock" class="map-legend-mock">模擬資料</em><div class="map-legend-bar" :style="{ background: FIELD_GRADIENT_CSS }"></div><span class="map-legend-ticks"><span>安靜</span><span>33</span><span>66</span><span>刺激</span></span><small class="map-legend-note">依你的感官敏感度加權；綠線內為 33 以下的綠區，紅線內為 66 以上。遠離回報處淡出，無色處為無資料{{ NO_DATA_AS_GREEN ? '（暫視為綠區）' : '' }}。</small><small v-if="!hasField" class="map-legend-empty">附近 30 分鐘內回報尚未達公開門檻，暫無資料</small></div>
    <div class="map-tools"><button class="q-icon-button" aria-label="使用目前位置並移至地圖中心" @click="$emit('locate')"><AppIcon name="locate" :size="21"/></button><button class="q-icon-button" aria-label="放大地圖" @click="map?.zoomIn({ duration: reduced() ? 0 : 200 })"><AppIcon name="plus" :size="21"/></button><button class="q-icon-button" aria-label="縮小地圖" @click="map?.zoomOut({ duration: reduced() ? 0 : 200 })"><span class="minus-icon">−</span></button></div>
  </div>
</template>

<style scoped>
/* MapLibre 的 CSS 會在探索頁延遲載入；此規則不可被其 position: relative 覆蓋。
   容器本身也需有尺寸，不能只依賴外層的高度或內部絕對定位的 canvas。 */
.map-legend-mock { display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 4px; background: #fff1e3; color: #8a4f1d; font-size: 11px; font-style: normal; vertical-align: 1px; }
.map-legend-empty { display: block; margin-top: 6px; color: var(--q-muted); font-size: 12px; line-height: 1.5; }
.map-legend-bar { height: 8px; margin: 7px 0 3px; border-radius: 8px; opacity: .85; }
/* 刻度對齊色帶：33、66 置於約三分之一、三分之二處。 */
.map-legend-ticks { position: relative; display: block; height: 16px; font-size: 11px; color: var(--q-muted); }
.map-legend-ticks span { position: absolute; top: 0; }
.map-legend-ticks span:nth-child(1) { left: 0; }
.map-legend-ticks span:nth-child(2) { left: 33%; transform: translateX(-50%); }
.map-legend-ticks span:nth-child(3) { left: 66%; transform: translateX(-50%); }
.map-legend-ticks span:nth-child(4) { right: 0; }
.sensory-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
