# 樂譜讀取與升降 Key 移調工作台 (SheetMusic Transposer Workspace)

這是一個專為音樂愛好者、歌手與樂手設計的網頁端**樂譜移調工作台**。本專案採純前端靜態建置，完美支援部署至 GitHub Pages，並可與自訂的 Google Apps Script (GAS) 後端進行無縫同步。

👉 **專案展示與部署地址**：`https://JirehWang.github.io/SheetMusic_Transposition.github.io/`

---

## ✨ 核心特色

1. **雙樂譜模式支援**
   - **吉他/鋼琴和弦簡譜**：支援標準對齊格式與 ChordPro 格式（如 `[C]閃閃[G]亮亮`）。和弦與歌詞整合在網頁端採用響應式 word-wrap，即使在手機窄螢幕下換行，和弦與歌詞也絕對不會錯位。
   - **五線譜 (ABC Notation)**：輸入簡單的 ABC 記譜法，即可在瀏覽器端渲染出向量 SVG 五線譜，並支援移調與 Web Audio MIDI 試聽播放。

2. **樂譜 PDF 閱讀與自動辨識**
   - **雙視窗對照編輯**：左側為 PDF 閱讀器（支援頁碼控制、放大、縮小），右側為編輯器與渲染區。方便影像型/掃描型 PDF 進行手動對照轉譯。
   - **文字型 PDF 自動擷取**：針對內含文字的和弦歌譜 PDF，一鍵點擊「擷取文字」即可自動辨識並推算和弦與歌詞的水平空格排版，自動載入至編輯區。

3. **Google Apps Script (GAS) 資料庫同步**
   - 頂部設有 GAS 後端同步面板。只要貼上您部署的 GAS Web App 網址，即可一鍵將當前樂譜（標題、類別、內容、移調數值）儲存至您的 Google 試算表資料庫中。

4. **列印與 PDF 輸出最佳化**
   - 整合 `@media print` 樣式。點擊「列印」或按下 `Ctrl + P` 時，系統會自動隱藏側邊欄、編輯器與所有工具列，僅將優雅的「米色紙質樂譜卡片」以高對比排版輸出至 A4 紙張或另存成 PDF 檔案。

---

## 🛠️ 本地開發與建置

本專案基於 **Vite + React + TypeScript + Vanilla CSS** 開發，不依賴 Tailwind，具有輕量、載入迅速、100% 離線可用等特性。

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```

### 3. 專案建置 (生產環境)
```bash
npm run build
```
建置完成後，靜態檔案將輸出至 `dist` 資料庫，即可將其部署至任何靜態託管空間（例如 GitHub Pages）。

---

## 💾 Google Apps Script (GAS) 後端設定建議

您可以透過以下方式建立與本前端對接的 GAS 後端：

1. 在 Google 雲端硬碟建立一個 **Google 試算表**。
2. 點選「擴充功能」->「Apps Script」。
3. 貼上以下範例程式碼並修改，以接收來自本前端的樂譜同步資料：

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === 'save') {
      sheet.appendRow([
        data.timestamp,
        data.title,
        data.type,
        data.content,
        data.semitones
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*');
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }
}

// 處理預檢請求 (CORS)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```
4. 點選右上角「部署」->「新增部署」-> 選擇「網頁應用程式」。
5. 將「誰有權限存取」設為 **「任何人 (Anyone)」**，點選部署並複製產生的網頁應用程式 URL。
6. 將該 URL 貼入本網頁工具的「GAS 後端同步」欄位，即可開始儲存您的樂譜！

---

## 📄 授權條款
本專案基於 MIT 授權條款開源。
