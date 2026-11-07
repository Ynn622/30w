// 由 Taipei City Dashboard 的臺北市里界產生前端用的精簡里界：frontend/src/data/taipei-villages.json
// 用法：cd frontend && npm run geo:villages -- <taipei_village.geojson 路徑>
//
// 來源：臺北市政府資訊局 Taipei City Dashboard（AGPL-3.0），
// https://github.com/taipei-doit/Taipei-City-Dashboard/blob/develop/Taipei-City-Dashboard-FE/public/mapData/taipei_village.geojson
// 處理：只保留區名、里名、內政部村里代碼；邊界以 Douglas–Peucker 簡化（容許誤差約 3 公尺）、座標取到小數第 5 位（約 1 公尺），
// 只用於判斷座標所在的里，不作為法定界線。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://github.com/taipei-doit/Taipei-City-Dashboard/blob/develop/Taipei-City-Dashboard-FE/public/mapData/taipei_village.geojson'
const TOLERANCE_M = 3
const input = process.argv[2]
if (!input) {
  console.error('請提供 taipei_village.geojson 路徑：npm run geo:villages -- ./taipei_village.geojson')
  process.exit(1)
}

const M_PER_DEG_LAT = 111320
// Douglas–Peucker：以公尺座標計算點到線段距離，保留首尾點（環的首尾相同）。
function simplify(ring, tolerance) {
  const mLng = M_PER_DEG_LAT * Math.cos(ring[0][1] * Math.PI / 180)
  const xy = ring.map(([lng, lat]) => [lng * mLng, lat * M_PER_DEG_LAT])
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()
    const [ax, ay] = xy[start], [bx, by] = xy[end]
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy
    let farthest = -1, maxDistance = 0
    for (let i = start + 1; i < end; i++) {
      const [px, py] = xy[i]
      const t = length2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2)) : 0
      const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      if (distance > maxDistance) { maxDistance = distance; farthest = i }
    }
    if (farthest !== -1 && maxDistance > tolerance) {
      keep[farthest] = 1
      stack.push([start, farthest], [farthest, end])
    }
  }
  const result = ring.filter((_, i) => keep[i])
  // 環至少要有 4 點（三角形＋閉合點），太小的環保留原樣。
  return result.length >= 4 ? result : ring
}
const round = value => Number(value.toFixed(5))

const source = JSON.parse(readFileSync(input, 'utf8'))
let before = 0, after = 0
const villages = source.features.map(feature => {
  const { TNAME: district, VNAME: village, CPTVID: code } = feature.properties
  if (!district || !village || !code) throw new Error(`里界資料缺少區名、里名或代碼：${JSON.stringify(feature.properties)}`)
  if (feature.geometry.type !== 'MultiPolygon') throw new Error(`不支援的幾何類型：${feature.geometry.type}`)
  const polygons = feature.geometry.coordinates.map(polygon => polygon.map(ring => {
    before += ring.length
    const simplified = simplify(ring, TOLERANCE_M).map(([lng, lat]) => [round(lng), round(lat)])
    after += simplified.length
    return simplified
  }))
  const points = polygons.flat(2)
  const bbox = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]
  return [district, village, String(code), bbox, polygons]
}).sort((a, b) => a[2].localeCompare(b[2]))

const header = {
  description: '臺北市里界（精簡版），只用於判斷座標所在的里，不作為法定界線。',
  source: SOURCE_URL,
  license: 'AGPL-3.0；© 臺北市政府資訊局 Taipei City Dashboard，保留原著作權聲明',
  sourceUpdated: '2024-01-30（來源 repo 最後一次修改此檔的 commit 日期）',
  processing: `只保留區名、里名、內政部村里代碼；Douglas–Peucker 簡化（約 ${TOLERANCE_M} 公尺）、座標取到小數第 5 位`,
  generator: 'frontend/scripts/build-villages.mjs（npm run geo:villages）',
  fields: ['district', 'village', 'code', 'bbox [west, south, east, north]', 'polygons（MultiPolygon，[lng, lat]）'],
}
const json = `{\n${Object.entries(header).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join('\n')}\n  "villages": [\n${villages.map(row => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]\n}\n`
const out = fileURLToPath(new URL('../src/data/taipei-villages.json', import.meta.url))
writeFileSync(out, json)
console.log(`已寫入 ${villages.length} 個里（頂點 ${before} → ${after}）→ ${out}（${(json.length / 1024).toFixed(0)} KB）`)
