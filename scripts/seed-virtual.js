/*
 * 가상 학생 20명 × 4일 제출을 실제 API로 보내는 스크립트 (로컬 서버 · Apps Script 모두 가능)
 *   node scripts/seed-virtual.js --url http://localhost:8080 --admin-password test-admin-2026
 *   node scripts/seed-virtual.js --url https://script.google.com/macros/s/.../exec --admin-password ...
 * 실제 학생 데이터를 넣기 전, 관리자 페이지 [설정 → 가상 데이터 삭제]로 지우세요.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { call, args } = require('./api-client.js');
const { buildVirtualSubmissions } = require('./virtual-data.js');

async function seed({ url, adminPassword, photoDir, log = console.log, concurrency = 4 }) {
  photoDir = photoDir || path.join(__dirname, '../data/virtual-photos');
  const manifest = JSON.parse(fs.readFileSync(path.join(photoDir, 'manifest.json'), 'utf8'));
  const admin = await call(url, 'adminLogin', { password: adminPassword });
  await call(url, 'adminGenerateStudents', { token: admin.token, count: 20, startAt: 1 });
  const { students } = await call(url, 'adminStudents', { token: admin.token });
  const pins = Object.fromEntries(students.map((s) => [s.studentId, s.pin]));
  const subs = buildVirtualSubmissions(Object.keys(manifest));
  const tokens = {};
  const stats = { submitted: 0, photos: 0, bytes: 0, ms: [] };

  async function one(sub) {
    if (!tokens[sub.studentId]) tokens[sub.studentId] = (await call(url, 'studentLogin', { studentId: sub.studentId, pin: pins[sub.studentId] })).token;
    const token = tokens[sub.studentId];
    const t0 = Date.now();
    const photos = [];
    for (const ph of sub.photos) {
      const m = manifest[ph.file];
      const orig = fs.readFileSync(path.join(photoDir, ph.file));
      const disp = fs.readFileSync(path.join(photoDir, m.display));
      const r = await call(url, 'uploadPhoto', {
        token, day: sub.day, clientUploadId: crypto.randomUUID(),
        original: { base64: orig.toString('base64'), mime: 'image/jpeg', name: ph.file },
        display: { base64: disp.toString('base64'), width: m.width, height: m.height }
      });
      stats.photos++;
      stats.bytes += orig.length;
      photos.push({ photoId: r.photoId, caption: ph.caption, mission: ph.mission });
    }
    const r = await call(url, 'submit', {
      token, day: sub.day, clientSubmissionId: crypto.randomUUID(), confirmOverwrite: true,
      reflection: sub.reflection, essay: sub.essay, oneLine: sub.oneLine, photos, userAgent: 'seed-virtual'
    });
    stats.ms.push(Date.now() - t0);
    stats.submitted++;
    if (stats.submitted % 10 === 0) log(`  제출 ${stats.submitted}/${subs.length} (마지막: ${sub.studentId}번 DAY${sub.day} → ${r.status})`);
  }

  // 여러 학생이 동시에 제출하는 상황을 흉내 (동시 4명)
  const queue = subs.slice();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) await one(queue.shift());
  }));
  stats.ms.sort((a, b) => a - b);
  return { ...stats, expected: subs.length, p50: stats.ms[Math.floor(stats.ms.length / 2)], max: stats.ms[stats.ms.length - 1], adminToken: admin.token };
}

if (require.main === module) {
  const a = args(process.argv);
  if (!a.url || !a['admin-password']) {
    console.log('사용법: node scripts/seed-virtual.js --url <주소> --admin-password <비밀번호>');
    process.exit(1);
  }
  seed({ url: a.url, adminPassword: a['admin-password'] }).then((s) => {
    console.log(`완료: 제출 ${s.submitted}/${s.expected}건, 사진 ${s.photos}장 (${(s.bytes / 1048576).toFixed(1)}MB), 1건 처리 시간 중앙값 ${s.p50}ms / 최대 ${s.max}ms`);
  }).catch((e) => { console.error('실패:', e.message); process.exit(1); });
}

module.exports = { seed };
