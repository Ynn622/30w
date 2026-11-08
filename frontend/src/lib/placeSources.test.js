import { describe, expect, it, vi } from 'vitest'
import { createPlaceSources, mergePlaces } from './placeSources.js'
import { assessSensory } from './sensoryIndex.js'
import { livePlaceFor, testMetaFor, testPlaceFor } from './placeSources.fixture.js'

const QUERY = { areaId: 'shilin', lat: 25.1161, lng: 121.5349, radius: 2000, max: 100 }
const liveApi = (places = [livePlaceFor()], extra = {}) => ({ supportsFreeRadius: true, getPlaces: vi.fn(async () => ({ data: { places }, meta: {} })), getPlace: vi.fn(async id => ({ data: livePlaceFor({ id }), meta: {} })), ...extra })
const testApi = (places = [testPlaceFor()], extra = {}) => ({ getPlaces: vi.fn(async () => ({ data: { places }, meta: testMetaFor() })), getPlace: vi.fn(async (id, scenario) => ({ data: testPlaceFor({ id }, scenario), meta: testMetaFor(scenario) })), ...extra })
const REF = { origin: 'merged', liveId: 'p-1', testId: 'p-1', scenario: 'weekday_day' }

describe('merging live places with test scenarios (issue #7)', () => {
  it('merges an explicit one-to-one match: live facts and photo, test senses', () => {
    const [place] = mergePlaces([livePlaceFor({ tag: '感官資料不足' })], [testPlaceFor()], 'weekday_day')
    expect(place).toMatchObject({ origin: 'merged', id: 'p-1', hours: '全天開放', image: { kind: 'nearby' }, senses: { noise: 42, light: 0, odor: null }, updatedAt: null })
    expect(place.ref).toEqual(REF)
    // 正式的「感官資料不足」描述正式感官，合併後不再成立；其他正式標籤保留。
    expect(place.tag).toBeNull()
    expect(mergePlaces([livePlaceFor({ tag: '樹蔭' })], [testPlaceFor()], 'weekday_day')[0].tag).toBe('樹蔭')
  })
  it('matches by livePlaceIds or shared source identity, never by name or distance', () => {
    const byLiveIds = mergePlaces([livePlaceFor({ id: 'live-9', sourceIdentities: [] })], [testPlaceFor({ id: 'test-9', livePlaceIds: ['live-9'], sourceIdentities: [] })], 'weekday_day')
    expect(byLiveIds.map(place => place.origin)).toEqual(['merged'])
    const byIdentity = mergePlaces([livePlaceFor({ id: 'live-9' })], [testPlaceFor({ id: 'test-9', livePlaceIds: [] })], 'weekday_day')
    expect(byIdentity.map(place => place.origin)).toEqual(['merged'])
    const sameNameOnly = mergePlaces([livePlaceFor({ id: 'live-9', sourceIdentities: [] })], [testPlaceFor({ id: 'test-9', livePlaceIds: [], sourceIdentities: [] })], 'weekday_day')
    expect(sameNameOnly.map(place => place.origin).sort()).toEqual(['live', 'test'])
  })
  it('keeps test-only and live-only places, and gives each a source-qualified render key', () => {
    const places = mergePlaces([livePlaceFor(), livePlaceFor({ id: 'live-only', sourceIdentities: [] })], [testPlaceFor(), testPlaceFor({ id: 'test-only', livePlaceIds: [], sourceIdentities: [] })], 'weekend_day')
    expect(places.map(place => place.renderKey).sort()).toEqual(['live:live-only', 'merged:p-1:p-1', 'test:test-only'])
    expect(places.find(place => place.origin === 'test')).toMatchObject({ image: null, ref: { origin: 'test', liveId: null, testId: 'test-only', scenario: 'weekend_day' } })
    expect(places.find(place => place.origin === 'live').ref).toEqual({ origin: 'live', liveId: 'live-only', testId: null, scenario: null })
  })
  it('does not pick one when a test place has several live candidates or two test places claim one live place', () => {
    const twoLive = mergePlaces([livePlaceFor({ id: 'a' }), livePlaceFor({ id: 'b' })], [testPlaceFor({ id: 't', livePlaceIds: [] })], 'weekday_day')
    expect(twoLive.map(place => place.origin).sort()).toEqual(['live', 'live', 'test'])
    const twoTest = mergePlaces([livePlaceFor({ id: 'a' })], [testPlaceFor({ id: 't1', livePlaceIds: [] }), testPlaceFor({ id: 't2', livePlaceIds: [] })], 'weekday_day')
    expect(twoTest.map(place => place.origin).sort()).toEqual(['live', 'test', 'test'])
    expect(new Set(twoTest.map(place => place.renderKey)).size).toBe(3)
  })
  it('scores validated scenario records as live data with SSI and SFS, keeping 0 and null as given', () => {
    const [place] = mergePlaces([livePlaceFor()], [testPlaceFor()], 'weekday_day')
    const assessment = assessSensory(place)
    expect(assessment).toMatchObject({ basis: 'typical_scenario', confidence: 'low', dimensions: { noise: 42, light: 0, crowd: 35, odor: null } })
    // SSI 固定權重 0.4／0.2／0.3（氣味缺值不計）：(42×0.4 + 0×0.2 + 35×0.3) ÷ 0.9 ≈ 30。
    expect(assessment.ssi).toBe(30)
    expect(assessment.coverage).toBe(0.9)
    expect(assessment.sfs).not.toBeNull()
    // 沒有 testData 的正式紀錄仍需新鮮觀測，不會因此算出分數。
    expect(assessSensory(livePlaceFor({ senses: { noise: 42, light: 0, crowd: 35, odor: 10 }, confidence: 'low', updatedAt: null })).sfs).toBeNull()
  })
})

describe('dual-source place requests (issue #7)', () => {
  it('requests both sources in parallel with the same query and only the test side gets the scenario', async () => {
    const live = liveApi(), test = testApi()
    const result = await createPlaceSources({ liveApi: live, testApi: test }).getPlaces({ ...QUERY, scenario: 'weekday_day' })
    expect(live.getPlaces).toHaveBeenCalledWith(QUERY, { signal: undefined })
    expect(test.getPlaces).toHaveBeenCalledWith({ ...QUERY, scenario: 'weekday_day' }, { signal: undefined })
    expect(result.meta).toMatchObject({ scenario: 'weekday_day', partial: null })
    expect(result.data.places.map(place => place.origin)).toEqual(['merged'])
  })
  it('marks a partial result when one source fails and errors only when both fail', async () => {
    const failing = { getPlaces: vi.fn(async () => { throw new Error('HTTP 503') }) }
    const testDown = await createPlaceSources({ liveApi: liveApi(), testApi: failing }).getPlaces({ ...QUERY, scenario: 'weekday_day' })
    expect(testDown.meta).toMatchObject({ partial: 'test', testError: 'HTTP 503' })
    expect(testDown.data.places.map(place => place.origin)).toEqual(['live'])
    const liveDown = await createPlaceSources({ liveApi: { getPlaces: failing.getPlaces }, testApi: testApi() }).getPlaces({ ...QUERY, scenario: 'weekday_day' })
    expect(liveDown.meta.partial).toBe('live')
    expect(liveDown.data.places.map(place => place.origin)).toEqual(['test'])
    await expect(createPlaceSources({ liveApi: { getPlaces: failing.getPlaces }, testApi: failing }).getPlaces({ ...QUERY, scenario: 'weekday_day' })).rejects.toThrow('場所資料暫時無法取得')
  })
  it('treats the built-in fictional fallback of the live API as a failure', async () => {
    const fallback = liveApi([], { getPlaces: vi.fn(async () => ({ data: { places: [livePlaceFor({ id: 'fiction' })] }, meta: { mock: true, fallbackReason: 'HTTP 404' } })) })
    const result = await createPlaceSources({ liveApi: fallback, testApi: testApi() }).getPlaces({ ...QUERY, scenario: 'weekday_day' })
    expect(result.meta.partial).toBe('live')
    expect(result.data.places.some(place => place.id === 'fiction')).toBe(false)
  })
  it('passes cancellation through instead of reporting a partial result', async () => {
    const cancelled = Object.assign(new Error('請求已取消。'), { code: 'CANCELLED' })
    const live = liveApi([], { getPlaces: vi.fn(async () => { throw cancelled }) })
    await expect(createPlaceSources({ liveApi: live, testApi: testApi() }).getPlaces({ ...QUERY, scenario: 'weekday_day' })).rejects.toBe(cancelled)
  })
})

describe('dual-source place details (issue #7)', () => {
  it('opens each origin from its own source with the stored scenario', async () => {
    const live = liveApi(), test = testApi(), sources = createPlaceSources({ liveApi: live, testApi: test })
    const onlyTest = await sources.getPlace({ origin: 'test', liveId: null, testId: 't-1', scenario: 'weekend_day' })
    expect(test.getPlace).toHaveBeenCalledWith('t-1', 'weekend_day', { signal: undefined })
    expect(live.getPlace).not.toHaveBeenCalled()
    expect(onlyTest.data).toMatchObject({ origin: 'test', image: null })
    const legacy = await sources.getPlace('p-9')
    expect(live.getPlace).toHaveBeenCalledWith('p-9', { signal: undefined })
    expect(legacy.data.origin).toBe('live')
  })
  it('re-verifies identity for merged details and falls back to a marked partial', async () => {
    const merged = await createPlaceSources({ liveApi: liveApi(), testApi: testApi() }).getPlace(REF)
    expect(merged).toMatchObject({ data: { origin: 'merged', senses: { noise: 42 } }, meta: { partial: null } })
    // test 詳情指向無關場所（不同 id、沒有共同身份）時不合併，只顯示正式場所並標示部分資料。
    const unrelatedTest = testApi([], { getPlace: vi.fn(async () => ({ data: testPlaceFor({ id: 't-2', livePlaceIds: [], sourceIdentities: [] }), meta: testMetaFor() })) })
    const unrelated = await createPlaceSources({ liveApi: liveApi(), testApi: unrelatedTest }).getPlace({ ...REF, testId: 't-2' })
    expect(unrelated).toMatchObject({ data: { origin: 'live' }, meta: { partial: 'test' } })
    const testDown = await createPlaceSources({ liveApi: liveApi(), testApi: testApi([], { getPlace: vi.fn(async () => { throw new Error('HTTP 503') }) }) }).getPlace(REF)
    expect(testDown).toMatchObject({ data: { origin: 'live' }, meta: { partial: 'test', testError: 'HTTP 503' } })
    const liveDown = await createPlaceSources({ liveApi: liveApi([], { getPlace: vi.fn(async () => { throw new Error('HTTP 502') }) }), testApi: testApi() }).getPlace(REF)
    expect(liveDown).toMatchObject({ data: { origin: 'test', image: null }, meta: { partial: 'live' } })
  })
})

describe('legacy alias UUIDs in livePlaceIds (issue #7)', () => {
  // test 記下的是查核當時的 UUID（舊別名），正式清單已排重成主 id；正式詳情對舊別名回傳 canonicalId。
  const live = () => liveApi([livePlaceFor({ id: 'canon', sourceIdentities: [] })], {
    getPlace: vi.fn(async id => id === 'alias' ? { data: livePlaceFor({ id: 'alias', canonicalId: 'canon', sourceIdentities: [] }), meta: {} } : { data: livePlaceFor({ id, sourceIdentities: [] }), meta: {} }),
  })
  const aliasTest = () => testPlaceFor({ id: 't-alias', livePlaceIds: ['alias'], sourceIdentities: [] })

  it('resolves an alias through canonicalId and merges instead of listing the place twice', async () => {
    const liveSide = live()
    const result = await createPlaceSources({ liveApi: liveSide, testApi: testApi([aliasTest()]) }).getPlaces({ ...QUERY, scenario: 'weekday_day' })
    expect(liveSide.getPlace).toHaveBeenCalledWith('alias', { signal: undefined })
    expect(result.data.places.map(place => place.renderKey)).toEqual(['merged:canon:t-alias'])
  })
  it('does not look up aliases for places that already matched, and keeps them apart when lookup fails', async () => {
    const liveSide = liveApi()
    await createPlaceSources({ liveApi: liveSide, testApi: testApi() }).getPlaces({ ...QUERY, scenario: 'weekday_day' })
    expect(liveSide.getPlace).not.toHaveBeenCalled()
    const failing = live()
    failing.getPlace.mockRejectedValue(new Error('HTTP 404'))
    const result = await createPlaceSources({ liveApi: failing, testApi: testApi([aliasTest()]) }).getPlaces({ ...QUERY, scenario: 'weekday_day' })
    expect(result.data.places.map(place => place.origin).sort()).toEqual(['live', 'test'])
  })
  it('re-verifies a merged detail through the same alias resolution', async () => {
    const liveSide = live()
    const detailTest = testApi([], { getPlace: vi.fn(async () => ({ data: aliasTest(), meta: testMetaFor() })) })
    const result = await createPlaceSources({ liveApi: liveSide, testApi: detailTest }).getPlace({ origin: 'merged', liveId: 'canon', testId: 't-alias', scenario: 'weekday_day' })
    expect(result).toMatchObject({ data: { origin: 'merged', id: 'canon' }, meta: { partial: null } })
  })
})
