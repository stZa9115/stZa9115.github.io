// ====== 設定 ======
const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'; // 跟 index.html 同一個
const ALLOWED_DOMAIN = '';   // 例如 'gs.ncku.edu.tw' 只允許該網域；留空 = 任何 Google 帳號
const SHEET_NAME = 'responses';
// ==================

// 瀏覽器直接打開 /exec 網址可以確認有沒有部署成功
function doGet() {
  return json_({ ok: true, msg: 'GAS backend is running' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const user = verifyIdToken_(req.idToken);

    const name = String(req.name || '').trim();
    const gender = String(req.gender || '');
    if (!name || name.length > 50) throw new Error('姓名格式不正確');
    if (['男', '女', '其他', '不願透露'].indexOf(gender) === -1) throw new Error('性別選項不正確');

    const updated = save_(user, name, gender);
    return json_({ ok: true, updated: updated });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

// 向 Google 驗證 ID token，前端傳來的任何身分資訊都不直接相信
function verifyIdToken_(token) {
  if (!token) throw new Error('缺少登入憑證');
  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error('登入憑證無效，請重新登入');

  const info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('憑證不是發給這個網站的');
  if (['accounts.google.com', 'https://accounts.google.com'].indexOf(info.iss) === -1) throw new Error('憑證來源錯誤');
  if (Number(info.exp) * 1000 < Date.now()) throw new Error('登入已過期');
  if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('Email 未驗證');
  if (ALLOWED_DOMAIN && info.hd !== ALLOWED_DOMAIN) throw new Error('只允許 @' + ALLOWED_DOMAIN + ' 帳號');

  return { email: info.email, sub: info.sub, googleName: info.name || '' };
}

// 同一個帳號只留一筆：有就更新，沒有就新增
function save_(user, name, gender) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['時間', 'Google 帳號', 'Google 名稱', 'Google sub', '姓名', '性別']);
      sheet.setFrozenRows(1);
    }

    const row = [new Date(), user.email, safe_(user.googleName), user.sub, safe_(name), gender];
    const last = sheet.getLastRow();
    if (last > 1) {
      const subs = sheet.getRange(2, 4, last - 1, 1).getValues();
      for (let i = 0; i < subs.length; i++) {
        if (String(subs[i][0]) === user.sub) {
          sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
          return true;
        }
      }
    }
    sheet.appendRow(row);
    return false;
  } finally {
    lock.releaseLock();
  }
}

// 防止試算表公式注入（使用者輸入 =IMPORTXML(...) 之類）
function safe_(v) {
  v = String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
