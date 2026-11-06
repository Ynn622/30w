# CityLink 城市通 WebView

Vue 3 + JavaScript + Vite 的行動版城市服務入口示範。資訊架構參考市民服務 App 常見的卡證、快捷服務、公告與底部導覽，但未使用台北通的商標或官方素材。

## 本機開發

```bash
npm install
npm run dev
```

測試與正式建置：

```bash
npm test
npm run build
```

## 後端 API

端點集中在 `src/config/apiConfig.js`，預設 base URL 為 `https://30wbackend.idfc.dev/api/v1`。
如需切換環境，可將 `.env.example` 複製為 `.env.local` 並修改 `VITE_API_BASE_URL`，之後重新啟動或建置。

```js
import apiConfig from './config/apiConfig.js'

const url = new URL(apiConfig.endpoints.hello)
url.searchParams.set('name', 'CityLink')
const response = await fetch(url)
if (!response.ok) throw new Error(`API request failed: ${response.status}`)
const result = await response.json()
// result.data.message
```

- `apiConfig.endpoints.hello`：GET `/api/v1/hello`，可選 query `name`。
- `apiConfig.endpoints.health`：GET `/health`，回傳 `status` 與 `uptime`。
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

## GitHub Pages

`.github/workflows/deploy-frontend.yml` 會在 `main` 分支的 `frontend/**` 變更後執行測試、建置並部署 `dist/`。Vite 會依 `GITHUB_REPOSITORY` 自動判斷：

- 專案站：使用 `/<repository>/`
- `<owner>.github.io` 使用者站：使用 `/`
- 特殊路徑：在 workflow 設定 `VITE_BASE_PATH`

Repository 的 **Settings → Pages → Build and deployment → Source** 請選擇 **GitHub Actions**。
