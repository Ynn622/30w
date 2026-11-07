import { createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import ReportSheet from './ReportSheet.vue'
import { REPORT_KINDS } from '../../lib/sensoryDomain.js'

const city = enabled => ({ reportIntensityEnabled: ref(enabled), area: ref({ id: 'zhongzheng', name: '中正區' }), address: ref('臺北市中正區承德路一段3號'), addressState: ref('ready'), locating: ref(false), locate: () => {},
  reportLocation: ref({ lat: 25.0386, lng: 121.5143, source: 'device', areaId: 'zhongzheng', label: '目前位置（中正區）' }) })
// AppSheet 透過 Teleport 輸出，SSR 內容位於 context.teleports。
async function render(kindId, enabled = true) {
  const context = {}
  await renderToString(createSSRApp(ReportSheet, { kind: REPORT_KINDS.find(kind => kind.id === kindId), city: city(enabled) }), context)
  return context.teleports.body
}

describe('report intensity', () => {
  it('asks a single-dimension intensity without a preselected answer', async () => {
    const html = await render('odor')
    expect(html).toContain('此刻的氣味刺激有多強？')
    expect(html).toContain('沒有明顯刺激')
    expect(html).not.toMatch(/type="radio"[^>]*checked/)
    expect(html).toContain('請先選擇強度')
  })
  it('does not ask intensity for comfortable or other reports, or when the backend has not enabled it', async () => {
    for (const html of [await render('comfortable'), await render('other'), await render('noisy', false)]) {
      expect(html).not.toContain('刺激有多強')
    }
  })
})
describe('report location', () => {
  it('shows the current coordinates with a map and drops the old helper sentence', async () => {
    const html = await render('noisy')
    expect(html).toContain('mini-map')
    expect(html).toContain('臺北市中正區承德路一段3號')
    expect(html).toContain('© OpenStreetMap contributors')
    expect(html).toContain('經緯度 25.03860, 121.51430')
    expect(html).not.toContain('不需要提供姓名')
  })
})
