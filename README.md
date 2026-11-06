# 30w


<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-35495E?logo=vuedotjs&logoColor=4FC08D" alt="Vue.js">
  <img src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
</p>

---

## 技術框架

- 前端：Vue 3、JavaScript、Vite
- 測試：Vitest
- 部署：GitHub Pages

## WebView 支援

前端依照[城市通雙向溝通規範](https://tpe-guideline.web.app/docs/two-way-connection/web.html)，透過 `window.flutterObject` 與 App 傳送及接收 `{ name, data }` 格式的 JSON 字串。

若直接使用一般瀏覽器開啟，系統會自動切換成示範模式，不影響畫面瀏覽與基本操作。

## 本機啟動

```bash
cd frontend
npm install
npm run dev
```

啟動後依照終端機顯示的網址開啟頁面，預設通常為 `http://localhost:5173`。

## 測試與建置

```bash
# 執行測試
npm test

# 建立正式版本
npm run build
```

建置完成的檔案會輸出至 `frontend/dist`。
