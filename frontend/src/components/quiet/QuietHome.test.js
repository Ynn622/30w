import { computed, createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import QuietHome from './QuietHome.vue'
import PlaceCard from './PlaceCard.vue'
import { mockMeta, mockOverview, mockPlaces } from '../../data/quietMock.js'
import { assessSensory } from '../../lib/sensoryIndex.js'
import { DEFAULT_PREFERENCES, MOCK_LABEL } from '../../lib/sensoryDomain.js'
import SenseInfoDialog from './SenseInfoDialog.vue'
// 首頁以目前時間判斷新鮮度，模擬資料也以目前時間產生。
const NOW = Date.now()
const sampleOverview = () => mockOverview('zhongzheng', NOW)
const samplePlaces = () => mockPlaces('zhongzheng', NOW).slice(0, 3)
function cityFor(data, places = [], meta = mockMeta(NOW), status = 'ready') {
  return { areaId: ref(status === 'ready' ? 'zhongzheng' : null), area: ref(status === 'ready' ? { id: 'zhongzheng', name: '中正區' } : null),
    locationStatus: ref(status), locationError: ref(''), serviceAvailable: ref(status === 'ready'),
    locating: ref(false), deviceLocation: ref(null), locate: () => {},
    preferences: ref({ ...DEFAULT_PREFERENCES }), assess: record => assessSensory(record, undefined, NOW),
    recommendations: computed(() => places.map(place => ({ ...place, assessment: assessSensory(place, undefined, NOW) }))),
    overview: { data: ref(data), meta: ref(meta), state: ref('ready'), error: ref(''), reload: () => {} },
    places: { data: ref({ places }), meta: ref(meta), state: ref('ready'), error: ref(''), reload: () => {} },
  }
}
describe('home sensory presentation', () => {
  it('renders the product and labels mock data only when the fallback is active', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview()) }))
    expect(html).toContain('城市靜音鍵')
    expect(html).toContain('舒適偏吵')
    expect(html).toContain('模擬：')
    expect(html).not.toContain('示範')
    const live = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview(), [], { updatedAt: new Date(NOW).toISOString(), sources: [] }) }))
    expect(live).not.toContain('模擬：')
    expect(live).toContain('更新：')
    expect(html).toContain('城市靜音鍵標誌')
    // 區域只依目前定位決定，不提供手動選單。
    expect(html).toMatch(/臺北市・中正區/)
    expect(html).toContain('目前位置')
    expect(html).toContain('重新定位')
    expect(html).not.toContain('<select')
    // 「附近的安靜角落」暫時隱藏。
    expect(html).not.toContain('附近的安靜角落')
    expect(html).not.toContain('循環杯')
    expect(html).not.toContain('帳務')
  })
  it('shows only the four sense tiles as buttons, without AQI, report counts, SSI chip or weather', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview(), samplePlaces()) }))
    expect(html).toContain('氣味')
    expect((html.match(/<button[^>]*class="[^"]*sense-tile/g) || []).length).toBe(4)
    expect(html).toContain('查看資料來源與計算方式')
    for (const removed of ['空氣品質', 'AQI', '筆回報', 'SSI', '適配', '降雨', '°C']) expect(html).not.toContain(removed)
  })
  it.each([
    { reportCount: 0, measurementCount: 0 },
    { observedAt: '2026-11-06T10:30:00+08:00' },
    { confidence: 'insufficient' },
  ])('does not describe insufficient or stale data as comfortable: %j', async changes => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor({ ...sampleOverview(), ...changes }) }))
    expect(html).toContain('資料不足，暫無法判斷')
    expect(html).not.toContain('舒適偏吵')
    expect(html).toContain('未知')
  })
})
describe('place card index honesty', () => {
  it('shows legacy readings without inventing an SSI', async () => {
    const { sensoryIndex, ...legacy } = samplePlaces()[0]
    const html = await renderToString(createSSRApp(PlaceCard, { place: { ...legacy, assessment: assessSensory(legacy, undefined, NOW) } }))
    expect(html).toContain('尚無版本化指數')
    expect(html).not.toContain('SSI')
  })
})
describe('location-only service', () => {
  it('shows that the service is unavailable outside Taipei and hides the sensory content', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview(), [], mockMeta(NOW), 'outside') }))
    expect(html).toContain('此區域非台北市內，無法提供服務')
    expect(html).toContain('重新定位')
    expect(html).not.toContain('今日感官天氣')
    expect(html).not.toContain('快速回報')
  })
  it('asks for the current location before showing anything', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(null, [], null, 'idle') }))
    expect(html).toContain('需要使用目前位置')
    expect(html).toContain('使用目前位置')
    expect(html).not.toContain('今日感官天氣')
  })
})
describe('sense info dialog', () => {
  async function renderDialog(props) {
    const context = {}
    await renderToString(createSSRApp(SenseInfoDialog, { city: cityFor(sampleOverview()), ...props }), context)
    return context.teleports.body
  }
  it('explains the value, calculation and mock source for a dimension', async () => {
    const html = await renderDialog({ senseKey: 'noise', value: 72, described: true })
    expect(html).toContain('聲音資料說明')
    expect(html).toContain('刺激指數 72／100')
    expect(html).toContain('0–33 低')
    expect(html).toContain('不是分貝')
    expect(html).toContain('40%')
    expect(html).toContain('城市靜音鍵模擬資料')
    expect(html).toContain(MOCK_LABEL)
  })
  it('says why a dimension is unknown instead of treating it as quiet', async () => {
    const html = await renderDialog({ senseKey: 'odor', value: null, described: true })
    expect(html).toContain('未知')
    expect(html).toContain('近 30 分鐘沒有這一項的回報')
    expect(html).toContain('AQI 不能代替氣味')
  })
})
