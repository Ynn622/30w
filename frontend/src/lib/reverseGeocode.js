// 經緯度轉地址：使用 OpenStreetMap Nominatim（軟體 GPL-3.0、資料 ODbL）。
// 遵守公用伺服器使用規範：每秒最多 1 次、同位置結果快取不重查、只在定位成功時查詢（不定時輪詢）、
// 畫面標示 © OpenStreetMap contributors。服務網址可用 VITE_GEOCODE_URL 改成自架或後端轉送。
// 快取只在記憶體，不寫入 localStorage／sessionStorage，關閉頁面即消失。
export const GEOCODE_ATTRIBUTION = '地址資料 © OpenStreetMap contributors（Nominatim）'
const DEFAULT_URL = 'https://nominatim.openstreetmap.org/reverse'

export function formatAddress(address) {
  if (!address || typeof address !== 'object') return ''
  const city = address.city || address.county || address.state || ''
  const district = address.suburb || address.city_district || address.town || address.district || ''
  const road = address.road || address.pedestrian || address.footway || ''
  let number = String(address.house_number || '').trim()
  if (number && /^[\d-]+$/.test(number)) number += '號'
  const local = road ? `${road}${number}` : (address.neighbourhood || address.quarter || '')
  return `${city}${district}${local}`.trim()
}

export function createReverseGeocoder({
  url = import.meta.env.VITE_GEOCODE_URL || DEFAULT_URL,
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  minInterval = 1100,
  cacheSize = 50,
} = {}) {
  const cache = new Map()
  let queue = Promise.resolve(), lastRequest = -Infinity
  // 約 11 公尺內視為同一位置，直接使用快取。
  const keyOf = ({ lat, lng }) => `${lat.toFixed(4)},${lng.toFixed(4)}`

  async function lookup(point, { signal } = {}) {
    if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) throw new Error('座標無效，無法查詢地址。')
    const key = keyOf(point)
    if (cache.has(key)) return cache.get(key)
    // 依序排隊，確保兩次請求間隔至少 minInterval。
    const run = queue.then(async () => {
      if (cache.has(key)) return cache.get(key)
      const wait = lastRequest + minInterval - now()
      if (wait > 0) await sleep(wait)
      if (signal?.aborted) throw Object.assign(new Error('地址查詢已取消。'), { name: 'AbortError' })
      lastRequest = now()
      const params = new URLSearchParams({ format: 'jsonv2', lat: String(point.lat), lon: String(point.lng), zoom: '18', addressdetails: '1', 'accept-language': 'zh-TW' })
      const response = await fetchImpl(`${url}?${params}`, { signal, headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`地址查詢失敗（HTTP ${response.status}）。`)
      const data = await response.json()
      const result = {
        address: formatAddress(data?.address),
        inTaipei: data?.address?.['ISO3166-2-lvl4'] === 'TW-TPE',
        district: data?.address?.suburb || data?.address?.city_district || '',
      }
      if (!result.address) throw new Error('查無此位置的地址。')
      cache.set(key, result)
      if (cache.size > cacheSize) cache.delete(cache.keys().next().value)
      return result
    })
    queue = run.catch(() => {})
    return run
  }
  return { lookup, cacheSize: () => cache.size }
}

export const reverseGeocoder = createReverseGeocoder()
