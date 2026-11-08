// 地圖具名場所雙來源（Ynn622/30w#7，2026-11-08 契約）：正式 places 與 test/places 同時請求。
// - 只依明確身份配對：同 UUID、test.livePlaceIds，或共同官方 sourceIdentities（sourceId＋sourceKey）；不依名稱或距離猜。
//   livePlaceIds 是查核當時的 UUID，可能是正式清單排重後的舊別名：以正式詳情回傳的 canonicalId 換成主 id 再配對。
// - 一對一配對才合併：保留正式的場所事實（名稱、地址、照片、來源），感官整筆改用 test 情境（null 維持未知）。
// - 多候選不任選合併，兩邊都保留；test 獨有與正式獨有也照常顯示。
// - 任一來源失敗標示 partial，兩邊都失敗才算錯誤；正式介接退回內建虛構資料時視為失敗，不假裝成功。
import { sensoryApi } from './sensoryApi.js'
import { filterPlaces } from './sensoryDomain.js'
import { isScenario, testPlacesApi } from './testPlacesApi.js'

// 從 test 紀錄帶入的感官欄位；其餘欄位沿用正式場所。
const SCENARIO_FIELDS = ['senses', 'sound', 'rawBands', 'confidence', 'sensoryIndex', 'observedAt', 'updatedAt', 'reportCount', 'measurementCount', 'testData', 'sampleLocation']
const identityKeys = place => (Array.isArray(place?.sourceIdentities) ? place.sourceIdentities : [])
  .filter(item => item && typeof item.sourceId === 'string' && typeof item.sourceKey === 'string')
  .map(item => `${item.sourceId}\u0000${item.sourceKey}`)

const livePlaceIdsOf = place => Array.isArray(place?.livePlaceIds) ? place.livePlaceIds.filter(id => typeof id === 'string' && id) : []
// 回傳 test 場所可能對應的正式場所 id（Set）；aliases 為舊別名 UUID → 正式主 id。
function liveCandidates(testPlace, liveById, liveByIdentity, aliases = new Map()) {
  const found = new Set()
  if (liveById.has(testPlace.id)) found.add(testPlace.id)
  for (const id of livePlaceIdsOf(testPlace)) {
    const canonical = liveById.has(id) ? id : aliases.get(id)
    if (canonical && liveById.has(canonical)) found.add(canonical)
  }
  for (const key of identityKeys(testPlace)) for (const id of liveByIdentity.get(key) || []) found.add(id)
  return found
}
// 詳情重驗身份：test 詳情必須明確指向這個正式場所。
export function sameIdentity(livePlace, testPlace, aliases = new Map()) {
  if (!livePlace || !testPlace) return false
  if (livePlace.id === testPlace.id || livePlaceIdsOf(testPlace).some(id => id === livePlace.id || aliases.get(id) === livePlace.id)) return true
  const keys = new Set(identityKeys(livePlace))
  return identityKeys(testPlace).some(key => keys.has(key))
}

const refOf = (origin, liveId, testId, scenario) => ({ origin, liveId: liveId ?? null, testId: testId ?? null, scenario: testId ? scenario : null })
function liveOnly(place) { return { ...place, origin: 'live', renderKey: `live:${place.id}`, ref: refOf('live', place.id, null, null) } }
function testOnly(place, scenario) { return { ...place, image: null, photo: null, origin: 'test', renderKey: `test:${place.id}`, ref: refOf('test', null, place.id, scenario) } }
// 正式 tag「感官資料不足」描述的是正式感官；合併後感官改用情境資料，這個標籤不再成立。
const LIVE_SENSORY_TAG = /感官資料不足/
export function mergeRecord(livePlace, testPlace, scenario) {
  const merged = { ...livePlace }
  for (const key of SCENARIO_FIELDS) merged[key] = testPlace[key] ?? null
  if (typeof merged.tag === 'string' && LIVE_SENSORY_TAG.test(merged.tag)) merged.tag = null
  return { ...merged, origin: 'merged', renderKey: `merged:${livePlace.id}:${testPlace.id}`, ref: refOf('merged', livePlace.id, testPlace.id, scenario) }
}

export function mergePlaces(livePlaces = [], testPlaces = [], scenario = null, aliases = new Map()) {
  const liveById = new Map(livePlaces.map(place => [place.id, place]))
  const liveByIdentity = new Map()
  for (const place of livePlaces) for (const key of identityKeys(place)) {
    if (!liveByIdentity.has(key)) liveByIdentity.set(key, new Set())
    liveByIdentity.get(key).add(place.id)
  }
  const candidates = testPlaces.map(place => liveCandidates(place, liveById, liveByIdentity, aliases))
  // 反向計數：同一個正式場所被幾筆 test 指到。
  const claims = new Map()
  candidates.forEach(set => set.forEach(id => claims.set(id, (claims.get(id) || 0) + 1)))
  const mergedLive = new Set()
  const result = []
  testPlaces.forEach((place, index) => {
    const set = candidates[index]
    const [liveId] = set
    if (set.size === 1 && claims.get(liveId) === 1) {
      mergedLive.add(liveId)
      result.push(mergeRecord(liveById.get(liveId), place, scenario))
    } else result.push(testOnly(place, scenario))
  })
  for (const place of livePlaces) if (!mergedLive.has(place.id)) result.push(liveOnly(place))
  return result
}
// 沒有直接配對、但 livePlaceIds 不在正式清單裡的 test 場所：這些 UUID 可能是舊別名，需要查正式詳情取得 canonicalId。
export function unresolvedLiveIds(livePlaces = [], testPlaces = []) {
  const liveById = new Map(livePlaces.map(place => [place.id, place]))
  const liveByIdentity = new Map()
  for (const place of livePlaces) for (const key of identityKeys(place)) {
    if (!liveByIdentity.has(key)) liveByIdentity.set(key, new Set())
    liveByIdentity.get(key).add(place.id)
  }
  const ids = new Set()
  for (const place of testPlaces) {
    if (liveCandidates(place, liveById, liveByIdentity).size) continue
    for (const id of livePlaceIdsOf(place)) if (!liveById.has(id)) ids.add(id)
  }
  return [...ids]
}

const isCancelled = reason => reason?.code === 'CANCELLED' || reason?.name === 'AbortError'
// 正式介接失敗時會退回內建虛構資料（meta.mock）；雙來源模式下視為正式來源失敗。
const strictLive = promise => promise.then(result => {
  if (result?.meta?.mock) throw new Error(`正式場所暫時無法取得（${result.meta.fallbackReason || '後端無回應'}）`)
  return result
})

// 每次最多查幾個舊別名（避免異常資料造成大量詳情請求）。
export const MAX_ALIAS_LOOKUPS = 10

export function createPlaceSources({ liveApi = sensoryApi, testApi = testPlacesApi } = {}) {
  // 以正式詳情解析舊別名：有效舊 UUID 仍回 200，data.id 保留請求 id、另附 canonicalId。查不到或失敗就不合併（照常分開顯示）。
  async function resolveAliases(ids, signal) {
    const aliases = new Map()
    const results = await Promise.allSettled(ids.slice(0, MAX_ALIAS_LOOKUPS).map(id => strictLive(liveApi.getPlace(id, { signal })).then(result => [id, result.data])))
    const cancelled = results.find(item => item.status === 'rejected' && isCancelled(item.reason))
    if (cancelled || signal?.aborted) throw cancelled?.reason || Object.assign(new Error('請求已取消。'), { code: 'CANCELLED' })
    for (const item of results) {
      if (item.status !== 'fulfilled') continue
      const [id, data] = item.value
      if (typeof data?.canonicalId === 'string' && data.canonicalId && data.canonicalId !== id) aliases.set(id, data.canonicalId)
    }
    return aliases
  }
  return {
    supportsFreeRadius: Boolean(liveApi.supportsFreeRadius),
    async getPlaces({ scenario, ...query } = {}, { signal } = {}) {
      const [live, test] = await Promise.allSettled([
        strictLive(liveApi.getPlaces(query, { signal })),
        isScenario(scenario) ? testApi.getPlaces({ ...query, scenario }, { signal }) : Promise.reject(new Error('未知的場所情境。')),
      ])
      if (signal?.aborted || [live, test].some(item => item.status === 'rejected' && isCancelled(item.reason))) {
        throw [live, test].find(item => item.status === 'rejected' && isCancelled(item.reason))?.reason || Object.assign(new Error('請求已取消。'), { code: 'CANCELLED' })
      }
      if (live.status === 'rejected' && test.status === 'rejected') {
        throw new Error(`場所資料暫時無法取得：${live.reason?.message || '正式場所失敗'}；${test.reason?.message || '場所情境失敗'}`)
      }
      // test 清單同樣依查詢中心與半徑計算直線距離並裁切，與正式清單一致。
      const livePlaces = live.status === 'fulfilled' ? live.value.data.places : []
      const testPlaces = test.status === 'fulfilled' ? filterPlaces(test.value.data.places, query) : []
      const aliasIds = livePlaces.length ? unresolvedLiveIds(livePlaces, testPlaces) : []
      const aliases = aliasIds.length ? await resolveAliases(aliasIds, signal) : new Map()
      return {
        data: { places: mergePlaces(livePlaces, testPlaces, scenario, aliases) },
        meta: {
          scenario, partial: live.status === 'rejected' ? 'live' : test.status === 'rejected' ? 'test' : null,
          liveError: live.status === 'rejected' ? live.reason?.message || '' : '', testError: test.status === 'rejected' ? test.reason?.message || '' : '',
          liveMeta: live.status === 'fulfilled' ? live.value.meta : null, testMeta: test.status === 'fulfilled' ? test.value.meta : null,
        },
      }
    },
    // 詳情依清單記下的來源與情境讀取：merged 兩邊都查並重驗身份；舊的字串 id 視為正式場所。
    async getPlace(target, { signal } = {}) {
      const ref = typeof target === 'string' ? refOf('live', target, null, null) : target
      if (ref?.origin === 'test') {
        const result = await testApi.getPlace(ref.testId, ref.scenario, { signal })
        return { data: testOnly(result.data, ref.scenario), meta: { ...result.meta, origin: 'test', partial: null } }
      }
      if (ref?.origin === 'merged') {
        const [live, test] = await Promise.allSettled([strictLive(liveApi.getPlace(ref.liveId, { signal })), testApi.getPlace(ref.testId, ref.scenario, { signal })])
        const cancelled = [live, test].find(item => item.status === 'rejected' && isCancelled(item.reason))
        if (cancelled) throw cancelled.reason
        if (live.status === 'rejected' && test.status === 'rejected') throw new Error(`場所詳情暫時無法取得：${live.reason?.message}；${test.reason?.message}`)
        if (live.status === 'rejected') return { data: testOnly(test.value.data, ref.scenario), meta: { ...test.value.meta, origin: 'test', partial: 'live', liveError: live.reason?.message || '' } }
        if (test.status === 'rejected') return { data: liveOnly(live.value.data), meta: { ...live.value.meta, origin: 'live', partial: 'test', testError: test.reason?.message || '' } }
        // 先比對直接身份；不符時再以 canonicalId 解析 test 記下的舊別名 UUID。
        const aliases = sameIdentity(live.value.data, test.value.data) ? new Map() : await resolveAliases(livePlaceIdsOf(test.value.data).filter(id => id !== live.value.data.id), signal)
        if (!sameIdentity(live.value.data, test.value.data, aliases)) {
          return { data: liveOnly(live.value.data), meta: { ...live.value.meta, origin: 'live', partial: 'test', testError: '場所情境與正式場所身份不一致，未合併。' } }
        }
        return { data: mergeRecord(live.value.data, test.value.data, ref.scenario), meta: { ...live.value.meta, scenarioMeta: test.value.meta, origin: 'merged', partial: null } }
      }
      if (ref?.origin !== 'live' || !ref.liveId) throw new Error('場所編號不正確。')
      const result = await strictLive(liveApi.getPlace(ref.liveId, { signal }))
      return { data: liveOnly(result.data), meta: { ...result.meta, origin: 'live', partial: null } }
    },
  }
}
export const placeSources = createPlaceSources()
