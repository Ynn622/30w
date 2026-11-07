# 城市靜音鍵後端 API 交接

前端已完成呼叫層與示範體驗。請依這份契約建立後端，不必沿用示範資料；真實運作需接上合法開放資料、匿名回報及場所資料。所有 JSON 欄位使用 camelCase，時間使用含時區的 ISO 8601，座標為 WGS84。

## 啟用與範圍

```dotenv
# frontend/.env.local（修改後重新啟動或建置）
VITE_API_BASE_URL=https://your-backend.example/api/v1
VITE_SENSORY_MODE=api
```

預設為 `demo`，感官讀取與寫入皆不送網路請求。`api` 模式沒有失敗時自動使用假資料的機制。既有 debug 的 hello/health 測試獨立運作，不受此開關影響。

前端入口：`frontend/src/lib/sensoryApi.js`。以下路徑全部接在 base URL 後，不含開頭 `/`，確保 `/api/v1` 不被覆蓋。正式模式在頁面可見時每 60 秒重新讀取三種概況／地圖／清單資料，視窗重新取得焦點也更新；離開產品頁（含 debug）會清除 timer 與 listener。每次切區域／偏好會取消舊 GET，避免舊回覆覆蓋新查詢；POST 送出期間禁止重複點選。

## 本次必須提供的六個接口

| 方法與路徑 | 用途 | 前端使用處 |
| --- | --- | --- |
| `GET sensory/overview` | 區域感官概況、天氣、空品、回報與量測計數 | 首頁 |
| `GET sensory/map` | 近期匿名彙整感官熱區 | 探索地圖 |
| `GET places` | 同時符合偏好、距離與資料條件的場所 | 首頁與探索清單 |
| `GET places/{id}` | 場所詳情、可進入性、感官與來源 | 詳情三分頁 |
| `POST reports` | 接收個人主觀感受 | 兩步快速回報 |
| `POST measurements` | 接收使用者另外同意分享的數值摘要 | 量測完成頁 |

本次偏好與收藏僅存本機 localStorage，**沒有呼叫登入、雲端偏好或收藏 API**。若未來需要跨裝置同步，再新增會員授權與個人資料契約，不應因本文件列出可能方向就假設前端已串接。

## 共用 envelope 與錯誤

所有 GET 回傳 HTTP 200：

```json
{
  "data": {},
  "meta": {
    "demo": false,
    "updatedAt": "2026-11-07T10:30:00+08:00",
    "sources": [
      {
        "name": "資料集或回報來源名稱",
        "url": "https://example.org/open-dataset",
        "license": "實際適用的資料授權名稱",
        "observedAt": "2026-11-07T10:20:00+08:00"
      }
    ]
  }
}
```

- `meta.demo` 必須為 `false`；若後端只有測試資料，請使用前端 demo 模式，避免混淆。
- `updatedAt` 是實際資料整理時間；各來源的 `observedAt` 是觀測／發布時間，兩者不得混用。各感官資料另有 freshness 限制，後端不可只更新 meta 來掩蓋舊資料。
- `sources` 逐筆提供名稱、原始網址、授權與時間。沒有資料可以是空陣列，UI 會顯示尚未取得來源；正式成果應補齊真實來源。
- `referenceTime` 僅供前端固定 demo 情境，不應出現在正式 API。
- 未知數值使用 `null`，不要用 `0`、空字串或猜測值代替。

錯誤格式（配合既有 apiClient）：

```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "請提供有效的回報位置。" },
  "requestId": "req-example-001"
}
```

建議狀態：400 驗證失敗、401 未授權、403 禁止、404 場所不存在、409 重複寫入、429 頻率限制、503 上游暫不可用。請回傳可顯示的繁體中文 `error.message`，不得包含資料庫、金鑰或個資。可另送 `X-Request-Id`，讓前端 debug 比對。

## 1 區域感官概況

`GET sensory/overview?areaId=zhongzheng&lat=25.0386&lng=121.5143&radius=500`

| query | 型別 | 說明 |
| --- | --- | --- |
| `areaId` | string | 目前選單：`zhongzheng`、`daan`、`xinyi`；臺北市行政區 |
| `lat`, `lng` | number | 使用者手動選定的區域中心或另行授權的裝置位置 |
| `radius` | number | 300、500、1000 公尺；前端目前皆使用直線距離 |

`data` 範例：

```json
{
  "area": "中正區",
  "headline": "聲音刺激偏高",
  "description": "近期回報顯示周邊聲音刺激較高，可探索室內休息空間。",
  "senses": { "noise": 72, "light": null, "crowd": 42, "air": 22 },
  "observedAt": "2026-11-07T10:20:00+08:00",
  "reportCount": 28,
  "measurementCount": 12,
  "windowMinutes": 30,
  "confidence": "medium",
  "weather": { "temperatureC": 25, "rainProbability": 20, "description": "多雲時晴" },
  "air": { "aqi": 32, "station": "實際測站名稱", "observedAt": "2026-11-07T10:00:00+08:00" }
}
```

- `senses` 為 0–100 相對刺激尺度（越高越刺激）；**不是分貝、照度、人數或 AQI 原值**。空品 AQI 原值放在 `air.aqi`。請後端記錄轉換公式與版本；沒有合理資料就回 null。
- 前端顯示分段：0–33「低」、34–66「中等」、67–100「偏高」；空品相對尺度為「良好／普通／不佳」。目前沒有從 dBFS 推導刺激指數的演算法，後端不可混合不同手機 dBFS 做城市噪音比較。
- `observedAt` 是此次感官判斷使用的有效觀測時間（多來源以最舊的仍採用時間為準），不得填 API 呼叫或整理時間。超過 30 分鐘或未知時前端顯示資料不足。過期的單項值須直接回 null；空品另依其來源更新週期揭露。
- `reportCount` 只計主觀感受，`measurementCount` 只計有效裝置摘要；不得重複灌入同一計數。
- `confidence`：`high | medium | low | insufficient`。後端應依有效樣本數、觀測年齡、來源涵蓋度與離散程度訂定版本化規則；尚未具備規則時用 `insufficient`，不要捏造高信心。
- 資料不足時仍回 200，計數 0、各 senses=null、confidence=insufficient、headline="資料不足，暫無法判斷"。上游錯誤回 503，或保留可用來源並明示不足，不能使用示範值補空。
- `weather` 和 `air` 可為 null；預報與測站時間應放來源，不宣稱全部是現在所在地即時觀測。

## 2 感官地圖

`GET sensory/map` 使用相同的區域、座標與距離 query。回傳 `data`：

```json
{
  "cells": [
    {
      "id": "grid-001",
      "location": { "lat": 25.039, "lng": 121.515 },
      "senses": { "noise": 70, "light": null, "crowd": 30 },
      "reportCount": 8,
      "confidence": "medium",
      "updatedAt": "2026-11-07T10:20:00+08:00"
    }
  ]
}
```

- 無資料時 `cells: []`。前端仍可用底圖與場所清單，不憑空補點。
- location 為匿名格網中心，非個別回報者位置；後端自行設置最少樣本門檻、格網尺度與保留期間，避免還原個人位置。
- 前端切聲音／光線／人潮不重建地圖；只使用對應的非 null、0–100、30 分鐘內資料。`insufficient` 及過期格網不繪製。
- 熱圖為樣本位置與指數的加權視覺化，**不是官方噪音等值線，也不能解讀為道路即時 dBA**。低值與未觀測處以觀測格網圓點區分：0 指數仍顯示綠點，無觀測則沒有圓點。

## 3 靜音推薦場所

`GET places?areaId=zhongzheng&lat=25.0386&lng=121.5143&radius=500&noise=low&light=any&crowd=any&indoor=false`

增加以下 query（與區域 query 一起使用）：

| query | 值 | 篩選規則 |
| --- | --- | --- |
| `noise` | `low` / `any` | low 時聲音指數 <=33，不能 null、過期或 insufficient |
| `light` | `low` / `any` | low 時光線指數 <=33 |
| `crowd` | `low` / `any` | low 時人潮指數 <=33 |
| `indoor` | 字串 `true` / `false` | true 僅室內；false 不限制，**不是僅戶外** |

多項條件為 AND。應另外排除已關閉、不可合法進入或已知環境危害的候選場所；天氣／空品不適宜戶外時，後端可排除戶外並提供說明。若進入條件未知，顯示待確認，避免保證可用。不得把 NOS_P_08 的測站位置當安靜推薦依據。

回傳 `data: { "places": [Place] }`。無結果回 200 + 空陣列。前端也會再次檢查篩選、觀測時間與座標，不完全信任後端篩選。結果依直線距離遞增排列；本版不做分頁，請限制回傳數量，例如最多 50 筆。`Place` 使用下一節欄位；清單至少需要 id、name、category、location、indoor、senses、tag、confidence、updatedAt。

`distanceM` 由前端根據座標重新計算。尚無路由服務，不可把直線距離寫成「步行 X 分鐘」。若之後要提供真實步行距離，須先另訂路由結果契約與開源服務來源。

## 4 場所詳情

`GET places/{id}`，id 經 URL encoding。不存在回 404，不能回另一個場所。

```json
{
  "data": {
    "id": "place-001",
    "name": "真實場所名稱",
    "category": "圖書館",
    "artwork": "library",
    "indoor": true,
    "location": { "lat": 25.04, "lng": 121.515 },
    "senses": { "noise": 21, "light": 44, "crowd": 26, "odor": null },
    "tag": "適合休息",
    "description": "由公開資料整理的場所介紹。",
    "address": "實際地址",
    "hours": "實際開放時間與休館注意事項",
    "accessibility": "平面入口、電梯、座位、進入限制及查核時間等資訊。",
    "confidence": "medium",
    "summary": "匿名回報的固定整理文字，資料不足時為 null。",
    "reportCount": 18,
    "reviewCount": 0,
    "reviews": [],
    "updatedAt": "2026-11-07T10:20:00+08:00",
    "sources": [
      { "name": "真實場所開放資料", "url": "https://example.org/dataset", "license": "實際授權", "observedAt": "2026-11-07T09:00:00+08:00" }
    ]
  },
  "meta": { "demo": false, "updatedAt": "2026-11-07T10:30:00+08:00", "sources": [] }
}
```

- 場所 `updatedAt` 表示感官數值的觀測時間，不是場所介紹的編輯時間；來源時間可各自不同，過期單項回 null。
- `artwork`: `library | park | hall`，前端使用原創示意插畫，不代表實景。這版不接照片網址，避免未確認的照片授權。
- `summary` 使用既有、規則整理或開發階段預先生成的固定文字；本版不呼叫雲端 LLM，也不把後端生成摘要宣稱為即時端側 AI。
- `reviews` 每筆 `{ "text": "去識別化內容", "observedAt": "ISO 8601" }`。不傳會員識別碼、姓名或精確回報位置；後端應先去識別與檢查內容。
- 前端提供收藏（僅 ID 存本機）、分享場所名稱與 `launch_map` 導航。底圖不提供步行路線；導航以 Apple Maps 公開 URL 交給原生 handler／瀏覽器，沒有引入商用地圖 SDK。正式交付需實機確認 App 接受的 URL 格式。

## 5 主觀感受回報

`POST reports`，`Content-Type: application/json`：

```json
{
  "kind": "noisy",
  "note": "靠近馬路的座位比較吵",
  "location": { "lat": 25.0386, "lng": 121.5143, "source": "manual", "areaId": "zhongzheng", "label": "中正區手動區域中心" },
  "observedAt": "2026-11-07T10:30:00+08:00"
}
```

- kind：`noisy | bright | crowded | odor | comfortable | other`。
- note 選填，最長 140 字；前後端都要驗證，後端需限制 payload 大小及儲存期限。
- location.source：`manual`（區域中心）或 `device`（另行取得授權的裝置位置）。手動回報不能變成該格網的精確觀測；可只計區域統計，不加入街道熱點。
- 不傳疾病、診斷、會員個資。實際 body 只包含上列資料，使用者按「確認送出」才送。
- 成功回 201 + 共用 envelope：`data: { "id": "report-001", "accepted": true }`。
- 後端需做合法位置／時間範圍驗證、匿名濫用控制、去重及 rate limit。`observedAt` 不可任意相信客戶端時間。

## 6 環境音量摘要

`POST measurements`：

```json
{
  "protocolVersion": 1,
  "sessionId": "native-noise-session-id",
  "source": "native_microphone",
  "location": { "lat": 25.0386, "lng": 121.5143, "source": "manual", "areaId": "zhongzheng", "label": "中正區手動區域中心" },
  "observedAt": "2026-11-07T10:30:00+08:00",
  "consent": true,
  "sampleCount": 60,
  "averageDbfs": -38.2,
  "peakDbfs": -21.5,
  "durationMs": 15000,
  "unit": "dBFS",
  "calibrated": false
}
```

- 成功回 201 + `data: { "id": "measurement-001", "accepted": true }` 與共用 meta。
- 拒絕 `consent !== true`；驗證 sessionId、durationMs、樣本數、數值及來源，sessionId 建議設唯一鍵；重試同一摘要應回原成功結果，避免重複統計。
- `averageDbfs` 為每 250ms 平均功率資料再以功率平均計算，不是直接對分貝取算術平均。現版未處理不規則間隔的時間加權，原生端應按協定固定間隔回傳；這不是 IEC 等級 Leq。
- dBFS 範圍 -160 到 0，peakDbfs >= averageDbfs，durationMs <=31000，sampleCount >0。本版不傳音訊、逐筆波形、裝置名稱或使用者識別。
- dBFS 只可表達同裝置相對音量，**不得標成 dBA，不可跨不同手機直接平均、拿來判定噪音法規或直接餵入城市聲音指數**。若後續需要校準 dBA，必須另定 protocolVersion 與校正證據欄位。
- 測量與同意分享為不同操作，未勾選同意不會 POST。資料只留 sheet 記憶體；關閉後消失。
- Flutter 協定見 [flutter-noise-interface.md](flutter-noise-interface.md)。

## 開放資料整合工作

需求單列出的上游由**後端**處理 API key、快取、更新頻率、格式轉換、授權與異常；金鑰不能寫入 Vite 環境變數。這版前端未直接串接以下服務。

| 來源／資料集 | 後端用途與限制 |
| --- | --- |
| [CWA F-D0047-061](https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-061) | 臺北市 3 天天氣預報；授權碼放後端 |
| [CWA F-D0047-063](https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-063) | 臺北市 1 週天氣預報；本版首頁只需要目前時段 |
| [CWA F-C0032-001](https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001) | 36 小時天氣概況；可選為首頁概況來源 |
| [MOENV AQX_P_432](https://data.moenv.gov.tw/dataset/detail/AQX_P_432) | AQI 測站觀測；保留站名、實際發布時間、站點與距離 |
| [MOENV AQF_P_01](https://data.moenv.gov.tw/dataset/detail/AQF_P_01) | 區域空品預報，不能標成當地即時感測 |
| [MOENV AQX_P_434](https://data.moenv.gov.tw/dataset/detail/AQX_P_434) | 歷史日統計；不是即時值 |
| [MOENV NOS_P_08](https://data.moenv.gov.tw/dataset/detail/NOS_P_08) | 噪音測站位置，**沒有即時分貝** |
| [MOENV NOS_P_03](https://data.moenv.gov.tw/dataset/detail/NOS_P_03) | 時段／地區統計，不能推論某條街現在的噪音 |
| [MOENV NOS_P_10](https://data.moenv.gov.tw/dataset/detail/NOS_P_10) | 陳情數分類分析，不是即時噪音熱點 |
| [MOENV NOS_P_07](https://data.moenv.gov.tw/dataset/detail/NOS_P_07) | 申訴管道資料，可做後續官方聯絡資訊 |
| [TDX](https://tdx.transportdata.tw/api-service/swagger/basic/) | 若之後加入公車／交通才需要，本版沒有假裝提供真實步行路由 |

上述為需求單提供的候選來源與用途，並未匯入到本次前端；上線前須由整合者重新核對實際資料集 schema、更新頻率、授權、服務費與競賽適用性。真實場所、開放時間、進入條件及無障礙資料的公開來源也仍需後端選定，不能把本地虛構場所當正式資料。

## HTTP 與部署

- CORS 允許實際前端 Origin，例如 `http://localhost:7890`、`https://ynn622.github.io`（Origin 沒有 `/30w/`）；允許 GET、POST、OPTIONS 及 Content-Type、Accept。
- 現版感官接口為匿名、不傳 Cookie 或 Authorization；不能宣稱已有會員授權。若後端要求登入，需另行串接 token 取得與錯誤 UX。
- 全部 HTTPS。GET 預設 15 秒 timeout；前端取消不保證後端一定停止工作。
- POST 不自動重試；回報失敗顯示錯誤讓使用者選擇重送。遇到網路中斷後仍可能已成功寫入，後端應加入時間／格網／匿名節流的去重機制，量測以 sessionId 冪等。
- 預報與監測快取應保留真實資料時間；不要讓重新抓取 API 的時間冒充觀測時間。
- 伺服器不得做本作品的遠端 LLM 推論。若新增 AI，執行時必須在使用者裝置端，另記錄模型來源與版本。

## 後端交付驗收

1. 六個接口依本文提供範例與空／不足／錯誤情境，附可重現的 seed（明示測試資料）及 OpenAPI。
2. 真實模式的每一種核心資料均有公開合法來源、授權、更新頻率與觀測時間，無假資料補值。
3. 確認過期／null／不足感官資料不能被低刺激篩選當成安全安靜結果。
4. reports 與 measurements 分開統計；未校準 dBFS 不當環境 dBA。
5. 完成匿名資料最小化、寫入驗證、rate limit、去重、保存與刪除策略，正式提供前另訂隱私政策。
6. 在實際 GitHub Pages 與城市通 WebView 測試 CORS、HTTPS、取消、逾時、錯誤及實際資料來源展示。
