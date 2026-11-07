// 座標轉里：以臺北市里界（src/data/taipei-villages.json，來源 Taipei City Dashboard，AGPL-3.0）判斷座標所在的里。
// 只在裝置端計算，不把座標送到任何服務。里界約 330KB，第一次需要時才動態載入。
// 簡化後的相鄰里界可能有數公尺的縫隙：座標不在任何里內但距離某里邊界 30 公尺內時，取最近的里。
const M_PER_DEG_LAT = 111320
const EDGE_TOLERANCE_M = 30

let villagesPromise
export function loadVillages() {
  villagesPromise ??= import('../data/taipei-villages.json').then(module => (module.default || module).villages)
  return villagesPromise
}

// 射線法（even-odd）：對 MultiPolygon 的每個環計算交點，可正確處理洞。
function inPolygons(polygons, lng, lat) {
  let inside = false
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j]
        if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside
      }
    }
  }
  return inside
}
function distanceToEdgesM(polygons, lng, lat) {
  const mLng = M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180)
  let best = Infinity
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 0; i < ring.length - 1; i++) {
        const ax = (ring[i][0] - lng) * mLng, ay = (ring[i][1] - lat) * M_PER_DEG_LAT
        const bx = (ring[i + 1][0] - lng) * mLng, by = (ring[i + 1][1] - lat) * M_PER_DEG_LAT
        const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy
        const t = length2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length2)) : 0
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
      }
    }
  }
  return best
}
const toVillage = ([district, village, code]) => ({ city: '臺北市', district, village, code, name: `${district}${village}` })

// 同步版本：傳入已載入的里界列表；不在臺北市任何里內時回 null。
export function villageAt(villages, point) {
  const lat = point?.lat, lng = point?.lng
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Array.isArray(villages)) return null
  const padLat = EDGE_TOLERANCE_M / M_PER_DEG_LAT, padLng = EDGE_TOLERANCE_M / (M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180))
  const candidates = villages.filter(([, , , [west, south, east, north]]) => lng >= west - padLng && lng <= east + padLng && lat >= south - padLat && lat <= north + padLat)
  const hit = candidates.find(row => inPolygons(row[4], lng, lat))
  if (hit) return toVillage(hit)
  let nearest = null, nearestDistance = EDGE_TOLERANCE_M
  for (const row of candidates) {
    const distance = distanceToEdgesM(row[4], lng, lat)
    if (distance <= nearestDistance) { nearest = row; nearestDistance = distance }
  }
  return nearest ? toVillage(nearest) : null
}

export async function findVillage(point) {
  return villageAt(await loadVillages(), point)
}
