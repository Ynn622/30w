// 固定測試位置：VITE_FAKE_LOCATION=true 時不呼叫 App／瀏覽器定位，一律使用臺北市天母體育館。
// 用於展示與不在臺北市時的開發測試；建置時寫入前端，修改後需重新啟動 dev server 或重新建置。
// 座標取自 OpenStreetMap「天母運動公園」（© OpenStreetMap contributors），士林區忠誠路二段。
export const TIANMU_STADIUM = Object.freeze({ lat: 25.1144737, lng: 121.5351923, name: '天母體育館' })

export function readFakeLocation(env = import.meta.env) {
  return Object.freeze({ enabled: env.VITE_FAKE_LOCATION === 'true', ...TIANMU_STADIUM })
}

export const fakeLocation = readFakeLocation()

export default fakeLocation
