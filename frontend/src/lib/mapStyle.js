// 探索地圖底圖：皆為 OpenFreeMap（OpenMapTiles 資料、開源樣式），不新增服務或依賴。
// 一般模式用彩色的 liberty；低刺激模式改用灰階、無 POI 的 positron，讓敏感圖層成為畫面上主要的顏色。
export const MAP_STYLES = Object.freeze({
  default: 'https://tiles.openfreemap.org/styles/liberty',
  lowStimulus: 'https://tiles.openfreemap.org/styles/positron',
})
export const mapStyleUrl = lowStimulus => lowStimulus ? MAP_STYLES.lowStimulus : MAP_STYLES.default

// 低刺激模式隱藏的底圖符號：商家／設施圖示、機場、道路編號盾牌。街名、地名與水系名稱保留，避免失去方位。
const NOISY_SOURCE_LAYERS = new Set(['poi', 'aerodrome_label'])
export function isNoisySymbolLayer(layer) {
  if (layer?.type !== 'symbol') return false
  return NOISY_SOURCE_LAYERS.has(layer['source-layer']) || /shield/.test(layer.id || '')
}

// 低刺激模式下地圖疊加物的色彩：場所圖釘統一單色（類型仍以圖示區分），臺北市界改用低飽和灰藍。
export const LOW_STIMULUS_PIN_COLOR = '#55707a'
export const boundaryColor = lowStimulus => lowStimulus ? '#7b9097' : '#0391A7'
