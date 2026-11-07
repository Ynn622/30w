import { AREAS } from '../lib/sensoryDomain.js'

// 固定示範情境，並非當日實況或官方場所資料。時間不偽裝成即時更新。
export const DEMO_TIME = '2026-11-07T10:30:00+08:00'
export const DEMO_META = {
  demo: true, updatedAt: DEMO_TIME, referenceTime: DEMO_TIME,
  sources: [{ name: '城市靜音鍵自製示範資料', url: null, license: '專案原創示範', observedAt: DEMO_TIME }],
}
export function demoOverview(areaId = 'zhongzheng') {
  const area = AREAS.find(item => item.id === areaId) || AREAS[0]
  return {
    area: area.name, headline: '舒適偏吵', description: '給自己一點安靜，城市也能慢下來。',
    observedAt: DEMO_TIME,
    senses: { noise: 72, light: 46, crowd: 42, air: 22 },
    reportCount: 28, measurementCount: 12, windowMinutes: 30, confidence: 'medium',
    weather: { temperatureC: 25, rainProbability: 20, description: '多雲時晴' },
    air: { aqi: 32, station: '示範測站', observedAt: DEMO_TIME },
  }
}
export function demoPlaces(areaId = 'zhongzheng') {
  const area = AREAS.find(item => item.id === areaId) || AREAS[0]
  return [
    { id: `${area.id}-reading`, name: '巷弄閱讀室', category: '閱讀空間', artwork: 'library', indoor: true, offset: [.0017, .0011], senses: { noise: 21, light: 44, crowd: 26, odor: 15 }, tag: '適合休息', description: '把城市的喧鬧留在門外，找一個靠窗的位置，安靜讀幾頁書。', accessibility: '示例：平面入口、有座椅；正式無障礙資訊待查核。', hours: '示例開放時間 09:00–18:00', confidence: 'medium', summary: '示範描述：平日上午較安靜，靠窗座位有柔和自然光；下午可能有活動。', reportCount: 18, reviewCount: 0, reviews: [] },
    { id: `${area.id}-park`, name: '綠蔭公園・樹下角落', category: '公園綠地', artwork: 'park', indoor: false, offset: [-.0016, -.0026], senses: { noise: 28, light: 30, crowd: 31, odor: 18 }, tag: '綠意安靜', description: '沿著樹蔭走一小段，在微風裡暫停片刻。', accessibility: '示例：部分步道平坦，雨天須注意濕滑。', hours: '示例開放時間 全天', confidence: 'medium', summary: '示範描述：樹下光線柔和，遠離主要道路的座椅較安靜；仍可能聽到鳥鳴。', reportCount: 10, reviewCount: 0, reviews: [] },
    { id: `${area.id}-hall`, name: '街角市民休憩站', category: '公共空間', artwork: 'hall', indoor: true, offset: [.0036, -.0027], senses: { noise: 31, light: 28, crowd: 22, odor: null }, tag: '人潮較少', description: '在日常的移動之間，留一個可以喘口氣的地方。', accessibility: '示例：設有座椅，進入條件待查核。', hours: '示例開放時間 10:00–17:00', confidence: 'medium', summary: '示範描述：室內座位不多，平日人潮較少，適合短暫停留。', reportCount: 6, reviewCount: 0, reviews: [] },
  ].map(({ offset, ...place }) => ({ ...place,
    location: { lat: area.lat + offset[0], lng: area.lng + offset[1] },
    address: `臺北市${area.name}（虛構示例場所，請勿據此前往）`,
    updatedAt: '2026-11-07T10:20:00+08:00', sources: DEMO_META.sources,
  }))
}
export function demoCells(areaId = 'zhongzheng') {
  const area = AREAS.find(item => item.id === areaId) || AREAS[0]
  return [
    [-.002, -.001, 24, 33, 26], [.002, .001, 75, 48, 61], [.004, -.003, 44, 70, 40], [-.003, .004, 33, 25, 29], [.0002, -.004, 58, 55, 72],
  ].map(([lat, lng, noise, light, crowd], i) => ({ id: `demo-cell-${i}`, location: { lat: area.lat + lat, lng: area.lng + lng }, senses: { noise, light, crowd }, reportCount: i + 3, updatedAt: DEMO_TIME, confidence: 'medium' }))
}
