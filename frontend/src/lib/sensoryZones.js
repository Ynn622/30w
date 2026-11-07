// 低刺激綠區（docs/backend-api.md 2.1）：只採用後端判定的多邊形與場所標註，前端不從熱圖或格網外插綠區。
import { SENSORY_KEYS, sensoryValues } from './sensoryIndex.js'

export const SUPPORTED_ZONE_VERSIONS = Object.freeze(['zone-v0.1'])
export const ZONE_THRESHOLD = 33
const ZONE_STATUSES = ['low', 'not_low', 'unknown']
const finitePair = point => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite)
  && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
// 外環至少 4 點且首尾相同（RFC 7946）。
const validRing = ring => Array.isArray(ring) && ring.length >= 4 && ring.every(finitePair)
  && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]
const validPolygon = rings => Array.isArray(rings) && rings.length > 0 && rings.every(validRing)
function validGeometry(geometry) {
  if (geometry?.type === 'Polygon') return validPolygon(geometry.coordinates)
  if (geometry?.type === 'MultiPolygon') return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(validPolygon)
  return false
}

// 回傳 { rule, features }；缺 zones、版本不支援或格式錯誤時 features 為空，不視為錯誤。
export function parseZones(data, now = Date.now()) {
  const rule = data?.zoneRule
  if (!rule || !SUPPORTED_ZONE_VERSIONS.includes(rule.zoneVersion) || data?.zones?.type !== 'FeatureCollection' || !Array.isArray(data.zones.features)) {
    return { rule: null, features: [] }
  }
  const threshold = Number.isFinite(rule.threshold) ? rule.threshold : ZONE_THRESHOLD
  const time = new Date(now).getTime()
  const features = data.zones.features.filter(feature => {
    const props = feature?.properties
    if (feature?.type !== 'Feature' || !props || props.level !== 'low' || !SENSORY_KEYS.includes(props.layer)) return false
    if (!validGeometry(feature.geometry)) return false
    if (Number.isFinite(props.value) && props.value > threshold) return false
    const expires = new Date(props.validUntil).getTime()
    return Number.isFinite(expires) && expires >= time
  })
  return { rule: { ...rule, threshold }, features }
}

// 場所在某維度的低刺激狀態：室內場所以自身有效 senses 為準（室外綠區不能推論室內安靜），
// 其他場所讀後端 Place.zone；缺漏或非列舉值一律 unknown。
export function zoneOf(place, layer = 'noise', now = Date.now()) {
  if (place?.indoor === true) {
    const value = sensoryValues(place, now)[layer]
    return value === null ? 'unknown' : value <= ZONE_THRESHOLD ? 'low' : 'not_low'
  }
  const status = place?.zone?.[layer]
  return ZONE_STATUSES.includes(status) ? status : 'unknown'
}

export const ZONE_RANK = Object.freeze({ low: 0, unknown: 1, not_low: 2 })
