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
  it('shows the address with a map and drops coordinates and helper sentences', async () => {
    const html = await render('noisy')
    expect(html).toContain('mini-map')
    expect(html).toContain('臺北市中正區承德路一段3號')
    // 位置框只顯示地址，不再列出經緯度與說明文字。
    expect(html).not.toContain('經緯度')
    expect(html).not.toContain('這次回報會送出')
    // 重新定位改為地址旁的定位圖示按鈕，不再有整列按鈕。
    expect(html).toMatch(/<button[^>]*class="[^"]*relocate-button[^"]*"[^>]*aria-label="重新定位"/)
    expect(html).not.toMatch(/<button[^>]*q-secondary full[^>]*>[\s\S]*?重新定位/)
    expect(html).not.toContain('不需要提供姓名')
  })
})
describe('report kind header', () => {
  it('renders the chosen feeling as a compact button that can switch to another kind', async () => {
    const html = await render('crowded')
    const header = html.match(/<button[^>]*report-selection[^>]*>/)?.[0] || ''
    expect(header).toContain('aria-expanded="false"')
    expect(header).toContain('aria-controls="report-kind-picker"')
    expect(html).toContain('人潮擁擠')
    expect(html).toContain('更換')
    // 種類清單收合時不顯示。
    expect(html).not.toContain('id="report-kind-picker"')
  })
})
