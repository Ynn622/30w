// 產生敏感圖層的模擬資料來源：frontend/src/data/mock-sensory-cells.json
// 用法：cd frontend && npm run mock:cells
//
// 內容是專案自製的模擬資料（不是實際觀測），刻意做得不規則，接近真實回報的樣子：
// - 位置：一般區域約每 150m 一點並隨機偏移；熱區（人多、回報多的地方）密集到約 50m。
// - 數值：全市隨機散佈數百個大小、強弱不同的「熱點」與「安靜點」，四維各自獨立，再加上每點的隨機雜訊；
//   部分點缺少某些維度（null），呈現缺值不算 0。
// 使用固定亂數種子，重新執行會得到相同結果；要換一組分布就改 SEED。產生後也可直接手動修改 JSON。
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { insideTaipei } from '../src/lib/sensoryDomain.js'

const SEED = 20261108
const M_PER_DEG_LAT = 111320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos(25.05 * Math.PI / 180)
const BOUNDS = { south: 24.955, north: 25.215, west: 121.45, east: 121.67 }
const BASE_SPACING_M = 150

// mulberry32：小型可重現亂數產生器。
function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = prng(SEED)
const between = (min, max) => min + random() * (max - min)
const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
const clamp100 = value => Math.max(0, Math.min(100, Math.round(value)))

// 以公尺座標計算（相對 BOUNDS 西南角）。
const width = (BOUNDS.east - BOUNDS.west) * M_PER_DEG_LNG, height = (BOUNDS.north - BOUNDS.south) * M_PER_DEG_LAT
const toLatLng = (x, y) => ({ lat: Number((BOUNDS.south + y / M_PER_DEG_LAT).toFixed(5)), lng: Number((BOUNDS.west + x / M_PER_DEG_LNG).toFixed(5)) })
const inside = (x, y) => insideTaipei(toLatLng(x, y))
function randomInside() {
  for (;;) { const x = random() * width, y = random() * height; if (inside(x, y)) return { x, y } }
}

// 各維度的基準值與熱點：正值為刺激來源（施工、商圈、強光、油煙），負值為安靜口袋（公園、巷弄、圖書館周邊）。
const DIMENSIONS = {
  noise: { base: 38, spread: 9, spots: 170, amp: [-30, 55], radius: [60, 450] },
  light: { base: 34, spread: 8, spots: 120, amp: [-25, 55], radius: [40, 300] },
  crowd: { base: 32, spread: 9, spots: 160, amp: [-25, 60], radius: [50, 400] },
  odor: { base: 20, spread: 7, spots: 90, amp: [-10, 60], radius: [30, 220] },
}
const spots = Object.fromEntries(Object.entries(DIMENSIONS).map(([key, d]) => [key, Array.from({ length: d.spots }, () => {
  // 正向熱點較多、較強；安靜口袋較少、較弱。
  const positive = random() < 0.7
  return { ...randomInside(), amp: positive ? between(15, d.amp[1]) : between(d.amp[0], -8), radius: between(...d.radius) }
})]))
function valueAt(key, x, y) {
  const d = DIMENSIONS[key]
  let value = d.base + gaussian() * d.spread
  for (const spot of spots[key]) {
    const d2 = (spot.x - x) ** 2 + (spot.y - y) ** 2
    if (d2 < 9 * spot.radius ** 2) value += spot.amp * Math.exp(-d2 / (2 * spot.radius ** 2))
  }
  return clamp100(value)
}

const points = []
// 一般區域：約 150m 間距，每點隨機偏移、約一成空缺。
for (let y = 0; y < height; y += BASE_SPACING_M) {
  for (let x = 0; x < width; x += BASE_SPACING_M) {
    if (random() < 0.1) continue
    const px = x + gaussian() * 45, py = y + gaussian() * 45
    if (inside(px, py)) points.push({ x: px, y: py })
  }
}
// 熱區：從人潮／聲音熱點附近挑叢集中心，每叢 15–70 點，間距約 50m。
const hotspots = [...spots.crowd, ...spots.noise].filter(spot => spot.amp > 20)
for (let k = 0; k < 320; k++) {
  const anchor = hotspots[Math.floor(random() * hotspots.length)]
  const cx = anchor.x + gaussian() * 150, cy = anchor.y + gaussian() * 150
  const spread = between(60, 180), count = Math.floor(between(15, 70))
  for (let n = 0; n < count; n++) {
    const px = cx + gaussian() * spread, py = cy + gaussian() * spread
    if (inside(px, py)) points.push({ x: px, y: py })
  }
}

const rows = points.map(({ x, y }) => {
  const { lat, lng } = toLatLng(x, y)
  const noise = valueAt('noise', x, y)
  // 部分點只有部分維度：光線約一成缺、人潮約一成缺、氣味約三成缺。
  const light = random() < 0.1 ? null : valueAt('light', x, y)
  const crowd = random() < 0.1 ? null : valueAt('crowd', x, y)
  const odor = random() < 0.3 ? null : valueAt('odor', x, y)
  return [lat, lng, noise, light, crowd, odor]
}).sort((a, b) => a[0] - b[0] || a[1] - b[1])

const header = {
  description: '聆靜敏感圖層模擬資料：臺北市範圍內不規則分布的回報點與四維感官值（0–100，越高越刺激；null 為無資料）。一般區域約 150m 一點、熱區密集到約 50m。專案自製，不是實際觀測。',
  license: '專案原創模擬資料（隨專案以 AGPL-3.0-or-later 釋出）',
  generator: `frontend/scripts/generate-mock-cells.mjs（npm run mock:cells，seed ${SEED}）`,
  fields: ['lat', 'lng', 'noise', 'light', 'crowd', 'odor'],
}
// 一列一個點，方便手動檢視與修改；觀測時間與信心在執行時依目前時間補上。
const json = `{\n${Object.entries(header).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`).join('\n')}\n  "cells": [\n${rows.map(row => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]\n}\n`
const out = fileURLToPath(new URL('../src/data/mock-sensory-cells.json', import.meta.url))
writeFileSync(out, json)
console.log(`已寫入 ${rows.length} 個點 → ${out}（${(json.length / 1024).toFixed(0)} KB）`)
