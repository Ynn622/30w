// 測試用場所雙來源樣本：欄位形狀取自後端 places 與 test/places（2026-11-08 查核），內容精簡。
export function testMetaFor(scenario = 'weekday_day') {
  return { test: true, demo: true, mode: 'test-only', datasetVersion: 'taipei-places-test-v1', scenario, timeBasis: 'typical_scenario', timezone: 'Asia/Taipei', observedAt: null, updatedAt: null }
}
export function testPlaceFor(overrides = {}, scenario = 'weekday_day') {
  return {
    id: 'p-1', name: '天福綠地', category: '公園', artwork: 'park', location: { lat: 25.11675, lng: 121.53255 }, indoor: null, address: '天母東路22巷23號對面',
    sourceIdentities: [{ sourceId: 'taipei-parks', sourceKey: 'upstream:60' }], livePlaceIds: ['p-1'],
    senses: { noise: 42, light: 0, crowd: 35, odor: null }, sound: { value: 57, low: 50, high: 64, unit: 'dB(A)' }, confidence: 'low',
    sensoryIndex: null, observedAt: null, updatedAt: null, reportCount: null, measurementCount: null, tag: '場所情境測試', image: null, photo: null,
    testData: { datasetVersion: 'taipei-places-test-v1', scenario, timeBasis: 'typical_scenario', startTime: '14:00', endTime: '16:00' },
    ...overrides,
  }
}
export function livePlaceFor(overrides = {}) {
  return {
    id: 'p-1', name: '天福綠地', category: '公園', location: { lat: 25.11675, lng: 121.53255 }, address: '天母東路22巷23號對面', hours: '全天開放',
    sourceIdentities: [{ sourceId: 'taipei-parks', sourceKey: 'upstream:60' }],
    senses: { noise: null, light: null, crowd: null, odor: null }, confidence: 'insufficient', updatedAt: '2026-11-07T20:56:30.703Z',
    image: { kind: 'nearby', url: '/api/v1/places/p-1/image?v=abc' }, sources: [{ name: '臺北市公園基本資料' }],
    ...overrides,
  }
}
