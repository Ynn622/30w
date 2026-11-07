// 敏感圖層：把後端回傳的點（每點一個 0–100 個人刺激值）內插成連續平面，
// 像氣壓圖一樣畫成平滑色帶與等值線。只在點附近內插，遠離資料處淡出成透明，不把「沒資料」畫成安靜。
import { isCoordinate, personalStimulus } from './sensoryDomain.js'

const M_PER_DEG_LAT = 111320
export const FIELD_DEFAULTS = Object.freeze({ step: 15, sigma: 110, solid: 150, reach: 300 })
export const CONTOUR_LEVELS = Object.freeze([33, 66])
// 綠區上限：個人刺激值 ≤ 33（與「低」分段一致）。
export const GREEN_MAX = 33
// 暫定（2026-11-08 開發者決定）：沒有資料的地方先視為綠區，清單照常列出。之後要改回「無資料 ≠ 安靜」只需改成 false。
export const NO_DATA_AS_GREEN = true

// 由後端點（格中心＋四維）與使用者敏感度建立敏感圖層平面；地圖與清單共用同一個平面，判定才會一致。
export function buildSensoryField(cells, sensitivities, now = Date.now(), options) {
  const points = (cells || []).filter(cell => isCoordinate(cell?.location))
    .map(cell => ({ ...cell.location, value: personalStimulus(cell, sensitivities, now) }))
    .filter(point => point.value !== null)
  return interpolateField(points, options)
}
// 場所是否位於綠區：取該座標的平面值；無資料時依 noDataAsGreen 決定。
export function zoneOf(field, location, noDataAsGreen = NO_DATA_AS_GREEN) {
  const value = fieldValueAt(field, location)
  if (value === null) return { value: null, green: noDataAsGreen }
  return { value, green: value <= GREEN_MAX }
}

// 依點的疏密自動調整平滑程度：取最近鄰距離的第 75 百分位當「一般間距」s，
// sigma ≈ 0.7s、reach ≈ 3s、solid = reach / 2（上限即 FIELD_DEFAULTS），後端 200m 格網時剛好是 110／300／150；
// 模擬資料點距約 50–70m 時會縮到約 45／200／100，呈現較細的變化又不至於破洞；只有一個點或彼此相距很遠時用預設值。
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export function typicalSpacing(points, fallback = 200) {
  if (points.length < 2) return fallback
  const lat0 = points[0].lat, mLng = M_PER_DEG_LAT * Math.cos(lat0 * Math.PI / 180), cell = 300
  const meters = points.map(point => ({ x: (point.lng - points[0].lng) * mLng, y: (point.lat - lat0) * M_PER_DEG_LAT }))
  const buckets = new Map()
  for (const point of meters) {
    const key = `${Math.floor(point.x / cell)},${Math.floor(point.y / cell)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(point)
  }
  // 取樣至多 600 點估計即可。
  const stride = Math.max(1, Math.floor(meters.length / 600))
  const nearest = []
  for (let i = 0; i < meters.length; i += stride) {
    const point = meters[i], bx = Math.floor(point.x / cell), by = Math.floor(point.y / cell)
    let best = Infinity
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      for (const other of buckets.get(`${bx + ox},${by + oy}`) || []) {
        if (other === point) continue
        const d = Math.hypot(other.x - point.x, other.y - point.y)
        if (d < best) best = d
      }
    }
    nearest.push(Math.min(best, cell))
  }
  nearest.sort((a, b) => a - b)
  return nearest[Math.floor(nearest.length * 0.75)]
}
export function adaptiveRadii(points) {
  const spacing = typicalSpacing(points)
  const reach = clamp(3 * spacing, 100, FIELD_DEFAULTS.reach)
  return { sigma: clamp(0.7 * spacing, 30, FIELD_DEFAULTS.sigma), reach, solid: reach / 2 }
}

// 高斯核加權平均（Nadaraya–Watson）：每個網格點的值是附近各點依距離加權的平均，表面平滑、不會超出原始值範圍。
// solid 公尺內完全不透明，solid–reach 之間線性淡出，超過 reach 不畫（NaN）。平滑半徑預設依點的疏密自動決定。
export function interpolateField(points, options = {}) {
  const valid = points.filter(point => isCoordinate(point) && Number.isFinite(point.value))
  if (!valid.length) return null
  const { sigma, solid, reach, maxPixels = 400 } = { ...adaptiveRadii(valid), ...options }
  const lat0 = valid.reduce((sum, point) => sum + point.lat, 0) / valid.length
  const mLng = M_PER_DEG_LAT * Math.cos(lat0 * Math.PI / 180)
  // 網格間距：預設 15m；範圍很大時放寬，讓影像最長邊不超過 maxPixels（地圖放大時以線性取樣補平滑）。
  const spanM = Math.max(
    (Math.max(...valid.map(p => p.lat)) - Math.min(...valid.map(p => p.lat))) * M_PER_DEG_LAT,
    (Math.max(...valid.map(p => p.lng)) - Math.min(...valid.map(p => p.lng))) * mLng,
  ) + 2 * reach
  // 平滑半徑小時網格也要跟著細，至少每個 sigma 有約三個網格點。
  const step = Math.max(options.step ?? Math.min(FIELD_DEFAULTS.step, sigma / 3), spanM / maxPixels)
  const dLat = step / M_PER_DEG_LAT, dLng = step / mLng
  const north = Math.max(...valid.map(p => p.lat)) + reach / M_PER_DEG_LAT
  const south = Math.min(...valid.map(p => p.lat)) - reach / M_PER_DEG_LAT
  const west = Math.min(...valid.map(p => p.lng)) - reach / mLng
  const east = Math.max(...valid.map(p => p.lng)) + reach / mLng
  const width = Math.ceil((east - west) / dLng) + 1, height = Math.ceil((north - south) / dLat) + 1
  const values = new Float32Array(width * height).fill(NaN)
  const alpha = new Float32Array(width * height)
  const twoSigma2 = 2 * sigma * sigma, reach2 = reach * reach
  // 空間索引：點依 reach 大小分桶，每個像素只檢查周圍 3×3 桶內的點（reach 外權重已小於 3%，不計）。
  // 以公尺座標計算，2km 範圍數百個點也能在數十毫秒內完成。
  const meters = valid.map(point => ({ x: (point.lng - west) * mLng, y: (north - point.lat) * M_PER_DEG_LAT, value: point.value }))
  const buckets = new Map()
  for (const point of meters) {
    const key = `${Math.floor(point.x / reach)},${Math.floor(point.y / reach)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(point)
  }
  for (let y = 0; y < height; y++) {
    const py = y * step, by = Math.floor(py / reach)
    for (let x = 0; x < width; x++) {
      const px = x * dLng * mLng, bx = Math.floor(px / reach)
      let sumW = 0, sumV = 0, nearest = Infinity
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const bucket = buckets.get(`${bx + ox},${by + oy}`)
        if (!bucket) continue
        for (const point of bucket) {
          const dx = point.x - px, dy = point.y - py
          const d2 = dx * dx + dy * dy
          if (d2 > reach2) continue
          if (d2 < nearest) nearest = d2
          const w = Math.exp(-d2 / twoSigma2)
          sumW += w; sumV += w * point.value
        }
      }
      if (sumW === 0) continue
      nearest = Math.sqrt(nearest)
      const i = y * width + x
      values[i] = sumV / sumW
      alpha[i] = nearest <= solid ? 1 : (reach - nearest) / (reach - solid)
    }
  }
  return { width, height, values, alpha, west, north, dLng, dLat, east: west + (width - 1) * dLng, south: north - (height - 1) * dLat }
}

// 色帶：0–33 綠、34–66 黃到橘、67–100 紅，與「低／中等／偏高」分段一致。
const STOPS = [[0, [46, 158, 108]], [33, [150, 205, 120]], [50, [242, 212, 100]], [66, [240, 150, 88]], [100, [208, 72, 62]]]
export function fieldColor(value) {
  if (!Number.isFinite(value)) return null
  const v = Math.max(0, Math.min(100, value))
  for (let i = 1; i < STOPS.length; i++) {
    const [v1, c1] = STOPS[i]
    if (v <= v1) {
      const [v0, c0] = STOPS[i - 1]
      const t = (v - v0) / (v1 - v0)
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * t))
    }
  }
  return STOPS.at(-1)[1]
}
export const FIELD_GRADIENT_CSS = `linear-gradient(90deg, ${STOPS.map(([v, c]) => `rgb(${c.join(',')}) ${v}%`).join(', ')})`

// Marching squares：在網格上找出值等於 level 的等值線段，回傳 GeoJSON 座標 [[lng, lat], [lng, lat]]。
// 只在四角都有值、且不透明度足夠的方格內畫線，避免在資料邊緣畫出沒有根據的線。
const EDGES = { 1: [['l', 'b']], 2: [['b', 'r']], 3: [['l', 'r']], 4: [['t', 'r']], 5: [['l', 't'], ['b', 'r']], 6: [['t', 'b']], 7: [['l', 't']],
  8: [['l', 't']], 9: [['t', 'b']], 10: [['t', 'r'], ['l', 'b']], 11: [['t', 'r']], 12: [['l', 'r']], 13: [['b', 'r']], 14: [['l', 'b']] }
export function contourSegments(field, level, minAlpha = 0.35) {
  if (!field) return []
  const { width, height, values, alpha, west, north, dLng, dLat } = field
  const at = (x, y) => values[y * width + x]
  const point = (x, y) => [west + x * dLng, north - y * dLat]
  const lerp = (x1, y1, x2, y2) => {
    const v1 = at(x1, y1), v2 = at(x2, y2)
    const t = v1 === v2 ? 0.5 : (level - v1) / (v2 - v1)
    const [lng1, lat1] = point(x1, y1), [lng2, lat2] = point(x2, y2)
    return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t]
  }
  const segments = []
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1)
      if ([a, b, c, d].some(Number.isNaN)) continue
      if (Math.min(alpha[y * width + x], alpha[y * width + x + 1], alpha[(y + 1) * width + x + 1], alpha[(y + 1) * width + x]) < minAlpha) continue
      const index = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0)
      const edges = EDGES[index]
      if (!edges) continue
      const edgePoint = { t: () => lerp(x, y, x + 1, y), r: () => lerp(x + 1, y, x + 1, y + 1), b: () => lerp(x, y + 1, x + 1, y + 1), l: () => lerp(x, y, x, y + 1) }
      for (const [from, to] of edges) segments.push([edgePoint[from](), edgePoint[to]()])
    }
  }
  return segments
}

// 取平面上某座標的值（最近網格點），供之後清單判斷場所是否位於綠區；不在平面範圍或無資料回 null。
export function fieldValueAt(field, location) {
  if (!field || !isCoordinate(location)) return null
  const x = Math.round((location.lng - field.west) / field.dLng), y = Math.round((field.north - location.lat) / field.dLat)
  if (x < 0 || y < 0 || x >= field.width || y >= field.height) return null
  const value = field.values[y * field.width + x]
  return Number.isNaN(value) ? null : value
}
