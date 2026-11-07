# Flutter WebView 麥克風設定（環境音量量測）

環境音量改由**網頁自行以 `getUserMedia` + Web Audio 在裝置上計算**，不再使用 `noise_start`／`noise_stop`／`noise_status`／`noise_sample` 自訂訊息，App 端**不需要新增任何 bridge handler**。但官方 [TownPass](https://github.com/taipei-doit/TownPass) 目前沒有麥克風權限宣告，`TPWebView` 也沒有處理 WebView 的權限請求，所以 App 團隊仍須完成下列設定，網頁才能取得麥克風。

2026-11-07 查核 TownPass main：使用 `flutter_inappwebview: ^6.1.5`；iOS `Info.plist` 只有定位與相機用途說明；Android Manifest 只有定位權限；`lib/util/tp_web_view.dart` 只實作 `onGeolocationPermissionsShowPrompt`。

以下是交接設計，**不是已加入本倉庫、經實機驗證的 Flutter 程式**。

## 網頁端行為

- 使用者按「開始量測」才呼叫 `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`；開頁或打開面板不會請求麥克風。
- 以 `AnalyserNode` 讀取時域樣本，每 250ms 輸出一筆 RMS／peak dBFS（功率平均），固定 15 秒。不建立 `MediaRecorder`、不保存或上傳音訊，只保留數值統計。
- 拒絕、找不到麥克風、30 秒內未授權、音軌被系統中斷、AudioContext 被中斷、`visibilitychange`／`pagehide`、關閉面板，都會立即停止音軌並關閉 AudioContext。
- 需要安全來源（HTTPS 或 localhost）；GitHub Pages 符合。
- 量測結果為未校準 dBFS，不是 dBA；分享摘要仍需使用者另外勾選同意。

## 1. 權限宣告

**iOS** `ios/Runner/Info.plist`：

```xml
<key>NSMicrophoneUsageDescription</key>
<string>量測附近環境音量，只在手機上計算數值、不保留錄音；是否分享摘要由你決定。</string>
```

缺少這個 key 時，iOS 不會讓 WebView 取得麥克風（依系統版本可能直接拒絕或終止 App），網頁只會收到失敗。

**Android** `android/app/src/main/AndroidManifest.xml`：

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

## 2. 執行期權限（Android 必要）

Android WebView 只能把 App 已取得的權限轉給網頁；App 本身沒有 `RECORD_AUDIO` 執行期授權時，網頁會得到 `NotAllowedError` 或 `NotReadableError`。TownPass 目前沒有通用權限套件，建議加入 [`permission_handler`](https://pub.dev/packages/permission_handler)（MIT 授權，免費；加入前請 App 團隊依賽規再次確認版本與授權）。iOS 由 WKWebView／系統彈窗處理，不需要另外請求。

## 3. TPWebView 處理權限請求

在 `lib/util/tp_web_view.dart` 的 `TPInAppWebView(...)` 加入 `onPermissionRequest`，**只對信任的來源、只允許麥克風**：

```dart
import 'package:permission_handler/permission_handler.dart';

const _microphoneOrigins = {'https://ynn622.github.io'}; // 依正式上架網域調整

onPermissionRequest: (controller, request) async {
  final origin = '${request.origin.scheme}://${request.origin.host}';
  final onlyMicrophone = request.resources.isNotEmpty &&
      request.resources.every((r) => r == PermissionResourceType.MICROPHONE);
  if (!_microphoneOrigins.contains(origin) || !onlyMicrophone) {
    return PermissionResponse(resources: request.resources, action: PermissionResponseAction.DENY);
  }
  final granted = defaultTargetPlatform != TargetPlatform.android ||
      (await Permission.microphone.request()).isGranted;
  return PermissionResponse(
    resources: request.resources,
    action: granted ? PermissionResponseAction.GRANT : PermissionResponseAction.DENY,
  );
},
```

- iOS 15 以上 `onPermissionRequest` 才會被呼叫；回 `GRANT` 後若 App 尚未取得系統麥克風授權，iOS 仍會跳系統彈窗。iOS 14.3–14.x 由 WKWebView 自行詢問。
- 不要對所有網站一律 `GRANT`，也不要順帶允許 `CAMERA`。
- 若希望 iOS 不每次重開頁面都詢問，可在信任來源時直接回 `GRANT`（如上），並由網頁按鈕作為使用者意圖。

## 4. WebView 設定

`initialSettings` 加入：

```dart
InAppWebViewSettings(
  mediaPlaybackRequiresUserGesture: false,
  allowsInlineMediaPlayback: true, // iOS：避免音訊工作階段被要求全螢幕播放
)
```

## 5. 生命週期

網頁會在 `visibilitychange`／`pagehide` 停止麥克風；App 關閉 WebView（`Get.back()`）時 WKWebView／Android WebView 會一併釋放 media stream。實機請確認狀態列的麥克風指示器會立即消失。

## 現有定位與導航

- 定位沿用官方 `location`，data=null；前端相容 `{latitude,longitude}` 或 `{lat,lng}` 的數值座標，無效回覆顯示手動區域。請依 App 真正回傳格式確認，不提供假的成功座標。
- 主動按定位才呼叫；一般瀏覽器使用 Geolocation API，沒有 bridge 或拒絕不會偽裝成功。
- `launch_map` data 為 Apple Maps 公開網址字串：`https://maps.apple.com/?daddr=lat,lng&dirflg=w`。請確認城市通 handler 是否接受此格式；模擬資料的場所不啟動導航。

## 實機驗收清單

1. 新安裝未授權：進入網頁與打開面板不出現權限彈窗；按開始才出現。
2. 拒絕權限／非信任網域：顯示「麥克風權限未允許」，畫面無虛構數值；Android 系統設定可再開啟。
3. 允許後量測 15 秒：60 筆樣本、dBFS 與峰值合理，完成後麥克風指示器消失。
4. 量測中按停止、切背景、跳頁、關閉 WebView、來電：麥克風立即停止，顯示中斷或停止。
5. 完成後未勾同意：沒有 measurements 請求；勾選並主動分享才傳數值與明示位置，不含音訊。
6. 不同手機與音訊路由（藍牙耳機麥克風）：明示未校準，不跨裝置比較、不顯示 dBA、不宣稱法規噪音監測。
