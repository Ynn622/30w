import { createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import QuietHome from './QuietHome.vue'
import { demoOverview, DEMO_META } from '../../data/quietDemo.js'
function cityFor(data) {
  return { mode: 'demo', areaId: ref('zhongzheng'), locating: ref(false), deviceLocation: ref(null), locate: () => {},
    overview: { data: ref(data), meta: ref(DEMO_META), state: ref('ready'), error: ref(''), reload: () => {} },
    places: { data: ref({ places: [] }), state: ref('ready'), error: ref(''), reload: () => {} },
  }
}
describe('home sensory presentation', () => {
  it('renders the requested product without the upper service nav and identifies demo data', async () => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor(demoOverview()) }))
    expect(html).toContain('城市靜音鍵')
    expect(html).toContain('舒適偏吵')
    expect(html).toContain('以上皆為示範數據，非官方即時監測')
    expect(html).toContain('還沒找到符合偏好的角落')
    expect(html).not.toContain('循環杯')
    expect(html).not.toContain('帳務')
  })
  it.each([
    { reportCount: 0, measurementCount: 0 },
    { observedAt: '2026-11-06T10:30:00+08:00' },
    { confidence: 'insufficient' },
  ])('does not describe insufficient or stale data as comfortable: %j', async changes => {
    const html = await renderToString(createSSRApp(QuietHome, { city: cityFor({ ...demoOverview(), ...changes }) }))
    expect(html).toContain('資料不足，暫無法判斷')
    expect(html).not.toContain('舒適偏吵')
    expect(html).toContain('未知')
  })
})
