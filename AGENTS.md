# AGENTS.md

## 專案摘要

這是一個提供城市通 App WebView 使用的行動版城市服務前端。主要程式位於 `frontend/`，使用 Vue 3、JavaScript、Vite 與 Vitest，並由 GitHub Actions 部署至 GitHub Pages。

## 快速開始

```bash
cd frontend
npm install
npm run dev
```

修改完成後至少執行：

```bash
cd frontend
npm test
npm run build
```

## 重要路徑

- `frontend/src/App.vue`：頁面切換、Toast 與 WebView 互動入口。
- `frontend/src/components/`：首頁、服務、票夾、個人頁與共用元件。
- `frontend/src/data/services.js`：示範服務資料。
- `frontend/src/lib/webview.js`：城市通雙向溝通封裝。
- `frontend/src/config/apiConfig.js`：後端 base URL 與 API 端點；使用 `VITE_API_BASE_URL` 切換環境。
- `frontend/src/styles.css`：行動版樣式與 safe-area。
- `.github/workflows/deploy-frontend.yml`：GitHub Pages 部署流程。

## WebView 介接規則

介接以城市通文件為準：<https://tpe-guideline.web.app/docs/two-way-connection/web.html>

- 主要 bridge 是 `window.flutterObject`，不要在元件中直接操作 bridge，統一使用 `src/lib/webview.js`。
- 網頁呼叫 App：`flutterObject.postMessage(JSON.stringify({ name, data }))`。
- App 回覆網頁：監聽 `flutterObject` 的 `message` 事件並解析 `event.data`。
- Vue 元件卸載時必須移除 listener，避免重複註冊。
- 官方既有名稱包含 `userinfo`、`launch_map`、`phone_call`、`1999agree`、`location`、`deviceinfo`、`open_link`、`notify`、`qr_code_scan`。
- `open_service` 與 `native_action` 是本專案暫定的自訂名稱，正式使用前需確認 App 端有同名 handler。
- 不要把真實會員個資寫入程式碼、測試資料、console 或版本庫。

## 開發原則

- 使用 JavaScript，不新增 TypeScript，除非需求明確要求。
- 維持 WebView 與行動裝置優先，支援 320px 寬度、safe-area 與至少 44px 觸控區。
- 不直接複製台北通商標或官方圖片。
- 新增 bridge 方法時，同步補上 `frontend/src/lib/webview.test.js` 測試與 README 說明。
- GitHub Pages base path 由 `frontend/vite.config.js` 處理，不要硬編碼 `/30w/`。
