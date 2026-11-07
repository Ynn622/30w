# 城市靜音鍵


<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-35495E?logo=vuedotjs&logoColor=4FC08D" alt="Vue.js">
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
</p>

---

## 本次功能

城市感官 WebView：首頁感官天氣、兩步快速回報、感官地圖與靜音推薦、場所詳情、收藏與感官偏好。保留隱藏測試工作台與版本檢查，移除參考圖最上方的服務導覽列；底部分頁為首頁、探索、我的。

- 先讀 [前端實作計畫](docs/superpowers/plans/2026-11-07-city-quiet.md)。
- 後端直接依 [API 接口與資料契約](docs/backend-api.md) 實作六個接口。
- Flutter／iOS 團隊依 [環境噪音訊息協定](docs/flutter-noise-interface.md) 實作 native handler。
- 地圖、素材與資料授權見 [來源紀錄](docs/data-sources.md)。

預設為 **demo**，天氣、感官資料與虛構場所皆有示範標示；確認示範回報不會上傳。正式串接時在 `frontend/.env.local` 設定：

```dotenv
VITE_API_BASE_URL=https://your-backend.example/api/v1
VITE_SENSORY_MODE=api
```

切換後重新啟動或建置。API 失敗會顯示可重試的錯誤，不會偷偷改用假資料。偏好與收藏 ID 僅存在此裝置；量測與精確位置不會持久化。

## 地圖與噪音量測

地圖採指定 [Yuzen 地圖](https://map.yuzen.dev/zh-TW/) 同樣的 **MapLibre GL JS + OpenFreeMap Liberty** 底圖，支援繁中標籤、拖曳縮放、聲音／光線／人潮圖層及場所選取。來源與 attribution 保留於地圖角落；不使用商用地圖 SDK。場所圖片是原創插畫，距離為直線估算，沒有假裝提供步行分鐘數。

環境音量面板已接好自訂 `noise_start`／`noise_stop` 及 `noise_status`／`noise_sample` 串流協定。**Flutter handler 尚待 App 團隊實作與 iOS 實機驗證**。一般瀏覽器不模擬音量；未連接時顯示說明。未校準量測為 **dBFS，不能當 dBA**，使用者須主動開始並另行同意分享摘要，不會上傳錄音。

## 技術框架

- 前端：Vue 3、JavaScript、Vite
- 測試：Vitest
- 部署：GitHub Pages

## 授權

專案原創程式依 [GNU AGPL 第 3 版或更新版本](LICENSE) 釋出（`AGPL-3.0-or-later`）。第三方套件、底圖、圖資與字型保留各自授權與著作權聲明，見 [來源紀錄](docs/data-sources.md) 與 `frontend/public/third-party/`。

## WebView 支援

前端依照[城市通雙向溝通規範](https://tpe-guideline.web.app/docs/two-way-connection/web.html)，透過 `window.flutterObject` 與 App 傳送及接收 `{ name, data }` 格式的 JSON 字串。

感官資料是否使用示範由 `VITE_SENSORY_MODE` 明確決定，與是否在瀏覽器／App 中開啟無關；需要原生能力的功能會獨立檢查 bridge 支援。

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
