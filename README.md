# Google 登入問卷 Demo

GitHub Pages（前端）+ Google Identity Services（登入）+ Google Apps Script（驗證 token、寫入試算表）

```
使用者 ──Google 登入──▶ 拿到 ID token
   │
   └─ POST {idToken, 姓名, 性別} ──▶ GAS ──向 Google 驗證 token──▶ 寫進 Google 試算表
```

## 1. 建立 OAuth Client ID

1. 到 https://console.cloud.google.com/ 建立（或選擇）一個專案
2. 「API 和服務」→「OAuth 同意畫面」：
   - User Type 選「外部」，填應用程式名稱、支援 email
   - 測試階段：在「測試使用者」加入要登入的帳號；或直接「發布應用程式」
     （只用到 email/profile 基本範圍，不需要 Google 審查）
3. 「憑證」→「建立憑證」→「OAuth 用戶端 ID」→ 類型選「網頁應用程式」
4. 「已授權的 JavaScript 來源」加入：
   - `https://你的帳號.github.io`（注意：不要加路徑、不要結尾斜線）
   - 本機測試用：`http://localhost` **和** `http://localhost:8000`（兩個都要加）
5. 複製產生的 Client ID（`xxxx.apps.googleusercontent.com`）

> 設定改完可能要等幾分鐘才生效。

## 2. 建立 GAS 後端

1. 新建一個 Google 試算表 →「擴充功能」→「Apps Script」
2. 把 `Code.gs` 內容貼進去，修改最上面的 `CLIENT_ID`（`ALLOWED_DOMAIN` 視需要）
3. 「部署」→「新增部署作業」→ 類型「網頁應用程式」
   - 執行身分：**我**
   - 存取權：**所有人**
4. 第一次會要求授權（試算表、外部連線），按允許
5. 複製網頁應用程式網址（結尾是 `/exec`），用瀏覽器打開，看到 `{"ok":true,...}` 就是成功

> 之後改了 Code.gs，要「管理部署作業」→ 編輯 → 版本選「新版本」，網址才會吃到新程式碼。

## 3. 設定前端

打開 `index.html`，改最上面兩個值：

```js
const CLIENT_ID = 'xxxx.apps.googleusercontent.com';
const GAS_URL   = 'https://script.google.com/macros/s/xxxx/exec';
```

## 4. 測試

**本機**（不能直接雙擊用 file:// 開，Google 登入會失敗）：

```bash
cd google-login-demo
python -m http.server 8000
# 開 http://localhost:8000
```

**GitHub Pages**：把 `index.html` 推到 repo → Settings → Pages → 選 branch → 開
`https://你的帳號.github.io/repo名稱/`

（`Code.gs` 不需要放上 GitHub，放了也沒差，裡面只有 Client ID，不是機密。）

## 可以確認的事

- 登入後送出 → 試算表多一列，Google 帳號欄位是真的登入帳號
- 同帳號再送一次 → 同一列被更新，畫面顯示「已更新」
- 設定 `ALLOWED_DOMAIN` 後用別的帳號送 → 被擋
- 用 F12 改 body 裡的 idToken 亂填 → 後端回「登入憑證無效」

## 常見錯誤

| 現象 | 原因 |
|---|---|
| 按鈕出不來 / `origin_mismatch` | JavaScript 來源沒加對（含 port、http/https） |
| `access_blocked` / 無法登入 | OAuth 同意畫面還在測試中，帳號不在測試使用者名單 |
| `連線失敗：Failed to fetch` | GAS 存取權不是「所有人」，或網址不是 `/exec` |
| 改了 Code.gs 沒反應 | 沒有部署新版本 |
| `憑證不是發給這個網站的` | Code.gs 跟 index.html 的 CLIENT_ID 不一致 |
