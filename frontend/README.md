# 聆靜 WebView

Vue 3 + JavaScript + Vite 的行動版城市感官服務。首頁、探索、我的三頁搭配場所詳情、兩步回報與 Flutter 環境音量面板；不含參考圖最上方的服務導覽列。

介面依提供的城市通風格參考圖設計：主色 `#0391A7`，搭配白底、淺藍資訊卡與深灰文字。正文 15–16px、輔助資訊至少 12px；窄螢幕優先換行，不再縮成 8–10px。首頁採四欄感官資訊與三欄快速回報，探索與詳情使用青藍分頁底線。

## 感官功能與交接

- [前端實作計畫](../docs/superpowers/plans/2026-11-07-city-quiet.md)
- [六個後端 API 與完整 JSON 契約](../docs/backend-api.md)
- [Flutter iOS 環境噪音協定](../docs/flutter-noise-interface.md)
- [地圖與資料來源、授權](../docs/data-sources.md)

感官資料一律先呼叫後端（`VITE_API_BASE_URL`）。目前只有場所清單（與詳情、回報／量測寫入）會在失敗時改用內建模擬資料；首頁概況（`test/overview`）與敏感圖層（`test/hourly`）失敗時只顯示錯誤並可重試。以下為場所清單的備援規則：連不上、路由不存在（404）、伺服器錯誤或回應格式不符時，該次請求改用 `frontend/src/data/quietMock.js` 的完整模擬資料，並跳出通知「後端感官服務暫時無法連線，已改用模擬資料顯示。」。模擬期間畫面以「模擬」小標與首頁「感官概況說明」視窗標示（競賽規則要求清楚標示模擬內容），每 2 分鐘持續重試後端（切回視窗時也會立即重試），三種資料都取得後端回應時自動切回並通知。取消請求不改用模擬；回報／量測只有在無法連線或路由不存在時才模擬完成（不上傳），驗證錯誤與頻率限制仍顯示錯誤讓使用者重試。 請複製 `.env.example` 至 `.env.local` 設定，之後重新啟動或建置。元件卸載時清除輪詢。

首頁展示聲音、光線、人潮、氣味四維與另列的空品 AQI（不納入 SSI），主觀回報與手機音量分開統計。資料不足／感官觀測過期會顯示未知，推薦再次過濾過期與 null 值；所有距離皆為直線。敏感度與介面設定僅本機儲存，位置與量測只在記憶體。

已移除「我的感官偏好」（低噪、柔光、少人、氣味、只看室內、探索距離）與「我的安靜角落」收藏功能：地點查詢只帶區域、座標與半徑：探索地圖停止移動後，以地圖中心與「可視範圍長邊的一半」作為需求半徑（`longSideRadius`）；後端 places 已接受任意正整數半徑（issue #4），前端預設送精確值（`placesRadius`，取整到 10 公尺、限制 100–20000 公尺，超過 20 公里時只查中心並提示放大）並帶 `max=100`；`VITE_PLACES_FREE_RADIUS=false` 可退回只送 300／500／1000。`max` 只送給正式 places，不送給感官地圖、概況或測試資料。探索地圖只能在臺北市外框矩形內移動，並以底圖 OpenStreetMap 行政界線標示臺北市界、顯示公制比例尺；首頁概況固定 500 公尺，舊版存下的這些偏好讀取時略過，舊收藏編號 `quiet-city-favorites` 會在開啟時從此裝置清除。

### 首頁區域、定位與探索頁

- **只依目前定位提供服務，不開放手動選擇區域。** App 開啟時即請求定位（城市通 `location` 或瀏覽器 geolocation）；尚未定位、定位失敗時，首頁與探索頁顯示定位提示與「使用目前位置」按鈕，不呼叫感官接口。
- 取得座標後在裝置端判斷**所在的里**（`src/lib/villages.js`）：以臺北市里界 `src/data/taipei-villages.json`（456 里，來源 Taipei City Dashboard，AGPL-3.0）做點在多邊形判斷，首頁顯示「士林區・三玉里」，行政區也改以里界所屬的區為準（舊的最近代表點推估在全市隨機點約有 28% 判錯區）。里界約 330KB，第一次需要時才載入；載入前或找不到里時，退回 `nearestArea()`（手繪臺北市外框＋最近行政區代表點的近似判斷）。座標不會送到任何服務。里界由 `npm run geo:villages -- <taipei_village.geojson>`（`scripts/build-villages.mjs`）從來源檔精簡產生：只留區名、里名、村里代碼，邊界簡化約 3 公尺，與原始邊界在隨機點的判斷一致率 99.87%（差異都在里界邊緣數公尺內）。
- 不在臺北市時，首頁與探索頁顯示「此區域非台北市內，無法提供服務」並提供重新定位，停止呼叫感官接口；回報只會帶目前定位座標（`location.source=device`）。
- 快速回報顯示目前位置的小地圖（`MiniMap.vue`）、經緯度與門牌地址。地址由 `src/lib/reverseGeocode.js` 呼叫 OpenStreetMap Nominatim 取得：只在定位成功且位於臺北市時查一次，請求間隔至少 1.1 秒、約 11 公尺內記憶體快取，畫面標示 © OpenStreetMap contributors；查不到時退回顯示行政區。座標會送到 Nominatim 伺服器，目前 App 內未另外揭露（開發者 2026-11-08 決定首頁說明視窗不列資料來源）（「我的」頁的隱私與資料卡片已移除）。公用伺服器可能收回權限，正式交付建議以 `VITE_GEOCODE_URL` 改接後端轉送或自架服務。
- 首頁「附近的安靜角落」以 `QuietHome.vue` 的 `SHOW_NEARBY` 暫時隱藏。改用模擬資料時，模擬場所與格網以使用者目前位置為中心產生。
- 探索頁的 h1 只保留給螢幕閱讀器；地圖填滿畫面，推薦清單放在可拖曳的底部抽屜（`BottomSheet.vue`，收合／半開／全開三段，點把手或上下方向鍵也可切換）。收合時地圖底緣留在抽屜上方，確保 OpenStreetMap 等授權標示可見。

### 首頁概況（test/overview）

首頁四張感官卡片讀後端 `test/overview`（目前位置 150 公尺內網格的四維平均，時段由後端依**當下**臺北時間決定），開發者決定目前當正式資料對待：只送 `lat`／`lng`，顯示「更新：時間」（取 `simulatedAt`）。標題與說明不用後端固定文字，由 `src/lib/overviewSummary.js` 以四維平均依「我的」感官敏感度加權計算個人化指數（聲音權重 ×2，未知維度不列入、其餘權重重新換算）：0–33「整體舒適」、34–66「整體普通」、67–100「整體偏刺激」，說明點名中等以上的感官（用各自刻度，如聲音「有點吵」、人潮「擁擠」）並註明資料不足的項目；概況說明視窗的箭頭指向此個人刺激指數。數值可為小數、0 為有效、各維獨立為 null，空圈或全未知顯示「資料不足」與原因；感官卡片說明視窗以刺激指數呈現。不受「模擬環境」影響，失敗時顯示錯誤並可重試，不改用內建模擬資料。`sensory/overview` 目前不呼叫。

### 敏感圖層與模擬環境（Ynn622/30w#5）

敏感圖層（熱力圖）一律來自後端逐小時模擬網格 `test/hourly`（臺北 30,000 個固定網格 × 24 小時 × 平日／週末），不再呼叫 `sensory/map`，也沒有本機模擬：

- **平常**：自動取臺北當下的平日／週末與小時；每到整點、下次定時重新整理時才換時段重抓，平常的重新整理不重抓網格。
- **模擬環境**：探索地圖左上的「模擬環境」按鈕（`TestDataPanel.vue`）點開後可開啟「使用模擬環境」，自選平日／週末與時段滑桿（0–23 時；拖曳時只更新畫面上的時段文字，放開才寫入並查詢）。開啟時按鈕本身長駐顯示「模擬環境：週末 14:00・典型時段推估・非即時觀測」；預設值由 `VITE_DATA_MODE` 決定，選擇存在此裝置。
- **只影響地圖**：首頁概況、推薦清單、詳情、回報與量測不受模擬環境影響。網格沒有名稱、照片，也不是可進入場所，推薦清單仍是正式 places，綠區篩選依網格算出的敏感圖層。
- 介接在 `src/lib/hourlyApi.js`，與正式 `sensoryApi` 分開：每個時段以 `limit=30000` 一次取完整市（gzip 約 0.5 MB，依 `nextOffset` 續取），驗證 `meta.test`／`demo`、`mode: test-only`、`datasetVersion: taipei-hourly-grid-v2`、`modelVersion: taipei-hourly-grid-v1`、噪音對照 `test-noise-linear-v2`（35–100 dB(A) 線性換算）、時段、`timeBasis`、`tg00001` 格式網格 ID、座標、四維 0–100 整數或 null、聲音單位與筆數完整。400／404／429／503 顯示錯誤並可重試，不改用內建 quietMock；取消請求不顯示錯誤。
- 依地圖範圍（外加 400 公尺）裁切後交給與原本相同的內插與個人敏感度加權；新鮮度以後端 `meta.simulatedAt` 判斷，不受裝置時鐘誤差影響；資料不足（null）的網格不當作安靜。
- 圖例不另加模擬標籤（以上方「模擬環境」按鈕為準），展開說明註明資料為後端模擬網格的典型時段推估、非即時觀測，並說明載入中／失敗／無資料；面板只放開關與時段設定，並顯示載入中、錯誤與重試（不列說明文字與資料來源清單，開發者 2026-11-08 決定）。切換時段會取消舊請求並先清空舊網格。
- 後端 CORS 只允許 `http://localhost:5173` 與 GitHub Pages，其他埠開發時敏感圖層會顯示讀取錯誤。

### 場所照片與資料來源（Ynn622/30w#7）

- **正式場所照片**：`GET places` 與 `places/{id}` 內嵌 `image`（後端依序選 reviewed 同場所照片 → linked 同主體照片 → nearby 1 公里內參考照片 → illustration）。`src/lib/placeImage.js` 只接受同場所的 `/api/v1/places/{id}/image?v=…` 路徑並以 API origin 解析（不重複 `/api/v1`、不連到 Pages origin），版本參數照後端提供；插畫、格式不符或缺作者／授權時改用前端原創插畫，不多打一次 API。`PlacePhoto.vue` 以 `crossorigin="anonymous"`、`referrerpolicy="no-referrer"`、`loading="lazy"` 載入，固定比例避免版面跳動；載入失敗（404／429／網路）只換回插畫、不重試，換新網址才重新嘗試。（目前場所資料暫用天母接口，天母資料沒有照片，所以畫面上都是插畫；改回正式 places 後照片才會出現。）
- 卡片縮圖不顯示小標，只列純文字署名「照片／參考照片：作者・授權」；詳情照片右下角顯示小標（reviewed 為「歷史照片・年份・非即時」，其他為「參考照片・非即時」，插畫為「原創示意插畫・非實景」）與完整署名（作者、credit、授權連結、原始來源、修改說明、後端 notice），nearby 另註明「附近參考照片：來源名稱（約 N 公尺），非此場所實景」。依開發者決定照片優先、允許附近圖，不因 `verified=false` 拒圖、不加「未人工核對」警語；清單不逐卡查 `image-info`。低刺激模式隱藏照片。
- **排重與舊 UUID**：清單已由後端排重，前端不再以距離合併；詳情保留請求 id 相等檢查，舊 UUID 回應的 `canonicalId` 照常顯示，圖片直接用後端提供的網址。
- **場所資料來源（正式＋場所情境雙來源，Ynn622/30w#7）**：探索頁推薦清單與詳情同時請求正式 `places` 與 `test/places?scenario=`（`src/lib/placeSources.js`、`src/lib/testPlacesApi.js`），只依同 UUID、`test.livePlaceIds` 或共同 `sourceIdentities` 一對一合併：保留正式的名稱、地址、照片與來源，感官整筆改用情境資料（null 維持未知、0 是有效低值）；多候選不合併，test 獨有與正式獨有都照常顯示，Vue key 用來源限定的 `renderKey`。場所情境（平日下午／平日晚上／週末下午）不提供切換，依臺北當下時間自動挑最接近的一種（週末→週末下午、平日 18 點後→平日晚上、其餘→平日下午），重新整理跨過界線時自動重查。詳情依清單記下的 `{ origin, liveId, testId, scenario }` 讀同一來源，合併場所兩邊都查並重驗身份；任一來源失敗標示部分資料、兩邊都失敗顯示錯誤，正式介接退回內建虛構資料時視為失敗。情境資料（`taipei-places-test-v1`、`typical_scenario`）依開發者決定先當正式資料呈現：不套 30 分鐘新鮮度、不顯示過期提示，以同一組 SSI 權重計算 SSI 與 SFS（信心沿用 `confidence`，多為 low）；test 場所沒有照片，不借正式照片。舊的天母 `test/tianmu/places` 介接已移除。

### 個人化歷史趨勢（後端開發中）

- 場所詳情的分頁為「感官資訊／基本資訊／歷史趨勢」（原「回報摘要」已移除）。歷史趨勢以場所座標與平日／假日 POST 後端（`src/lib/historyApi.js`，只送 `lat`、`lng`、`dayType=weekday|weekend`），後端回傳一天各時段（每 3 小時一點）的聲音／光線／人潮／氣味四個值。
- 前端回來後依「我的」敏感度加權（`personalWeights`，聲音權重 ×2，與場所安靜程度一致），得到 0–100 個人刺激值，以 `HistoryChart.vue` 的 SVG 折線圖呈現；33／66 虛線與敏感圖層分界一致，未知時段不畫點、折線斷開，不當作安靜。
- 後端接口路徑未定：設定 `VITE_HISTORY_PATH`（相對 API base）後才發請求；未設定時分頁顯示「歷史資料尚未提供」。回傳格式暫時寬鬆接受 `data.slots／points／series` 或陣列、`hour／startHour` 或 `"HH:00"`、`senses` 物件或平鋪四維，後端公布正式契約後再收緊驗證。

### SSI、SFS 與低刺激模式

- `src/lib/sensoryIndex.js`：`assessSensory(record, sensitivities, now)` 只採 `sensoryIndex.scoreVersion=ssi-v0.1`、信心非 insufficient、`sourceType=subjective_report`、有樣本且 30 分鐘內有效的維度；回傳 SSI、SFS、`coverage`（環境權重）、`fitCoverage`（個人權重）與 `dimensionCoverage`。缺值、過期與不支援版本不當作低刺激；舊版只有 `senses` 的回應仍顯示各維，但不推造 SSI。
- `useQuietCity` 的 `city.assess(record, meta)` 供各畫面使用；`city.recommendations` 在本機依安靜程度（SFS：依「我的」1–5 敏感度佔比加權場所有效四維 `senses`，聲音權重為敏感度 ×2〔`personalWeights`、`NOISE_WEIGHT_MULTIPLIER`〕，首頁概況與敏感圖層共用同一權重；未版本化的 `senses` 也可計分）或直線距離排序。探索頁附近推薦提供文字搜尋（`searchPlaces`，比對名稱、類別、地址、標籤，地圖標記同步篩選）與「距離優先／安靜程度優先」切換。環境指數 SSI 仍只在後端提供版本化 `sensoryIndex` 時計算。敏感度、排序與低刺激模式皆不加入 API query。
- 「我的」提供四維 1–5 敏感度（預設 聲音 4／光線 2／人潮 3／氣味 1）與低刺激模式；舊版或損壞的 localStorage 會回到有效預設。
- 低刺激模式（「我的」→「介面」開啟，開啟後首頁標題旁顯示「低刺激」標記可點選關閉；本機設定）**不改變敏感圖層資料、場所或推薦**：`body` 加上 `q-low-stimulus`，讓 Teleport sheet 一併套用。介面改為米白暖灰底（不用大面積純白）、卡片無陰影與漸層、圖示單色（級距與警示仍以文字顯示）、停止動畫（含地圖移動動畫）、加大操作區、隱藏裝飾插畫與照片、首頁快速回報的 8 類收進「選擇要回報的感受」按鈕；探索地圖與回報小地圖改用 OpenFreeMap `positron` 灰階底圖（同一開源服務，不新增依賴），隱藏 POI、機場與道路盾牌，場所圖釘改單色、市界改低飽和色（`src/lib/mapStyle.js`）。通知停留 6 秒可點擊關閉、新版本改為手動重新整理；裝置開啟「減少動態」時只提示、不自動開啟；裝置要求高對比時加深文字色。計畫見 `docs/superpowers/plans/2026-11-07-low-stimulus-mode.md`。
- 快速回報為兩層式：8 種類型（聲音、光線、人潮、氣味、溫度、動線、舒適、其他）＋該類型的快速標籤（可複選），另有未預選的感受程度（`mild | noticeable | strong`，四種 SSI 類型與溫度、動線）、持續狀態（`ongoing | ended | recurring`）與室內／室外（`indoor | outdoor`），後兩者選填；「其他感受」需填說明。欄位與後端彙整規則見 `docs/backend-api.md` 第 5 節。改用模擬資料時可完整操作但不上傳；後端模式需 `VITE_REPORT_INTENSITY=true` 才顯示並送出 `intensity`，否則維持舊 body。

地圖使用 `maplibre-gl@6.16.0`（BSD-3-Clause）與 OpenFreeMap Liberty 底圖（低刺激模式改用同服務的 Positron 灰階底圖）。地圖引擎與 worker 延遲載入，只有探索頁需要；底圖服務需連網，WebGL 不可用或載入錯誤時提供重試與清單。第三方授權原文隨 `public/third-party/` 交付。UI 插畫、圖示為原創 SVG，沒有下載額外字型或照片。

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
