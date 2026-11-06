# 歌曲管理系統歌單匯入

## 使用

1. 部署支援歌單 API 的亞太希望工程歌曲管理系統，重新啟動服務；本功能不需 migration。
2. FreeShow「設定 → 連線」設定伺服器網址（預設 `https://lyrics.apachope.org/`）。
3. 專案列表點 `＋ → 匯入歌曲管理系統歌單`。
4. 選取歌單，預覽段落及歌曲順序，按「匯入為新專案」。
5. 使用 FreeShow 的儲存功能（例如 macOS `⌘S`）。曲目與專案保存在本機，儲存後可離線播放。

僅可選今天或未來的進行中歌單，與網站判定一致。每頁顯示 20 份歌單。專案名稱為日期加歌單名稱。匯入包含完整歌詞、歌單段落、重複曲目的各次位置，本場調性保存在專案曲目備註。

## 重用及變更

同一來源網址＋歌曲 ID＋來源內容版本相同時重用本機曲目，保留本機的改名、歌詞與排版。來源歌詞變更時，可選「沿用本機曲目」或「匯入新版副本」；副本不修改其他專案引用的原曲目。同名不同 ID、不同來源的歌曲不會合併。

本版單曲搜尋也保存來源識別。舊版建立、沒有來源 ID 的曲目不會只依歌名合併。

同份歌單再次匯入會開啟既有專案，不會自動更新。既有專案差異同步、歌譜及整頁／單行雙版型留待後續實作。

## 維護

- `WorshipToolImport.svelte`：歌單選擇、預覽及變更選擇。
- `worshipToolImportPlan.ts`：純函式，比對本機曲目與專案來源。
- `worshipToolImport.ts`：使用既有歌詞轉換器及 history 建立曲目、專案。
- 曲目來源：`quickAccess.worshipTool`，同時保存在完整曲目及索引，可在未載入完整曲目時比對。
- 專案來源：`worshipTool`，包含來源網址、歌單 ID、版本及匯入時間。
- 專案曲目引用：`data.worshipToolEntryId`，段落為 `data.worshipToolSectionId`。

所有歌曲先轉換完成才寫入 store；重用與新版副本均不會覆蓋既有歌曲。歷史操作先記錄新增歌曲，再記錄專案；撤銷專案建立後，新增歌曲仍會保留於曲目庫，可繼續撤銷。

## 驗證

```bash
npm run test:unit -- src/electron/utils/WorshipTool.test.ts src/frontend/utils/worshipToolImportPlan.test.ts
npx tsc --noEmit --p config/typescript/tsconfig.electron.json
npm run build:frontend:prod
```

20 項單元測試、Electron 型別檢查及前端正式編譯通過。另以真實 Django HTTP API、臨時 SQLite 資料及瀏覽器驗證兩份歌單匯入、段落／重複歌曲、跨歌單重用、來源變更副本及防止同份歌單重複建立。完整 Electron 原生啟動及安裝檔未驗證。全專案 Svelte 檢查仍有既有程式問題，新匯入元件未回報錯誤。
