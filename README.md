# 聆靜

<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-35495E?logo=vuedotjs&logoColor=4FC08D" alt="Vue.js">
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/MapLibre-396CB2?logo=maplibre&logoColor=white" alt="MapLibre">
  <img src="https://img.shields.io/badge/License-AGPL--3.0--or--later-blue" alt="AGPL-3.0-or-later">
</p>

**在台北，找到屬於你的安靜角落。**

聆靜是一個在台北通 App 裡開啟的城市感官服務，幫對聲音、光線、人潮或氣味比較敏感的人，在出門前和移動中看出哪裡比較安靜、舒服。

同一個地方，怕吵的人和怕擠的人感受不同。聆靜會依你在「我的」設定的感官敏感度，重新計算每個地點的刺激程度，畫成**只屬於你的敏感圖層**。

- 線上版本：<https://ynn622.github.io/30w/>
- 前端（本專案）：<https://github.com/Ynn622/30w>
- 後端：<https://github.com/Ynn622/30w_backend>（API：`https://30wbackend.idfc.dev/api/v1`）

---

## 主要功能

| 頁面 | 功能 |
|---|---|
| **首頁** | 依目前位置顯示所在的區和里（例如「士林區・三玉里」），以及周圍 150 公尺的聲音、光線、人潮、氣味。整體狀態會依你的敏感度算出「整體舒適／普通／偏刺激」。每 2 分鐘自動更新，也可以手動重新整理。 |
| **快速回報** | 分享當下的感受：選類型、標籤、強度與室內外，回報會帶上目前位置。 |
| **聽見此刻的環境** | 用手機麥克風在裝置上即時計算音量。**不錄音、不上傳聲音**，只有在你同意後，才分享平均值、峰值等統計數字。 |
| **探索** | 全螢幕地圖加上可拖曳的推薦清單。開啟**敏感圖層**後，地圖會畫出綠到紅的平滑色帶，清單只列出綠區內的地點。 |
| **場所詳情** | 分成三個分頁：感官資訊、基本資訊（地址、開放時間、設施、無障礙），以及依你的敏感度計算的平日／假日歷史趨勢。可以直接開啟導航。 |
| **我的** | 調整四種感官的敏感度（1–5），以及**低刺激模式**（米白底、單色圖示、灰階地圖、減少動畫）。設定只存在這支手機，不會上傳。 |

## 個人刺激值怎麼算

首頁、敏感圖層、場所排序與歷史趨勢都用同一條公式：

```text
聲音權重 = 你的聲音敏感度 × 2，其他感官權重 = 你的敏感度
個人刺激值 = Σ(感官值 × 權重) ÷ Σ(有資料感官的權重)
```

- 感官值是 0–100，越高越刺激。
- 沒資料的感官不列入計算，不會被當成安靜。
- 0–33 是綠色（舒適）、34–66 是黃色（普通）、67–100 是紅色（刺激）。
- 敏感圖層會把每個網格的個人刺激值，用高斯加權平均內插成平滑色帶，並畫出 33 和 66 兩條等值線。

程式在 [`frontend/src/lib/sensoryIndex.js`](frontend/src/lib/sensoryIndex.js) 與 [`frontend/src/lib/sensoryField.js`](frontend/src/lib/sensoryField.js)。

## 系統架構

```text
台北通 App（Flutter WebView）
  └─ 聆靜前端（本專案，Vue 3，部署在 GitHub Pages）
       ├─ window.flutterObject ⇄ App：定位、開啟連結、導航等原生功能
       ├─ 後端 API（Ynn622/30w_backend）：場所、感官概況、逐小時網格、回報、量測
       ├─ OpenFreeMap 底圖（MapLibre GL）
       └─ OpenStreetMap Nominatim：座標轉地址
```

- 個人敏感度、排序方式、低刺激模式和量測紀錄只存在手機上，**不會送到後端**。
- 所在的里是在手機上用臺北市里界判斷的，座標不會為此送到任何服務。
- 後端提供的場所來自臺北市開放資料。感官網格與場所情境目前是後端的**典型時段推估**，不是即時觀測，畫面上會標示。
- 場所清單在後端連不上時，會改用內建模擬資料，並跳出通知、標上「模擬」。

## 文件

- [前端開發說明](frontend/README.md)：功能細節、環境變數、模組說明
- [後端 API 與資料契約](docs/backend-api.md)
- [台北通 App 環境噪音協定](docs/flutter-noise-interface.md)：給 Flutter／iOS 團隊
- [地圖、素材與資料來源授權](docs/data-sources.md)
- [AGENTS.md](AGENTS.md)：開發規範與競賽限制

## 本機開發

需要 Node.js **22.12 以上**（可用 `frontend/.nvmrc` 切換）。

```bash
cd frontend
npm install
npm run dev -- --port 5173
```

開啟 <http://localhost:5173>。後端 CORS 只允許 `localhost:5173` 和 GitHub Pages。直接執行 `npm run dev` 會用預設的 7890 port，這時連不到後端：場所清單會改用模擬資料，首頁概況和敏感圖層會顯示讀取錯誤。

要切換後端或調整功能開關，請把 `frontend/.env.example` 複製成 `frontend/.env.local` 再修改，修改後需重新啟動。

```bash
cd frontend
npm test
npm run build
```

建置結果輸出到 `frontend/dist`。推送到 `main` 且有修改 `frontend/` 時，GitHub Actions 會自動部署到 GitHub Pages。

## 技術框架

- 前端：Vue 3、JavaScript、Vite
- 地圖：MapLibre GL JS、OpenFreeMap（Liberty／Positron），不使用商用地圖 SDK
- 測試：Vitest
- 部署：GitHub Actions → GitHub Pages
- App 介接：依[台北通雙向溝通規範](https://tpe-guideline.web.app/docs/two-way-connection/web.html)，透過 `window.flutterObject` 收發 `{ name, data }` JSON

## 授權

本專案原創程式依 [GNU AGPL 第 3 版或更新版本](LICENSE)（`AGPL-3.0-or-later`）釋出。第三方套件、底圖、圖資與字型保留各自的授權與著作權聲明，詳見[來源紀錄](docs/data-sources.md)與 `frontend/public/third-party/`。
