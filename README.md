# 聆靜


<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-35495E?logo=vuedotjs&logoColor=4FC08D" alt="Vue.js">
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
</p>

---

## 本次功能

城市感官 WebView：首頁感官天氣（聲音／光線／人潮／氣味四維與另列 AQI）、兩層式快速回報（8 類型、快速標籤、強度、持續狀態、室內外）、感官地圖與靜音推薦、場所詳情、1–5 感官敏感度與低刺激模式（已移除感官篩選偏好與收藏功能）。保留隱藏測試工作台與版本檢查，移除參考圖最上方的服務導覽列；底部分頁為首頁、探索、我的。

- 先讀 [前端實作計畫](docs/superpowers/plans/2026-11-07-city-quiet.md) 與 [感官個人化計畫](docs/superpowers/plans/2026-11-07-sensory-personalization.md)。
- 後端直接依 [API 接口與資料契約](docs/backend-api.md) 實作六個接口。
- Flutter／iOS 團隊依 [環境噪音訊息協定](docs/flutter-noise-interface.md) 實作 native handler。
- 地圖、素材與資料授權見 [來源紀錄](docs/data-sources.md)。

切換後端時在 `frontend/.env.local` 設定：

```dotenv
VITE_API_BASE_URL=https://your-backend.example/api/v1
# 後端確認 POST reports 支援 intensity 後才開啟
VITE_REPORT_INTENSITY=false
# true：鎖定在臺北市天母體育館（士林區）測試，不呼叫定位；false：維持裝置定位
VITE_FAKE_LOCATION=false
# true：探索地圖感官格網一律用模擬資料（展示敏感圖層用）；false：先呼叫後端
VITE_MOCK_MAP=false
```

`VITE_FAKE_LOCATION=true` 時，`useQuietCity.locate()` 不呼叫城市通 `location` 或瀏覽器 Geolocation，直接使用 `frontend/src/config/locationConfig.js` 的天母體育館座標（取自 OpenStreetMap「天母運動公園」），第一次定位時跳通知「測試模式：已固定使用天母體育館位置，非實際定位。」。回報與量測仍照常帶這個座標，僅供展示與開發測試；正式上架請維持 `false`。GitHub Pages 部署由 repo 的 Actions Variable `VITE_FAKE_LOCATION` 控制（Settings → Secrets and variables → Actions → Variables），未設定等同 `false`；修改後需重跑部署流程。

`VITE_MOCK_MAP=true` 時，`sensoryApi.getMap` 不呼叫 `sensory/map`，直接使用 `frontend/src/data/mock-sensory-cells.json` 的模擬格網（臺北市範圍內約 2.7 萬個不規則分布的模擬回報點：一般區域約 150m 一點、熱區密集到約 50m，數值由隨機熱點與雜訊產生；回傳查詢中心 2km 內的點，移動地圖不會改變數值）。這個 JSON 是敏感圖層的模擬資料來源，可手動修改，或執行 `npm run mock:cells`（`frontend/scripts/generate-mock-cells.mjs`）重新產生；只在需要模擬地圖時才動態載入，仍以 `meta.mock=true` 標示並跳通知；場所清單與首頁概況照常呼叫後端。用於後端尚無達門檻資料時展示敏感圖層，正式上架請維持 `false`。部署同樣由 Actions Variable `VITE_MOCK_MAP` 控制。

SSI（環境感官刺激指數）與 SFS（個人適配分數）在前端以 `frontend/src/lib/sensoryIndex.js` 計算：只採 `sensoryIndex.scoreVersion=ssi-v0.1` 且 30 分鐘內有效的維度，缺值不當作低刺激並標示涵蓋率；後端未提供版本化指數時只顯示各維度，不自行推算 SSI。敏感度、排序與低刺激模式只存本機，不加入 API query。

感官資料一律先呼叫後端（`VITE_API_BASE_URL`）；連不上、路由不存在（404）、伺服器錯誤或回應格式不符時，該次請求改用 `frontend/src/data/quietMock.js` 的完整模擬資料，並跳出通知「後端感官服務暫時無法連線，已改用模擬資料顯示。」。模擬期間畫面以「模擬」小標與首頁「感官概況說明」視窗標示（競賽規則要求清楚標示模擬內容），每 2 分鐘持續重試後端（切回視窗時也會立即重試），三種資料都取得後端回應時自動切回並通知。取消請求不改用模擬；回報／量測只有在無法連線或路由不存在時才模擬完成（不上傳），驗證錯誤與頻率限制仍顯示錯誤讓使用者重試。

2026-11-07 晚間查核 `https://30wbackend.idfc.dev/api/v1`：`places`、`places/{id}` 已上線，回傳臺北市開放資料場所（公園、涼適點、圖書館等，感官四維目前皆為 null、信心 insufficient，因此開啟「低噪」等低刺激篩選時清單為空）；`sensory/overview`、`sensory/map`、`POST reports`、`POST measurements` 仍回 404，這些部分繼續使用模擬資料並以通知標示。後端另提供 `resources` 系列（無障礙設施、公廁、涼適點等開放資料點位，見後端 `/openapi.json`），前端尚未使用。後端 CORS 允許 `localhost:5173` 與 `ynn622.github.io`，但不含 `localhost:7890`；本機要連真實後端請用 `.claude/launch.json` 的 `frontend-5173`（`npm run dev -- --port 5173`）。修改後重新啟動或建置。偏好與收藏 ID 僅存在此裝置；精確位置不會持久化；環境音量量測的數值摘要保留最近 20 筆於此裝置（`quiet-city-noise-history`，不含座標與音訊），首頁顯示最近三筆。畫面以「dBFS + 校準值」估計 dB（預設 120，可在 `#debug` 的「噪音校準」用參考音量計校準，存於 `quiet-city-noise-offset`），並依估計值自動顯示安靜（<50）／普通（50–69）／吵雜（≥70）；未校準時標示誤差可能達 ±10 dB 以上，不是 dBA 或法規量測。上傳後端仍只送 dBFS。

## 地圖與噪音量測

地圖採 **MapLibre GL JS + OpenFreeMap Liberty** 開源底圖，支援繁中標籤、拖曳縮放、聲音／光線／人潮圖層及場所選取。來源與 attribution 保留於地圖角落；不使用商用地圖 SDK。場所圖片是原創插畫，距離為直線估算，沒有假裝提供步行分鐘數。

環境音量面板由網頁以 `getUserMedia` + Web Audio 在裝置上計算，不需自訂 bridge handler；城市通 App 內需由 App 團隊加入麥克風權限宣告與 WebView 權限處理（見 [docs/flutter-noise-interface.md](docs/flutter-noise-interface.md)），**尚待實機驗證**。不支援或未授權時顯示說明，不模擬音量。未校準量測為 **dBFS，不能當 dBA**，使用者須主動開始並另行同意分享摘要，不會上傳錄音。

## 技術框架

- 前端：Vue 3、JavaScript、Vite
- 測試：Vitest
- 部署：GitHub Pages

## 授權

專案原創程式依 [GNU AGPL 第 3 版或更新版本](LICENSE) 釋出（`AGPL-3.0-or-later`）。第三方套件、底圖、圖資與字型保留各自授權與著作權聲明，見 [來源紀錄](docs/data-sources.md) 與 `frontend/public/third-party/`。

## WebView 支援

前端依照[城市通雙向溝通規範](https://tpe-guideline.web.app/docs/two-way-connection/web.html)，透過 `window.flutterObject` 與 App 傳送及接收 `{ name, data }` 格式的 JSON 字串。

感官資料是否改用模擬資料只取決於後端是否可用，與是否在瀏覽器／App 中開啟無關；需要原生能力的功能會獨立檢查 bridge 支援。

## 本機啟動

需要 Node.js **22.12 或以上**，可依 `frontend/.nvmrc` 切換 Node 22。

```bash
cd frontend
npm install
npm run dev
```

啟動後開啟 `http://localhost:7890`。若 port 已被占用，請先釋放再啟動。

## 測試與建置

```bash
# 執行測試
npm test

# 建立正式版本
npm run build
```

建置完成的檔案會輸出至 `frontend/dist`。
