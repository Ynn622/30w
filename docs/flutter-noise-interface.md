# Flutter iOS 環境噪音接口

這是本專案提出的 **protocolVersion 1 自訂接口**，不是城市通已支援的官方 handler。前端已完成訊息封裝、啟動、波形、停止、狀態、逾時、session 隔離與分享摘要；Flutter／iOS 原生程式由 App 團隊另行實作與實機驗證。

## 原則與測量限制

- 點擊「開始量測」才取得麥克風權限，與定位分開取得同意。打開網頁或量測面板不應啟用麥克風。
- 前景量測 15 秒，每 250ms 回傳統計值，不傳錄音、base64、音訊檔網址或原始 PCM。
- iOS meter 的 `averagePower`／`peakPower` 為 **dBFS**，不是經校準的環境 dBA。v1 全部標示 `calibrated:false`，不支援 dBA；如需校準請另訂版本。
- 量測同意、分享同意與定位同意是不同操作。原生端不能收到 noise_start 就自行將音訊或摘要送往任何伺服器。
- webview 關閉、跳頁、App 進背景、取消、期限到或 native 錯誤都必須停止麥克風與計時器。不能只依賴 JS 的停止訊息。

## Transport

沿用 [城市通雙向訊息格式](https://tpe-guideline.web.app/docs/two-way-connection/web.html)：

```js
// 僅示意 transport；Vue 元件實際使用 webview.js／noiseClient.js。
window.flutterObject.postMessage(JSON.stringify({ name, data }))
```

App 回覆同樣 `{ name, data }` JSON 字串，由 `window.flutterObject` 的 `message` 事件送入 `event.data`。listener 必須在傳出 start **前**註冊，以免漏接同步回覆。不能任意改成 window.postMessage 或只觸發 document 事件。

所有噪音訊息 data 均須含 `protocolVersion:1`、`sessionId`。sessionId 由前端建立，App 原封不動帶回；前端忽略不同版本、不同 session 或已停止 session 的回覆。

## Web → Flutter

### noise_start

```json
{
  "name": "noise_start",
  "data": {
    "protocolVersion": 1,
    "sessionId": "c050d71f-example",
    "durationSeconds": 15,
    "intervalMs": 250,
    "includeAudio": false
  }
}
```

- v1 durationSeconds 最小 5、最大 30；目前產品固定 15。Native 仍須驗證範圍，不相信網頁參數。
- 收到未知版本、非合法 session、includeAudio 非 false 或不支援設定時，回 noise_status:error。
- 麥克風未授權時請求 iOS 系統授權；30 秒內未開始量測，前端會停止等待並傳 noise_stop。若權限彈窗更晚才同意，原生需檢查該 session 是否已取消，不可再次啟用麥克風。
- 同時只允許一個 native session。新的 start 到達時應先停止前一個，再開始新 session；舊回覆不能套用新 sessionId。

### noise_stop

```json
{
  "name": "noise_stop",
  "data": { "protocolVersion": 1, "sessionId": "c050d71f-example" }
}
```

- 冪等：同 session 重複停止不報錯，停止未知／舊 session 不影響目前 session。
- 停止 meter、timer、錄製資源，釋放 AVAudioSession（尊重 App 其他音訊使用情境），移除任何暫存檔，再回 noise_status:stopped。
- 前端關閉 sheet 後 listener 已移除，仍由 native 保證停止成功。

## Flutter → Web

### noise_status

開始時，在原生 meter 真正準備好後回：

```json
{
  "name": "noise_status",
  "data": { "protocolVersion": 1, "sessionId": "c050d71f-example", "status": "measuring" }
}
```

| status | 意義與前端動作 |
| --- | --- |
| `measuring` | 開始接收 sample；設定 durationSeconds + 5 秒硬性回覆期限 |
| `completed` | 正常結束，先送最後 sample，再送完成；前端計算結果並清除 listener |
| `stopped` | 使用者或 App 停止；不提供可分享結果 |
| `denied` | 權限遭拒，顯示 message 並停止 |
| `unsupported` | 裝置／系統不支援，顯示說明並停止 |
| `error` | 量測錯誤／中斷，顯示說明並停止 |

失敗範例：

```json
{
  "name": "noise_status",
  "data": {
    "protocolVersion": 1,
    "sessionId": "c050d71f-example",
    "status": "denied",
    "code": "MICROPHONE_DENIED",
    "message": "尚未授權麥克風，可至 iOS 設定開啟後再試。"
  }
}
```

可使用的 code：`MICROPHONE_DENIED`、`MICROPHONE_RESTRICTED`、`AUDIO_SESSION_FAILED`、`INTERRUPTED`、`APP_BACKGROUND`、`UNSUPPORTED_VERSION`、`INVALID_ARGUMENT`。message 使用繁體中文，不包含裝置識別、音訊內容或會員資料。

### noise_sample

```json
{
  "name": "noise_sample",
  "data": {
    "protocolVersion": 1,
    "sessionId": "c050d71f-example",
    "elapsedMs": 250,
    "averageDbfs": -42.1,
    "peakDbfs": -28.4
  }
}
```

- `elapsedMs` 從實際 measuring 起算，單調遞增；由 monotonic clock 計算，不能以日曆時間相減。
- `averageDbfs` 與 `peakDbfs` 必須是有限數值，-160..0，且 peak>=average。不得用 null、NaN、Infinity、字串或無效數值補齊。
- 建議 meter warm-up 後開始計時，固定 250ms。前端忽略未開始、重複／倒序、超出 duration+1000ms 的 sample。
- 完成先停止音訊資源，按順序送最後 sample 與 completed；沒有有效 sample、或最後有效樣本未達預定時長減 1 秒時，前端顯示錯誤，不產生摘要。
- 前端只保留數值統計，最多顯示最近 30 個波形樣本；整段 15 秒摘要透過功率平均計算，單位仍為 dBFS。它不等同經標準儀器校正的 Leq。

## iOS 原生實作建議

以下是交接設計，**不是已加入本倉庫的可執行 Flutter／Swift 功能**。

1. `Info.plist` 提供清楚的 `NSMicrophoneUsageDescription`，如「量測附近環境音量，不保留錄音；由你決定是否分享數值摘要」。只在使用者主動 start 後請求權限。
2. 可用 Apple AVFoundation 的 `AVAudioRecorder.isMeteringEnabled`、`updateMeters()`、`averagePower(forChannel:)`、`peakPower(forChannel:)`；或用 AVAudioEngine 直接統計 RMS／peak，避免儲存音訊。請依實際實作標示量測演算法版本。
3. AVAudioSession 類別、mode、mixing 設定須與既有 App 音訊需求協調。固定並記錄感測設定，不能任意套 AGC 等效果後再當環境 SPL。
4. 若 AVAudioRecorder 必須使用檔案作為 meter 來源，只能使用短期暫存、不加入備份、開始／停止／錯誤／背景時清除；優先選擇不保存音訊的引擎方案。
5. 每個 session 保留 cancel token；權限 await 完成、開啟 session 前後都要再次確認 token。舊 noise_stop 不可中斷新 session。
6. 訂閱 interruption、route change、scene lifecycle／Flutter AppLifecycleState，前景以外立即停止。JS `visibilitychange` 和 `pagehide` 只是額外保護。
7. 原生 handler 限制可信的 WebView Origin／導航來源；驗證 JSON、版本、長度與數值，不把任意網頁當合法控制端。
8. 不要自行引入第三方噪音 SDK。若選 Flutter 套件，先查核來源、開源授權、費用與平台限制再加入；本次沒有替 App 指定未查核套件。

Apple 原始參考：[AVAudioRecorder](https://developer.apple.com/documentation/avfaudio/avaudiorecorder)、[averagePower(forChannel:)](https://developer.apple.com/documentation/avfaudio/avaudiorecorder/averagepower(forchannel:))、[AVAudioSession](https://developer.apple.com/documentation/avfaudio/avaudiosession)。App 團隊依目標 iOS 版本核對權限 API。

## 現有定位與導航

- 定位沿用官方 `location`，data=null；前端相容 `{latitude,longitude}` 或 `{lat,lng}` 的數值座標，無效回覆顯示手動區域。請依 App 真正回傳格式確認，不提供假的成功座標。
- 主動按定位才呼叫；一般瀏覽器使用 Geolocation API，沒有 bridge 或拒絕不會偽裝成功。
- `launch_map` data 為 Apple Maps 公開網址字串：`https://maps.apple.com/?daddr=lat,lng&dirflg=w`。請確認城市通 handler 是否接受此格式；模擬資料的場所不啟動導航。

## 實機驗收清單

1. 新安裝未授權：網頁進入與 sheet 開啟不啟動麥克風；按開始才出權限彈窗。
2. 拒絕／受限／不支援／沒有 handler：顯示失敗或 timeout，畫面無虛構數值。
3. 開始→有效 sample→15 秒→completed：順序正確、資源釋放、dBFS 標示及統計正確。
4. 開始後取消、切背景、跳頁、關閉 WebView：麥克風指示器立即消失，timer 與 listener 無殘留。
5. 舊 session 延遲回覆、重複 sample、無效值：前端忽略；舊 stop 不影響新 session。
6. 完成後未勾同意：沒有 measurements 請求；勾選並主動分享才傳數值與明示位置，不含音訊。
7. 不同 iPhone 與音訊路由：明示未校準，不跨裝置比較、不顯示 dBA、不宣稱法規噪音監測。
