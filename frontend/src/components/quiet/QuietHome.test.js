import { computed, createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import QuietHome from './QuietHome.vue'
import PlaceCard from './PlaceCard.vue'
import { mockMeta, mockOverview, mockPlaces } from '../../data/quietMock.js'
import { assessSensory } from '../../lib/sensoryIndex.js'
import { DEFAULT_PREFERENCES } from '../../lib/sensoryDomain.js'
import SenseInfoDialog from './SenseInfoDialog.vue'
import OverviewInfoDialog from './OverviewInfoDialog.vue'
// 首頁以目前時間判斷新鮮度，模擬資料也以目前時間產生。
const NOW = Date.now()
const sampleOverview = () => mockOverview('zhongzheng', NOW)
const samplePlaces = () => mockPlaces('zhongzheng', NOW).slice(0, 3)
function cityFor(data, places = [], meta = mockMeta(NOW), status = 'ready') {
  return { areaId: ref(status === 'ready' ? 'zhongzheng' : null), area: ref(status === 'ready' ? { id: 'zhongzheng', name: '中正區' } : null),
    locationStatus: ref(status), locationError: ref(''), serviceAvailable: ref(status === 'ready'),
    locating: ref(false), deviceLocation: ref(null), locate: () => {},
    remoteMock: ref(false), writesEnabled: ref(true),
    preferences: ref({ ...DEFAULT_PREFERENCES }), assess: record => assessSensory(record, undefined, NOW),
    recommendations: computed(() => places.map(place => ({ ...place, assessment: assessSensory(place, undefined, NOW) }))),
    overview: { data: ref(data), meta: ref(meta), state: ref('ready'), error: ref(''), reload: () => {} },
    places: { data: ref({ places }), meta: ref(meta), state: ref('ready'), error: ref(''), reload: () => {} },
  }
}
describe('home sensory presentation', () => {
  it('shows the village once resolved and falls back to the district before that', async () => {
    const before = await renderToString(createSSRApp(QuietHome, { city: { ...cityFor(sampleOverview()), village: ref(null) } }))
    expect(before).toContain('中正區')
    expect(before).not.toContain('臺北市')
    const after = await renderToString(createSSRApp(QuietHome, { city: { ...cityFor(sampleOverview()), village: ref({ district: '中正區', village: '黎明里', name: '中正區黎明里' }) } }))
    expect(after).toContain('中正區・黎明里')
    expect(after).not.toContain('臺北市')
    expect(after).not.toContain('今日感官天氣')
    expect(after).toContain('sensory-weather')
    // 重新定位為地點前的圖示按鈕；資料時間移到地點列右側（在感官卡片之前）。
    expect(after).toMatch(/class="area-row"[\s\S]*aria-label="重新定位"[\s\S]*中正區・黎明里[\s\S]*模擬：[\s\S]*sensory-weather/)
  })
  it('turns the data time into a refresh button and keeps it visible while reloading', async () => {
    const ready = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview()) }))
    // 時間旁有重新整理圖示，點選是重新整理，不再開啟資料來源視窗。
    expect(ready).toMatch(/aria-label="重新整理資料（模擬資料時間[^"]*）"[^>]*>[\s\S]*模擬：[\s\S]*<\/button>/)
    const loading = { ...cityFor(sampleOverview()), overview: { ...cityFor(sampleOverview()).overview, state: ref('loading') } }
    const html = await renderToString(createSSRApp(QuietHome, { city: loading }))
    expect(html).toContain('更新中…')
    expect(html).toContain('aria-label="資料更新中"')
  })
  it('renders the product and labels mock data only when the fallback is active', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview()) }))
    expect(html).toContain('聆靜')
    expect(html).toContain('舒適偏吵')
    expect(html).toContain('模擬：')
    expect(html).not.toContain('示範')
    const live = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview(), [], { updatedAt: new Date(NOW).toISOString(), sources: [] }) }))
    expect(live).not.toContain('模擬：')
    expect(live).toContain('更新：')
    expect(html).toContain('聆靜標誌')
    // 區域只依目前定位決定，不提供手動選單。
    expect(html).toContain('中正區')
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
    expect(html).toContain('查看說明與計算方式')
    expect(html).toContain('aria-label="查看感官概況說明"')
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
  it('shows a quiet score from plain senses without inventing an SSI', async () => {
    const { sensoryIndex, ...legacy } = samplePlaces()[0]
    const html = await renderToString(createSSRApp(PlaceCard, { place: { ...legacy, assessment: assessSensory(legacy, undefined, NOW) } }))
    expect(html).toContain('安靜程度')
    expect(html).not.toContain('SSI')
    const unknown = await renderToString(createSSRApp(PlaceCard, { place: { ...legacy, assessment: assessSensory({ ...legacy, confidence: 'insufficient' }, undefined, NOW) } }))
    expect(unknown).toContain('資料不足')
  })
})
describe('location-only service', () => {
  it('shows that the service is unavailable outside Taipei and hides the sensory content', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview(), [], mockMeta(NOW), 'outside') }))
    expect(html).toContain('此區域非台北市內，無法提供服務')
    expect(html).toContain('重新定位')
    expect(html).not.toContain('sensory-weather')
    expect(html).not.toContain('快速回報')
  })
  it('disables quick reports and measurement in remote-mock mode and shows the synthetic label', async () => {
    const city = { ...cityFor(sampleOverview()), remoteMock: ref(true), writesEnabled: ref(false) }
    const html = await renderToString(createSSRApp(QuietHome, { city }))
    expect(html).toContain('人工情境推估・合成分數・非即時')
    expect(html).toContain('測試情境模式不開放回報與量測')
    expect(html.match(/<button[^>]*disabled/g).length).toBeGreaterThanOrEqual(9)
  })
  it('shows the decorative Taipei 101 illustration hidden from assistive technology', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(sampleOverview()) }))
    expect(html).toMatch(/<svg class="city-illustration taipei-101"[^>]*aria-hidden="true"/)
    expect(html.match(/t101-window/g)).toHaveLength(6)
  })
  it('asks for the current location before showing anything', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(null, [], null, 'idle') }))
    expect(html).toContain('需要使用目前位置')
    expect(html).toContain('使用目前位置')
    expect(html).not.toContain('sensory-weather')
  })
})
describe('sense info dialog', () => {
  async function renderDialog(props) {
    const context = {}
    await renderToString(createSSRApp(SenseInfoDialog, { city: cityFor(sampleOverview()), ...props }), context)
    return context.teleports.body
  }
  it('explains the overview in the same dialog style without a source list', async () => {
    const context = {}
    const city = cityFor(sampleOverview())
    await renderToString(createSSRApp(OverviewInfoDialog, { city, ssi: 58, described: true }), context)
    const html = context.teleports.body
    expect(html).toContain('感官概況說明')
    expect(html).toContain('sense-info-value')
    expect(html).toContain('環境刺激指數 SSI 58／100（中等）')
    expect(html).toContain('聲音 40%')
    expect(html).toContain('目前為模擬資料')
    expect(html).not.toContain('資料來源')
    expect(html).not.toContain('Nominatim')
    const unknown = {}
    await renderToString(createSSRApp(OverviewInfoDialog, { city, ssi: null, described: false }), unknown)
    expect(unknown.teleports.body).toContain('資料不足')
    expect(unknown.teleports.body).toContain('未知不代表環境安靜')
  })
  it('explains the value and calculation only, without the data table or source list', async () => {
    const html = await renderDialog({ senseKey: 'noise', value: 72, described: true })
    expect(html).toContain('聲音資料說明')
    expect(html).toContain('刺激指數 72／100')
    expect(html).toContain('0–33 低')
    expect(html).toContain('不是分貝')
    expect(html).toContain('40%')
    for (const removed of ['觀測時間', '有效至', '採用樣本', '資料信心', '資料來源', '聆靜模擬資料']) expect(html).not.toContain(removed)
  })
  it('says why a dimension is unknown instead of treating it as quiet', async () => {
    const html = await renderDialog({ senseKey: 'odor', value: null, described: true })
    expect(html).toContain('未知')
    expect(html).toContain('近 30 分鐘沒有這一項的回報')
    expect(html).toContain('AQI 不能代替氣味')
  })
})
