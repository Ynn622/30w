// 測試用 hourly 模擬網格回應樣本：欄位形狀取自後端 test/mock/hourly（2026-11-08 查核），內容精簡。
export const SIMULATED_AT = '2026-11-07T19:00:26.660Z'

export function hourlyMetaFor({ dayType = 'weekday', hour = 8, simulatedAt = SIMULATED_AT } = {}) {
  return {
    mock: true, demo: true, mode: 'test-only', datasetVersion: 'taipei-hourly-grid-v1', storage: 'precomputed',
    dayType, hour, timezone: 'Asia/Taipei', recordsPerHour: 30000, observedAt: null, updatedAt: null, confidence: 'low',
    simulatedAt, validUntil: new Date(Date.parse(simulatedAt) + 30 * 60_000).toISOString(), timeBasis: 'simulated_request_time',
    notice: '人工逐小時網格情境；非即時、非實測。',
    sources: [
      { id: 'boundary', name: '臺北市區界圖 20220915', url: 'https://data.taipei/', attribution: '臺北市政府民政局', licenseUrl: 'https://data.gov.tw/license' },
      { id: 'curated-v2' },
    ],
  }
}

export function hourlyPointFor(overrides = {}, simulatedAt = SIMULATED_AT) {
  return {
    id: 'tg07270', location: { lat: 25.0336, lng: 121.5363 }, district: '大安區', environment: 'street_outdoor',
    coordinateKind: 'synthetic_grid_center', accessStatus: 'not_assessed',
    senses: { noise: 20, light: 20, crowd: 20, odor: 20 }, sound: { value: 52, unit: 'dB(A)', low: 45, high: 59 },
    quality: 'estimated', observedAt: simulatedAt, updatedAt: simulatedAt,
    validUntil: new Date(Date.parse(simulatedAt) + 30 * 60_000).toISOString(), confidence: 'low', sensoryIndex: null, reportCount: null,
    ...overrides,
  }
}

// 大安區附近三點＋一個資料不足的網格＋一個遠方網格（天母）。
export function hourlyPointsFor() {
  return [
    hourlyPointFor(),
    hourlyPointFor({ id: 'tg07271', location: { lat: 25.0345, lng: 121.5363 }, senses: { noise: 80, light: 70, crowd: 75, odor: 60 } }),
    hourlyPointFor({ id: 'tg07272', location: { lat: 25.0336, lng: 121.5373 } }),
    hourlyPointFor({ id: 'tg07273', location: { lat: 25.0327, lng: 121.5363 }, quality: 'insufficient', senses: { noise: null, light: null, crowd: null, odor: null }, sound: { value: null, unit: 'dB(A)', low: null, high: null } }),
    hourlyPointFor({ id: 'tg19999', location: { lat: 25.1145, lng: 121.5352 }, district: '士林區' }),
  ]
}

export function hourlyPayloadFor(slot = {}, points = hourlyPointsFor(), page = {}) {
  return {
    data: { points, total: page.total ?? points.length, limit: 30000, offset: page.offset ?? 0, nextOffset: page.nextOffset ?? null },
    meta: hourlyMetaFor(slot),
  }
}
