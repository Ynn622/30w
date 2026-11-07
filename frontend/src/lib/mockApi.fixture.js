// 測試用 Mock API 回應樣本：欄位形狀取自後端 test/mock/places（2026-11-07 查核），內容精簡。
export const DAAN_ID = '147df5ff-68a7-530b-b9d2-8355bf25f71e'
export const PLAIN_ID = '00787b3c-adcc-53c2-b123-d12cf328b051'
export const CLOSED_ID = '11111111-2222-5333-8444-555555555555'
export const UNKNOWN_ID = '66666666-7777-5888-9999-aaaaaaaaaaaa'

export function mockMetaFor(scenario = 'weekday_day') {
  return {
    mock: true, demo: true, mode: 'test-only', datasetVersion: 'taipei-sensory-mock-v1', scenario,
    observedAt: null, updatedAt: null, mapping: { version: 'mock-band-normal-v1' },
    notice: '人工情境推估與合成分數，非即時觀測。',
    sources: [{ id: 'park-basic', name: '臺北市公園基本資料', url: 'https://data.taipei/', attribution: '臺北市政府工務局公園路燈工程管理處', licenseUrl: 'https://data.gov.tw/license', limitations: '僅提供位置' }],
  }
}

export function mockPlaceFor(overrides = {}, scenario = 'weekday_day') {
  return {
    id: PLAIN_ID, name: '陽明公園', district: '北投區', category: '公園', artwork: 'park', indoor: false,
    location: { lat: 25.0333, lng: 121.5358 }, address: '臺北市北投區', sampleLocation: '園內步行區',
    coordinateKind: 'facility_reference_point', senses: { noise: null, light: 40, crowd: 30, odor: 20 },
    sound: { value: 48, unit: 'dB(A)', low: 41, high: 55, status: 'estimated' },
    scenario, openStatus: 'open', estimatedInterval: '14:00–16:00', season: '秋季', assumptions: '一般週三', accessNote: '僅為典型情境',
    uncertainty: '低信心情境推估', observedAt: null, updatedAt: null, confidence: 'low', reportCount: null, sensoryIndex: null, photo: null,
    ...overrides,
  }
}

export const DAAN_PHOTO = {
  id: 'daan-forest-park', author: '玄史生', credit: 'Own work', license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Daan_Park_Ecological_Pool_West_Zone.jpg',
  capturedAt: '2010-02-28', url: `/api/v1/test/mock/places/${DAAN_ID}/photo`, alt: '大安森林公園歷史實景照片（非即時）', changes: 'Wikimedia 縮圖',
}

export function mockPlacesFor(scenario = 'weekday_day') {
  return [
    mockPlaceFor({ id: DAAN_ID, name: '大安森林公園', district: '大安區', photo: DAAN_PHOTO, senses: { noise: null, light: 44, crowd: 33, odor: 31 } }, scenario),
    mockPlaceFor({}, scenario),
    mockPlaceFor({ id: CLOSED_ID, name: '情境休館館舍', artwork: 'library', indoor: true, openStatus: 'closed', senses: { noise: null, light: 5, crowd: 5, odor: 5 }, location: { lat: 25.0336, lng: 121.5361 } }, scenario),
    mockPlaceFor({ id: UNKNOWN_ID, name: '未知狀態場所', openStatus: 'unknown', senses: { noise: null, light: null, crowd: null, odor: null }, sound: { value: null, unit: 'dB(A)', low: null, high: null, status: 'unknown' } }, scenario),
  ]
}

export function mockPayloadFor(scenario = 'weekday_day', places = mockPlacesFor(scenario)) {
  return {
    data: {
      places,
      map: { type: 'FeatureCollection', features: places.map(place => ({ type: 'Feature', id: place.id, geometry: { type: 'Point', coordinates: [place.location.lng, place.location.lat] }, properties: { id: place.id } })) },
    },
    meta: mockMetaFor(scenario),
  }
}
