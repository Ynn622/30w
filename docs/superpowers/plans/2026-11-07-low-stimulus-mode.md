# 低刺激模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「低刺激模式」從單純的介面配色開關，擴充成一個完整的使用情境：介面本身不刺激（畫面、動態、通知），地圖只呈現後端判定的低刺激綠區，推薦只列出有資料支持的低刺激場所，且資料不足時誠實說明。

**Architecture:** 沿用 `preferences.lowStimulus`（僅存本機）作為唯一開關，`body.q-low-stimulus` 讓 Teleport sheet 一併套用。新增 `sensory/map` 的 `zones`／`zoneRule` 解析與 `Place.zone` 判讀（契約見 `docs/backend-api.md` 2.1），由 composable 提供 `lowZones`、`zoneOf(place)`，SensoryMap 依模式切換熱圖或綠區圖層。後端未提供 `zones` 時前端不自行推算綠區。

**Tech Stack:** 既有 Vue 3、JavaScript、MapLibre GL、Vitest、CSS；不新增依賴或外部服務。

**Spec:** `docs/backend-api.md` 2.1 低刺激綠區（`ca22720`）、第三階段低刺激模式段落；`AGENTS.md` 開發原則（320px、safe-area、44px 觸控區）。

## 現況（2026-11-07）

已完成，作為本計畫起點：

- 開關位置：「我的」→「介面」→「低刺激模式」，存在 localStorage `quiet-city-preferences.lowStimulus`。
- 介面：`styles/quiet.css` 的 `.q-low-stimulus` 規則——柔和配色變數、停用所有 animation／transition、隱藏裝飾插畫（城市剪影、天氣圖示、場所縮圖、詳情插畫、頁尾）、降低飽和度、主要按鈕加大到 52px。
- 地圖：熱圖不透明度 0.43 → 0.22、觀測點 0.65 → 0.5；`flyTo`／縮放動畫時間設為 0（SensoryMap、MiniMap）。
- 底部抽屜、sheet、頁面切換：因全域停用 transition 而直接切換。

缺口：

1. **入口太深**：只有「我的」頁能開關；在地圖上覺得太刺激時要跳三層。
2. **地圖仍以熱圖為主**：紅橙色熱區本身是刺激，且熱圖顏色是樣本累加的視覺效果，不能代表「哪裡安靜」（契約 2.1 已說明）。
3. **推薦未依低刺激判定**：只依 SFS／距離排序，沒有使用 `Place.zone`；目前場所感官資料多為 null，開啟模式也不會改變清單。
4. **仍有突發刺激**：新版本偵測會「10 秒後自動重新整理頁面」；Toast 3.5 秒自動消失；地圖觀測點與場所標記仍為高彩。
5. **系統偏好未銜接**：`prefers-reduced-motion` 只影響動畫，未提示使用者可開啟低刺激模式；`prefers-contrast`、`prefers-reduced-transparency` 未處理。

## Global Constraints

- 開關與相關設定只存本機，不上傳；不新增會員或偏好 API。
- **資料不足不是低刺激**：沒有 `zones`、`zone` 為 `unknown`、資料過期時，不畫綠區、不標示為低刺激，改以文字說明。
- 綠區只用後端回傳的多邊形與 `zoneRule.threshold`；前端不從熱圖顏色或 `cells` 外插綠區。模擬資料的綠區須標示「模擬資料」。
- 必要狀態一律保留文字：錯誤、資料不足、模擬資料、市外無法服務、定位失敗。
- 320px、safe-area、觸控區至少 44px（模式開啟時主要操作 52px）；不新增遠端 AI、字型或素材。

## Review Focus

- 綠區門檻與 `GET places?noise=low`、前端「低」分段一致（≤ 33）；33 屬綠區、34 不屬。
- `zones` 缺漏、空陣列、格式錯誤、`level` 非 `low`、過期（`validUntil` 已過）時都不畫綠區且不報錯。
- 室內場所以自身 `senses` 為準，`zone` 只當周邊參考，不能以室外綠區推論室內安靜。
- 模式切換不重新打 API（`zones` 一次回傳四維）；切換後地圖、清單、sheet 同步。
- 關閉模式後完全回到原畫面，不殘留 class、paint 屬性或篩選。

### Task 1: 資料層——解析綠區與場所標註

**Files:** 修改 `frontend/src/lib/sensoryApi.js`、`frontend/src/lib/sensoryDomain.js`、`frontend/src/composables/useQuietCity.js`、`frontend/src/data/quietMock.js`；新增 `frontend/src/lib/sensoryZones.js`、`sensoryZones.test.js`。

**Interfaces:**

- `parseZones(data, now)` → `{ rule, features }`：只保留 `Polygon`／`MultiPolygon`、`properties.level === 'low'`、`layer` 屬四維、`validUntil` 未過期、`zoneRule.zoneVersion` 為支援版本（`zone-v0.1`）的 feature；其餘丟棄。缺 `zones` 回 `{ rule: null, features: [] }`。
- `zoneOf(place, layer)` → `'low' | 'not_low' | 'unknown'`：讀 `Place.zone[layer]`，缺漏或非列舉值一律 `unknown`；室內場所（`indoor === true`）另以自身有效 `senses` 為準（≤ 33 才算 low）。
- composable 新增 `lowZones`（computed，依目前圖層過濾的 features）與 `zoneOf`；`sensory/map` 的 `zones` 隨 `cells` 一起取得，不另發請求。
- 模擬資料：`mockCells` 旁新增 `mockZones`，以模擬格網中 ≤ 33 的格子產生 100 m 方格多邊形，`meta.mock` 時才使用。

- [x] 測試：缺 `zones`、空 features、非 `low`、過期、錯誤座標格式、未知 `zoneVersion` 皆回空；33 保留、34 丟棄；室內場所不受室外 zone 影響。
- [x] 實作解析與 composable 介接，確認舊後端（無 `zones`）不報格式錯誤。
- [x] 更新 `docs/backend-api.md` 階段表：綠區「前端已讀取」。

### Task 2: 地圖——低刺激模式改畫綠區

**Files:** 修改 `frontend/src/components/quiet/SensoryMap.vue`、`ExploreView.vue`、`frontend/src/styles/quiet.css`。

**Interfaces:** SensoryMap 新增 `zones` prop；`lowStimulus` 為 true 時隱藏 `sensory-heat` 與 `sensory-observed`，改顯示 `sensory-zones`（fill 低飽和綠 `#8fbf9f`、opacity 0.28，外框 1px）；false 時恢復熱圖。

- [x] 新增 GeoJSON source `zones` 與 fill／line 兩層，切換以 `setLayoutProperty(..., 'visibility')` 完成，不重建地圖。
- [x] 圖例改為「綠色：後端判定的低刺激區域（聲音 ≤ 33）」；無綠區時圖例顯示「目前沒有已確認的低刺激區域」，不畫任何綠色。模擬資料時附「模擬資料」標籤。
- [x] 場所標記在模式中降為單色（灰綠），並依 `zoneOf` 加文字標記「低刺激區」，不只靠顏色區分。
- [x] 「聲音圖層」開關在模式中改名「低刺激區域」，控制綠區顯示。

### Task 3: 推薦與快速入口

**Files:** 修改 `ExploreView.vue`、`QuietHome.vue`、`PlaceCard.vue`、`useQuietCity.js`。

- [x] 探索頁地圖左上新增快速開關（與圖層開關同列，44px 以上）：「低刺激模式」；與「我的」頁同一個 `preferences.lowStimulus`。
- [x] 模式中清單排序：`zoneOf === 'low'` 優先，其次 `unknown`，`not_low` 最後；同組內沿用 SFS／距離。**不隱藏** `unknown` 場所（決策 2 確認前先採排序，不採過濾）。
- [x] PlaceCard 顯示「周邊低刺激區」／「周邊資料不足」文字標籤；室內場所改顯示自身感官狀態。
- [x] 首頁：模式開啟時快速回報縮小圖示、增加間距（感官天氣卡已只有四格與文字結論）。

### Task 4: 介面與通知的低刺激行為

**Files:** 修改 `frontend/src/App.vue`、`frontend/src/lib/versionChecker.js`、`QuietApp.vue`、`styles/quiet.css`。

- [x] 新版本偵測：模式中不自動重新整理，改為常駐提示＋「重新整理」按鈕（使用者主動觸發）。
- [x] Toast：模式中延長到 6 秒並可點擊關閉；不使用震動或聲音（目前本就沒有，列為守則）。
- [x] 系統偏好：偵測 `prefers-reduced-motion: reduce` 時，在「我的」頁開關旁提示「你的裝置已減少動態，可一併開啟低刺激模式」；不自動替使用者開啟。
- [x] `prefers-contrast: more` 時，模式配色改用較高對比的文字色，避免柔和配色造成可讀性不足。
- [x] 量測面板：模式中波形與光暈動畫由全域「停用 animation／transition」規則一併停止。

### Task 5: 驗證與交接

**Files:** 新增／修改相關 `*.test.js`、`frontend/README.md`、`docs/backend-api.md`。

- [x] 元件測試：模式開關後 SSR 輸出含綠區圖例文字、不含熱圖圖例；無綠區時顯示「目前沒有已確認的低刺激區域」。
- [x] composable 測試：模式切換不觸發新的 API 請求；排序符合 low → unknown → not_low。
- [x] 實機或 320px 瀏覽器：切換模式時地圖、清單、sheet、Toast、版本提示行為符合本計畫；關閉後完全恢復。
- [x] 執行 `npm test`、`npm run build`、`git diff --check`，更新 README 的低刺激模式說明。

## 已採用的決策（2026-11-07 開發者同意採建議預設）

探索頁加快速開關；清單採「低刺激優先排序」不過濾；綠區只看聲音維度；裝置減少動態時只提示；後端綠區上線前以標示「模擬資料」的模擬綠區展示。

## 原待開發者決策

1. **入口**：探索頁地圖上是否加「低刺激模式」快速開關（建議加），或維持只在「我的」頁？
2. **清單**：模式中是否只列出 `zone === 'low'` 的場所（嚴格，資料少時常為空），或採本計畫的「低刺激優先排序」（建議，待資料量足夠再改嚴格）？
3. **綠區維度**：模式中綠區只看聲音（與目前「聲音圖層」一致），或四維都 ≤ 33 才算（更嚴格、資料需求更高）？
4. **系統偏好**：裝置開啟減少動態時，只提示或直接預設開啟低刺激模式？（建議只提示，尊重使用者選擇。）
5. **後端時程**：`zones`／`Place.zone` 何時上線？未上線前前端模式只會顯示「目前沒有已確認的低刺激區域」，是否需要模擬綠區供展示（須標示模擬）？
