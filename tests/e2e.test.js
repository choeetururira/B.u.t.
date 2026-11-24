/*
 * 브라우저 종단 테스트 (Playwright, iPhone 13 화면)
 * 학생: 로그인 → 검증 오류 → 사진 3장(휴대폰 원본 크기 포함) → 제출 버튼 연타 → 영수증 → 수정 제출(2회차) → 임시저장 복원
 * 관리자: 로그인 → 현황 → 편집 저장 → 결과물 미리보기 · PPTX/HTML 내려받기
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium, devices } = require('playwright');
const { createServer } = require('../src/local/server.js');
const { tmpDir } = require('./helpers.js');

const PHOTO_DIR = path.join(__dirname, '../data/virtual-photos');
if (!fs.existsSync(path.join(PHOTO_DIR, 'manifest.json'))) execFileSync('python3', [path.join(__dirname, '../scripts/make-virtual-photos.py'), PHOTO_DIR]);

let srv, base, browser;
const errors = [];

test.before(async () => {
  srv = createServer({ dataDir: tmpDir('but-e2e-'), adminPassword: 'e2e-admin-pass' });
  await new Promise((r) => srv.server.listen(0, r));
  base = 'http://localhost:' + srv.server.address().port + '/';
  browser = await chromium.launch();
});
test.after(async () => {
  await browser.close();
  srv.server.close();
});

function pinOf(id) { return srv.storage.table('Students').all().find((s) => s.studentId === id).pin; }
function watch(page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
}

test('학생: 로그인 → 제출 → 중복 방지 → 수정 제출 → 임시저장', { timeout: 120000 }, async () => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base);

  // 잘못된 PIN
  await page.fill('#sid', '05');
  await page.fill('#pin', '0000' === pinOf('05') ? '1111' : '0000');
  await page.check('#agree');
  await page.click('#loginBtn');
  await page.waitForFunction(() => /맞지 않습니다/.test(document.getElementById('loginErr').textContent));

  await page.fill('#pin', pinOf('05'));
  await page.click('#loginBtn');
  await page.waitForSelector('.tab[aria-selected="true"]');
  assert.match(await page.textContent('.me strong'), /STUDENT 05/);

  // 빈 제출 → 항목별 오류
  await page.click('#submitBtn');
  assert.match(await page.textContent('[data-err="photos"]'), /사진/);
  assert.match(await page.textContent('[data-err="essay"]'), /100자/);

  // 사진 3장 (하나는 4032px 휴대폰 원본 크기)
  await page.setInputFiles('#file', ['day1_01.jpg', 'day1_02.jpg', 'day1_99_big.jpg'].map((f) => path.join(PHOTO_DIR, f)));
  await page.waitForFunction(() => document.querySelectorAll('.ph img').length === 3);
  await page.fill('[data-cap="0"]', '시부야 교차로');
  await page.selectOption('[data-mis="0"]', '1');
  await page.fill('#reflection', '일본은 조용한 나라라고만 생각했는데 시부야는 생각보다 훨씬 활기차고 다양한 사람들로 가득했다.');
  await page.fill('#essay', '도쿄타워 전망대에서 끝없이 이어지는 건물들을 보며 이 도시에 사는 사람들의 하루를 상상해 보았다. 시부야 교차로에서는 신호가 바뀌자마자 수백 명이 동시에 건너는 모습을 직접 보았는데 질서 있고 빨랐다.');
  await page.fill('#oneLine', '낯선 도시에서 발견한 익숙함');
  assert.equal(await page.textContent('#pv-one'), '낯선 도시에서 발견한 익숙함');

  // 제출 버튼 연타
  await page.evaluate(() => { const b = document.getElementById('submitBtn'); b.click(); b.click(); b.click(); });
  await page.waitForSelector('#doneCard', { timeout: 60000 });
  assert.match(await page.textContent('#doneCard'), /1회차/);
  let subs = srv.storage.table('Submissions').all().filter((s) => s.studentId === '05');
  assert.equal(subs.length, 1, '연타해도 제출은 1건');
  const photos = srv.storage.table('Photos').all().filter((p) => p.studentId === '05');
  assert.equal(photos.length, 3);
  const big = photos.find((p) => p.originalName === 'day1_99_big.jpg');
  assert.equal(big.bytes, fs.statSync(path.join(PHOTO_DIR, 'day1_99_big.jpg')).size, '원본 바이트 그대로 저장');
  assert.ok(Math.max(big.width, big.height) <= 2000, '출력용 사본은 2000px 이하');
  assert.equal(photos.find((p) => p.caption === '시부야 교차로').mission, '1');
  await page.screenshot({ path: path.join(__dirname, '../output/e2e-student-done.png'), fullPage: true }).catch(() => {});

  // 수정 제출: 이전 사진 유지, 1장 삭제, 한 줄 변경 → 확인 대화상자 → 2회차
  await page.click('#editAgain');
  await page.waitForFunction(() => document.querySelectorAll('.ph img').length === 3);
  assert.equal(await page.inputValue('#oneLine'), '낯선 도시에서 발견한 익숙함');
  await page.click('[data-rm="2"]');
  await page.fill('#oneLine', '다르지만 닮은 거리');
  await page.click('#submitBtn');
  await page.waitForSelector('.dialog [data-a="1"]');
  await page.click('.dialog [data-a="1"]');
  await page.waitForSelector('#doneCard');
  assert.match(await page.textContent('#doneCard'), /2회차/);
  subs = srv.storage.table('Submissions').all().filter((s) => s.studentId === '05');
  assert.equal(subs.filter((s) => s.status === 'current').length, 1);
  assert.equal(subs.find((s) => s.status === 'current').photoIds.length, 2);
  assert.equal(subs.find((s) => s.status === 'current').oneLine, '다르지만 닮은 거리');

  // DAY 2 임시저장 → 새로고침 후 복원
  await page.click('.tab[data-day="2"]');
  await page.fill('#reflection', '임시저장 확인용 문장입니다.');
  await page.waitForTimeout(800);
  await page.reload();
  await page.click('.tab[data-day="2"]');
  assert.equal(await page.inputValue('#reflection'), '임시저장 확인용 문장입니다.');
  await ctx.close();
  assert.deepEqual(errors, []);
});

test('관리자: 현황 → 편집 → 결과물 미리보기 · 내려받기', { timeout: 120000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(base + 'admin');
  await page.fill('#pw', 'wrong-password');
  await page.click('#lb');
  await page.waitForFunction(() => /맞지 않습니다/.test(document.getElementById('le').textContent));
  await page.fill('#pw', 'e2e-admin-pass');
  await page.click('#lb');
  await page.waitForSelector('.stat');
  assert.match(await page.textContent('.stat'), /1\s*\/ 20/);

  await page.click('[data-go="1|05"]');
  await page.waitForSelector('.sub');
  await page.waitForFunction(() => [...document.querySelectorAll('.sub img')].every((i) => i.src.startsWith('data:')));
  await page.fill('.sub [data-k="oneLine"]', '선생님이 다듬은 한 줄');
  await page.click('.sub [data-st="approved"]');
  await page.click('.sub [data-save]');
  await page.waitForFunction(() => /저장됨/.test(document.querySelector('[data-msg]').textContent));
  const cur = srv.storage.table('Submissions').all().find((s) => s.studentId === '05' && s.status === 'current');
  assert.equal(cur.editedOneLine, '선생님이 다듬은 한 줄');
  assert.equal(cur.oneLine, '다르지만 닮은 거리');
  assert.equal(cur.reviewStatus, 'approved');
  await page.click('.sub [data-hero]');
  await page.waitForFunction(() => document.querySelector('.sub [data-hero]').classList.contains('on'));

  await page.click('[data-tab="outputs"]');
  await page.waitForSelector('[data-out="day1"]');
  await page.click('[data-out="day1"] [data-act="preview"]');
  await page.waitForSelector('#pv .pg');
  assert.match(await page.textContent('#pv'), /선생님이 다듬은 한 줄/);
  await page.screenshot({ path: path.join(__dirname, '../output/e2e-admin-preview.png') }).catch(() => {});

  // 헤드리스 Chromium은 한글 파일명을 'download'로 바꾸므로, 의도한 파일명은 a.download 값을 기록해 확인
  await page.evaluate(() => {
    window.__names = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__names.push(this.download); return orig.call(this); };
  });
  const [pptx] = await Promise.all([page.waitForEvent('download'), page.click('[data-out="day1"] [data-act="pptx"]')]);
  assert.equal(fs.readFileSync(await pptx.path()).slice(0, 2).toString(), 'PK', 'PPTX(zip) 파일');
  const [html] = await Promise.all([page.waitForEvent('download'), page.click('[data-out="growth"] [data-act="html"]')]);
  assert.match(fs.readFileSync(await html.path(), 'utf8'), /STUDENT 05/);
  const names = await page.evaluate(() => window.__names);
  assert.deepEqual(names.slice(0, 2), ['DAY01_A1_포스터.pptx', '개인성장기록지_A4.html']);
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  const csvText = fs.readFileSync(await csv.path(), 'utf8');
  assert.match(csvText, /선생님이 다듬은 한 줄/);
  await ctx.close();
  assert.deepEqual(errors, []);
});
