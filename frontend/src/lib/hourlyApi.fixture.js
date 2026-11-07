// 測試用 hourly 網格回應樣本：欄位形狀取自後端 test/hourly（2026-11-08 #8 切換後查核），內容精簡。
export const SIMULATED_AT = '2026-11-07T19:00:26.660Z'

export function hourlyMetaFor({ dayType = 'weekday', hour = 8, simulatedAt = SIMULATED_AT } = {}) {
  return {
    test: true, demo: true, mode: 'test-only', datasetVersion: 'taipei-hourly-grid-v2', modelVersion: 'taipei-hourly-grid-v1', storage: 'precomputed',
    dayType, hour, timezone: 'Asia/Taipei', recordsPerHour: 30000, observedAt: null, updatedAt: null, confidence: 'low',
    simulatedAt, validUntil: new Date(Date.parse(simulatedAt) + 30 * 60_000).toISOString(), timeBasis: 'simulated_request_time',
    noiseMapping: { version: 'test-noise-demo-v1', thresholds: [50, 60, 70], unit: 'dB(A)' },
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

// 首頁 150 公尺測試平均（GET test/overview）。
export function hourlyOverviewFor({ dayType = 'weekend', hour = 3, senses = { noise: 26.6, light: 23.7, crowd: 11.4, odor: 12.4 }, pointCount = 9, validPointCounts = { noise: 8, light: 7, crowd: 7, odor: 8 }, missingReason = null } = {}) {
  const allNull = Object.values(senses).every(value => value === null)
  const meta = { ...hourlyMetaFor({ dayType, hour }), aggregationVersion: 'hourly-radius-mean-v1', aggregation: { method: 'arithmetic_mean', radiusMeters: 150 } }
  return {
    data: {
      location: { lat: 25.0333, lng: 121.5358 }, radiusMeters: 150, dayType, hour, timezone: 'Asia/Taipei', senses, pointCount, validPointCounts,
      confidence: allNull ? 'insufficient' : 'low', headline: '附近150公尺感官模擬平均', description: '所選典型時段的網格推估平均，非即時觀測。',
      observedAt: null, updatedAt: null, simulatedAt: meta.simulatedAt, validUntil: meta.validUntil,
      reportCount: null, measurementCount: null, sensoryIndex: null, missingReason: allNull ? (missingReason || 'no_points_within_radius') : null,
    },
    meta,
  }
}
