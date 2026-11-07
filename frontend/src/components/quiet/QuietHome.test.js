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
import { hourlyOverviewFor } from '../../lib/hourlyApi.fixture.js'
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
// 色帶刻度的文字（去掉標籤與 SSR 的片段註解）。
const ticksOf = html => html.match(/class="level-ticks"[^>]*>([\s\S]*?)<\/span><\/div>/)[1].replace(/<[^>]+>/g, '')
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
  it('disables quick reports and measurement in remote-hourly mode and shows the simulated label', async () => {
    const city = { ...cityFor(sampleOverview()), remoteMock: ref(true), writesEnabled: ref(false) }
    city.preferences.value = { ...city.preferences.value, dayType: 'weekend', hour: 20 }
    const html = await renderToString(createSSRApp(QuietHome, { city }))
    expect(html).toContain('測試情境：週末 20:00')
    expect(html).toContain('模擬情境・非即時觀測')
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
  it('shows the overview level on the sensitivity-layer colour bar with a marker, without explanation text or sources', async () => {
    const context = {}
    const city = cityFor(sampleOverview())
    await renderToString(createSSRApp(OverviewInfoDialog, { city, ssi: 58, described: true }), context)
    const html = context.teleports.body
    expect(html).toContain('感官概況說明')
    expect(html).toContain('sense-info-value')
    expect(html).toContain('環境刺激指數 SSI 58／100（中等）')
    // 色帶同敏感圖層圖例，箭頭標在 SSI 58 的位置；不再有「怎麼計算」等說明文字。
    expect(html).toContain('level-bar')
    expect(html).toMatch(/class="level-marker" style="left:58%;?"/)
    // 整體概況的刻度名稱。
    expect(ticksOf(html)).toBe('舒適普通刺激')
    expect(html).not.toContain('怎麼計算')
    expect(html).not.toContain('每 2 分鐘自動更新')
    expect(html).toContain('目前為模擬資料')
    expect(html).not.toContain('資料來源')
    expect(html).not.toContain('Nominatim')
    const unknown = {}
    await renderToString(createSSRApp(OverviewInfoDialog, { city, ssi: null, described: false }), unknown)
    expect(unknown.teleports.body).toContain('資料不足')
    expect(unknown.teleports.body).toContain('未知不代表環境安靜')
    // 資料不足時不畫箭頭，不暗示任何級別。
    expect(unknown.teleports.body).not.toContain('level-marker')
  })
  it('shows the value on the same colour bar with a marker, without explanation text, data table or source list', async () => {
    const html = await renderDialog({ senseKey: 'noise', value: 72, described: true })
    expect(html).toContain('聲音資料說明')
    expect(html).toContain('刺激指數 72／100')
    expect(html).toContain('level-bar')
    expect(html).toMatch(/class="level-marker" style="left:72%;?"/)
    expect(html).toContain('aria-label="聲音刺激程度：偏高，72／100"')
    // 刻度名稱依類別：聲音為安靜／有點吵／吵雜。
    expect(ticksOf(html)).toBe('安靜有點吵吵雜')
    for (const removed of ['怎麼計算', '不是分貝', '0–33 低', '40%']) expect(html).not.toContain(removed)
    for (const removed of ['觀測時間', '有效至', '採用樣本', '資料信心', '資料來源', '聆靜模擬資料']) expect(html).not.toContain(removed)
  })
  it('names the scale ticks after each sense', async () => {
    const expected = { noise: '安靜有點吵吵雜', light: '柔和明亮刺眼', crowd: '空曠適中擁擠', odor: '清新有氣味刺鼻' }
    for (const [senseKey, ticks] of Object.entries(expected)) {
      const html = await renderDialog({ senseKey, value: 50, described: true })
      expect(ticksOf(html)).toBe(ticks)
    }
  })
  it('says why a dimension is unknown instead of treating it as quiet', async () => {
    const html = await renderDialog({ senseKey: 'odor', value: null, described: true })
    expect(html).toContain('未知')
    expect(html).toContain('近 30 分鐘沒有這一項的回報')
    // 未知時不畫箭頭，不暗示任何級別。
    expect(html).toContain('level-bar')
    expect(html).not.toContain('level-marker')
  })
})

describe('home mock overview (remote-hourly)', () => {
  function testCity(overview = hourlyOverviewFor(), slot = { dayType: 'weekend', hour: 3 }) {
    const city = { ...cityFor(sampleOverview()), remoteMock: ref(true), writesEnabled: ref(false) }
    city.preferences.value = { ...city.preferences.value, dataMode: 'remote-hourly', ...slot }
    city.overview = { data: ref(overview.data), meta: ref(overview.meta), state: ref('ready'), error: ref(''), reload: () => {} }
    return city
  }
  const home = city => renderToString(createSSRApp(QuietHome, { city }))
  async function dialog(component, props) {
    const context = {}
    await renderToString(createSSRApp(component, props), context)
    return context.teleports.body
  }
  it('shows the 150 m simulated average with the backend slot and keeps the mock label visible', async () => {
    const html = await home(testCity())
    expect(html).toContain('附近150公尺感官模擬平均')
    expect(html).toContain('週末 03:00 典型時段・9 個網格平均（網格數不是人數），非即時觀測。')
    expect(html).toContain('模擬：週末 03:00')
    expect(html).toContain('模擬情境・非即時觀測')
    expect(html).not.toContain('資料不足，暫無法判斷')
    expect(html).not.toContain('首頁卡片為當下典型時段')
  })
  it('treats decimals and zero as values and partial nulls as unknown', async () => {
    const html = await home(testCity(hourlyOverviewFor({ senses: { noise: 0, light: 33.4, crowd: null, odor: 66.1 }, validPointCounts: { noise: 2, light: 2, crowd: 0, odor: 2 } })))
    const levels = [...html.matchAll(/<strong[^>]*>([^<]+)<\/strong>/g)].map(match => match[1]).filter(text => ['低', '中等', '偏高', '未知'].includes(text))
    expect(levels).toEqual(['低', '中等', '未知', '偏高'])
  })
  it('shows insufficient data for an empty circle instead of zero', async () => {
    const empty = hourlyOverviewFor({ senses: { noise: null, light: null, crowd: null, odor: null }, pointCount: 0, validPointCounts: { noise: 0, light: 0, crowd: 0, odor: 0 } })
    const html = await home(testCity(empty))
    expect(html).toContain('資料不足，暫無法判斷')
    expect(html).toContain('附近 150 公尺內沒有模擬網格。未知不代表環境安靜。')
    expect(html.match(/>未知</g)).toHaveLength(4)
  })
  it('labels the home slot when the map uses a different simulated slot', async () => {
    const html = await home(testCity(hourlyOverviewFor(), { dayType: 'weekday', hour: 8 }))
    expect(html).toContain('首頁卡片為當下典型時段（週末 03:00），探索地圖為你選的平日 08:00。')
  })
  it('explains mock values in the dialogs without SSI, sample counts as people or observation time', async () => {
    const city = testCity()
    const sense = await dialog(SenseInfoDialog, { city, senseKey: 'noise', value: 26.6, described: true })
    expect(sense).toContain('模擬平均 26.6／100・8 個有效網格（非人數）')
    const unknown = await dialog(SenseInfoDialog, { city, senseKey: 'crowd', value: null, described: true })
    expect(unknown).toContain('附近 150 公尺內這一項沒有有效模擬網格')
    const overview = await dialog(OverviewInfoDialog, { city, ssi: null, described: true })
    expect(overview).toContain('週末 03:00 典型時段・附近 150 公尺 9 個網格平均；模擬資料不計算環境刺激指數 SSI。')
    expect(overview).toContain('模擬情境・非即時觀測')
    expect(overview).not.toMatch(/SSI \d/)
  })
})
