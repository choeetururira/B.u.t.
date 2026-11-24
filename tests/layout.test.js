/*
 * 결과물 레이아웃 검증 (가상 학생 20명 데이터)
 *  - 모든 요소가 용지 안에 있는지
 *  - 글자가 상자를 넘치지 않는지 (계산값 + 실제 브라우저 렌더링 측정)
 *  - PPTX 쪽수 = 문서 쪽수
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Layout = require('../src/shared/layout.js');
const RH = require('../src/shared/render-html.js');
const RP = require('../src/shared/render-pptx.js');
const { makeService, TINY_JPEG } = require('./helpers.js');
const { buildVirtualSubmissions } = require('../scripts/virtual-data.js');

function virtualDataset() {
  const env = makeService();
  const tokens = {};
  const names = [];
  for (let d = 1; d <= 4; d++) for (let i = 1; i <= 10; i++) names.push(`day${d}_${String(i).padStart(2, '0')}.jpg`);
  for (const s of buildVirtualSubmissions(names)) {
    const st = env.students.find((x) => x.studentId === s.studentId);
    tokens[s.studentId] = tokens[s.studentId] || env.ok('studentLogin', { studentId: s.studentId, pin: st.pin }).token;
    const photos = s.photos.map((p, k) => ({
      photoId: env.ok('uploadPhoto', { token: tokens[s.studentId], day: s.day, clientUploadId: crypto.randomUUID(), original: { base64: TINY_JPEG, mime: 'image/jpeg' }, display: { base64: TINY_JPEG, width: k === 1 ? 1200 : 1600, height: k === 1 ? 1600 : 1200 } }).photoId,
      caption: p.caption, mission: p.mission
    }));
    env.ok('submit', { token: tokens[s.studentId], day: s.day, clientSubmissionId: crypto.randomUUID(), reflection: s.reflection, essay: s.essay, oneLine: s.oneLine, photos });
  }
  return env.svc.buildDataset(false);
}

const ds = virtualDataset();
const docs = Layout.OUTPUTS.map((o) => Layout.build(o.key, ds)).concat([
  Layout.accessGuide('https://script.google.com/macros/s/AKfycbTEST/exec', ds.students.map((s) => ({ ...s, pin: '0123' })))
]);

test('가상 데이터: 20명, 77건 제출 (미제출 3건 포함 시나리오)', () => {
  assert.equal(ds.students.length, 20);
  assert.equal(ds.entries.length, 77);
});

test('결과물 13종 생성, 쪽수 확인', () => {
  const pages = Object.fromEntries(docs.map((d) => [d.name, d.pages.length]));
  assert.equal(pages['DAY01_A1_포스터'], 1);
  assert.equal(pages['개인성장기록지_A4'], 40, '학생 20명 × 2쪽');
  assert.equal(pages['국제교류_팜플렛_A5'] % 4, 0, '중철 제본용 4의 배수');
  assert.equal(pages['기록카드_A5'], 77);
  assert.equal(docs.length, 13);
});

test('모든 요소가 용지 안에 있고 글자가 상자를 넘치지 않음(계산)', () => {
  const problems = [];
  for (const doc of docs) {
    doc.pages.forEach((p, pi) => p.els.forEach((e) => {
      const box = e.t === 'line' ? { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(e.x2 - e.x1), h: Math.abs(e.y2 - e.y1) } : e;
      if (box.x < -0.5 || box.y < -0.5 || box.x + box.w > doc.size.w + 0.5 || box.y + box.h > doc.size.h + 0.5) problems.push(`${doc.name} p${pi + 1} ${e.t} 용지 밖 (${box.x.toFixed(1)},${box.y.toFixed(1)})`);
      if (e.t === 'text') {
        const lines = e.text.split('\n').length;
        // 마지막 줄은 행간 여백 없이 글자 높이만 필요
        const need = ((lines - 1) * e.lh + 1.05) * e.pt * 0.3528;
        if (need > e.h + 0.6) problems.push(`${doc.name} p${pi + 1} 글자 넘침 "${e.text.slice(0, 20)}" ${need.toFixed(1)}>${e.h.toFixed(1)}mm`);
      }
    }));
  }
  assert.deepEqual(problems, []);
});

test('실제 브라우저(Chromium + Gowun 글꼴)에서 줄 길이가 상자 폭을 넘지 않음', { timeout: 180000 }, async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const FONT = 'https://fonts.but.local/';
  await page.route(FONT + '**', (route) => {
    const p = path.join(__dirname, '../node_modules/@fontsource', route.request().url().slice(FONT.length));
    route.fulfill(fs.existsSync(p) ? { body: fs.readFileSync(p), contentType: p.endsWith('.css') ? 'text/css' : 'font/woff2' } : { status: 404 });
  });
  const css = `<link rel="stylesheet" href="${FONT}gowun-dodum/index.css"><link rel="stylesheet" href="${FONT}gowun-batang/400.css"><link rel="stylesheet" href="${FONT}gowun-batang/700.css">`;
  const over = [];
  let checked = 0;
  for (const doc of docs) {
    await page.setContent(RH.documentHTML(doc, () => null, css), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const out = [];
      const els = document.querySelectorAll('.t');
      els.forEach((el) => {
        const span = el.firstElementChild;
        const w = span.getBoundingClientRect().width, box = el.getBoundingClientRect().width;
        if (w > box + 1) out.push({ text: span.textContent.slice(0, 30), over: +(w - box).toFixed(1) });
      });
      return { out, n: els.length };
    });
    checked += r.n;
    r.out.forEach((o) => over.push(doc.name + ': "' + o.text + '" +' + o.over + 'px'));
  }
  await browser.close();
  assert.ok(checked > 1500, '측정한 글 상자 수: ' + checked);
  assert.deepEqual(over, []);
});

test('PPTX 생성: 쪽수 일치, 유효한 파일', async () => {
  for (const doc of docs.filter((d) => /DAY01|팜플렛_A5|접속안내/.test(d.name))) {
    const pptx = RP.render(doc, () => 'data:image/jpeg;base64,' + TINY_JPEG);
    const buf = await pptx.write({ outputType: 'nodebuffer' });
    assert.equal(buf.slice(0, 2).toString(), 'PK', 'zip 형식');
    const slides = (buf.toString('latin1').match(/ppt\/slides\/slide\d+\.xml/g) || []).filter((v, i, a) => a.indexOf(v) === i).length;
    assert.equal(slides, doc.pages.length, doc.name);
  }
});
