const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Core = require('../src/shared/core.js');
const { createLocalStorage, nodeCrypto } = require('../src/local/storage-local.js');

// 1x1 JPEG (가장 작은 유효 이미지)
const TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'but-test-'));
}

function makeService(opts = {}) {
  const dir = opts.dir || tmpDir();
  const storage = createLocalStorage(dir);
  let t = opts.start ? new Date(opts.start).getTime() : Date.parse('2026-12-07T12:00:00Z');
  const clock = { now: () => new Date(t), advance: (ms) => { t += ms; } };
  const svc = Core.createService({ storage, crypto: nodeCrypto, now: clock.now });
  svc.setAdminPassword('admin-pass-1234');
  const students = svc.generateStudents(opts.students || 20, 1);
  const call = (action, payload) => svc.api(action, payload);
  const ok = (action, payload) => {
    const r = call(action, payload);
    if (!r.ok) throw new Error(action + ' 실패: ' + JSON.stringify(r.error));
    return r.data;
  };
  return { dir, storage, svc, clock, students, call, ok };
}

function sampleSubmission(over = {}) {
  return Object.assign({
    reflection: '일본에 오기 전에는 조용한 나라라고 생각했는데 실제로는 활기차고 다양한 모습이 많아서 놀랐다.',
    essay: '도쿄타워 전망대에서 끝없이 이어지는 건물들을 보며 이 도시에 사는 사람들의 하루를 상상해 보았다. 시부야 교차로에서는 신호가 바뀌자마자 수백 명이 동시에 건너는 모습을 직접 보았다.',
    oneLine: '낯선 도시에서 발견한 익숙함',
    clientSubmissionId: crypto.randomUUID()
  }, over);
}

function upload(ok, token, day) {
  return ok('uploadPhoto', {
    token, day, clientUploadId: crypto.randomUUID(),
    original: { base64: TINY_JPEG, mime: 'image/jpeg', name: 'a.jpg' },
    display: { base64: TINY_JPEG, width: 1, height: 1 }
  }).photoId;
}

module.exports = { makeService, sampleSubmission, upload, tmpDir, TINY_JPEG };
