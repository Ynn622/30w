import { apiRequest } from './apiClient.js'
import { mockCells, mockMeta, mockOverview, mockPlace, mockPlaces } from '../data/quietMock.js'
import { filterPlaces, INTENSITY_KINDS, isCoordinate, REPORT_INTENSITIES, REPORT_PERSISTENCE, REPORT_SETTINGS, reportKind } from './sensoryDomain.js'

export const MOCK_NOTICE = '後端感官服務暫時無法連線，已改用模擬資料顯示。'

// 每次都先呼叫後端；連不上、路由不存在、伺服器錯誤或格式不符時才改用模擬資料，
// 並以 meta.mock=true 標示，讓畫面跳出通知。取消請求不改用模擬資料。
export function createSensoryApi({
  request = apiRequest, now = () => Date.now(),
  reportIntensity = import.meta.env.VITE_REPORT_INTENSITY === 'true',
  // 展示用：VITE_MOCK_MAP=true 時感官地圖一律用模擬格網（不呼叫 sensory/map），仍以 meta.mock 標示並跳通知。
  mockMap = import.meta.env.VITE_MOCK_MAP === 'true',
  // 後端 places 接受任意整數半徑後才開啟；目前後端只接受 300／500／1000。
  freeRadius = import.meta.env.VITE_PLACES_FREE_RADIUS === 'true',
} = {}) {
  // 後端確認支援 intensity 後再以環境變數開啟，否則維持舊 body。
  const supportsReportIntensity = reportIntensity === true
  // 模擬清單以查詢座標為中心；記住各區最近一次的中心，讓模擬詳情與清單座標一致。
  const mockCenters = new Map()
  const centerOf = query => {
    const center = isCoordinate(query) ? { lat: query.lat, lng: query.lng } : null
    if (center && query.areaId) mockCenters.set(query.areaId, center)
    return center
  }
  const validSources = sources => Array.isArray(sources) && sources.every(source => source && typeof source.name === 'string' && (source.url == null || typeof source.url === 'string'))
  const cancelled = (error, signal) => signal?.aborted || error?.code === 'CANCELLED'
  const reasonOf = error => error?.status ? `HTTP ${error.status}：${error.message}` : error?.message || '後端無回應'
  // 寫入只在後端不存在或無法連線時模擬；驗證失敗、頻率限制等錯誤要讓使用者看到並可重試。
  const writeFallback = error => ['NETWORK_ERROR', 'TIMEOUT'].includes(error?.code) || [404, 405, 501, 502, 503, 504].includes(error?.status) || error?.status >= 500
  async function get(path, query, { signal } = {}) {
    const response = await request(path, { query, signal })
    const payload = response.data
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object' || !payload.meta
      || payload.meta.demo === true || payload.meta.mock === true || !validSources(payload.meta.sources)) {
      throw new Error('後端回應格式不符：需要 data、meta 與 meta.sources。')
    }
    return payload
  }
  async function withFallback(load, fallback, signal) {
    try { return await load() }
    catch (error) {
      if (cancelled(error, signal)) throw error
      const time = now()
      // 模擬地圖格網需非同步載入 JSON，其餘模擬資料為同步；一律 await。
      const data = await fallback(time)
      if (data == null) throw error
      return { data: JSON.parse(JSON.stringify(data)), meta: mockMeta(time, reasonOf(error)) }
    }
  }
  function checkPlace(place) {
    return place && typeof place.id === 'string' && typeof place.name === 'string' && isCoordinate(place.location)
  }
  function locationOf(body) {
    if (!isCoordinate(body?.location) || !['manual', 'device'].includes(body.location.source)) throw new Error('請選擇有效的回報位置。')
  }
  async function write(path, body, label) {
    try {
      const response = await request(path, { method: 'POST', body })
      if (!response.data?.data?.accepted) throw new Error(`後端尚未接受此${label}。`)
      return response.data
    } catch (error) {
      if (!writeFallback(error)) throw error
      const time = now()
      return { data: { id: `mock-${path}-${time}`, accepted: true }, meta: mockMeta(time, reasonOf(error)) }
    }
  }
  return {
    supportsReportIntensity,
    supportsFreeRadius: freeRadius === true,
    getOverview: (query, options = {}) => withFallback(async () => {
      const result = await get('sensory/overview', query, options)
      if (!result.data.senses || typeof result.data.senses !== 'object') throw new Error('感官概況格式不符，缺少 senses。')
      return result
    }, time => mockOverview(query.areaId, time), options.signal),
    getMap: (query, options = {}) => withFallback(async () => {
      if (mockMap) throw new Error('已設定 VITE_MOCK_MAP，感官地圖使用模擬資料。')
      const result = await get('sensory/map', query, options)
      if (!Array.isArray(result.data.cells)) throw new Error('地圖資料格式不符，缺少 cells 陣列。')
      return result
    }, async time => ({ cells: await mockCells(query.areaId, time, centerOf(query), query.radius) }), options.signal),
    getPlaces: (query, options = {}) => withFallback(async () => {
      const result = await get('places', query, options)
      if (!Array.isArray(result.data.places) || !result.data.places.every(checkPlace)) throw new Error('場所清單格式不符，請檢查名稱與座標。')
      // 前端再次檢查距離、觀測時間與低刺激條件，不完全信任後端篩選。
      return { ...result, data: { ...result.data, places: filterPlaces(result.data.places, query, now()) } }
    }, time => ({ places: filterPlaces(mockPlaces(query.areaId, time, centerOf(query)), query, time) }), options.signal),
    getPlace: (id, options = {}) => withFallback(async () => {
      const result = await get(`places/${encodeURIComponent(id)}`, undefined, options)
      if (!checkPlace(result.data) || result.data.id !== id || (result.data.sources && !validSources(result.data.sources))
        || (result.data.reviews && (!Array.isArray(result.data.reviews) || !result.data.reviews.every(review => review && typeof review.text === 'string')))) throw new Error('場所詳情格式不符或場所編號不一致。')
      return result
    }, time => mockPlace(id, time, areaId => mockCenters.get(areaId)), options.signal),
    async createReport(body) {
      locationOf(body)
      const kind = reportKind(body.kind)
      if (!kind || (body.note?.length || 0) > 140) throw new Error('回報內容格式不正確。')
      if (kind.noteRequired && !body.note?.trim()) throw new Error('請描述你感受到的環境狀況。')
      if (body.tags !== undefined) {
        const allowed = new Set(kind.tags.map(item => item.id))
        if (!Array.isArray(body.tags) || new Set(body.tags).size !== body.tags.length || !body.tags.every(id => allowed.has(id))) throw new Error('具體情況的選項不正確。')
      }
      if (body.persistence !== undefined && !REPORT_PERSISTENCE.some(item => item.id === body.persistence)) throw new Error('持續狀態的選項不正確。')
      if (body.setting !== undefined && !REPORT_SETTINGS.some(item => item.id === body.setting)) throw new Error('室內／室外的選項不正確。')
      const { intensity, ...payload } = body
      const needsIntensity = INTENSITY_KINDS.includes(body.kind)
      if (intensity != null) {
        if (!needsIntensity) throw new Error('此感受不需要選擇強度。')
        if (!REPORT_INTENSITIES.some(item => item.id === intensity)) throw new Error('請選擇有效的感受強度。')
      } else if (supportsReportIntensity && needsIntensity) throw new Error('請先選擇感受強度。')
      if (supportsReportIntensity && intensity != null) payload.intensity = intensity
      return write('reports', payload, '回報')
    },
    async createMeasurement(body) {
      locationOf(body)
      if (body.consent !== true) throw new Error('請先同意分享量測摘要。')
      return write('measurements', body, '量測')
    },
  }
}
export const sensoryApi = createSensoryApi()
