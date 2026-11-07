# AGENTS.md

## 專案摘要

這是一個提供城市通 App WebView 使用的行動版城市服務前端。主要程式位於 `frontend/`，使用 Vue 3、JavaScript、Vite 與 Vitest，並由 GitHub Actions 部署至 GitHub Pages。

## 2026 競賽限制與開發決策

依本專案城市通用途，採用「2026 臺北秋季程式設計節－城市通微服務大黑客松」規範。查核日期：2026-11-07。

官方來源：[競賽規則](https://codefest.taipei/2026-fall/rules)（伍、競賽內容；柒、得獎隊伍權利義務；捌、智慧財產聲明）、[技術 FAQ](https://codefest.taipei/2026-fall/rules/faq)。主辦單位若更新公告，重新查核後再修改本節，不套用往年規則。

### 官方要求

- **作品使用的軟體與套件必須開源**，不得自行引入可能產生後續授權費、訂閱費、付費功能或妨礙上架的商用模組與第三方套件；官方明列 Google Maps 等商用地圖套件為限制案例。免費額度或免費試用不等於開源、也不保證合規。
- **核心與關鍵資料須為公開、合法的開放資料，並註明引用來源**；只有其餘非必要資料可用模擬資料替代。展示時清楚標示模擬內容，不把假資料冒充實際串接結果。
- **開發時可以使用雲端 AI 協助**企劃、寫程式、除錯及資料整理；但作品執行時的 LLM 即時理解、推論與生成，**必須完全在裝置端執行**。不可呼叫外部雲端模型 API、自建遠端模型伺服器或其他遠端 LLM 服務。
- 登入、資料庫、檔案儲存、排行榜與資料同步等一般後端服務可使用，但不可將使用者輸入或作品資料送往後端做 LLM 推論。開發階段預先生成的固定文字、圖片與程式碼可用，不得宣稱為執行時即時 AI。
- 使用裝置端模型時，須揭露模型名稱、版本、量化格式、推論框架與來源，並能接受斷網、全新題目的現場驗證；不得部署規則所禁止的危害國家資通安全產品（含大陸廠牌資通訊軟硬體與服務）。
- 競賽開發成果須公開釋出並依 **AGPL** 授權，規則指定的聲明為 AGPL 第 3 版或更新版本；保留第三方原有授權與著作權聲明，確保程式、素材及資料有合法使用權。依規則，公布得獎結果日起一年內不得下架相關開發成果。
- 最終成果必須可移轉、可維運、可上架。得獎後須配合指定元素整併至官方程式庫，原則上於通知翌日起一個月內完成，並與獎金核發連動。
- 成果發表僅投影作品實際運作畫面，不使用 PowerPoint、Keynote、Google 簡報等任何形式簡報；功能要可實際操作，不能只交付展示圖。

### AI 執行原則：有疑義先問開發者

- 新增依賴、SDK、模型、地圖、字型、圖片或資料來源前，先核對來源、授權、費用與可移轉性；確認可開源及符合競賽要求後才加入，並在 README 或相關文件記錄來源與授權。
- 需要非開源、商用、付費／訂閱、專有雲端 API、授權不明的素材／資料或規則未涵蓋的第三方服務時，**先詢問開發者**，說明用途、限制及可行的開源替代方案，再處理該項需求；無關工作可繼續。
- 技術文件的範例不代表賽規核准。現有 `launch_map` 的 Google Maps 範例網址僅供介接測試；正式作品若要依賴該服務，先請開發者確認，不擴充為商用地圖 SDK 整合。

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
- `frontend/src/components/quiet/`：聆靜首頁、探索、我的、場所詳情與 sheet。
- `frontend/src/data/quietMock.js`：後端無法連線時的完整模擬資料（需跳通知並標示模擬）。
- `frontend/src/lib/sensoryApi.js`：感官接口，先打後端、失敗才改用模擬資料。
- `frontend/src/lib/webview.js`：城市通雙向溝通封裝。
- `frontend/src/lib/nativeClient.js`：可等待回覆的原生請求，集中管理逾時、取消與 listener 清理。
- `frontend/src/lib/apiClient.js`：共用 JSON API 呼叫與錯誤處理。
- `frontend/src/components/DebugView.vue`：隱藏測試工作台，使用 `#debug`、`cityDebug.open()` 或 `Ctrl + Alt + D` 開啟；不做環境區分。
- `frontend/src/components/AsyncState.vue`：共用載入、錯誤與空資料畫面。
- `frontend/src/config/apiConfig.js`：僅管理後端 base URL；使用 `VITE_API_BASE_URL` 切換環境。
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

## Git 提交與分支規範

依照 [Git_Guide.md](https://github.com/Ynn622/ProfiqAI/blob/main/Git_Guide.md) 執行，重點如下。

### Commit 訊息

```text
[類型] 變更摘要

1. 詳細變更項目
2. 詳細變更項目
```

- 摘要用一句話說明修改，不超過 70 字；只有多項修改時才需要編號細項。
- 使用以下類型：`[new]` 新增功能／模組／頁面、`[fix]` 修正錯誤、`[refactor]` 不改變功能的重構、`[style]` 樣式／排版／格式、`[docs]` 文件、`[perf]` 效能、`[ci]` 自動化／部署。
- 例如：`[new] 新增每分鐘前端版本檢查`、`[docs] 更新專案開發規範`。
- 避免 `update`、`fix again`、`try test` 等無意義訊息。
- Commit 前檢查修改範圍與影響，確認可執行且不破壞既有功能；程式修改須通過 `npm test` 與 `npm run build`。