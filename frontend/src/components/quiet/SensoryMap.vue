<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { isCoordinate } from '../../lib/sensoryDomain.js'
import { sensoryValues } from '../../lib/sensoryIndex.js'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
const props = defineProps({ places: { type: Array, default: () => [] }, cells: { type: Array, default: () => [] }, center: { type: Object, required: true }, layer: { type: String, default: 'noise' }, deviceLocated: Boolean, lowStimulus: Boolean })
const emit = defineEmits(['select', 'locate'])
const container = ref(null), ready = ref(false), error = ref('')
let map, maplibre, markers = [], centerMarker, observer, timer, disposed = false, generation = 0
const reduced = () => props.lowStimulus || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const layerLabels = { noise: '聲音', light: '光線', crowd: '人潮', odor: '氣味' }
function applyStimulus() {
  if (!ready.value || !map) return
  // 低刺激模式降低熱區飽和度與不透明度，但保留有觀測的圓點與文字圖例。
  map.setPaintProperty('sensory-heat', 'heatmap-opacity', props.lowStimulus ? .22 : .43)
  map.setPaintProperty('sensory-observed', 'circle-opacity', props.lowStimulus ? .5 : .65)
}
function clearMarkers() { markers.forEach(marker => marker.remove()); markers = [] }
function sync() {
  if (!ready.value || !map) return
  const now = Date.now()
  // 與清單共用有效觀測規則：過期、不足、未知或版本不符的格網不繪製。
  const features = props.cells.filter(cell => isCoordinate(cell?.location))
    .map(cell => ({ cell, value: sensoryValues(cell, now)[props.layer] }))
    .filter(({ value }) => value !== null)
    .map(({ cell, value }) => ({ type: 'Feature', properties: { intensity: value / 100 }, geometry: { type: 'Point', coordinates: [cell.location.lng, cell.location.lat] } }))
  map.getSource('sensory')?.setData({ type: 'FeatureCollection', features })
  clearMarkers()
  props.places.filter(place => isCoordinate(place.location)).forEach(place => {
    const button = document.createElement('button')
    button.type = 'button'; button.className = `q-map-pin ${place.indoor ? 'indoor' : ''}`
    button.setAttribute('aria-label', `查看${place.name}`)
    // 文字來自 API，使用 textContent，禁止插入 HTML。
    button.textContent = place.indoor ? '▤' : '♧'
    button.addEventListener('click', () => emit('select', place.id))
    markers.push(new maplibre.Marker({ element: button, anchor: 'bottom' }).setLngLat([place.location.lng, place.location.lat]).addTo(map))
  })
  centerMarker?.remove()
  const dot = document.createElement('div'); dot.className = props.deviceLocated ? 'q-user-dot' : 'q-area-dot'
  dot.setAttribute('aria-label', props.deviceLocated ? '目前位置' : '手動區域中心')
  centerMarker = new maplibre.Marker({ element: dot }).setLngLat([props.center.lng, props.center.lat]).addTo(map)
}
async function initialize() {
  const current = ++generation
  ready.value = false; error.value = ''; clearTimeout(timer); observer?.disconnect(); clearMarkers(); centerMarker?.remove(); map?.remove(); map = null
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
      map.addLayer({ id: 'sensory-heat', type: 'heatmap', source: 'sensory', paint: {
        'heatmap-weight': 1, 'heatmap-intensity': .8, 'heatmap-radius': 78, 'heatmap-opacity': .43,
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', .15, '#73c5a6', .4, '#c5dea1', .6, '#f4df9b', .85, '#edb18e', 1, '#d47e78'],
      } })
      // 刺激強度由資料值影響熱圖權重，不將樣本密度誤稱音量。
      map.setPaintProperty('sensory-heat', 'heatmap-weight', ['get', 'intensity'])
      map.addLayer({ id: 'sensory-observed', type: 'circle', source: 'sensory', paint: {
        'circle-radius': 7, 'circle-opacity': .65, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
        'circle-color': ['interpolate', ['linear'], ['get', 'intensity'], 0, '#70b393', .5, '#d8c47e', 1, '#cf887b'],
      } })
      ready.value = true; applyStimulus(); sync()
    })
    map.on('error', () => { if (!ready.value) error.value = '底圖資源暫時無法取得，仍可使用下方場所清單。' })
    observer = new ResizeObserver(() => map?.resize()); observer.observe(container.value)
  } catch { error.value = '此裝置無法啟用地圖，請使用下方場所清單。' }
}
watch(() => [props.places, props.cells, props.layer, props.deviceLocated], sync, { deep: true })
watch(() => props.lowStimulus, applyStimulus)
watch(() => props.center, center => {
  if (map && isCoordinate(center)) map.flyTo({ center: [center.lng, center.lat], duration: reduced() ? 0 : 700 })
  sync()
}, { deep: true })
onMounted(initialize)
onUnmounted(() => { disposed = true; generation++; clearTimeout(timer); observer?.disconnect(); clearMarkers(); centerMarker?.remove(); map?.remove() })
</script>
<template>
  <div class="sensory-map-wrap">
    <div ref="container" class="sensory-map" role="region" aria-label="城市感官互動地圖，可拖曳縮放"></div>
    <div v-if="!ready || error" class="q-map-state" role="status"><AppIcon :name="error ? 'map' : 'layers'" :size="28"/><strong>{{ error || '正在展開城市地圖…' }}</strong><button v-if="error" class="q-secondary" @click="initialize">重新載入地圖</button></div>
    <div v-if="ready && !error" class="map-legend"><strong>{{ layerLabels[layer] }}刺激示意</strong><div></div><span>較低 <span>較高</span></span><small>圓點代表有觀測的格網<br>回報加權熱區，非實測等值線</small></div>
    <div class="map-tools"><button class="q-icon-button" aria-label="使用目前位置並移至地圖中心" @click="$emit('locate')"><AppIcon name="locate" :size="21"/></button><button class="q-icon-button" aria-label="放大地圖" @click="map?.zoomIn({ duration: reduced() ? 0 : 200 })"><AppIcon name="plus" :size="21"/></button><button class="q-icon-button" aria-label="縮小地圖" @click="map?.zoomOut({ duration: reduced() ? 0 : 200 })"><span class="minus-icon">−</span></button></div>
  </div>
</template>

<style scoped>
/* MapLibre 的 CSS 會在探索頁延遲載入；此規則不可被其 position: relative 覆蓋。
   容器本身也需有尺寸，不能只依賴外層的高度或內部絕對定位的 canvas。 */
.sensory-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
