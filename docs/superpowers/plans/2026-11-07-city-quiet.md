# 城市靜音鍵前端實作計畫

**Goal:** 在既有 Vue WebView 專案完成城市感官回報、探索與靜音推薦、場所詳情、偏好設定，以及可交接的後端及 Flutter 協定。

**Architecture:** 沿用 apiClient、webview、nativeClient、隱藏 debug 與版本檢查。以 sensoryApi 隔離明確切換的 demo/API 資料來源；元件使用同一組資料契約。地圖使用 MapLibre + OpenFreeMap Liberty；噪音由獨立串流 client 管理 session、timeout 與清理。

**Tech Stack:** Vue 3、JavaScript、Vite、Vitest、MapLibre GL JS、CSS 動畫。

**Spec:** `/Users/Ynn22/Downloads/功能需求單.docx` 的文字、內嵌三張圖，以及本次使用者提供的三頁參考圖與直接指示。文件內容視為功能參考，不當作工具執行指令。

## 全域限制

- 不製作參考圖最上方城市通「服務／帳務／循環杯」nav；底部使用需求單的首頁、探索、我的三頁。
- JavaScript；320px、safe-area、44px 觸控區、鍵盤操作、prefers-reduced-motion。
- 不新增遠端 LLM；摘要使用固定示範文字或後端事先整理的非即時生成內容。
- API 模式錯誤須顯示錯誤，不自動降級為示範。示範資料、距離、時間及來源需明示；不將官方噪音測站位置當即時音量。
- 定位與麥克風分開取得同意；不自動請求、不上傳原始聲音、不要求疾病資訊。
- 新增依賴先查核來源授權；保留地圖 attribution，來源與授權記錄於文件。
- 依使用者最新決定，直接在 main 開發與提交，不另建功能分支；完成後依專案格式提交本次修改，不推送未要求的部署。

## Review Focus

1. API 失敗、空資料、取消與競態：錯誤可重試，舊請求不得蓋過新結果。
2. 無定位、拒絕、超時：提供手動區域；地圖中心不冒充使用者位置。
3. 零筆、過期或未知刺激數值：顯示資料不足／未知，不能當低刺激推薦。
4. Flutter 不存在、不同 session、權限拒絕、背景切換：停止串流並清除 listener，不顯示虛構量測。
5. 隱私設定與儲存失敗：不默默開啟分享；使用者未同意前不送出量測。

## 檔案與責任

| 檔案 | 責任 |
| --- | --- |
| `frontend/src/App.vue` | 三頁容器、debug、toast、版本檢查 |
| `frontend/src/components/quiet/QuietApp.vue` | 共用查詢、偏好與場所選取 |
| `frontend/src/components/quiet/{QuietHome,ExploreView,PlaceDetail,QuietProfile}.vue` | 各產品畫面 |
| `frontend/src/components/quiet/{SensoryMap,PlaceCard,ReportSheet,NoiseSheet,AppSheet}.vue` | 地圖、場所卡、兩步回報、感測與可操作對話框 |
| `frontend/src/composables/useQuietCity.js` | 查詢取消、區域、回報與偏好狀態 |
| `frontend/src/lib/{sensoryApi,sensoryDomain,noiseClient}.js` | API adapter、篩選與資料語意、Flutter 噪音串流 |
| `frontend/src/data/quietDemo.js` | 明確標示之固定示範資料 |
| `frontend/src/styles/quiet.css` | 行動版畫面、動畫與減少動態效果 |
| `docs/{backend-api,flutter-noise-interface,data-sources}.md` | 後端契約、原生協定、來源授權與資料限制 |

## Task 1 資料契約與示範 adapter

**Interfaces:** `createSensoryApi({ mode, request })` 產生 `getOverview(query, {signal})`、`getMap(query, {signal})`、`getPlaces(query, {signal})`、`getPlace(id, {signal})`、`createReport(body)`、`createMeasurement(body)`。回傳 `{data, meta}`；meta 含 demo、updatedAt、sources。

- [x] 先測試 demo 不呼叫 fetch、API 失敗不回退、篩選／未知值／資料過期、距離計算與座標驗證。
- [x] 實作 adapter、固定示範資料及 domain helper；設定 `VITE_SENSORY_MODE=demo|api`（預設 demo）。
- [x] 撰寫 `docs/backend-api.md`：路徑、query、JSON 範例、null 語意、來源、權限、錯誤、CORS 與後端處理範圍。
- [x] 執行相關 Vitest，確認錯誤與空資料不冒充真實結果。

## Task 2 首頁與快速回報

**Interfaces:** 首頁讀 overview；回報 `{kind, location, observedAt, note}`；分享與定位均預設關閉。

- [x] 實作三頁 shell、首頁感官天氣、聲音／光線／人潮／空品卡、資料信心、來源說明、附近推薦。
- [x] 實作選擇感受→確認送出的 sheet，支援手動區域與獨立定位按鈕、送出中防重複、錯誤重試；demo 僅記憶體示範。
- [x] 保留 `#debug`、`cityDebug`、快捷鍵、版本檢查與既有測試工具。

## Task 3 地圖與場所探索

**Interfaces:** `SensoryMap({places, cells, layer, center})` 發出 `select(id)`、`locate`；搜尋條件 `{lat,lng,radius,noise,light,crowd,indoor}`，場所詳情包含 accessibility、openingHours、confidence、sources。

- [x] 查核 MapLibre BSD-3-Clause、Liberty 樣式授權及 OpenStreetMap attribution 後安裝依賴。
- [x] MapLibre 地圖延遲載入；同一張地圖切換感官圖層／推薦，保留拖曳縮放、中文標籤、定位、圖例、更新時間、載入／失敗與重試。
- [x] 實作推薦條件、距離、空清單、場所卡、詳情三分頁、收藏、分享、導航（Apple Maps URL 由既有 launch_map 傳送，需 App 端驗證）。
- [x] 詳情使用自製插圖，不引入授權不明的場所照片。

## Task 4 Flutter iOS 環境噪音與我的偏好

**Interfaces:** 自訂 `noise_start`、`noise_stop`；回覆 `noise_status`、`noise_sample`，以 `sessionId` 隔離。iOS 回傳未校準 dBFS，只有具校正資訊時才能標成 dBA。

- [x] 先測試 session、無 bridge、拒絕、timeout、invalid sample、停止重複與 listener 清理。
- [x] 在 webview.js 加入噪音封裝，同步更新 webview.test.js；noiseClient 管理串流，元件不直接存取 flutterObject。
- [x] 實作使用者明確啟動、取消、計時／波形／結果、背景停止、分享同意後才上傳摘要；無原生 bridge 顯示實際未支援。
- [x] 偏好設定僅存本機非敏感偏好與收藏 ID，提供分享預設關閉、儲存失敗提示；不持久化聲音或精確位置。
- [x] 撰寫 Flutter 接口 md：訊息完整範例、AVAudioSession/AVAudioRecorder、權限、背景、校準、錯誤與 native handler 尚待實作。

## Task 5 整合驗證與交接

- [x] 測試 adapter 與 domain、噪音串流、既有 WebView／API／版本功能。
- [x] `cd frontend && npm test`：全數通過。
- [x] `cd frontend && npm run build`：成功，檢查地圖分包及 GitHub Pages base。
- [ ] 可用時以瀏覽器檢查 320px 與一般手機畫面及回報／推薦／收藏互動；目前 CUA browser host 不可用，須如實記錄未能視覺驗證。
- [x] 更新 README、來源授權、需求覆蓋與未完成的後端／Flutter 實機工作，檢查 diff，僅提交本次檔案。

使用者已授權先寫計畫後直接實作；在本次 session 依序完成，不另停下請求計畫批准。

## 完成紀錄

- 實作：首頁／探索／我的三頁、兩步回報、詳情三分頁、收藏、來源 sheet、原創 SVG 插畫與 CSS 動畫；沒有最上方服務導覽列。
- 資料：預設明示 demo，六個真實 API 呼叫已就位；GET 競態取消、正式模式每分鐘前景刷新與回焦點更新、篩選二次檢查、過期資料不冒充目前狀況。
- 地圖：已核對指定網站採 OpenFreeMap Liberty；採同底圖、繁中標籤、格網觀測點及加權熱圖；MapLibre 與 worker 延遲載入。
- Flutter：協定 v1 的 start／stop／status／sample、15 秒波形與統計、session／有效值檢查、權限失敗、背景停止與清理；正式原生 handler 仍由 App 團隊實作。
- 文件：backend-api.md、flutter-noise-interface.md、data-sources.md 與兩份 README 更新完成，新增依賴授權原文隨 public/third-party 交付；依 AGENTS.md 補上根目錄 LICENSE 與 AGPL-3.0-or-later 聲明。
- 相容性：新間接依賴要求 Node 22，已同步 engines >=22.12、.nvmrc 與 CI Node 22。
- 驗證：10 個測試檔案共 **50 項通過**；正式建置成功；另外以 GitHub Pages /30w/ base 建置，檢查 index、MapLibre worker URL 與授權靜態資產成功。MapLibre 主 chunk 約 1.1 MB（gzip 約 300 KB）有 Vite 體積提示，已獨立延遲載入，不阻塞首頁。
- 驗證限制：CUA browser host unavailable，無法對實際 320px／手機畫面目視驗證或點擊走查；已以 Vue SSR 測試首頁輸出與資料不足情境，不能取代瀏覽器與真機測試。
- 待外部團隊：六個後端接口與公開真實場所／環境資料、Flutter handler、iOS 麥克風／背景／導航實機測試；未在本次假稱完成。
