import { apiRequest } from './apiClient.js'
import { demoOverview, demoPlaces, demoCells, DEMO_META, DEMO_TIME } from '../data/quietDemo.js'
import { AREAS, filterPlaces, isCoordinate, REPORT_KINDS } from './sensoryDomain.js'

export function createSensoryApi({ mode = import.meta.env.VITE_SENSORY_MODE || 'demo', request = apiRequest } = {}) {
  if (!['demo', 'api'].includes(mode)) throw new Error('VITE_SENSORY_MODE 必須是 demo 或 api')
  const copy = value => JSON.parse(JSON.stringify(value))
  const wrap = data => ({ data: copy(data), meta: copy(DEMO_META) })
  const validSources = sources => Array.isArray(sources) && sources.every(source => source && typeof source.name === 'string' && (source.url == null || typeof source.url === 'string'))
  async function get(path, query, { signal } = {}) {
    const response = await request(path, { query, signal })
    const payload = response.data
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object' || !payload.meta || payload.meta.demo !== false || !validSources(payload.meta.sources)) {
      throw new Error('後端回應格式不符：需要 data、meta.demo=false 與 meta.sources。')
    }
    return payload
  }
  function checkPlace(place) {
    return place && typeof place.id === 'string' && typeof place.name === 'string' && isCoordinate(place.location)
  }
  function locationOf(body) {
    if (!isCoordinate(body?.location) || !['manual', 'device'].includes(body.location.source)) throw new Error('請選擇有效的回報位置。')
  }
  return {
    mode,
    getOverview: async (query, options) => {
      if (mode === 'demo') return wrap(demoOverview(query.areaId))
      const result = await get('sensory/overview', query, options)
      if (!result.data.senses || typeof result.data.senses !== 'object') throw new Error('感官概況格式不符，缺少 senses。')
      return result
    },
    getMap: async (query, options) => {
      if (mode === 'demo') return wrap({ cells: demoCells(query.areaId) })
      const result = await get('sensory/map', query, options)
      if (!Array.isArray(result.data.cells)) throw new Error('地圖資料格式不符，缺少 cells 陣列。')
      return result
    },
    getPlaces: async (query, options) => {
      if (mode === 'demo') return wrap({ places: filterPlaces(demoPlaces(query.areaId), query, DEMO_TIME) })
      const result = await get('places', query, options)
      if (!Array.isArray(result.data.places) || !result.data.places.every(checkPlace)) throw new Error('場所清單格式不符，請檢查名稱與座標。')
      return { ...result, data: { ...result.data, places: filterPlaces(result.data.places, query) } }
    },
    getPlace: async (id, options) => {
      if (mode === 'api') {
        const result = await get(`places/${encodeURIComponent(id)}`, undefined, options)
        if (!checkPlace(result.data) || result.data.id !== id || (result.data.sources && !validSources(result.data.sources))
          || (result.data.reviews && (!Array.isArray(result.data.reviews) || !result.data.reviews.every(review => review && typeof review.text === 'string')))) throw new Error('場所詳情格式不符或場所編號不一致。')
        return result
      }
      const place = AREAS.flatMap(area => demoPlaces(area.id)).find(item => item.id === id)
      return place ? Promise.resolve(wrap(place)) : Promise.reject(new Error('找不到此場所。'))
    },
    async createReport(body) {
      locationOf(body)
      if (!REPORT_KINDS.some(kind => kind.id === body.kind) || (body.note?.length || 0) > 140) throw new Error('回報內容格式不正確。')
      if (mode === 'demo') return wrap({ id: `demo-report-${Date.now()}`, accepted: true })
      const response = await request('reports', { method: 'POST', body })
      if (!response.data?.data?.accepted) throw new Error('後端尚未接受此回報。')
      return response.data
    },
    async createMeasurement(body) {
      locationOf(body)
      if (body.consent !== true) throw new Error('請先同意分享量測摘要。')
      if (mode === 'demo') return wrap({ id: `demo-measurement-${Date.now()}`, accepted: true })
      const response = await request('measurements', { method: 'POST', body })
      if (!response.data?.data?.accepted) throw new Error('後端尚未接受此量測。')
      return response.data
    },
  }
}
export const sensoryApi = createSensoryApi()
