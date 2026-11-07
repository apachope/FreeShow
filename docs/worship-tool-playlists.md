# 歌曲管理系統歌單匯入

## 使用

1. 更新並啟動亞太希望工程歌曲管理系統；本功能無新增 migration。
2. FreeShow「設定 → 連線」設定網站網址。
3. 專案列表點「＋ → 匯入歌曲管理系統歌單」。
4. 選取進行中的歌單，預覽歌曲並設定「每頁最多行數」，預設 2，單行請輸入 1。
5. 確認匯入並依 FreeShow 原有流程儲存，例如 macOS `⌘S`。儲存後可離線播放。

專案保留日期、歌單名稱、段落、歌曲順序、重複歌曲位置及本場調性備註。名稱不附加每頁行數。只列出日期為今天或未來的進行中歌單，每頁 20 筆。

## 同一曲目，原生 Layout

以來源網址及歌曲 ID 辨識曲目。不同行數共用同一首曲目，在其中新增或重用 FreeShow 原生 Layout。專案曲目引用的 `layout` 指定應使用的 Layout ID，因此 2 行與 1 行專案可以引用同一首歌而各自分頁。

只沿用 FreeShow 原有文字轉投影片及每頁行數處理，傳入本次匯入的行數參數；不改全域分頁設定，沒有客製切換、分頁引擎或重建介面。

既有 Layout、投影片及手動排版保留。新增 Layout 以本機目前 Layout 的歌詞為準；不會因「沿用本機」而帶入網站新版歌詞。新分頁不複製舊投影片的媒體、動作和手動排版，原 Layout 完整保留。

來源有更新時可「沿用本機曲目」或「匯入新版副本」。選副本仍會建立另一首曲目，這是明確選擇的版本副本，不是因行數不同而重複建立。

同份歌單及相同行數再次匯入會開啟既有專案。不同的行數可建立另一個專案，但共用歌曲及對應 Layout。舊曲目只有一個 Layout 且有舊行數記錄時，可辨識該 Layout；無法確認時保留原 Layout，另新增需要的分頁。

先前已建立的重複曲目不會自動合併或刪除。沒有來源 ID 的曲目不會只憑歌名合併。

## 儲存與維護

- `quickAccess.worshipTool`：來源網址、歌曲 ID、來源版本。
- `quickAccess.worshipTool.layouts`：每頁行數至原生 Layout ID 的對應，隨完整曲目及索引保存。
- 舊曲目的 `maxLines`：僅用於辨識尚未建立對應表的單一 Layout。
- 專案 `worshipTool.maxLines`：該專案的匯入行數。
- 專案曲目 `layout`：使用的 Layout ID；`data.worshipToolEntryId` 保留歌單項目 ID。

新增 Layout 前，沒有指定 Layout 的舊專案引用會先固定為原本版型，避免共用曲目切換時影響它。透過原生 history 保存，支援復原。先完成所有轉換才寫入資料；本機曲目無法載入時顯示錯誤，不另建重複曲目。

既有專案差異同步、歌譜匯入及雙輸出同步不在本功能範圍。

## 驗證

```bash
npm run test:unit -- src/electron/utils/WorshipTool.test.ts src/frontend/utils/worshipToolImportPlan.test.ts src/frontend/utils/worshipToolPagination.test.ts
npx tsc --noEmit --p config/typescript/tsconfig.electron.json
npm run build:frontend:prod
```

29 項單元測試通過。以真實 Django API、臨時 SQLite 與瀏覽器驗證同曲的 2／1 行 Layout、專案分別引用、本機歌詞及原投影片保留、舊專案引用保護、冷快取載入、Layout 重用及原生復原。全專案 Svelte 檢查仍有既有問題，未新增診斷。完整 Electron 安裝檔尚未驗證。
