# CityLink 城市通 WebView

Vue 3 + JavaScript + Vite 的行動版城市服務入口示範。資訊架構參考市民服務 App 常見的卡證、快捷服務、公告與底部導覽，但未使用台北通的商標或官方素材。

## 本機開發

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

本專案的服務點擊暫時使用自訂 `open_service`，正式介接時需在 App 端建立同名 handler。一般瀏覽器沒有 bridge 時會進入示範模式。舊的 WebKit、Android 與 React Native bridge 僅保留為 fallback。

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
