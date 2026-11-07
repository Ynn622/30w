# 聆靜 WebView

Vue 3 + JavaScript + Vite 的行動版城市感官服務。首頁、探索、我的三頁搭配場所詳情、兩步回報與 Flutter 環境音量面板；不含參考圖最上方的服務導覽列。

介面依提供的城市通風格參考圖設計：主色 `#0391A7`，搭配白底、淺藍資訊卡與深灰文字。正文 15–16px、輔助資訊至少 12px；窄螢幕優先換行，不再縮成 8–10px。首頁採四欄感官資訊與三欄快速回報，探索與詳情使用青藍分頁底線。

## 感官功能與交接

- [前端實作計畫](../docs/superpowers/plans/2026-11-07-city-quiet.md)
- [六個後端 API 與完整 JSON 契約](../docs/backend-api.md)
- [Flutter iOS 環境噪音協定](../docs/flutter-noise-interface.md)
- [地圖與資料來源、授權](../docs/data-sources.md)

感官資料一律先呼叫後端（`VITE_API_BASE_URL`）；連不上、路由不存在（404）、伺服器錯誤或回應格式不符時，該次請求改用 `frontend/src/data/quietMock.js` 的完整模擬資料，並跳出通知「後端感官服務暫時無法連線，已改用模擬資料顯示。」。模擬期間畫面以「模擬」小標與首頁「感官概況說明」視窗標示（競賽規則要求清楚標示模擬內容），每 2 分鐘持續重試後端（切回視窗時也會立即重試），三種資料都取得後端回應時自動切回並通知。取消請求不改用模擬；回報／量測只有在無法連線或路由不存在時才模擬完成（不上傳），驗證錯誤與頻率限制仍顯示錯誤讓使用者重試。 請複製 `.env.example` 至 `.env.local` 設定，之後重新啟動或建置。元件卸載時清除輪詢。

首頁展示聲音、光線、人潮、氣味四維與另列的空品 AQI（不納入 SSI），主觀回報與手機音量分開統計。資料不足／感官觀測過期會顯示未知，推薦再次過濾過期與 null 值；所有距離皆為直線。敏感度與介面設定僅本機儲存，位置與量測只在記憶體。

已移除「我的感官偏好」（低噪、柔光、少人、氣味、只看室內、探索距離）與「我的安靜角落」收藏功能：地點查詢只帶區域、座標與半徑：探索地圖停止移動後，以地圖中心與「可視範圍長邊的一半」作為需求半徑（`longSideRadius`）；後端 places 已接受任意正整數半徑（issue #4），前端預設送精確值（`placesRadius`，取整到 10 公尺、限制 100–20000 公尺，超過 20 公里時只查中心並提示放大）並帶 `max=100`；`VITE_PLACES_FREE_RADIUS=false` 可退回只送 300／500／1000。`max` 只送給正式 places，不送給感官地圖、概況或測試資料。探索地圖只能在臺北市外框矩形內移動，並以底圖 OpenStreetMap 行政界線標示臺北市界、顯示公制比例尺；首頁概況固定 500 公尺，舊版存下的這些偏好讀取時略過，舊收藏編號 `quiet-city-favorites` 會在開啟時從此裝置清除。

### 首頁區域、定位與探索頁

- **只依目前定位提供服務，不開放手動選擇區域。** App 開啟時即請求定位（城市通 `location` 或瀏覽器 geolocation）；尚未定位、定位失敗時，首頁與探索頁顯示定位提示與「使用目前位置」按鈕，不呼叫感官接口。
- 取得座標後在裝置端判斷**所在的里**（`src/lib/villages.js`）：以臺北市里界 `src/data/taipei-villages.json`（456 里，來源 Taipei City Dashboard，AGPL-3.0）做點在多邊形判斷，首頁顯示「士林區・三玉里」，行政區也改以里界所屬的區為準（舊的最近代表點推估在全市隨機點約有 28% 判錯區）。里界約 330KB，第一次需要時才載入；載入前或找不到里時，退回 `nearestArea()`（手繪臺北市外框＋最近行政區代表點的近似判斷）。座標不會送到任何服務。里界由 `npm run geo:villages -- <taipei_village.geojson>`（`scripts/build-villages.mjs`）從來源檔精簡產生：只留區名、里名、村里代碼，邊界簡化約 3 公尺，與原始邊界在隨機點的判斷一致率 99.87%（差異都在里界邊緣數公尺內）。
- 不在臺北市時，首頁與探索頁顯示「此區域非台北市內，無法提供服務」並提供重新定位，停止呼叫感官接口；回報只會帶目前定位座標（`location.source=device`）。
- 快速回報顯示目前位置的小地圖（`MiniMap.vue`）、經緯度與門牌地址。地址由 `src/lib/reverseGeocode.js` 呼叫 OpenStreetMap Nominatim 取得：只在定位成功且位於臺北市時查一次，請求間隔至少 1.1 秒、約 11 公尺內記憶體快取，畫面標示 © OpenStreetMap contributors；查不到時退回顯示行政區。座標會送到 Nominatim 伺服器，目前 App 內未另外揭露（開發者 2026-11-08 決定首頁說明視窗不列資料來源）（「我的」頁的隱私與資料卡片已移除）。公用伺服器可能收回權限，正式交付建議以 `VITE_GEOCODE_URL` 改接後端轉送或自架服務。
- 首頁「附近的安靜角落」以 `QuietHome.vue` 的 `SHOW_NEARBY` 暫時隱藏。改用模擬資料時，模擬場所與格網以使用者目前位置為中心產生。
- 探索頁的 h1 只保留給螢幕閱讀器；地圖填滿畫面，推薦清單放在可拖曳的底部抽屜（`BottomSheet.vue`，收合／半開／全開三段，點把手或上下方向鍵也可切換）。收合時地圖底緣留在抽屜上方，確保 OpenStreetMap 等授權標示可見。

### 測試情境（remote-hourly，Ynn622/30w#5）

「我的 › 測試資料」可明確切換「正式資料」與後端逐小時模擬網格 `test/mock/hourly`（臺北 30,000 個固定網格 × 24 小時 × 平日／週末），並選擇平日／週末與小時；預設值由 `VITE_DATA_MODE` 決定，時段預設為臺北時間的當下，選擇存在此裝置。舊的 60 點 `test/mock/places` 已由後端退役（404），前端已移除相關程式。

- 介接在 `src/lib/hourlyApi.js`，與正式 `sensoryApi` 分開：每個時段以 `limit=30000` 一次取完整市（gzip 約 0.5 MB，依 `nextOffset` 續取），驗證 `meta.mock`／`demo`、`mode: test-only`、`datasetVersion: taipei-hourly-grid-v1`、時段、`timeBasis`、`tg00001` 格式網格 ID、座標、四維 0–100 整數或 null、聲音單位與筆數完整。400／404／429／503 顯示錯誤並可重試，**不改用內建 quietMock**；取消請求不顯示錯誤。
- 網格只用來畫敏感圖層：依地圖範圍（外加 400 公尺）裁切後交給與正式資料相同的內插與個人敏感度加權，綠區篩選照常運作；正式 `sensory/map` 在此模式停用。網格沒有名稱、照片，也不是可進入場所，**推薦清單與詳情仍是正式 places**。
- 新鮮度以後端 `meta.simulatedAt` 判斷（點的 `observedAt` 與其相同、有效 30 分鐘），不受裝置時鐘誤差影響；正式資料的新鮮度與 SSI 規則不變，資料不足（null）的網格不當作安靜。
- 首頁感官概況改讀後端 `test/mock/overview`（只送目前位置 `lat`／`lng`）：座標 150 公尺內網格的四維平均，時段由後端依**當下**臺北時間決定。卡片直接顯示平均值（可為小數、0 為有效、各維獨立為 null），不套正式的新鮮度／樣本數／SSI 規則；空圈或全未知顯示「資料不足」與原因。重新整理按鈕顯示「模擬：週末 03:00」，若探索地圖另選了不同時段會標示兩者不同；說明視窗寫明有效網格數不是人數、模擬資料不計算 SSI。定位改變會取消舊請求。
- 首頁、探索地圖長駐「測試情境：平日 08:00・模擬情境・非即時觀測」，圖例標示「模擬情境」並說明載入中／失敗／無資料；「我的」列出後端 `meta.sources`（沒有名稱的項目顯示 id）。
- 切換時段會取消舊請求，切回正式資料時網格立即清空、恢復正式感官地圖；回報與環境量測在測試情境停用（按鈕停用並提示）。
- 後端 CORS 只允許 `http://localhost:5173` 與 GitHub Pages，其他埠開發時測試情境會顯示讀取錯誤。

### SSI、SFS 與低刺激模式

- `src/lib/sensoryIndex.js`：`assessSensory(record, sensitivities, now)` 只採 `sensoryIndex.scoreVersion=ssi-v0.1`、信心非 insufficient、`sourceType=subjective_report`、有樣本且 30 分鐘內有效的維度；回傳 SSI、SFS、`coverage`（環境權重）、`fitCoverage`（個人權重）與 `dimensionCoverage`。缺值、過期與不支援版本不當作低刺激；舊版只有 `senses` 的回應仍顯示各維，但不推造 SSI。
- `useQuietCity` 的 `city.assess(record, meta)` 供各畫面使用；`city.recommendations` 在本機依安靜程度（SFS：依「我的」1–5 敏感度佔比加權場所有效四維 `senses`，未版本化的 `senses` 也可計分）或直線距離排序。探索頁附近推薦提供文字搜尋（`searchPlaces`，比對名稱、類別、地址、標籤，地圖標記同步篩選）與「距離優先／安靜程度優先」切換。環境指數 SSI 仍只在後端提供版本化 `sensoryIndex` 時計算。敏感度、排序與低刺激模式皆不加入 API query。
- 「我的」提供四維 1–5 敏感度（預設 聲音 4／光線 2／人潮 3／氣味 1）與低刺激模式；舊版或損壞的 localStorage 會回到有效預設。
- 低刺激模式（「我的」→「介面」，本機設定）**只調整介面，不改變地圖內容或推薦**：`body` 加上 `q-low-stimulus`，讓 Teleport sheet 一併套用柔和配色、停止動畫（含地圖移動動畫）、加大操作區、隱藏裝飾插畫、降低卡片飽和度；通知停留 6 秒可點擊關閉、新版本改為手動重新整理；裝置開啟「減少動態」時只提示、不自動開啟；裝置要求高對比時加深文字色。計畫見 `docs/superpowers/plans/2026-11-07-low-stimulus-mode.md`。
- 快速回報為兩層式：8 種類型（聲音、光線、人潮、氣味、溫度、動線、舒適、其他）＋該類型的快速標籤（可複選），另有未預選的感受程度（`mild | noticeable | strong`，四種 SSI 類型與溫度、動線）、持續狀態（`ongoing | ended | recurring`）與室內／室外（`indoor | outdoor`），後兩者選填；「其他感受」需填說明。欄位與後端彙整規則見 `docs/backend-api.md` 第 5 節。改用模擬資料時可完整操作但不上傳；後端模式需 `VITE_REPORT_INTENSITY=true` 才顯示並送出 `intensity`，否則維持舊 body。

地圖使用 `maplibre-gl@6.16.0`（BSD-3-Clause）與 OpenFreeMap Liberty 底圖。地圖引擎與 worker 延遲載入，只有探索頁需要；底圖服務需連網，WebGL 不可用或載入錯誤時提供重試與清單。第三方授權原文隨 `public/third-party/` 交付。UI 插畫、圖示為原創 SVG，沒有下載額外字型或照片。

噪音量測由 `noiseClient.js` 以 `getUserMedia`（關閉自動增益、降噪、回音消除）與 `AnalyserNode` 在裝置上計算每 250ms 的 RMS／peak dBFS，管理權限逾時、中斷、取消與資源釋放；不使用 bridge 訊息，也不建立錄音。城市通 App 需允許 WebView 麥克風（見 `docs/flutter-noise-interface.md`）。不支援、非 HTTPS 或未授權時不會產生假數字。僅支援未校準 **dBFS**，不宣稱環境 dBA。麥克風與定位分開取得權限，分享摘要還需另勾選並主動送出；完成後摘要存入 `noiseHistory.js`（localStorage 最近 20 筆，不含座標），首頁顯示最近三筆；`noiseLevel.js` 以 dBFS + 校準值（預設 120，`#debug`「噪音校準」可依參考音量計調整）估計 dB，並自動分為安靜 <50／普通 50–69／吵雜 ≥70，未校準時明示誤差；波形以 -90～-10 dBFS 範圍繪製。音訊節點以音量 0 的 gain 接到 destination（避免部分 WebKit 讀到全零），iOS 短暫 suspended 會先嘗試恢復；錯誤訊息附上 DOMException 名稱方便實機除錯；不送原始音訊。

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
