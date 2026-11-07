# 城市靜音鍵 WebView

Vue 3 + JavaScript + Vite 的行動版城市感官服務。首頁、探索、我的三頁搭配場所詳情、兩步回報與 Flutter 環境音量面板；不含參考圖最上方的服務導覽列。

介面依提供的城市通風格參考圖設計：主色 `#0391A7`，搭配白底、淺藍資訊卡與深灰文字。正文 15–16px、輔助資訊至少 12px；窄螢幕優先換行，不再縮成 8–10px。首頁採四欄感官資訊與三欄快速回報，探索與詳情使用青藍分頁底線。

## 感官功能與交接

- [前端實作計畫](../docs/superpowers/plans/2026-11-07-city-quiet.md)
- [六個後端 API 與完整 JSON 契約](../docs/backend-api.md)
- [Flutter iOS 環境噪音協定](../docs/flutter-noise-interface.md)
- [地圖與資料來源、授權](../docs/data-sources.md)

感官資料一律先呼叫後端（`VITE_API_BASE_URL`）；連不上、路由不存在（404）、伺服器錯誤或回應格式不符時，該次請求改用 `frontend/src/data/quietMock.js` 的完整模擬資料，並跳出通知「後端感官服務暫時無法連線，已改用模擬資料顯示。」。模擬期間畫面以「模擬」小標與資料來源頁說明標示（競賽規則要求清楚標示模擬內容），每 60 秒持續重試後端，三種資料都取得後端回應時自動切回並通知。取消請求不改用模擬；回報／量測只有在無法連線或路由不存在時才模擬完成（不上傳），驗證錯誤與頻率限制仍顯示錯誤讓使用者重試。 請複製 `.env.example` 至 `.env.local` 設定，之後重新啟動或建置。元件卸載時清除輪詢。

首頁展示聲音、光線、人潮、氣味四維與另列的空品 AQI（不納入 SSI），主觀回報與手機音量分開統計。資料不足／感官觀測過期會顯示未知，推薦再次過濾過期與 null 值；所有距離皆為直線。偏好與收藏 ID 僅本機儲存，位置與量測只在記憶體。

### 首頁區域、定位與探索頁

- **只依目前定位提供服務，不開放手動選擇區域。** App 開啟時即請求定位（城市通 `location` 或瀏覽器 geolocation）；尚未定位、定位失敗時，首頁與探索頁顯示定位提示與「使用目前位置」按鈕，不呼叫感官接口。
- 取得座標後以 `nearestArea()` 判斷行政區（臺北市 12 區，`AREAS`）：先用手繪的臺北市概略外框排除市外位置，再取最近的行政區代表點。**這是近似判斷**，靠近區界可能判到鄰區或誤判市內外。MapLibre 沒有反向地理編碼功能；若要精確判斷，需另外加入官方行政區界資料（例如內政部國土測繪中心開放資料）做點在多邊形判斷，加入前須確認授權。
- 不在臺北市時，首頁與探索頁顯示「此區域非台北市內，無法提供服務」並提供重新定位，停止呼叫感官接口；回報只會帶目前定位座標（`location.source=device`）。
- 快速回報顯示目前位置的小地圖（`MiniMap.vue`）、經緯度與門牌地址。地址由 `src/lib/reverseGeocode.js` 呼叫 OpenStreetMap Nominatim 取得：只在定位成功且位於臺北市時查一次，請求間隔至少 1.1 秒、約 11 公尺內記憶體快取，畫面標示 © OpenStreetMap contributors；查不到時退回顯示行政區。座標會送到 Nominatim 伺服器，已寫入「我的」隱私說明。公用伺服器可能收回權限，正式交付建議以 `VITE_GEOCODE_URL` 改接後端轉送或自架服務。
- 首頁「附近的安靜角落」以 `QuietHome.vue` 的 `SHOW_NEARBY` 暫時隱藏。改用模擬資料時，模擬場所與格網以使用者目前位置為中心產生。
- 探索頁的 h1 只保留給螢幕閱讀器；地圖填滿畫面，推薦清單放在可拖曳的底部抽屜（`BottomSheet.vue`，收合／半開／全開三段，點把手或上下方向鍵也可切換）。收合時地圖底緣留在抽屜上方，確保 OpenStreetMap 等授權標示可見。

### SSI、SFS 與低刺激模式

- `src/lib/sensoryIndex.js`：`assessSensory(record, sensitivities, now)` 只採 `sensoryIndex.scoreVersion=ssi-v0.1`、信心非 insufficient、`sourceType=subjective_report`、有樣本且 30 分鐘內有效的維度；回傳 SSI、SFS、`coverage`（環境權重）、`fitCoverage`（個人權重）與 `dimensionCoverage`。缺值、過期與不支援版本不當作低刺激；舊版只有 `senses` 的回應仍顯示各維，但不推造 SSI。
- `useQuietCity` 的 `city.assess(record, meta)` 供各畫面使用；`city.recommendations` 在本機依 SFS（完整資料優先）或直線距離排序，並在本機套用氣味篩選。敏感度、排序、氣味與低刺激模式皆不加入 API query。
- 「我的」提供四維 1–5 敏感度（預設 聲音 4／光線 2／人潮 3／氣味 1）與低刺激模式；舊版或損壞的 localStorage 會回到有效預設。
- 低刺激模式在 `body` 加上 `q-low-stimulus`，讓 Teleport sheet 一併套用：柔和配色、停止動畫與地圖飛行、降低熱區不透明度、加大操作區並隱藏裝飾插畫；錯誤、模擬資料標示與資料不足仍以文字保留。
- 快速回報的四種刺激感受提供未預選的強度（`none | mild | noticeable | strong`）；comfortable／other 不送強度。改用模擬資料時可完整操作但不上傳；後端模式需 `VITE_REPORT_INTENSITY=true` 才顯示並送出 `intensity`，否則維持舊 body。

地圖使用 `maplibre-gl@6.16.0`（BSD-3-Clause）與 OpenFreeMap Liberty 底圖。地圖引擎與 worker 延遲載入，只有探索頁需要；底圖服務需連網，WebGL 不可用或載入錯誤時提供重試與清單。第三方授權原文隨 `public/third-party/` 交付。UI 插畫、圖示為原創 SVG，沒有下載額外字型或照片。

噪音量測由 `noiseClient.js` 以 `getUserMedia`（關閉自動增益、降噪、回音消除）與 `AnalyserNode` 在裝置上計算每 250ms 的 RMS／peak dBFS，管理權限逾時、中斷、取消與資源釋放；不使用 bridge 訊息，也不建立錄音。城市通 App 需允許 WebView 麥克風（見 `docs/flutter-noise-interface.md`）。不支援、非 HTTPS 或未授權時不會產生假數字。僅支援未校準 **dBFS**，不宣稱環境 dBA。麥克風與定位分開取得權限，分享摘要還需另勾選並主動送出；不送原始音訊。

Vue 頁面切換、卡片進場、sheet 與感官指示動畫支援 `prefers-reduced-motion` 與低刺激模式；按鈕或其標籤提供至少 44px 觸控區，支援 safe-area、320px 與對話框鍵盤 focus trap。

## 本機開發

需要 Node.js **22.12 或以上**（`frontend/.nvmrc` 指定 22）；GitHub Actions 使用 Node 22。新地圖的傳遞依賴要求 Node 22，因此同步調整原有版本要求。

```bash
npm install
npm run dev
```

本機開發網址：`http://localhost:7890`。

測試與正式建置：

```bash
npm test
npm run build
```

## 後端 API

隱藏測試工作台的「後端 API」可直接呼叫問候與健康檢查端點，顯示實際 HTTP 狀態、耗時與回應內容。請求超過 15 秒會中止，離開頁面也會取消請求。跨網域測試需由後端允許目前前端的 Origin。

`src/config/apiConfig.js` 僅管理 base URL，預設為 `https://30wbackend.idfc.dev/api/v1`。
如需切換環境，可將 `.env.example` 複製為 `.env.local` 並修改 `VITE_API_BASE_URL`，之後重新啟動或建置。

```js
import apiConfig from './config/apiConfig.js'

const url = new URL(`${apiConfig.baseURL}/hello`)
url.searchParams.set('name', 'CityLink')
const response = await fetch(url)
if (!response.ok) throw new Error(`API request failed: ${response.status}`)
const result = await response.json()
// result.data.message
```

- [Swagger](https://30wbackend.idfc.dev/docs/) · [OpenAPI](https://30wbackend.idfc.dev/openapi.json)

## WebView 訊息格式

本專案以[城市通雙向溝通文件](https://tpe-guideline.web.app/docs/two-way-connection/web.html)為主要介接規格。城市通 App 會透過 `flutter_inappwebview` 在網頁全域註冊：

```js
window.flutterObject
```

網頁呼叫 App 時使用 `window.flutterObject.postMessage(message)`；`message` 必須是 JSON 字串，並固定使用 `name`、`data` 格式。例如開啟 QR Code 掃描器：

```json
{
  "name": "qr_code_scan",
  "data": null
}
```

App 回覆時，網頁透過 `window.flutterObject.addEventListener('message', callback)` 接收，資料位於 `event.data`，同樣為 JSON 字串。Vue 元件卸載時必須移除 listener。

`frontend/src/lib/webview.js` 已封裝傳送、解析、監聽與清理。既有城市通方法包含 `userinfo`、`launch_map`、`phone_call`、`1999agree`、`location`、`deviceinfo`、`open_link`、`notify` 與 `qr_code_scan`。

本專案的服務點擊暫時使用自訂 `open_service`，正式介接時需在 App 端建立同名 handler。一般瀏覽器沒有 bridge 時不會送出原生訊息。舊的 WebKit、Android 與 React Native bridge 僅保留為 fallback。

## 介接測試面板

測試功能集中在隱藏工作台，平常不顯示於導覽或個人頁面。不區分本機、測試、正式環境。

開啟方式：

- 網址加上 `#debug`，例如 `http://localhost:7890/#debug` 或 `https://ynn622.github.io/30w/#debug`。
- 瀏覽器 Console 執行 `cityDebug.open()`，關閉用 `cityDebug.close()`。
- 鍵盤按 `Ctrl + Alt + D` 可切換顯示。

工作台提供「後端 API」、「WebView」、「畫面狀態」三個分頁，按「離開測試」回到原頁。這是隱藏入口而非登入權限，知道網址的人都能開啟。進入頁面不會自動呼叫 API 或索取會員、定位資料。

在「WebView」分頁選擇官方方法、編輯 `data` JSON，點選測試後即可查看要求內容與 App 回傳 JSON。

- 提供官方文件的 9 個方法；所有要求均由使用者手動觸發。
- `open_link`、`notify`、`1999agree` 成功時不回覆，因此只標示已送出。
- 其他方法等待 30 秒，QR Code 掃描等待 120 秒；逾時僅代表尚未收到回覆。
- 一般瀏覽器未注入 `flutterObject` 時不送出要求，也不以假資料冒充 App 回覆。
- 顯示資料僅保留於元件記憶體，切換分頁或按「清除結果」即可移除。
- 實機驗證需由城市通 App WebView 開啟此網站，確認允許的來源網域及 App handler 已設定。

## 共用功能

- `src/lib/apiClient.js`：`apiRequest('hello', { query: { name: 'CityLink' }, signal })`，回傳 `{ url, status, data, elapsed }`；統一 HTTP、網路、逾時、取消錯誤。相對路徑接在 API base 後，根路徑端點可使用完整 URL。可透過 `body` 傳送 JSON，並自行設定 `method`。
- `src/lib/nativeClient.js`：`requestNative('userinfo', null, { host: window, signal })`，回傳 `{ name, data, replied }`；處理連線偵測、監聽、逾時、取消與清理。未提供 requestId 的官方協定一次只能等待一個請求，逾時後的延遲回覆仍需在實機整合時注意。
- `src/components/AsyncState.vue`：共用 `loading`、`error`、`empty` 狀態，支援重試事件。可由測試工作台的「畫面狀態」預覽。

## GitHub Pages

正式建置會自動產生 `dist/version.json`，版本號與前端 bundle 一致。頁面開啟時立即檢查一次，之後每 **1 分鐘（60,000 ms）**檢查更新；發現不同版本時顯示提示，10 秒後自動重新整理。檢查使用 GitHub Pages base path、時間戳與 `cache: 'no-store'` 避免讀到快取版本；斷線或檔案異常時下次再試，本機 dev 模式不執行檢查。

`.github/workflows/deploy-frontend.yml` 會在 `main` 分支的 `frontend/**` 變更後執行測試、建置並部署 `dist/`。Vite 會依 `GITHUB_REPOSITORY` 自動判斷：

- 專案站：使用 `/<repository>/`
- `<owner>.github.io` 使用者站：使用 `/`
- 特殊路徑：在 workflow 設定 `VITE_BASE_PATH`

Repository 的 **Settings → Pages → Build and deployment → Source** 請選擇 **GitHub Actions**。
