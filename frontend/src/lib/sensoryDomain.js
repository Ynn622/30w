import { DEFAULT_SENSITIVITIES, sensoryValues } from './sensoryIndex.js'
export { isFresh } from './sensoryIndex.js'
// 改用模擬資料時的畫面標示（競賽規則要求清楚標示模擬內容）。
export const MOCK_LABEL = '目前為模擬資料，非後端即時資料'
// 臺北市 12 個行政區；座標為區內代表點（約為區公所附近），用於依目前位置推估所在行政區及模擬資料。
export const AREAS = [
  { id: 'zhongzheng', name: '中正區', lat: 25.0386, lng: 121.5143 },
  { id: 'datong', name: '大同區', lat: 25.0633, lng: 121.5131 },
  { id: 'zhongshan', name: '中山區', lat: 25.0642, lng: 121.5332 },
  { id: 'songshan', name: '松山區', lat: 25.0497, lng: 121.5578 },
  { id: 'daan', name: '大安區', lat: 25.0267, lng: 121.5354 },
  { id: 'wanhua', name: '萬華區', lat: 25.0353, lng: 121.4998 },
  { id: 'xinyi', name: '信義區', lat: 25.033, lng: 121.5654 },
  { id: 'shilin', name: '士林區', lat: 25.0929, lng: 121.5246 },
  { id: 'beitou', name: '北投區', lat: 25.1321, lng: 121.4987 },
  { id: 'neihu', name: '內湖區', lat: 25.0691, lng: 121.5888 },
  { id: 'nangang', name: '南港區', lat: 25.0548, lng: 121.6068 },
  { id: 'wenshan', name: '文山區', lat: 24.9898, lng: 121.5701 },
]
// 臺北市概略外框（手繪簡化多邊形 [lng, lat]，沿淡水河／新店溪／景美溪與山區概略描點）。
// 僅用來排除明顯不在臺北市的位置，邊界附近仍可能誤判。
const TAIPEI_OUTLINE = [
  [121.560, 25.210], [121.600, 25.180], [121.630, 25.120], [121.620, 25.080], [121.665, 25.060],
  [121.640, 25.020], [121.620, 24.990], [121.600, 24.960], [121.570, 24.960], [121.540, 24.985],
  [121.535, 25.010], [121.510, 25.020], [121.495, 25.030], [121.490, 25.050], [121.505, 25.075],
  [121.505, 25.095], [121.470, 25.115], [121.455, 25.130], [121.470, 25.170], [121.520, 25.200],
]
function insideTaipei({ lat, lng }) {
  let inside = false
  for (let i = 0, j = TAIPEI_OUTLINE.length - 1; i < TAIPEI_OUTLINE.length; j = i++) {
    const [xi, yi] = TAIPEI_OUTLINE[i], [xj, yj] = TAIPEI_OUTLINE[j]
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export const SENSES = [
  { key: 'noise', label: '聲音', icon: 'sound', color: 'teal' },
  { key: 'light', label: '光線', icon: 'sun', color: 'amber' },
  { key: 'crowd', label: '人潮', icon: 'people', color: 'blue' },
  { key: 'odor', label: '氣味', icon: 'wind', color: 'green' },
]
// 快速回報 8 種類型（第一層）與快速標籤（第二層）。前四種直接對應 SSI 四維；
// 溫度、動線另外統計不納入 SSI；舒適空間收集正向訊號；其他感受需自行描述。
const tag = (id, label) => ({ id, label })
export const REPORT_KINDS = [
  { id: 'noisy', label: '聲音刺激', hint: '噪音、廣播、施工聲', icon: 'sound', color: 'teal', intensityLabel: '聲音刺激',
    tags: [tag('construction', '施工噪音'), tag('traffic', '交通噪音'), tag('announcement', '廣播音量大'), tag('voices', '人聲吵雜'), tag('sudden_loud', '突發巨響'), tag('low_frequency', '持續低頻聲')] },
  { id: 'bright', label: '光線刺激', hint: '刺眼、閃爍、光線不足', icon: 'sun', color: 'amber', intensityLabel: '光線刺激',
    tags: [tag('sun_glare', '陽光刺眼'), tag('too_bright', '燈光過亮'), tag('flicker', '燈光閃爍'), tag('too_dark', '光線不足')] },
  { id: 'crowded', label: '人潮擁擠', hint: '人多、排隊、空間壓迫', icon: 'people', color: 'blue', intensityLabel: '擁擠程度',
    tags: [tag('dense_crowd', '人潮密集'), tag('long_queue', '排隊過長'), tag('congested_path', '動線擁堵'), tag('cramped_space', '空間狹窄')] },
  { id: 'odor', label: '氣味刺激', hint: '油煙、香水、異味', icon: 'wind', color: 'purple', intensityLabel: '氣味刺激',
    tags: [tag('cooking_fumes', '油煙'), tag('fragrance', '香水或香氛'), tag('smoke', '菸味'), tag('garbage', '垃圾異味'), tag('other_irritant', '其他刺激性氣味')] },
  { id: 'thermal', label: '溫度不適', hint: '悶熱、寒冷、通風不良', icon: 'thermometer', color: 'coral', intensityLabel: '溫度不適',
    tags: [tag('too_hot', '過熱'), tag('too_cold', '過冷'), tag('stuffy', '悶熱不通風')] },
  { id: 'mobility', label: '動線不適', hint: '通道狹窄、難以通行', icon: 'route', color: 'slate', intensityLabel: '通行困難',
    tags: [tag('obstacle', '障礙物'), tag('narrow_path', '通道狹窄'), tag('hard_to_find_exit', '難以找到出口')] },
  { id: 'comfortable', label: '舒適空間', hint: '安靜、舒適、適合休息', icon: 'leaf', color: 'green',
    tags: [tag('quiet', '安靜'), tag('soft_light', '光線柔和'), tag('few_people', '人潮少'), tag('seating', '有座位'), tag('rest_friendly', '可短暫休息')] },
  { id: 'other', label: '其他感受', hint: '自行描述環境狀況', icon: 'plus', color: 'muted', tags: [], noteRequired: true },
]
export const reportKind = id => REPORT_KINDS.find(kind => kind.id === id) || null
// 回報種類對應的 SSI 維度；溫度、動線、舒適與其他不直接計入 SSI。
export const INTENSITY_DIMENSIONS = Object.freeze({ noisy: 'noise', bright: 'light', crowded: 'crowd', odor: 'odor' })
// 需要選擇感受程度的種類（含不計入 SSI 的溫度與動線）。
export const INTENSITY_KINDS = Object.freeze(REPORT_KINDS.filter(kind => kind.intensityLabel).map(kind => kind.id))
export const REPORT_INTENSITIES = [
  { id: 'mild', label: '輕微' },
  { id: 'noticeable', label: '中等' },
  { id: 'strong', label: '強烈' },
]
// 事件是否仍在持續：影響回報的有效時間（已結束的不應讓該處整天顯示高刺激）。
export const REPORT_PERSISTENCE = [
  { id: 'ongoing', label: '現在仍然如此' },
  { id: 'ended', label: '剛剛發生，現在已結束' },
  { id: 'recurring', label: '這個地方經常如此' },
]
// 同一 GPS 位置的室內外可能差異很大，分開統計。
export const REPORT_SETTINGS = [
  { id: 'indoor', label: '室內' },
  { id: 'outdoor', label: '室外' },
]
export function isCoordinate(value) {
  return Number.isFinite(value?.lat) && Number.isFinite(value?.lng)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180
}
export function distanceMeters(a, b) {
  if (!isCoordinate(a) || !isCoordinate(b)) return null
  const rad = Math.PI / 180
  const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x))))
}
export function levelText(value, air = false) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return '未知'
  return air ? (value <= 33 ? '良好' : value <= 66 ? '普通' : '不佳')
    : value <= 33 ? '低' : value <= 66 ? '中等' : '偏高'
}
export function formatTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '時間未知'
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
// 依最近的行政區代表點推估所在區域。這是近似值：行政區邊界不規則，靠近區界時可能判斷到鄰區；
// 地圖套件 MapLibre 沒有反向地理編碼功能，精確判斷需另外加入官方行政區界資料。
export function nearestArea(point) {
  if (!isCoordinate(point)) return null
  if (!insideTaipei(point)) return null
  return AREAS.map(area => ({ area, distance: distanceMeters(point, area) }))
    .sort((a, b) => a.distance - b.distance)[0].area
}
// 環境部 AQI 分級原值，不轉成 0–100 刺激尺度。
export function aqiText(aqi) {
  if (!Number.isFinite(aqi) || aqi < 0) return '未知'
  return aqi <= 50 ? '良好' : aqi <= 100 ? '普通' : aqi <= 150 ? '對敏感族群不健康' : aqi <= 200 ? '對所有族群不健康' : aqi <= 300 ? '非常不健康' : '危害'
}
export function filterPlaces(places, query = {}, now = Date.now()) {
  return places.map(place => ({ ...place, distanceM: distanceMeters(query, place.location) }))
    .filter(place => place.distanceM !== null && place.distanceM <= (query.radius ?? 500))
    .filter(place => !query.indoor || place.indoor === true)
    .filter(place => ['noise', 'light', 'crowd', 'odor'].every(key => {
      if (query[key] !== 'low') return true
      const value = sensoryValues(place, now)[key]
      return Number.isFinite(value) && value <= 33
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
}
// 探索範圍固定以查詢中心 500 公尺直線距離（已移除使用者自訂的感官篩選與距離偏好）。
export const SEARCH_RADIUS = 500
// 本機偏好只剩介面與排序；舊版存下的 noise／light／crowd／odor／indoor／radius 讀取時會被略過。
export const DEFAULT_PREFERENCES = Object.freeze({ lowStimulus: false, sort: 'fit' })
export function readPreferences(storage) {
  const defaults = () => ({ ...DEFAULT_PREFERENCES, sensitivities: { ...DEFAULT_SENSITIVITIES } })
  try {
    const data = JSON.parse(storage.getItem('quiet-city-preferences') || '{}')
    const preferences = defaults()
    for (const [key, value] of Object.entries(data || {})) {
      if (!Object.hasOwn(DEFAULT_PREFERENCES, key)) continue
      if (key === 'sort' ? ['fit', 'distance'].includes(value) : typeof value === 'boolean') preferences[key] = value
    }
    for (const key of Object.keys(DEFAULT_SENSITIVITIES)) {
      const value = data?.sensitivities?.[key]
      if (Number.isInteger(value) && value >= 1 && value <= 5) preferences.sensitivities[key] = value
    }
    return preferences
  } catch { return defaults() }
}
