import { computed, createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/mockApi.js', async importOriginal => ({ ...(await importOriginal()), mockApi: { getPlaces: vi.fn(), getPlace: vi.fn() } }))
import { MOCK_LABEL, assessMockPlace, mockApi } from '../../lib/mockApi.js'
import { DAAN_ID, DAAN_PHOTO, mockMetaFor, mockPlaceFor } from '../../lib/mockApi.fixture.js'
import { DEFAULT_PREFERENCES } from '../../lib/sensoryDomain.js'
import PlaceCard from './PlaceCard.vue'
import MockPhoto from './MockPhoto.vue'
import MockBanner from './MockBanner.vue'
import MockPlaceDetail from './MockPlaceDetail.vue'
import QuietProfile from './QuietProfile.vue'

afterEach(() => vi.clearAllMocks())
const render = (component, props) => renderToString(createSSRApp(component, props))
const card = overrides => { const place = { ...mockPlaceFor(overrides), mock: true, distanceM: 120 }; return { ...place, mockAssessment: assessMockPlace(place) } }
function cityFor({ remote = true, scenario = 'weekday_day' } = {}) {
  const preferences = ref({ ...DEFAULT_PREFERENCES, sensitivities: { noise: 3, light: 3, crowd: 3, odor: 3 }, dataMode: remote ? 'remote-mock' : 'live', scenario })
  return { preferences, remoteMock: computed(() => preferences.value.dataMode === 'remote-mock'), writesEnabled: computed(() => preferences.value.dataMode !== 'remote-mock'), center: ref({ lat: 25.0333, lng: 121.5358 }) }
}

describe('mock place card', () => {
  it('shows synthetic light, crowd and odor separately from the estimated sound level', async () => {
    const html = await render(PlaceCard, { place: card() })
    expect(html).toContain('推估 48 dB(A)')
    expect(html).toContain('合成安靜度 70')
    expect(html).toContain('合成分數・非即時')
    expect(html).toContain('情境中開放')
    expect(html).not.toMatch(/SSI|適配|觀測時間|分鐘前/)
  })
  it('keeps closed and unknown places visible without a score, and shows null as unknown', async () => {
    const closed = await render(PlaceCard, { place: card({ openStatus: 'closed' }) })
    expect(closed).toContain('情境中休館')
    expect(closed).toContain('unavailable')
    expect(closed).not.toContain('合成安靜度')
    const unknown = await render(PlaceCard, { place: card({ openStatus: 'unknown', senses: { noise: null, light: null, crowd: null, odor: null }, sound: { value: null, unit: 'dB(A)', low: null, high: null } }) })
    expect(unknown).toContain('開放狀態未知')
    expect(unknown.match(/未知/g).length).toBeGreaterThanOrEqual(4)
  })
  it('shows the estimated interval for partly open places', async () => {
    expect(await render(PlaceCard, { place: card({ openStatus: 'partial', estimatedInterval: '19:00–20:00' }) })).toContain('部分時段開放 19:00–20:00')
  })
})

describe('mock photos', () => {
  it('loads the whitelisted photo from the API origin with anonymous CORS, no referrer and lazy loading', async () => {
    const html = await render(MockPhoto, { place: mockPlaceFor({ id: DAAN_ID, photo: DAAN_PHOTO }), large: true })
    expect(html).toContain(`src="https://30wbackend.idfc.dev/api/v1/test/mock/places/${DAAN_ID}/photo"`)
    expect(html).toContain('crossorigin="anonymous"')
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('歷史照片・2010・非即時')
    expect(html).toContain('玄史生')
    expect(html).toContain('href="https://creativecommons.org/licenses/by-sa/3.0/"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('不代表推估的子區域或目前狀況')
  })
  it('falls back to the illustration for places without a photo or with an unexpected photo path', async () => {
    for (const photo of [null, { ...DAAN_PHOTO, url: 'https://evil.example/photo.jpg' }]) {
      const html = await render(MockPhoto, { place: mockPlaceFor({ id: DAAN_ID, photo }), large: true })
      expect(html).not.toContain('<img')
      expect(html).toContain('示意插畫・非實景')
    }
  })
})

describe('mock banner and settings', () => {
  it('shows the persistent synthetic label only in remote-mock mode', async () => {
    expect(await render(MockBanner, { city: cityFor({ scenario: 'weekend_day' }) })).toContain(`週末白天`)
    expect(await render(MockBanner, { city: cityFor() })).toContain(MOCK_LABEL)
    expect(await render(MockBanner, { city: cityFor({ remote: false }) })).not.toContain(MOCK_LABEL)
  })
  it('offers an explicit live / test switch and the three scenarios', async () => {
    const remote = await render(QuietProfile, { city: cityFor() })
    expect(remote).toContain('使用測試情境')
    for (const label of ['平日白天', '平日晚上', '週末白天']) expect(remote).toContain(label)
    const live = await render(QuietProfile, { city: cityFor({ remote: false }) })
    expect(live).toContain('目前顯示正式資料')
    expect(live).not.toContain('<select')
  })
})

describe('mock place detail', () => {
  it('loads the same UUID with the scenario and labels every value as synthetic', async () => {
    mockApi.getPlace.mockResolvedValue({ data: mockPlaceFor({ id: DAAN_ID, name: '大安森林公園', photo: DAAN_PHOTO, openStatus: 'partial', estimatedInterval: '19:00–20:00' }, 'weekday_evening'), meta: mockMetaFor('weekday_evening') })
    const html = await render(MockPlaceDetail, { id: DAAN_ID, city: cityFor({ scenario: 'weekday_evening' }) })
    expect(mockApi.getPlace).toHaveBeenCalledWith(DAAN_ID, { scenario: 'weekday_evening' }, expect.objectContaining({ signal: expect.any(Object) }))
    expect(html).toContain('平日晚上')
    expect(html).toContain(MOCK_LABEL)
    expect(html).toContain('情境中部分時段開放')
    expect(html).toContain('19:00–20:00')
    expect(html).toMatch(/聲音推估 <b[^>]*>48 dB\(A\)/)
    expect(html).toContain('人工容許帶 41–55')
    expect(html).toContain('設施代表點，非實測點或入口')
    expect(html).toContain('臺北市公園基本資料')
    expect(html).not.toMatch(/觀測時間|分鐘前|SSI/)
  })
  it('shows a mock API error with retry instead of built-in mock data', async () => {
    mockApi.getPlace.mockRejectedValue(new Error('測試資料未啟用或查無此場所（404）。'))
    const html = await render(MockPlaceDetail, { id: DAAN_ID, city: cityFor() })
    expect(html).toContain('（404）')
    expect(html).not.toContain('大安森林公園')
  })
})
