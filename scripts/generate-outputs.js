/*
 * 결과물 일괄 생성 (출력소 납품용 고해상도 PDF + 편집용 PPTX/HTML)
 *   node scripts/generate-outputs.js --url <웹앱 주소> --admin-password <비밀번호> [--out output] [--only day1,growth] [--approved]
 * 결과: output/<이름>.pdf · .pptx · .html(+photos/) · 첫 쪽 미리보기 .png
 */
const fs = require('fs');
const path = require('path');
const { call, args } = require('./api-client.js');
const Layout = require('../src/shared/layout.js');
const RH = require('../src/shared/render-html.js');
const RP = require('../src/shared/render-pptx.js');

const ROOT = path.join(__dirname, '..');
const FONT_HOST = 'https://fonts.but.local/';
const FONT_CSS =
  `<link rel="stylesheet" href="${FONT_HOST}gowun-dodum/index.css"><link rel="stylesheet" href="${FONT_HOST}gowun-batang/400.css"><link rel="stylesheet" href="${FONT_HOST}gowun-batang/700.css">`;

async function fetchPhotos(url, token, ids, log) {
  const map = {};
  for (let i = 0; i < ids.length; i += 8) {
    const r = await call(url, 'adminPhotos', { token, photoIds: ids.slice(i, i + 8), kind: 'display' });
    Object.assign(map, r.photos);
    log && log(`  사진 ${Math.min(i + 8, ids.length)}/${ids.length}`);
  }
  return map;
}

async function generate({ url, adminPassword, out, only, approved, log = console.log, pdf = true, png = true }) {
  out = out || path.join(ROOT, 'output');
  fs.mkdirSync(path.join(out, 'photos'), { recursive: true });
  const { token } = await call(url, 'adminLogin', { password: adminPassword });
  const ds = await call(url, 'adminDataset', { token, approvedOnly: !!approved });
  const settings = await call(url, 'adminSettings', { token });
  const { students } = await call(url, 'adminStudents', { token });
  log(`데이터: 학생 ${ds.students.length}명, 제출 ${ds.entries.length}건`);

  const keys = Layout.OUTPUTS.map((o) => o.key).concat(['guide']).filter((k) => !only || only.includes(k));
  const docs = keys.map((k) =>
    k === 'guide'
      ? Layout.accessGuide(settings.appUrl || url, students.filter((s) => s.active).map((s) => ({ studentId: s.studentId, displayName: s.displayName, pin: s.pin })))
      : Layout.build(k, ds)
  );
  const allIds = [...new Set(docs.flatMap((d) => Layout.photoIdsOf(d)))];
  const photos = await fetchPhotos(url, token, allIds, null);
  log(`사진 ${Object.keys(photos).length}장 내려받음`);

  // HTML 원본용 사진 파일
  const fileOf = {};
  for (const [id, dataUrl] of Object.entries(photos)) {
    const f = 'photos/' + id + '.jpg';
    fs.writeFileSync(path.join(out, f), Buffer.from(dataUrl.split(',')[1], 'base64'));
    fileOf[id] = f;
  }

  let browser = null;
  if (pdf || png) {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
  }
  const results = [];
  for (const doc of docs) {
    const base = path.join(out, doc.name);
    // 1) 편집 가능한 HTML 원본 (사진은 photos/ 폴더 참조)
    fs.writeFileSync(base + '.html', RH.documentHTML(doc, (id) => fileOf[id] || null));
    // 2) 편집 가능한 PPTX
    const pptx = RP.render(doc, (id) => photos[id] || null);
    await pptx.writeFile({ fileName: base + '.pptx' });
    // 3) 출력용 PDF + 미리보기 PNG
    if (browser) {
      const ctx = await browser.newContext({ deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.route(FONT_HOST + '**', (route) => {
        const rel = route.request().url().slice(FONT_HOST.length);
        const p = path.join(ROOT, 'node_modules/@fontsource', rel);
        if (!p.startsWith(path.join(ROOT, 'node_modules/@fontsource')) || !fs.existsSync(p)) return route.fulfill({ status: 404 });
        route.fulfill({ body: fs.readFileSync(p), contentType: p.endsWith('.css') ? 'text/css' : 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' } });
      });
      await page.setContent(RH.documentHTML(doc, (id) => photos[id] || null, FONT_CSS), { waitUntil: 'networkidle', timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      if (pdf) await page.pdf({ path: base + '.pdf', preferCSSPageSize: true, printBackground: true, timeout: 300000 });
      if (png) {
        const pxW = Math.round(doc.size.w * 3.7795), pxH = Math.round(doc.size.h * 3.7795);
        await page.setViewportSize({ width: pxW, height: pxH });
        const el = await page.$('.but-page');
        await el.screenshot({ path: base + '.png', scale: 'css' });
      }
      await ctx.close();
    }
    const sizeMB = (f) => (fs.existsSync(f) ? (fs.statSync(f).size / 1048576).toFixed(1) + 'MB' : '-');
    results.push({ name: doc.name, pages: doc.pages.length, size: doc.sizeKey, pdf: sizeMB(base + '.pdf'), pptx: sizeMB(base + '.pptx') });
    log(`  ✓ ${doc.name} (${doc.sizeKey}, ${doc.pages.length}쪽) PDF ${sizeMB(base + '.pdf')} · PPTX ${sizeMB(base + '.pptx')}`);
  }
  if (browser) await browser.close();
  return { results, dataset: ds, out };
}

if (require.main === module) {
  const a = args(process.argv);
  if (!a.url || !a['admin-password']) {
    console.log('사용법: node scripts/generate-outputs.js --url <주소> --admin-password <비밀번호> [--out output] [--only day1,growth] [--approved]');
    process.exit(1);
  }
  generate({
    url: a.url, adminPassword: a['admin-password'], out: a.out && path.resolve(a.out),
    only: a.only ? String(a.only).split(',') : null, approved: !!a.approved, png: !a['no-png']
  }).then((r) => console.log(`완료: ${r.results.length}종 → ${r.out}`)).catch((e) => { console.error('실패:', e.stack || e.message); process.exit(1); });
}

module.exports = { generate };
