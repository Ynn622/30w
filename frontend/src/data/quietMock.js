import { AREAS } from '../lib/sensoryDomain.js'
import { assessSensory, SSI_WEIGHTS, SENSORY_KEYS } from '../lib/sensoryIndex.js'

// 後端無法連線時的完整模擬資料，結構與 docs/backend-api.md 六個接口相同。
// 時間以「目前時間」往前推算，讓 30 分鐘有效期判斷與正式資料一致；內容為專案自製，
// 場所與地址皆為虛構，不是官方監測或實際場所。中正、大安、信義為個別撰寫，其餘行政區由範本產生。
export const MOCK_SOURCES = Object.freeze([{ name: '聆靜模擬資料', url: null, license: '專案原創模擬資料', observedAt: null }])
const minutesAgo = (now, minutes) => new Date(new Date(now).getTime() - minutes * 60_000).toISOString()
export function mockMeta(now = Date.now(), fallbackReason = '') {
  return { mock: true, updatedAt: minutesAgo(now, 0), fallbackReason, sources: MOCK_SOURCES.map(source => ({ ...source, observedAt: minutesAgo(now, 0) })) }
}

function withIndex(record, ageMinutes, now) {
  const observedAt = minutesAgo(now, ageMinutes)
  const dimensions = Object.fromEntries(SENSORY_KEYS.map(key => [key, record.senses[key] ?? null]))
  const sensoryIndex = {
    scoreVersion: 'ssi-v0.1', confidenceVersion: 'mock-confidence-v0.1', confidence: record.confidence,
    dimensions, weights: { ...SSI_WEIGHTS }, dimensionMeta: Object.fromEntries(SENSORY_KEYS.map(key => [key, {
      observedAt: dimensions[key] === null ? null : observedAt,
      validUntil: dimensions[key] === null ? null : minutesAgo(observedAt, -30),
      sampleCount: dimensions[key] === null ? 0 : Math.max(1, record.reportCount || 1),
      confidence: dimensions[key] === null ? 'insufficient' : record.confidence,
      sourceType: dimensions[key] === null ? null : 'subjective_report', missingReason: dimensions[key] === null ? 'no_data' : null,
    }])),
  }
  const assessment = assessSensory({ ...record, sensoryIndex }, undefined, now)
  return { ...record, sensoryIndex: { ...sensoryIndex, ssi: assessment.ssi, level: assessment.ssi === null ? '資料不足' : undefined, coverage: assessment.coverage, dimensionCoverage: assessment.dimensionCoverage } }
}

const OVERVIEWS = {
  zhongzheng: { headline: '舒適偏吵', description: '主要道路旁聲音偏高，巷弄與室內空間相對安靜。', senses: { noise: 72, light: 46, crowd: 42, odor: null }, reportCount: 28, measurementCount: 12, confidence: 'medium', weather: { temperatureC: 25, rainProbability: 20, description: '多雲時晴' }, air: { aqi: 32, station: '模擬測站（中正）' } },
  daan: { headline: '大致舒適', description: '公園周邊人潮適中，午後光線較強，可往樹蔭處休息。', senses: { noise: 38, light: 58, crowd: 35, odor: 20 }, reportCount: 41, measurementCount: 19, confidence: 'high', weather: { temperatureC: 26, rainProbability: 10, description: '晴時多雲' }, air: { aqi: 48, station: '模擬測站（大安）' } },
  xinyi: { headline: '人潮偏多', description: '商圈周邊人潮與聲音較高，建議往住宅區或步道方向。', senses: { noise: 64, light: 70, crowd: 75, odor: 35 }, reportCount: 56, measurementCount: 23, confidence: 'medium', weather: { temperatureC: 24, rainProbability: 40, description: '多雲短暫雨' }, air: { aqi: 67, station: '模擬測站（信義）' } },
}

// 其餘行政區使用同一組範本，依區域序號微調數值，讓各區結果不同。
const OVERVIEW_PRESETS = [
  { headline: '大致舒適', description: '住宅區與公園周邊相對安靜，主要道路旁聲音較高。', senses: { noise: 40, light: 45, crowd: 33, odor: 18 }, confidence: 'medium', weather: { temperatureC: 25, rainProbability: 20, description: '多雲' }, aqi: 38 },
  { headline: '聲音偏高', description: '交通幹道與市場周邊聲音刺激偏高，可往巷弄或室內空間休息。', senses: { noise: 70, light: 50, crowd: 55, odor: 40 }, confidence: 'medium', weather: { temperatureC: 26, rainProbability: 30, description: '多雲時陰' }, aqi: 55 },
  { headline: '人潮較少', description: '近期回報人潮不多，河濱與山邊步道環境較放鬆。', senses: { noise: 30, light: 38, crowd: 24, odor: null }, confidence: 'low', weather: { temperatureC: 23, rainProbability: 50, description: '陰短暫雨' }, aqi: 29 },
]
function genericOverview(area, index) {
  const preset = OVERVIEW_PRESETS[index % OVERVIEW_PRESETS.length]
  return { ...preset, reportCount: 12 + index * 3, measurementCount: 4 + index, air: { aqi: preset.aqi + index, station: `模擬測站（${area.name.replace('區', '')}）` } }
}
function genericPlaces(area, index) {
  const short = area.name.replace('區', '')
  const v = (index % 5) * 3
  return [
    ['reading', `${short}社區閱讀室`, '閱讀空間', 'library', true, [.0016, .0012], 20 + v, 42, 27, 14, '適合休息', 'medium', 9, 14, '社區裡的小型閱讀空間，提供靠窗座位與飲水。', '平日白天安靜，傍晚學生放學後人潮略增。', '09:00–18:00（週一休）', '平面入口、有座椅。', ['靠窗位置很舒服。', '放學後比較熱鬧。']],
    ['green', `${short}河濱綠地`, '公園綠地', 'park', false, [-.0018, -.0024], 29, 33, 30 + v, 16, '綠意安靜', 'medium', 13, 9, '沿著綠地散步，樹下有幾張長椅可以坐下休息。', '遠離道路的樹蔭處較安靜，假日運動人潮增加。', '全天開放', '主要步道平坦，草地區輪椅通行不易。', ['樹蔭下很涼。']],
    ['rest', `${short}市民休憩站`, '公共空間', 'hall', true, [.0034, -.0026], 32, 29, 22, null, '人潮較少', 'medium', 8, 6, '提供座椅與飲水機的室內休憩空間。', '人潮少，適合短暫停留；氣味資料尚不足。', '10:00–17:00', '入口有斜坡。', ['座位不多但安靜。']],
    ['trail', `${short}巷弄小徑`, '街道巷弄', 'park', false, [-.0039, .0029], 36 + v, 28, 31, 21, '綠蔭步行', 'low', 18, 4, '車流少的小巷，兩側有行道樹。', '偶有機車經過；回報數仍少。', '全天開放', '部分人行道狹窄。', []],
    ['center', `${short}活動中心交誼廳`, '公共空間', 'hall', true, [.0009, .0044], 51, 58, 49 + v, 20, '偶有活動', 'medium', 45, 7, '活動中心一樓的交誼空間。', '有課程時聲音與人潮較高；目前觀測已超過 30 分鐘。', '08:30–21:30', '有電梯與無障礙廁所。', ['有課時會比較吵。']],
    ['study', `${short}自習空間`, '閱讀空間', 'library', true, [-.0028, .001], 17, 36, 38, 11, '低噪音', 'high', 6, 20, '提供單人座位的自習空間，禁止交談。', '整體非常安靜；考試期間座位較滿。', '08:00–22:00', '平面入口，座位間距寬。', ['真的很安靜。']],
  ]
}
const areaIndex = area => AREAS.findIndex(item => item.id === area.id)

// [id, 名稱, 類別, 插畫, 室內, 偏移, 聲音, 光線, 人潮, 氣味, 標籤, 信心, 觀測分鐘前, 回報數, 介紹, 摘要, 開放時間, 無障礙, 文字回報]
const PLACES = {
  zhongzheng: [
    ['reading', '巷弄閱讀室', '閱讀空間', 'library', true, [.0017, .0011], 21, 44, 26, 15, '適合休息', 'medium', 10, 18, '把城市的喧鬧留在門外，找一個靠窗的位置，安靜讀幾頁書。', '平日上午較安靜，靠窗座位有柔和自然光；下午可能有活動。', '09:00–18:00（週一休）', '平面入口、有座椅與無障礙廁所。', ['靠窗位置很安靜，適合看書。', '下午有說故事活動時會比較熱鬧。']],
    ['park', '綠蔭公園・樹下角落', '公園綠地', 'park', false, [-.0016, -.0026], 28, 30, 31, 18, '綠意安靜', 'medium', 12, 10, '沿著樹蔭走一小段，在微風裡暫停片刻。', '樹下光線柔和，遠離主要道路的座椅較安靜；仍可能聽到鳥鳴。', '全天開放', '部分步道平坦，雨天須注意濕滑。', ['樹蔭下很涼爽，車聲不明顯。']],
    ['hall', '街角市民休憩站', '公共空間', 'hall', true, [.0036, -.0027], 31, 28, 22, null, '人潮較少', 'medium', 8, 6, '在日常的移動之間，留一個可以喘口氣的地方。', '室內座位不多，平日人潮較少，適合短暫停留；氣味資料尚不足。', '10:00–17:00', '設有座椅，入口有一階小台階。', ['座位不多但很安靜。']],
    ['pavilion', '河畔步道涼亭', '公園綠地', 'park', false, [-.0042, .0031], 45, 25, 38, 30, '可看水景', 'low', 20, 4, '沿著河岸散步，涼亭裡可以坐下看看水面。', '傍晚運動人潮增加，白天相對安靜；回報數仍少。', '全天開放', '步道平坦，涼亭有一階高低差。', ['白天很舒服，傍晚跑步的人變多。']],
    ['arts', '社區藝文小館', '藝文空間', 'hall', true, [.0008, .0046], 52, 61, 47, 22, '近期有展覽', 'medium', 50, 9, '小型展覽與講座空間，展間之外有安靜的休息區。', '展覽開幕時人潮較多；目前觀測已超過 30 分鐘。', '10:00–20:00（週一休）', '有電梯與無障礙廁所。', ['展間燈光有點亮，休息區還好。']],
    ['study', '轉角自習空間', '閱讀空間', 'library', true, [-.0029, .0009], 18, 35, 40, 12, '低噪音', 'high', 6, 24, '提供單人座位的自習空間，禁止交談。', '禁止交談，整體非常安靜；考試期間座位較滿。', '08:00–22:00', '平面入口，座位間距寬。', ['真的很安靜，連翻書聲都很小。', '考季時位置比較難找。']],
  ],
  daan: [
    ['reading', '安和靜讀書房', '閱讀空間', 'library', true, [.0012, -.0018], 19, 38, 30, 10, '適合休息', 'high', 7, 22, '小巧的社區書房，有幾張面向中庭的閱讀桌。', '整體安靜，中庭採光柔和；週末親子人潮略增。', '09:00–21:00', '平面入口、有電梯。', ['中庭光線很舒服。']],
    ['lawn', '森林公園靜謐草坪', '公園綠地', 'park', false, [-.0021, .0024], 30, 52, 36, 16, '綠意安靜', 'medium', 14, 15, '遠離主要入口的草坪，可以坐在樹下休息。', '午後光線較強，樹下陰影處較舒適；假日人潮增加。', '全天開放', '草坪鬆軟，輪椅建議走外圍步道。', ['靠近入口比較吵，往裡面走就好多了。']],
    ['tea', '巷內茶香休憩所', '公共空間', 'hall', true, [.0031, .0007], 27, 33, 25, 40, '氣味較明顯', 'medium', 9, 8, '提供茶飲的小型休憩空間，座位寬敞。', '聲音與人潮都低，但茶香與焙茶氣味明顯，對氣味敏感者需注意。', '11:00–19:00', '入口有斜坡，座位可移動。', ['很安靜，但茶的味道蠻重的。']],
    ['lane', '溫州巷綠蔭小徑', '街道巷弄', 'park', false, [-.0009, -.0035], 34, 27, 29, 20, '綠蔭步行', 'medium', 16, 7, '兩側綠樹成蔭的小巷，適合慢慢散步。', '車流少、樹蔭多；偶有機車經過。', '全天開放', '部分路段人行道狹窄。', ['樹很多，走起來很放鬆。']],
    ['center', '社區活動中心交誼廳', '公共空間', 'hall', true, [.0045, -.0022], 49, 55, 58, 18, '偶有活動', 'low', 22, 5, '社區活動中心一樓的交誼空間。', '有課程時人潮與聲音較高；回報數少。', '08:30–21:30', '有電梯與無障礙廁所。', []],
    ['corner', '大學旁共讀角', '閱讀空間', 'library', true, [-.0038, .0012], 24, 41, 44, 14, '學生較多', 'medium', 11, 13, '開放給民眾使用的共讀空間，有插座與長桌。', '大多安靜，但下課時段人潮明顯增加。', '08:00–22:00', '平面入口。', ['下課時間人會突然變多。']],
  ],
  xinyi: [
    ['trail', '山腳步道休息平台', '步道', 'park', false, [-.0034, .0041], 26, 32, 39, 12, '可眺望城市', 'medium', 13, 17, '步道起點旁的木平台，可以先坐下休息再出發。', '平日安靜，假日登山人潮多；早晨光線柔和。', '全天開放', '平台前有階梯，無障礙通行受限。', ['平日早上很舒服。', '假日人非常多。']],
    ['books', '靜心書屋', '閱讀空間', 'library', true, [.0015, .0019], 20, 40, 28, 11, '適合休息', 'high', 5, 26, '住宅區裡的小書屋，有隔音良好的閱讀室。', '閱讀室隔音佳，整體安靜；入口靠近公車站。', '10:00–21:00', '平面入口、有電梯。', ['閱讀室隔音很好。']],
    ['rest', '社區休憩站', '公共空間', 'hall', true, [.0029, -.0031], 33, 30, 27, null, '人潮較少', 'low', 18, 3, '社區裡的小型休憩站，有幾張座椅與飲水機。', '安靜但回報數少，氣味資料不足。', '09:00–18:00', '平面入口。', []],
    ['meadow', '老眷村旁小草地', '公園綠地', 'park', false, [-.0012, -.0027], 37, 48, 41, 22, '綠意', 'medium', 15, 9, '老建築旁的一片小草地，有幾張長椅。', '週末市集時人潮與聲音偏高，平日較安靜。', '全天開放', '草地與碎石路面，輪椅通行不易。', ['平日很安靜，週末有市集。']],
    ['cafe', '商圈後巷咖啡角', '商店', 'hall', true, [.0041, .0016], 58, 66, 62, 45, '較熱鬧', 'medium', 9, 11, '商圈後巷的咖啡座，室內有音樂。', '室內播放音樂、燈光明亮，咖啡氣味明顯；不適合低刺激需求。', '08:00–22:00', '入口有一階台階。', ['音樂有點大聲。']],
    ['roof', '屋頂花園閱讀區', '閱讀空間', 'library', false, [-.0025, .0008], 29, 57, 24, 17, '半戶外', 'medium', 12, 8, '大樓屋頂的開放花園，設有遮陽閱讀座。', '人潮少、風大時較涼；午後日照強，光線刺激偏高。', '10:00–17:00（雨天關閉）', '有電梯可達。', ['風很舒服，但中午太曬。']],
  ],
}

export function mockOverview(areaId = 'zhongzheng', now = Date.now()) {
  const area = AREAS.find(item => item.id === areaId) || AREAS[0]
  const overview = OVERVIEWS[area.id] || genericOverview(area, areaIndex(area))
  return withIndex({
    area: area.name, headline: overview.headline, description: overview.description, observedAt: minutesAgo(now, 10),
    senses: { ...overview.senses, air: null }, reportCount: overview.reportCount, measurementCount: overview.measurementCount,
    windowMinutes: 30, confidence: overview.confidence, weather: { ...overview.weather },
    air: { ...overview.air, observedAt: minutesAgo(now, 25) },
  }, 10, now)
}
// center：模擬場所與格網圍繞的座標（通常是使用者目前位置）；未提供時用行政區代表點。
const isPoint = value => Number.isFinite(value?.lat) && Number.isFinite(value?.lng)
export function mockPlaces(areaId = 'zhongzheng', now = Date.now(), center = null) {
  const area = AREAS.find(item => item.id === areaId) || AREAS[0]
  const origin = isPoint(center) ? center : area
  return (PLACES[area.id] || genericPlaces(area, areaIndex(area))).map(([slug, name, category, artwork, indoor, offset, noise, light, crowd, odor, tag, confidence, age, reportCount, description, summary, hours, accessibility, reviews]) => {
    const observedAt = minutesAgo(now, age)
    return withIndex({
      id: `${area.id}-${slug}`, name, category, artwork, indoor, tag, confidence, reportCount, description, summary, hours, accessibility,
      location: { lat: origin.lat + offset[0], lng: origin.lng + offset[1] },
      senses: { noise, light, crowd, odor },
      address: `臺北市${area.name}（模擬地址）`,
      reviewCount: reviews.length,
      reviews: reviews.map((text, index) => ({ text, observedAt: minutesAgo(now, age + index * 17) })),
      updatedAt: observedAt, sources: mockMeta(now).sources,
    }, age, now)
  })
}
// centerFor(areaId)：回傳清單當時使用的中心點，確保詳情座標與清單一致。
export function mockPlace(id, now = Date.now(), centerFor = () => null) {
  return AREAS.flatMap(area => mockPlaces(area.id, now, centerFor(area.id))).find(place => place.id === id) || null
}
export function mockCells(areaId = 'zhongzheng', now = Date.now(), center = null) {
  const area = AREAS.find(item => item.id === areaId) || AREAS[0]
  const origin = isPoint(center) ? center : area
  const cells = [
    [-.002, -.001, 24, 33, 26, 15], [.002, .001, 75, 48, 61, 40], [.004, -.003, 44, 70, 40, null], [-.003, .004, 33, 25, 29, 18],
    [.0002, -.004, 58, 55, 72, 52], [-.0045, -.002, 20, 30, 18, 10], [.0035, .0042, 66, 62, 58, 30], [-.001, .0025, 38, 41, 35, null],
  ]
  // 依區域微調強度，讓三區熱區分布不同。
  const shift = { zhongzheng: 0, daan: -8, xinyi: 10 }[area.id] ?? ((areaIndex(area) % 5) * 4 - 8)
  const clamp = value => value === null ? null : Math.max(0, Math.min(100, value + shift))
  return cells.map(([lat, lng, noise, light, crowd, odor], i) => withIndex({
    id: `mock-cell-${area.id}-${i}`, location: { lat: origin.lat + lat, lng: origin.lng + lng },
    senses: { noise: clamp(noise), light: clamp(light), crowd: clamp(crowd), odor: clamp(odor) },
    reportCount: i + 3, updatedAt: minutesAgo(now, 6 + i * 2), confidence: i === 7 ? 'low' : 'medium',
  }, 6 + i * 2, now))
}
