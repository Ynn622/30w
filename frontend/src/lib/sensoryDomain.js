export const AREAS = [
  { id: 'zhongzheng', name: '中正區', lat: 25.0386, lng: 121.5143 },
  { id: 'daan', name: '大安區', lat: 25.0267, lng: 121.5354 },
  { id: 'xinyi', name: '信義區', lat: 25.033, lng: 121.5654 },
]
export const SENSES = [
  { key: 'noise', label: '聲音', icon: 'sound', color: 'teal' },
  { key: 'light', label: '光線', icon: 'sun', color: 'amber' },
  { key: 'crowd', label: '人潮', icon: 'people', color: 'blue' },
  { key: 'air', label: '空氣品質', icon: 'leaf', color: 'green' },
]
export const REPORT_KINDS = [
  { id: 'noisy', label: '這裡太吵', icon: 'sound', color: 'teal' },
  { id: 'bright', label: '光線刺眼', icon: 'sun', color: 'amber' },
  { id: 'crowded', label: '人潮擁擠', icon: 'people', color: 'blue' },
  { id: 'odor', label: '有異味', icon: 'wind', color: 'purple' },
  { id: 'comfortable', label: '這裡很舒服', icon: 'leaf', color: 'green' },
  { id: 'other', label: '其他感受', icon: 'plus', color: 'muted' },
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
export function isFresh(date, now = Date.now()) {
  const age = new Date(now).getTime() - new Date(date).getTime()
  return Number.isFinite(age) && age >= 0 && age <= 30 * 60_000
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
export function filterPlaces(places, query = {}, now = Date.now()) {
  return places.map(place => ({ ...place, distanceM: distanceMeters(query, place.location) }))
    .filter(place => place.distanceM !== null && place.distanceM <= (query.radius ?? 500))
    .filter(place => !query.indoor || place.indoor === true)
    .filter(place => ['noise', 'light', 'crowd'].every(key => {
      if (query[key] !== 'low') return true
      return isFresh(place.updatedAt, now) && place.confidence !== 'insufficient'
        && Number.isFinite(place.senses?.[key]) && place.senses[key] >= 0 && place.senses[key] <= 33
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
}
export const DEFAULT_PREFERENCES = Object.freeze({ noise: true, light: false, crowd: false, radius: 500, indoor: false })
export function readPreferences(storage) {
  try {
    const data = JSON.parse(storage.getItem('quiet-city-preferences') || '{}')
    return { ...DEFAULT_PREFERENCES, ...Object.fromEntries(Object.entries(data).filter(([key, value]) =>
      Object.hasOwn(DEFAULT_PREFERENCES, key) && (key === 'radius' ? [300, 500, 1000].includes(value) : typeof value === 'boolean'))) }
  } catch { return { ...DEFAULT_PREFERENCES } }
}
