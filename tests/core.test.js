/* 서버 핵심 로직 테스트: 로그인 · 제출 · 중복 관리 · 권한 · 교사 편집 · 데이터셋 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeService, sampleSubmission, upload } = require('./helpers.js');

function login(env, id) {
  const st = env.students.find((s) => s.studentId === id);
  return env.ok('studentLogin', { studentId: id, pin: st.pin }).token;
}

test('학생 로그인: 올바른 PIN만 통과, 5회 실패 시 잠금', () => {
  const env = makeService();
  const st = env.students[0];
  assert.equal(env.call('studentLogin', { studentId: st.studentId, pin: '0000' === st.pin ? '1111' : '0000' }).error.code, 'AUTH');
  const r = env.ok('studentLogin', { studentId: st.studentId, pin: st.pin });
  assert.ok(r.token.startsWith('s.'));
  assert.equal(r.student.displayName, 'STUDENT 01');
  assert.equal(r.status.length, 4);
  assert.equal(r.student.name, undefined, '실명은 학생에게 내려가지 않음');
  for (let i = 0; i < 5; i++) env.call('studentLogin', { studentId: '02', pin: '99999' });
  const locked = env.call('studentLogin', { studentId: '02', pin: env.students[1].pin });
  assert.equal(locked.error.code, 'LOCKED');
  assert.equal(env.call('studentLogin', { studentId: '../x', pin: '1234' }).error.code, 'VALIDATION');
});

test('토큰 위조·만료 거부, 학생 토큰으로 관리자 API 호출 불가', () => {
  const env = makeService();
  const tok = login(env, '01');
  const forged = tok.replace('.01.', '.02.');
  assert.equal(env.call('myStatus', { token: forged }).error.code, 'AUTH');
  assert.equal(env.call('adminOverview', { token: tok }).error.code, 'AUTH');
  env.clock.advance(8 * 24 * 3600 * 1000);
  assert.equal(env.call('myStatus', { token: tok }).error.code, 'AUTH');
});

test('제출: 검증 오류는 항목별로 반환', () => {
  const env = makeService();
  const tok = login(env, '01');
  const r = env.call('submit', { token: tok, day: 1, ...sampleSubmission({ reflection: '짧음', essay: '짧음', oneLine: '가'.repeat(31) }), photos: [] });
  assert.equal(r.error.code, 'VALIDATION');
  assert.deepEqual(Object.keys(r.error.extra.fields).sort(), ['essay', 'oneLine', 'photos', 'reflection']);
});

test('제출 → 같은 요청 재전송은 duplicate, 다른 내용은 exists → 확인 후 2회차', () => {
  const env = makeService();
  const tok = login(env, '01');
  const p1 = upload(env.ok, tok, 1);
  const sub = sampleSubmission();
  const a = env.ok('submit', { token: tok, day: 1, ...sub, photos: [{ photoId: p1, caption: '타워', mission: '1' }] });
  assert.equal(a.status, 'created');
  assert.equal(a.receipt.revision, 1);
  // 버튼 연타/네트워크 재시도
  const b = env.ok('submit', { token: tok, day: 1, ...sub, photos: [{ photoId: p1 }] });
  assert.equal(b.status, 'duplicate');
  assert.equal(b.receipt.submissionId, a.receipt.submissionId);
  // 새 내용 → 확인 요청
  const sub2 = sampleSubmission({ oneLine: '두 번째 한 줄' });
  const c = env.ok('submit', { token: tok, day: 1, ...sub2, photos: [{ photoId: p1 }] });
  assert.equal(c.status, 'exists');
  assert.equal(c.existing.revision, 1);
  const d = env.ok('submit', { token: tok, day: 1, ...sub2, confirmOverwrite: true, photos: [{ photoId: p1, caption: '타워 야경', mission: '2' }] });
  assert.equal(d.status, 'updated');
  assert.equal(d.receipt.revision, 2);
  const all = env.storage.table('Submissions').all();
  assert.equal(all.filter((s) => s.status === 'current').length, 1, '현재 제출물은 날짜당 1건');
  assert.equal(all.filter((s) => s.status === 'superseded').length, 1, '이전 회차는 보관');
  const mine = env.ok('mySubmission', { token: tok, day: 1 }).submission;
  assert.equal(mine.oneLine, '두 번째 한 줄');
  assert.equal(mine.photos[0].caption, '타워 야경', '최신 제출의 사진 설명이 반영됨');
  assert.equal(mine.photos[0].mission, '2');
});

test('사진 업로드 재시도는 같은 photoId, 다른 학생 사진은 사용 불가', () => {
  const env = makeService();
  const t1 = login(env, '01');
  const t2 = login(env, '02');
  const body = { token: t1, day: 1, clientUploadId: 'same-id', original: { base64: require('./helpers.js').TINY_JPEG, mime: 'image/jpeg' }, display: { base64: require('./helpers.js').TINY_JPEG, width: 1, height: 1 } };
  const x = env.ok('uploadPhoto', body);
  const y = env.ok('uploadPhoto', body);
  assert.equal(x.photoId, y.photoId);
  assert.equal(y.reused, true);
  const r = env.call('submit', { token: t2, day: 1, ...sampleSubmission(), photos: [{ photoId: x.photoId }] });
  assert.equal(r.error.code, 'VALIDATION');
  assert.equal(env.call('myPhoto', { token: t2, photoId: x.photoId }).error.code, 'FORBIDDEN');
  assert.ok(env.ok('myPhoto', { token: t1, photoId: x.photoId }).dataUrl.startsWith('data:image/jpeg;base64,'));
  // 다른 날짜 사진도 거부
  const r2 = env.call('submit', { token: t1, day: 2, ...sampleSubmission(), photos: [{ photoId: x.photoId }] });
  assert.equal(r2.error.code, 'VALIDATION');
  // 이미지가 아닌 파일 거부
  assert.equal(env.call('uploadPhoto', { ...body, clientUploadId: 'z', original: { base64: 'AAAA', mime: 'application/pdf' } }).error.code, 'VALIDATION');
});

test('마감·날짜별 개방', () => {
  const env = makeService({ start: '2026-12-07T01:00:00Z' });
  const admin = env.ok('adminLogin', { password: 'admin-pass-1234' }).token;
  const tok = login(env, '01');
  env.ok('adminSettings', { token: admin, set: { openMode: 'byDate', locks: { 1: true } } });
  const st = env.ok('myStatus', { token: tok }).status;
  assert.deepEqual(st.map((s) => s.state), ['locked', 'notyet', 'notyet', 'notyet']);
  assert.equal(env.call('uploadPhoto', { token: tok, day: 1, clientUploadId: 'q' }).error.code, 'CLOSED');
  env.clock.advance(2 * 24 * 3600 * 1000);
  assert.equal(env.ok('myStatus', { token: tok }).status[2].state, 'open');
});

test('관리자: 편집본은 원문을 보존하고 결과물에는 편집본 사용, 보류·비동의 처리', () => {
  const env = makeService();
  const admin = env.ok('adminLogin', { password: 'admin-pass-1234' }).token;
  assert.equal(env.call('adminLogin', { password: 'wrong' }).error.code, 'AUTH');
  const t1 = login(env, '01'), t2 = login(env, '02'), t3 = login(env, '03');
  for (const [t, d] of [[t1, 1], [t2, 1], [t3, 1]]) {
    const p = upload(env.ok, t, d);
    env.ok('submit', { token: t, day: d, ...sampleSubmission(), photos: [{ photoId: p }] });
  }
  const ov = env.ok('adminOverview', { token: admin });
  assert.equal(ov.perDay[0].submitted, 3);
  assert.equal(ov.totalStudents, 20);
  const subs = env.ok('adminSubmissions', { token: admin, day: 1 }).submissions;
  assert.equal(subs.length, 3);
  const s1 = subs.find((s) => s.studentId === '01');
  env.ok('adminUpdateSubmission', { token: admin, submissionId: s1.submissionId, patch: { editedOneLine: '선생님이 다듬은 한 줄', reviewStatus: 'approved', topics: ['friend'], submissionId: 'hack', studentId: '99' } });
  const after = env.storage.table('Submissions').all().find((s) => s.submissionId === s1.submissionId);
  assert.equal(after.oneLine, '낯선 도시에서 발견한 익숙함', '학생 원문 보존');
  assert.equal(after.editedOneLine, '선생님이 다듬은 한 줄');
  assert.equal(after.studentId, '01', '허용되지 않은 필드는 무시');
  const s2 = subs.find((s) => s.studentId === '02');
  env.ok('adminUpdateSubmission', { token: admin, submissionId: s2.submissionId, patch: { reviewStatus: 'hold' } });
  env.ok('adminUpsertStudent', { token: admin, student: { studentId: '03', exhibitConsent: false, name: '홍길동', displayName: '도쿄 탐험가' } });

  const ds = env.ok('adminDataset', { token: admin });
  assert.equal(ds.entries.length, 2, '보류(hold)는 결과물에서 제외');
  const e1 = ds.entries.find((e) => e.studentId === '01');
  assert.equal(e1.oneLine, '선생님이 다듬은 한 줄');
  assert.deepEqual(e1.topics, ['friend']);
  const e3 = ds.entries.find((e) => e.studentId === '03');
  assert.equal(e3.photos.length, 0, '전시 비동의 학생 사진은 결과물에서 제외');
  assert.equal(e3.displayName, '도쿄 탐험가');
  assert.ok(!JSON.stringify(ds).includes('홍길동'), '실명은 결과물 데이터에 포함되지 않음');
  assert.equal(env.ok('adminDataset', { token: admin, approvedOnly: true }).entries.length, 1);
});

test('가상 데이터 삭제(purge): 제출물·사진 파일 삭제, 확인 문구 필수', () => {
  const env = makeService();
  const admin = env.ok('adminLogin', { password: 'admin-pass-1234' }).token;
  const t = login(env, '01');
  const p = upload(env.ok, t, 1);
  env.ok('submit', { token: t, day: 1, ...sampleSubmission(), photos: [{ photoId: p }] });
  assert.equal(env.call('adminPurge', { token: admin }).error.code, 'VALIDATION');
  const ph = env.storage.table('Photos').all()[0];
  const r = env.ok('adminPurge', { token: admin, confirm: 'DELETE' });
  assert.equal(r.deletedPhotos, 1);
  assert.equal(env.storage.table('Submissions').all().length, 0);
  assert.throws(() => env.storage.files.read(ph.originalFileId));
  assert.equal(env.storage.table('Students').all().length, 20, '학생 명단은 유지');
});

test('알 수 없는 action과 내부 오류는 안전한 메시지로 반환', () => {
  const env = makeService();
  assert.equal(env.call('setAdminPassword', {}).error.code, 'NOTFOUND');
  assert.equal(env.call('__proto__', {}).error.code, 'NOTFOUND');
  const orig = env.storage.table;
  env.storage.table = () => { throw new Error('disk exploded'); };
  const r = env.call('studentLogin', { studentId: '01', pin: '1234' });
  env.storage.table = orig;
  assert.equal(r.error.code, 'SERVER');
  assert.ok(!r.error.message.includes('disk'));
});
