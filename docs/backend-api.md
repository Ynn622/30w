# 聆靜後端 API 交接

前端已完成呼叫層，後端無法使用時以模擬資料備援。請依這份契約建立後端，不必沿用模擬資料；真實運作需接上合法開放資料、匿名回報及場所資料。所有 JSON 欄位使用 camelCase，時間使用含時區的 ISO 8601，座標為 WGS84。

本次依新增需求補充 SSI（環境感官刺激指數）、SFS（個人感官適配分數）與資料可用性，文件調整日期為 2026-11-07。**六個既有接口是目前前端契約；下文「第二階段」是待實作擴充，不能因文件列出就宣稱已完成串接。** 本文 JSON 均為契約示例，不是當日實際觀測。

| 階段 | 交付範圍 | 目前狀態 |
| --- | --- | --- |
| 第一階段 | 六個接口、四維缺值處理、來源／時間／信心揭露 | 前端已有呼叫層，後端與真實來源待整合 |
| 第二階段 | 兩層式回報（8 類型、快速標籤、強度、持續狀態、室內外）、逐維資料品質、SSI 與覆蓋率 | 前端已可讀取 `sensoryIndex`（ssi-v0.1）並送出強度（需 `VITE_REPORT_INTENSITY=true`）；後端待實作 |
| 第三階段 | 1–5 敏感度、端側 SFS 排序、低刺激介面模式 | 前端已完成（2026-11-07）；不增加會員或偏好上傳接口 |

## 啟用與範圍

```dotenv
# frontend/.env.local（修改後重新啟動或建置）
VITE_API_BASE_URL=https://your-backend.example/api/v1
# 後端確認 POST reports 支援 intensity 後才開啟
VITE_REPORT_INTENSITY=false
```

前端每次都先呼叫以下接口；網路錯誤、逾時、404／405、5xx 或回應格式不符時，該次請求改用前端 `frontend/src/data/quietMock.js` 的模擬資料（`meta.mock=true`、`meta.fallbackReason` 記錄原因），畫面跳出通知並標示「模擬」，之後每 60 秒重試，後端恢復即自動切回。POST 只在無法連線或 404／405／5xx 時模擬完成且不上傳；400、409、429 等錯誤直接顯示。後端上線後請確認不會落入模擬（例如格式不符也會觸發備援）。既有 debug 的 hello/health 測試獨立運作。

2026-11-07 晚間查核 `https://30wbackend.idfc.dev/api/v1`：`GET places`、`GET places/{id}` 200，符合本契約（前端已實測顯示真實場所與詳情；四維 senses 皆 null、confidence insufficient）；`sensory/overview`、`sensory/map`、`POST reports`、`POST measurements` 仍回 404 `Route not found`，前端這些部分維持模擬資料並以通知指出。後端 `/openapi.json` 另列 `resources`、`resources/sources`、`resources/{id}` 開放資料點位接口，不屬本契約，前端尚未使用。CORS 允許 `http://localhost:5173` 與 `https://ynn622.github.io`，**未允許** `http://localhost:7890`（前端 dev server 預設埠，回 403）。

前端入口：`frontend/src/lib/sensoryApi.js`。以下路徑全部接在 base URL 後，不含開頭 `/`，確保 `/api/v1` 不被覆蓋。頁面可見時每 60 秒重新讀取三種概況／地圖／清單資料，視窗重新取得焦點也更新；離開產品頁（含 debug）會清除 timer 與 listener。每次切區域／偏好會取消舊 GET，避免舊回覆覆蓋新查詢；POST 送出期間禁止重複點選。

## 本次必須提供的六個接口

| 方法與路徑 | 用途 | 前端使用處 |
| --- | --- | --- |
| `GET sensory/overview` | 區域感官概況、天氣、空品、回報與量測計數 | 首頁 |
| `GET sensory/map` | 近期匿名彙整感官熱區 | 探索地圖 |
| `GET places` | 查詢中心指定半徑內、符合資料條件的場所 | 探索地圖與清單 |
| `GET places/{id}` | 場所詳情、可進入性、感官與來源 | 詳情三分頁 |
| `POST reports` | 接收個人主觀感受 | 兩步快速回報 |
| `POST measurements` | 接收使用者另外同意分享的數值摘要 | 量測完成頁 |

本次只有感官敏感度與介面設定存於本機 localStorage，**沒有呼叫登入或雲端偏好 API**；收藏功能已移除。若未來需要跨裝置同步，再新增會員授權與個人資料契約，不應因本文件列出可能方向就假設前端已串接。

## 共用 envelope 與錯誤

所有 GET 回傳 HTTP 200：

```json
{
  "data": {},
  "meta": {
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

- 不需要 `meta.demo` 欄位；`meta.demo` 或 `meta.mock` 為 `true` 時前端視為測試資料而拒收並改用模擬資料，後端只有測試資料時請勿上線。
- `updatedAt` 是實際資料整理時間；各來源的 `observedAt` 是觀測／發布時間，兩者不得混用。各感官資料另有 freshness 限制，後端不可只更新 meta 來掩蓋舊資料。
- `sources` 逐筆提供名稱、原始網址、授權與時間。沒有資料可以是空陣列，UI 會顯示尚未取得來源；正式成果應補齊真實來源。
- 未知數值使用 `null`，不要用 `0`、空字串或猜測值代替。
- 匿名回報不是政府開放資料，須以使用者同意、去識別與合法再利用政策處理；不得在來源欄位冒稱官方監測。若無可公開的來源 URL，可為 `null`，但仍須提供來源名稱與適用的使用條件。

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
| `areaId` | string | 依目前位置推估的臺北市行政區：`zhongzheng`、`datong`、`zhongshan`、`songshan`、`daan`、`wanhua`、`xinyi`、`shilin`、`beitou`、`neihu`、`nangang`、`wenshan`；不在臺北市時前端不呼叫 |
| `lat`, `lng` | number | 使用者授權的裝置目前位置（前端已不提供手動選區） |
| `radius` | number | 300、500、1000 公尺；前端目前皆使用直線距離 |

`data` 範例：

```json
{
  "area": "中正區",
  "headline": "聲音刺激偏高",
  "description": "近期回報顯示周邊聲音刺激較高，可探索室內休息空間。",
  "senses": { "noise": 72, "light": null, "crowd": 42, "odor": null, "air": null },
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
- SSI 的四維固定為 `noise`（聲音）、`light`（光線）、`crowd`（人潮感受）、`odor`（氣味）。沿用現有 `noise`，不另引入需求示意中的 `sound`；版本欄位使用 `scoreVersion`，不使用 `score_version`。
- **`odor` 與 `air` 不可互換。** 首頁已改為 SSI 四維（第四張卡為 `senses.odor`），空品改以 `air.aqi` 原值另列，不再讀取 `senses.air`。可新增 `odor` 而保留 `air` 相容欄位；AQI 不能推算氣味，也不納入 SSI。未訂定空品映射規則前 `senses.air=null`，仍可回傳 `air.aqi` 原值。
- 前端顯示分段：0–33「低」、34–66「中等」、67–100「偏高」；空品相對尺度為「良好／普通／不佳」。目前沒有從 dBFS 推導刺激指數的演算法，後端不可混合不同手機 dBFS 做城市噪音比較。
- `observedAt` 是此次感官判斷使用的有效觀測時間（多來源以最舊的仍採用時間為準），不得填 API 呼叫或整理時間。超過 30 分鐘或未知時前端顯示資料不足。過期的單項值須直接回 null；空品另依其來源更新週期揭露。
- `reportCount` 只計主觀感受，`measurementCount` 只計有效裝置摘要；不得重複灌入同一計數。
- `confidence`：`high | medium | low | insufficient`。後端應依有效樣本數、觀測年齡、來源涵蓋度與離散程度訂定版本化規則；尚未具備規則時用 `insufficient`，不要捏造高信心。
- 資料不足時仍回 200，各感官維度為 null、confidence=insufficient、headline="資料不足，暫無法判斷"；計數保留實際已接受的有效事件／摘要筆數，只有確實沒有資料才填 0。有分類回報或 dBFS 摘要不代表已有可採用的刺激分數。上游錯誤回 503，或保留可用來源並明示不足，不能以模擬值補空。
- `weather` 和 `air` 可為 null；預報與測站時間應放來源，不宣稱全部是現在所在地即時觀測。
- `weather.temperatureC` 僅在上游提供所選預報時段的對應溫度時填入；若只有最低／最高溫，不取中點冒充氣溫。預報應另保留 `issuedAt`、`validFrom`、`validTo`，空品應保留測站座標、距離與發布時間（可擴充原物件）；這些擴充欄位目前前端尚未呈現。

## 2 感官地圖

`GET sensory/map` 使用相同格式的區域、座標與距離 query；探索頁停止拖曳／縮放 0.5 秒後，前端以**地圖中心**為 `lat`／`lng`、該處推估的行政區為 `areaId` 重新查詢（移動不到 80 公尺不查；地圖中心在臺北市外時不查）。回傳 `data`：

```json
{
  "cells": [
    {
      "id": "grid-001",
      "location": { "lat": 25.039, "lng": 121.515 },
      "senses": { "noise": 70, "light": null, "crowd": 30, "odor": null },
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

前端目前只送 `areaId`、`lat`、`lng`、`radius`（使用者感官篩選已移除）：`lat`／`lng` 為目前位置或探索地圖停止移動後的地圖中心；`radius` 依地圖可視範圍（中心到上緣／右緣中點的較大距離）選最小可涵蓋的 300／500／1000，超過 1000 公尺時仍送 1000 並提示使用者放大地圖。若要讓縮小後的地圖也能列出完整範圍，後端需另外支援更大的半徑或 `bbox` 查詢（`resources` 已有 `bbox`，`places` 尚無）多項條件為 AND。應另外排除已關閉、不可合法進入或已知環境危害的候選場所；天氣／空品不適宜戶外時，後端可排除戶外並提供說明。若進入條件未知，顯示待確認，避免保證可用。不得把 NOS_P_08 的測站位置當安靜推薦依據。

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
  "meta": { "updatedAt": "2026-11-07T10:30:00+08:00", "sources": [] }
}
```

- 場所 `updatedAt` 表示感官數值的觀測時間，不是場所介紹的編輯時間；來源時間可各自不同，過期單項回 null。
- `artwork`: `library | park | hall`，前端使用原創示意插畫，不代表實景。這版不接照片網址，避免未確認的照片授權。
- `summary` 使用既有、規則整理或開發階段預先生成的固定文字；本版不呼叫雲端 LLM，也不把後端生成摘要宣稱為即時端側 AI。
- `reviews` 每筆 `{ "text": "去識別化內容", "observedAt": "ISO 8601" }`。不傳會員識別碼、姓名或精確回報位置；後端應先去識別與檢查內容。
- 前端提供分享場所名稱與 `launch_map` 導航（收藏功能已移除）。底圖不提供步行路線；導航以 Google Maps 公開步行路線連結（`https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=walking`）交給原生 handler／瀏覽器，沒有引入商用地圖 SDK 或 API key。正式交付需實機確認 App 接受的 URL 格式。

## 5 主觀感受回報

`POST reports`，`Content-Type: application/json`。2026-11-07 起改為兩層式快速回報：第一層 8 種類型，第二層快速標籤，另有感受程度、持續狀態與室內／室外，讓使用者 5–10 秒完成，也讓後端能直接轉成 SSI 輸入。

```json
{
  "kind": "noisy",
  "tags": ["construction", "low_frequency"],
  "intensity": "strong",
  "persistence": "ongoing",
  "setting": "outdoor",
  "note": "靠近馬路的座位比較吵",
  "location": { "lat": 25.0386, "lng": 121.5143, "source": "device", "areaId": "zhongzheng", "label": "目前位置（中正區）" },
  "observedAt": "2026-11-07T10:30:00+08:00"
}
```

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `kind` | 是 | 8 種之一，見下表 |
| `location`、`observedAt` | 是 | 同前；目前前端只送 `source: "device"` |
| `note` | 視 `kind` | 最長 140 字；`kind=other` 時必填（去除空白後不可為空），其他選填 |
| `tags` | 否 | 第二層快速標籤 id 陣列，只能用該 `kind` 的標籤、不可重複；沒選時不送此欄 |
| `intensity` | 否 | `mild \| noticeable \| strong`（輕微／中等／強烈），只適用下表標示「有」的類型；前端需 `VITE_REPORT_INTENSITY=true` 才送出 |
| `persistence` | 否 | `ongoing`（現在仍然如此）、`ended`（剛剛發生，現在已結束）、`recurring`（這個地方經常如此） |
| `setting` | 否 | `indoor`（室內）、`outdoor`（室外） |

| `kind` | 名稱 | 強度 | 對應 | 第二層 `tags` |
| --- | --- | --- | --- | --- |
| `noisy` | 聲音刺激 | 有 | SSI `noise` | `construction` 施工噪音、`traffic` 交通噪音、`announcement` 廣播音量大、`voices` 人聲吵雜、`sudden_loud` 突發巨響、`low_frequency` 持續低頻聲 |
| `bright` | 光線刺激 | 有 | SSI `light` | `sun_glare` 陽光刺眼、`too_bright` 燈光過亮、`flicker` 燈光閃爍、`too_dark` 光線不足 |
| `crowded` | 人潮擁擠 | 有 | SSI `crowd` | `dense_crowd` 人潮密集、`long_queue` 排隊過長、`congested_path` 動線擁堵、`cramped_space` 空間狹窄 |
| `odor` | 氣味刺激 | 有 | SSI `odor` | `cooking_fumes` 油煙、`fragrance` 香水或香氛、`smoke` 菸味、`garbage` 垃圾異味、`other_irritant` 其他刺激性氣味 |
| `thermal` | 溫度不適 | 有 | 另列，不計入 SSI | `too_hot` 過熱、`too_cold` 過冷、`stuffy` 悶熱不通風 |
| `mobility` | 動線不適 | 有 | 另列，不計入 SSI | `obstacle` 障礙物、`narrow_path` 通道狹窄、`hard_to_find_exit` 難以找到出口 |
| `comfortable` | 舒適空間 | 無 | 正向訊號 | `quiet` 安靜、`soft_light` 光線柔和、`few_people` 人潮少、`seating` 有座位、`rest_friendly` 可短暫休息 |
| `other` | 其他感受 | 無 | 僅文字 | 無；需填 `note` |

- 舊 kind 名稱不變（`noisy`、`bright`、`crowded`、`odor`、`comfortable`、`other`），新增 `thermal`、`mobility`；畫面文字改為「聲音刺激」等類別名稱。
- `tags`、`persistence`、`setting` 為選填，**後端即使尚未儲存也必須接受（不可回 400）**；未知 `kind` 或標籤不屬於該 `kind`、重複、超出列舉值時回 400。缺少這些欄位的回報仍為有效回報，未提供不代表「無」。
- **事件 ≠ 分數**：`noisy` 等只表示該類型的主觀事件，不能自行當作分貝；`comfortable` 及其標籤是正向訊號，不能讓四維一律變低，未回報的維度也不是零。不從自由文字猜測分數或標籤。
- 舒適空間一定要保留並計數，否則地圖只會累積負面事件，沒有足夠資料推薦真正舒服的地方。
- location.source：`manual`（區域中心）或 `device`（另行取得授權的裝置位置）。目前前端只開放目前定位，實際只會送出 `device`；`manual` 保留為相容值。手動回報不能變成該格網的精確觀測；可只計區域統計，不加入街道熱點。
- 不傳疾病、診斷、會員個資。使用者按「確認送出」才送。
- 成功回 201 + 共用 envelope：`data: { "id": "report-001", "accepted": true }`。
- 後端需做合法位置／時間範圍驗證、匿名濫用控制、去重及 rate limit。`observedAt` 不可任意相信客戶端時間。
- 重送界線（issue #2）：前端在使用者按下確認時凍結 `kind`／`tags`／`intensity`／`persistence`／`setting`／`note`／`location`／`observedAt`；失敗後原樣重送會送出位元相同的 body，改了任一內容或位置才產生新的 `observedAt`，視為新事件。尚未加入 requestId／Idempotency-Key，若要新增須先共同約定，且不得改成必填。

## 6 環境音量摘要

`POST measurements`：

```json
{
  "protocolVersion": 1,
  "sessionId": "web-noise-session-id",
  "source": "web_microphone",
  "location": { "lat": 25.0386, "lng": 121.5143, "source": "device", "areaId": "zhongzheng", "label": "目前位置（中正區）" },
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
- `observedAt` 為網頁取得麥克風、實際開始量測的時間，不含等待麥克風權限；`location` 為使用者按下開始時的位置快照。同一 session 重送沿用同一份 body；重新量測會產生新 sessionId。
- `averageDbfs` 為每 250ms 平均功率資料再以功率平均計算，不是直接對分貝取算術平均。網頁以 Web Audio 在裝置上計算 RMS dBFS，並關閉自動增益、降噪與回音消除；這不是 IEC 等級 Leq。`source` 由舊版 `native_microphone` 改為 `web_microphone`，後端若有列舉驗證需同步調整。
- dBFS 範圍 -160 到 0，peakDbfs >= averageDbfs，durationMs <=31000，sampleCount >0。本版不傳音訊、逐筆波形、裝置名稱或使用者識別。
- dBFS 只可表達同裝置相對音量，**不得標成 dBA，不可跨不同手機直接平均、拿來判定噪音法規或直接餵入城市聲音指數**。若後續需要校準 dBA，必須另定 protocolVersion 與校正證據欄位。
- 測量與同意分享為不同操作，未勾選同意不會 POST。數值摘要另存於裝置 localStorage（最近 20 筆，不含座標）。前端畫面另以 dBFS + 本機校準值估計 dB 與安靜／普通／吵雜，**此估計值不上傳**，後端仍只收 dBFS。
- App 端麥克風權限設定見 [flutter-noise-interface.md](flutter-noise-interface.md)。

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
| [臺北捷運各站分時進出量統計](https://data.taipei/dataset/detail?id=63f31c7e-7fc3-418b-bd82-b95158755b4d) | 歷史 OD 資料；可計算車站歷史繁忙程度，不能當場所現在的人數或人潮密度 |

2026-11-07 已核對上述環境部資料集說明、[CWA API 文件](https://opendata.cwa.gov.tw/dist/opendata-swagger.html)與捷運資料集頁面的用途；這是來源文件查核，**不是已帶金鑰完成 API 串接或驗證即時資料**。TDX 頁面僅確認為官方文件入口，具體端點與適用方案仍待確認。環境部資料集頁面附有[政府資料開放授權說明](https://data.gov.tw/license)，CWA 的使用條件見[氣象資料開放平臺使用規範](https://opendata.cwa.gov.tw/about/rules)；整合者須保存各資料集實際適用授權、版本與標示方式，不把來源網站頁尾或本專案 AGPL 當成資料本身的授權。

實作優先接一組臺北市天氣預報與 AQX_P_432，供戶外環境背景使用；三種天氣資料不必全部串接。噪音位置／統計、歷史空品、陳情與 TDX 屬後續背景資訊，不能拿來補齊四維即時分數。施工案件與場所評論尚無本次確認的具體來源，不列為已可用資料。

上述資料尚未匯入本次前端；上線前須重新核對實際 schema、更新頻率、授權、服務費與競賽適用性。真實場所、開放時間、進入條件及無障礙資料的公開來源也仍需後端選定，不能把本地虛構場所當正式資料。新增服務若涉及專有 API、費用或授權疑義，依 AGENTS.md 先詢問開發者。

## 第二階段：四維資料與 SSI（待實作）

### 可用輸入與不能推論的內容

| 維度 | 可接受的輸入方向 | 缺值與限制 |
| --- | --- | --- |
| `noise` | 具強度的近期主觀回報；另有校正證據的音量量測 | 現行未校準 dBFS 只作同裝置相對音量展示，不直接計 SSI；噪音測站座標不能產生分數 |
| `light` | 市民對刺眼程度的主動回報 | 天氣、日照、UV 不能代替場所照度或室內刺眼程度 |
| `crowd` | 市民近期擁擠感受回報 | 捷運歷史 OD 僅作另列的歷史繁忙參考，不寫入即時 `senses.crowd` 或街道熱區 |
| `odor` | 市民近期氣味刺激回報 | AQI 不能代替氣味；歷史評論不能代替當下觀測 |

各來源先保留原始量綱、時間、空間範圍與品質，再使用版本化規則轉換。尚未建立共同尺度的主觀回報、手機音量與歷史評論不可直接加權混算。網路評論僅在確認合法開放授權或取得授權後另訂整合規格；本版不爬取商用評論。

### 回報擴充

`POST reports` 的欄位與列舉見第 5 節。`placeId` 仍為未來選填欄位，目前前端不送出。

- `intensity`：`mild | noticeable | strong`（輕微／中等／強烈），不預選。2026-11-07 起移除 `none`，因為使用者已先選定類型與具體情況；舊資料若有 `none` 可視為 10。四種 SSI 類型暫定映射為 35／65／90，屬產品假設，不是醫學或法規閾值。`thermal`、`mobility` 的強度另列統計，不計入 SSI。
- 缺少 `intensity` 的回報只列事件與標籤計數，不納入強度平均；`comfortable | other` 不接受 `intensity`，不從備註自動生成評分。
- `persistence` 影響有效期，避免短暫事件讓某處整天顯示高刺激：
  - `ongoing`：照常進入 30 分鐘有效窗。
  - `ended`：只在較短的回溯窗內計入，例如 10 分鐘，之後不再影響目前狀態；確切參數需版本化。
  - `recurring`：描述長期模式，不當作「現在」的觀測，不計入即時 SSI；可另行彙整為「經常如此」的場所／區域提示，並揭露統計期間。
  - 未提供：依舊規則視為當下觀測，信心可較低。
- `setting` 分開統計室內與室外：同一 GPS 位置，圖書館內可能很安靜，門口卻在施工。場所為室內時只採 `indoor`（或另行驗證屬於該場所）的回報；未提供室內外的回報不得併入室內場所評分，可只計入格網／室外統計或標示為不確定。
- `tags` 只做分類計數與說明文字，例如「近 30 分鐘 3 筆施工噪音」，不直接換算分數；不同標籤不另加權，除非另訂版本化規則。
- `placeId` 若存在，後端驗證場所、位置來源與可接受範圍；手動行政區中心仍只計區域事件，不據此建立場所評分。未提供時，不以最近場所猜測歸屬。
- 每一維只彙整同一空間範圍、有效窗內且通過去重／品質規則的有效回報。採算術平均或時間衰減平均均須固定公式、參數與版本；未訂規則或樣本不足時回 null。

若未來取得經校正的 dB(A)，可研究 `clip((dBA - 35) / 45 × 100, 0, 100)` 作為聲音產品映射；35／80 只是範例端點，不代表安全或不適閾值。此公式**不適用現有 protocolVersion=1 的 dBFS**，不得直接開啟。

捷運歷史參考可採 `100 × clip((N - P10) / (P90 - P10), 0, 1)`，需記錄車站、歷史期間、平假日／時段分組、N 的定義與百分位計算方式；`P90 <= P10` 或樣本不足時回 null。結果標為「歷史繁忙程度」，另外揭露資料期間，不回填本版即時四維。

### SSI、覆蓋率與信心

SSI 描述環境刺激，0–100 越高越刺激；SFS 描述個人適配，0–100 越高越符合偏好。兩者都是產品推薦指標，未經臨床驗證，不得作為醫療或安全保證。

SSI 暫定權重為 `noise: 0.4, light: 0.2, crowd: 0.3, odor: 0.1`。令 A 為有效、有值且信心非 `insufficient` 的維度：

```text
ssi = round(sum(score[k] × weight[k], k in A) / sum(weight[k], k in A))
coverage = sum(weight[k], k in A) / sum(weight[k], 全四維)
dimensionCoverage = 有效維度數 / 4
```

沒有有效維度或有效權重總和為 0 時 `ssi=null`；覆蓋率為 0。缺值不算 0 分，0 分本身則是有效觀測。權重必須有限、非負且總和大於 0；分數必須為有限的 0–100 數值，先排除無效、過期及品質不足資料再計算。僅最終指數四捨五入，不先四捨五入各項乘積。分段沿用目前 UI：0–33 低、34–66 中等、67–100 偏高，不套用需求示意的另一套分段。

`coverage` 是權重覆蓋率，`dimensionCoverage` 是維度覆蓋率，均不代表信心或正確機率。部分維度仍可產生指數，但必須同時顯示「部分資料」及缺少的維度；不能以高覆蓋率直接判為 `high`。比較不同場所時也須呈現各自覆蓋範圍，不能把缺失敏感維度的場所標成最適合。

信心使用 `high | medium | low | insufficient`，後端先訂出樣本門檻、年齡、離散程度、來源品質與空間涵蓋規則，記錄 `confidenceVersion`。尚無規則時回 `insufficient`、SSI 回 null；不能只因有一筆回報就回 `medium`。逐維信心與整體信心分開計算；資料不足不是低刺激。

### 相容擴充物件

第二階段可在 overview、Place 與地圖 cell 新增 `sensoryIndex`；前端只接受 `scoreVersion=ssi-v0.1`、有 `confidenceVersion`、逐維 `confidence` 非 insufficient、`sourceType=subjective_report`、`sampleCount>0` 且 `observedAt`／`validUntil` 在 30 分鐘內的維度，並以本機時間重算 SSI 與覆蓋率（不採用後端的 `ssi`／`coverage` 數字）。不符合者視為缺值；沒有 `sensoryIndex` 時只顯示 `senses` 各維、不計算 SSI。舊 `senses`、`confidence`、時間欄位仍須提供。以下僅為假設已有有效數值與品質規則的計算示例，並非本專案已取得的資料：

```json
{
  "sensoryIndex": {
    "ssi": 52,
    "level": "中等",
    "dimensions": { "noise": 70, "light": 20, "crowd": 50, "odor": null },
    "weights": { "noise": 0.4, "light": 0.2, "crowd": 0.3, "odor": 0.1 },
    "coverage": 0.9,
    "dimensionCoverage": 0.75,
    "confidence": "medium",
    "scoreVersion": "ssi-v0.1",
    "confidenceVersion": "confidence-v0.1",
    "dimensionMeta": {
      "noise": { "observedAt": "2026-11-07T10:20:00+08:00", "validUntil": "2026-11-07T10:50:00+08:00", "sampleCount": 8, "confidence": "medium", "sourceType": "subjective_report", "missingReason": null },
      "light": { "observedAt": "2026-11-07T10:20:00+08:00", "validUntil": "2026-11-07T10:50:00+08:00", "sampleCount": 8, "confidence": "medium", "sourceType": "subjective_report", "missingReason": null },
      "crowd": { "observedAt": "2026-11-07T10:20:00+08:00", "validUntil": "2026-11-07T10:50:00+08:00", "sampleCount": 8, "confidence": "medium", "sourceType": "subjective_report", "missingReason": null },
      "odor": { "observedAt": null, "validUntil": null, "sampleCount": 0, "confidence": "insufficient", "sourceType": null, "missingReason": "no_data" }
    }
  }
}
```

本例 `(70×0.4 + 20×0.2 + 50×0.3) / 0.9 = 52.22…`，SSI 為 52，覆蓋 3/4 維、90% 預設權重；不能沿用需求示意中的 58。`level` 在 SSI 為 null 時固定「資料不足」。`missingReason` 使用 `no_data | stale | insufficient_samples | incompatible_scale`，有效時為 null；`sampleCount` 只計該維實際採用樣本，無法確認時為 null，不把跨維計數相加冒充獨立回報人數。`sourceType` 本階段為 `subjective_report` 或 null；新增可比較來源時須擴充規格及來源引用。

`dimensionMeta` 各維須能追溯至 envelope 或 Place 的來源；內部保留計算規則與採用記錄，對外不回傳個別回報 ID 或精確位置。`dimensions` 與 `senses` 對應四維必須一致；舊 `observedAt`／`updatedAt` 仍以有效四維中最舊的觀測時間填入，不能改成計算時間讓前端 freshness 檢查失效。全維無值時觀測時間為 null。過期後重算 SSI 與覆蓋率，歷史資料、天氣與 AQI 不更新這個時間。

## 第三階段：個人化 SFS 與低刺激模式（待實作）

- 使用者於裝置端設定四維敏感度 1–5；以各敏感度除以總和得到個人權重。SSI 的預設環境權重不因個人偏好改變。
- `sfs = round(100 - 個人加權刺激負擔)`，負擔沿用前節有效維度的重新正規化公式，以未四捨五入值計算；無有效維度則為 null。另算個人權重的 `fitCoverage`，不能直接沿用 SSI 的 `coverage`。
- 完整四維為 70／20／50／10，敏感度 5／1／2／2（權重 50%／10%／20%／20%）時 SFS=51；2／5／1／2（20%／50%／10%／20%）時 SFS=69。這兩組可由 1–5 設定直接產生；需求示意中的 60%／10% 權重比為 6:1，超出此控制範圍，不能當成滑桿可產生的設定。缺值時顯示部分適配，不能用未知代替低刺激，也不能放寬使用者選定的必要篩選。
- 前端已在本機計算與排序，偏好不送後端：「我的」提供四維 1–5 敏感度，推薦依「個人適配優先」（完整資料優先，再依 SFS、距離）排序。使用者感官篩選（低噪、柔光、少人、氣味、室內）與距離偏好已移除：前端目前呼叫 `GET places` 只帶 `areaId`、`lat`、`lng` 與固定 `radius=500`，不送 `noise`／`light`／`crowd`／`indoor`；後端保留這些可選參數的支援即可。後端仍依直線距離回傳即可，不需也不應自行改成 SFS 排序。
- 低刺激模式已由前端實作：柔和配色、停止動畫與地圖飛行、降低熱區不透明度、較大操作區並隱藏裝飾插畫；警示保留文字，不只依賴顏色或聲音。不需新增後端接口。

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

第二階段驗收另加：8 種 `kind` 與其標籤驗證（標籤不屬於該類型、重複或 `other` 無說明時回 400，選填欄位缺漏時仍接受）、`persistence=ended` 不延長有效期且 `recurring` 不計入即時 SSI、室內外分開統計、舒適空間正向訊號不把四維歸零、強度缺漏不轉分、四維與空品分離、逐維來源與有效期可追溯；覆蓋率分母固定四維權重，驗證全缺值、有效 0 分、過期、零權重與部分覆蓋的計算結果。第三階段須驗證同一場所依不同偏好產生不同 SFS，且偏好留在裝置端；低刺激模式可實際切換。未完成前不得列入第一階段已串接項目。
