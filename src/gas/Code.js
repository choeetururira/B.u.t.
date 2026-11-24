/*
 * B.U.T. TOKYO 2026 — Apps Script 진입점
 *  - 학생 페이지:   https://script.google.com/macros/s/배포ID/exec
 *  - 관리자 페이지: https://script.google.com/macros/s/배포ID/exec?page=admin
 *  - JSON API:      POST 같은 주소, body = {"action": "...", "payload": {...}}
 *
 * 편집기에서 실행하는 함수(소유자만 실행 가능):
 *   setup()               스프레드시트·Drive 폴더·비밀키·관리자 비밀번호·학생 20명 생성 (1회)
 *   resetAdminPassword()  관리자 비밀번호 새로 발급 (실행 로그에 표시)
 *   showSetupInfo()       시트/폴더 주소 확인
 *   rotateTokenSecret()   모든 학생·관리자 로그인 강제 해제
 */

function service_() {
  return BUT_Core.createService({ storage: BUT_GasStorage.create(), crypto: BUT_GasStorage.crypto });
}

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'student';
  var file = page === 'admin' ? 'Admin' : 'Student';
  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle(page === 'admin' ? 'B.U.T. 관리자' : 'B.U.T. TOKYO 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// google.script.run.api(action, payload) 로 호출됨
function api(action, payload) {
  return service_().api(String(action), payload || {});
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  var out = service_().api(String(body.action || ''), body.payload || {});
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 웹앱 방문자(익명)가 google.script.run 으로 관리 함수를 부르지 못하도록 막는다.
function requireOwner_() {
  var active = Session.getActiveUser().getEmail();
  var owner = Session.getEffectiveUser().getEmail();
  if (!active || active !== owner) throw new Error('스크립트 소유자만 편집기에서 실행할 수 있습니다.');
}

function setup() {
  requireOwner_();
  var p = PropertiesService.getScriptProperties();
  var msgs = [];
  if (!p.getProperty('ROOT_FOLDER_ID')) {
    var folder = DriveApp.createFolder('B.U.T. TOKYO 2026 (비공개 · 학생 사진과 결과물)');
    p.setProperty('ROOT_FOLDER_ID', folder.getId());
    msgs.push('Drive 폴더 생성: ' + folder.getUrl());
  }
  if (!p.getProperty('SPREADSHEET_ID')) {
    var ss = SpreadsheetApp.create('B.U.T. TOKYO 2026 – 기록 데이터 (비공개)');
    DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(p.getProperty('ROOT_FOLDER_ID')));
    p.setProperty('SPREADSHEET_ID', ss.getId());
    msgs.push('스프레드시트 생성: ' + ss.getUrl());
  }
  var storage = BUT_GasStorage.create();
  Object.keys(BUT_Core.SCHEMA).forEach(function (name) { storage.table(name).all(); });
  // 기본 'Sheet1' / '시트1' 삭제
  var book = SpreadsheetApp.openById(p.getProperty('SPREADSHEET_ID'));
  book.getSheets().forEach(function (sh) { if (!BUT_Core.SCHEMA[sh.getName()] && book.getSheets().length > 1) book.deleteSheet(sh); });

  var svc = service_();
  if (!p.getProperty('ADMIN_HASH')) {
    var pw = randomPassword_();
    svc.setAdminPassword(pw);
    msgs.push('관리자 비밀번호(지금 한 번만 표시): ' + pw);
  }
  var created = svc.generateStudents(BUT_Program.program.participants, 1);
  if (created.length) msgs.push('학생 ' + created.length + '명 생성 (Students 시트에서 PIN 확인)');
  if (!msgs.length) msgs.push('이미 설정되어 있습니다.');
  msgs.forEach(function (m) { Logger.log(m); });
  return msgs.join('\n');
}

function resetAdminPassword() {
  requireOwner_();
  var pw = randomPassword_();
  service_().setAdminPassword(pw);
  Logger.log('새 관리자 비밀번호: ' + pw);
}

function rotateTokenSecret() {
  requireOwner_();
  PropertiesService.getScriptProperties().deleteProperty('TOKEN_SECRET');
  Logger.log('비밀키를 교체했습니다. 모든 사용자가 다시 로그인해야 합니다.');
}

function showSetupInfo() {
  requireOwner_();
  var p = PropertiesService.getScriptProperties();
  Logger.log('스프레드시트: https://docs.google.com/spreadsheets/d/' + p.getProperty('SPREADSHEET_ID'));
  Logger.log('Drive 폴더: https://drive.google.com/drive/folders/' + p.getProperty('ROOT_FOLDER_ID'));
  Logger.log('웹앱 주소: ' + ScriptApp.getService().getUrl());
}

function randomPassword_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  var hex = BUT_GasStorage.crypto.randomHex(12);
  var out = '';
  for (var i = 0; i < 12; i++) out += chars[parseInt(hex.substr(i * 2, 2), 16) % chars.length];
  return out;
}
