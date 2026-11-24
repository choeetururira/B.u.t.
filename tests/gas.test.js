/* 빌드된 Apps Script 코드(dist/gas/Code.js)를 Apps Script 모형에서 실행하는 테스트 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildGas } = require('../scripts/build.js');
const { loadGas } = require('./gas-mock.js');
const { tmpDir, TINY_JPEG, sampleSubmission } = require('./helpers.js');

const out = buildGas(tmpDir('but-gas-'));
const CODE = path.join(out, 'Code.js');

function setupGas(opts) {
  const g = loadGas(CODE, opts);
  const msg = g.ctx.setup();
  const pw = /관리자 비밀번호\(지금 한 번만 표시\): (\S+)/.exec(msg)[1];
  const api = (a, p) => g.ctx.api(a, p);
  const ok = (a, p) => { const r = api(a, p); if (!r.ok) throw new Error(a + ': ' + JSON.stringify(r.error)); return r.data; };
  return { g, pw, api, ok };
}

test('setup(): 시트·폴더·비밀번호·학생 20명 생성, 두 번 실행해도 안전', () => {
  const { g, pw } = setupGas();
  assert.ok(g.props.SPREADSHEET_ID && g.props.ROOT_FOLDER_ID && g.props.ADMIN_HASH);
  assert.ok(pw.length >= 12);
  const book = g.books.get(g.props.SPREADSHEET_ID);
  assert.deepEqual(book.getSheets().map((s) => s.getName()).sort(), ['Log', 'Photos', 'Settings', 'Students', 'Submissions']);
  const second = g.ctx.setup();
  assert.match(second, /이미 설정/);
  assert.ok(!second.includes('비밀번호'), '두 번째 실행에서 비밀번호를 다시 노출하지 않음');
});

test('익명 방문자는 setup/resetAdminPassword 를 호출할 수 없음', () => {
  const g = loadGas(CODE, { activeUser: '' });
  assert.throws(() => g.ctx.setup(), /소유자/);
  assert.throws(() => g.ctx.resetAdminPassword(), /소유자/);
});

test('PIN 앞자리 0, 불리언, JSON 열이 시트 왕복 후에도 유지됨', () => {
  const { g, pw, ok } = setupGas();
  const admin = ok('adminLogin', { password: pw }).token;
  ok('adminUpsertStudent', { token: admin, student: { studentId: '07', pin: '0042', exhibitConsent: false } });
  const st = ok('adminStudents', { token: admin }).students.find((s) => s.studentId === '07');
  assert.equal(st.pin, '0042');
  assert.equal(st.exhibitConsent, false);
  assert.equal(st.active, true);
  const login = ok('studentLogin', { studentId: '07', pin: '0042' });
  assert.ok(login.token);
  void g;
});

test('Apps Script 전체 흐름: 업로드 → 제출 → 중복 → 관리자 편집 → 데이터셋 → Drive 저장', () => {
  const { g, pw, ok, api } = setupGas();
  const admin = ok('adminLogin', { password: pw }).token;
  const pin = ok('adminStudents', { token: admin }).students.find((s) => s.studentId === '01').pin;
  const tok = ok('studentLogin', { studentId: '01', pin }).token;
  const up = ok('uploadPhoto', { token: tok, day: 3, clientUploadId: 'u1', original: { base64: TINY_JPEG, mime: 'image/jpeg', name: 'IMG_0001.JPG' }, display: { base64: TINY_JPEG, width: 1, height: 1 } });
  const photoRow = ok('adminSubmissions', { token: admin }).submissions; // 아직 제출 전
  assert.equal(photoRow.length, 0);
  const sub = sampleSubmission();
  const r1 = ok('submit', { token: tok, day: 3, ...sub, photos: [{ photoId: up.photoId, caption: '짝꿍과 함께' }] });
  assert.equal(r1.status, 'created');
  assert.equal(ok('submit', { token: tok, day: 3, ...sub, photos: [{ photoId: up.photoId }] }).status, 'duplicate');
  assert.equal(g.isLocked(), false, '잠금 해제 확인');

  // 원본 파일이 Drive 비공개 폴더에 그대로 저장됨
  const orig = [...g.files.values()].find((f) => f.name.endsWith('_orig.jpg'));
  assert.equal(orig.bytes.toString('base64'), TINY_JPEG);
  assert.match(orig.name, /^01_D3_P/);

  const subs = ok('adminSubmissions', { token: admin, day: 3 }).submissions;
  assert.equal(subs[0].photos[0].caption, '짝꿍과 함께');
  ok('adminUpdateSubmission', { token: admin, submissionId: subs[0].submissionId, patch: { editedEssay: '교사가 맞춤법을 다듬은 소감문입니다. '.repeat(5), reviewStatus: 'approved' } });
  const ds = ok('adminDataset', { token: admin, approvedOnly: true });
  assert.equal(ds.entries.length, 1);
  assert.match(ds.entries[0].essay, /^교사가/);
  const photos = ok('adminPhotos', { token: admin, photoIds: [up.photoId] }).photos;
  assert.ok(photos[up.photoId].startsWith('data:image/jpeg;base64,'));
  const saved = ok('adminSaveOutput', { token: admin, name: 'DAY03/포스터.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', base64: 'UEsDBA==' });
  assert.match(saved.url, /^https:\/\/drive\.google\.com\/file\/d\//);
  assert.equal(ok('adminSettings', { token: admin }).appUrl, 'https://script.google.com/macros/s/TEST/exec');
  assert.equal(api('adminOverview', { token: tok }).error.code, 'AUTH');
});

test('doGet은 학생/관리자 HTML, doPost는 JSON API', () => {
  const { g, pw } = setupGas({ htmlFiles: { Student: 'S', Admin: 'A' } });
  assert.equal(g.ctx.doGet({ parameter: {} })._file, 'Student');
  assert.equal(g.ctx.doGet({ parameter: { page: 'admin' } })._file, 'Admin');
  const res = g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'adminLogin', payload: { password: pw } }) } });
  const body = JSON.parse(res.getContent());
  assert.equal(body.ok, true);
  const bad = JSON.parse(g.ctx.doPost({ postData: { contents: 'not json' } }).getContent());
  assert.equal(bad.ok, false);
});
