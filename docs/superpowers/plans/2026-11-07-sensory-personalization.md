# Sensory Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 SSI、SFS、四維回報及低刺激模式實作於既有 Vue 行動畫面。

**Architecture:** 共用純函式處理有效觀測、缺值、加權及排序；composable 管理本機偏好與畫面資料。延用六個接口，正式強度回報由明確功能開關啟用，示範不送網路。

**Tech Stack:** 既有 Vue 3、JavaScript、Vitest、CSS；不新增依賴或外部服務。

**Spec:** `docs/backend-api.md`；使用者已要求直接實作，本次依序在目前工作目錄完成。

## Global Constraints

- 320px、safe-area、至少 44px 操作區；不新增遠端 AI、素材或依賴。
- SSI 只計有效四維，不納入 AQI；過期、未知與不足資料不當作低刺激。
- 偏好／敏感度／低刺激模式只存本機；示範不冒充真實串接。

## Review Focus

- 部分、全缺值、有效 0 分與過期資料：SSI、SFS 及覆蓋率正確。
- 正式後端尚無版本化指數：不以舊欄位推造 SSI。
- 敏感度變動：僅本機重排，必要低刺激條件仍保留。
- 舊設定與損壞 localStorage：保持有效預設及獨立物件。
- 低刺激模式：影響 Teleport sheet 與地圖動畫，保留必要狀態和文字警示。

### Task 1: 感官計算與偏好

**Files:** 新增 `frontend/src/lib/sensoryIndex.js`、`sensoryIndex.test.js`；修改 `sensoryDomain.js`、`quietDemo.js`、`useQuietCity.js`、相關測試。

**Interfaces:** `assessSensory(record, sensitivities, now)` 回傳有效 dimensions、SSI／SFS、兩種覆蓋率及資料信心；`city.assess(record, meta)` 供各畫面使用；`city.recommendations` 本機排序。

- [x] 測試 SSI=52、覆蓋 0.9／0.75、SFS=51／69、缺值／過期／不支援版本、缺失維度排序與偏好還原。
- [x] 實作共用計算、舊偏好相容、四維示範及本機排序，不將敏感度加入網路 query。
- [x] 執行相關 Vitest，確認既有篩選與取消機制仍通過。

### Task 2: 首頁、探索、詳情與偏好畫面

**Files:** 新增 `SensoryScore.vue`；修改 `QuietHome.vue`、`PlaceCard.vue`、`PlaceDetail.vue`、`ExploreView.vue`、`QuietProfile.vue`、`QuietApp.vue`、`SensoryMap.vue`、`quiet.css`。

**Interfaces:** `SensoryScore` 接收 assessment、demo；敏感度使用 1–5、本機持久化；`lowStimulus` 同步頁面／Teleport 的視覺與動畫。

- [x] 首頁四維與獨立 AQI；場所卡／詳情顯示 SSI、SFS、缺值與覆蓋率，來源與版本說明可查。
- [x] 加入四個敏感度控制、實際 SFS／距離排序選項、氣味圖層與低刺激篩選。
- [x] 加入低刺激模式與必要狀態樣式；以 SSR 與實際瀏覽器確認 320px 及互動。

### Task 3: 強度回報與交接

**Files:** 修改 `ReportSheet.vue`、`sensoryApi.js`、`.env.example`、`README.md`、`frontend/README.md`、`docs/backend-api.md`；補 API／畫面測試。

**Interfaces:** `intensity` 為 `none | mild | noticeable | strong`；正式後端未宣告支援時保持舊 body，示範可完整操作。

- [x] 四種感受提供未預選的單一維度強度；comfortable／other 不送強度；錯誤保留輸入可重試。
- [x] 記錄已完成的畫面、正式模式開關與後端仍需交付的資料規則。
- [x] 執行 `npm test`、`npm run build`、`git diff --check`，確認實際畫面與設定保存。
