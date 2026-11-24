/*
 * B.U.T. TOKYO 2026 — 서버 핵심 로직 (저장소와 무관)
 * Apps Script(Google Sheets + Drive)와 로컬 Node 서버(JSON 파일)가 같은 코드를 사용합니다.
 *
 * createService({ storage, crypto, now }) → { api(action, payload) , ... }
 *   storage: { table(name), files, props, cache, lock(fn) }   (src/gas/storage-gas.js, src/local/storage-local.js)
 *   crypto : { hmacHex(secret, msg), sha256Hex(msg), randomHex(bytes), uuid() }
 */
var BUT_Core = (function () {
  var P = typeof BUT_Program !== 'undefined' ? BUT_Program : require('./program.js');
  var program = P.program;
  var R = program.rules;

  // ---------------------------------------------------------------- 데이터 구조
  // 시트(탭) 이름 = 키, 열 순서 = cols. 타입: s 문자열, i 정수, b 불리언, j JSON
  var SCHEMA = {
    Students: {
      key: 'studentId',
      cols: [
        ['studentId', 's'], ['pin', 's'], ['name', 's'], ['displayName', 's'], ['group', 's'],
        ['exhibitConsent', 'b'], ['teacherComment', 's'], ['active', 'b'], ['createdAt', 's']
      ]
    },
    Submissions: {
      key: 'submissionId',
      cols: [
        ['submissionId', 's'], ['clientSubmissionId', 's'], ['studentId', 's'], ['day', 'i'],
        ['revision', 'i'], ['status', 's'], ['submittedAt', 's'],
        ['reflection', 's'], ['essay', 's'], ['oneLine', 's'], ['photoIds', 'j'],
        ['editedReflection', 's'], ['editedEssay', 's'], ['editedOneLine', 's'],
        ['featuredPhotoId', 's'], ['topics', 'j'], ['reviewStatus', 's'], ['teacherNote', 's'],
        ['editedAt', 's'], ['userAgent', 's']
      ]
    },
    Photos: {
      key: 'photoId',
      cols: [
        ['photoId', 's'], ['studentId', 's'], ['day', 'i'], ['clientUploadId', 's'],
        ['originalFileId', 's'], ['displayFileId', 's'], ['mime', 's'], ['originalName', 's'],
        ['bytes', 'i'], ['width', 'i'], ['height', 'i'], ['caption', 's'], ['mission', 's'],
        ['exhibit', 'b'], ['uploadedAt', 's'], ['submissionId', 's']
      ]
    },
    Settings: { key: 'key', cols: [['key', 's'], ['value', 'j']] },
    Log: { key: 'at', cols: [['at', 's'], ['actor', 's'], ['action', 's'], ['detail', 's']] }
  };

  function encodeCell(type, v) {
    if (v === undefined || v === null) return '';
    if (type === 'j') return JSON.stringify(v);
    if (type === 'b') return v ? 'TRUE' : 'FALSE';
    return String(v);
  }
  function decodeCell(type, v) {
    if (type === 'j') {
      if (v === '' || v === null || v === undefined) return null;
      if (typeof v !== 'string') return v;
      try { return JSON.parse(v); } catch (e) { return null; }
    }
    if (type === 'b') return v === true || String(v).toUpperCase() === 'TRUE';
    if (type === 'i') return v === '' || v === null || v === undefined ? 0 : parseInt(v, 10) || 0;
    return v === null || v === undefined ? '' : String(v);
  }
  function rowToObj(table, row) {
    var o = {};
    SCHEMA[table].cols.forEach(function (c, i) { o[c[0]] = decodeCell(c[1], row[i]); });
    return o;
  }
  function objToRow(table, obj) {
    return SCHEMA[table].cols.map(function (c) { return encodeCell(c[1], obj[c[0]]); });
  }

  // ---------------------------------------------------------------- 유틸
  function ApiError(code, message, extra) {
    this.code = code;
    this.message = message;
    this.extra = extra || null;
  }
  function fail(code, msg, extra) { throw new ApiError(code, msg, extra); }
  function str(v) { return v === undefined || v === null ? '' : String(v); }
  function clean(v) {
    // 제어문자 제거, 줄바꿈 정규화, 앞뒤 공백 제거
    return str(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  }
  function charLen(s) { return Array.from(str(s)).length; }
  function b64Bytes(b64) {
    b64 = str(b64);
    var pad = b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0;
    return Math.floor((b64.length * 3) / 4) - pad;
  }
  function stripDataUrl(s) {
    s = str(s);
    var i = s.indexOf('base64,');
    return i >= 0 ? s.slice(i + 7) : s;
  }
  function dayValid(d) { return !!P.getDay(d); }
  function effective(sub) {
    return {
      reflection: sub.editedReflection || sub.reflection,
      essay: sub.editedEssay || sub.essay,
      oneLine: sub.editedOneLine || sub.oneLine
    };
  }
  function defaultDisplayName(id) {
    var n = parseInt(id, 10);
    return 'STUDENT ' + (isNaN(n) ? id : P.pad2(n));
  }

  function classifyTopics(text) {
    text = str(text);
    var scored = program.topics.map(function (t) {
      var s = 0;
      t.keywords.forEach(function (k) {
        var idx = text.indexOf(k);
        while (idx >= 0) { s++; idx = text.indexOf(k, idx + k.length); }
      });
      return { key: t.key, score: s };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var out = scored.filter(function (x) { return x.score > 0; }).slice(0, 2).map(function (x) { return x.key; });
    return out;
  }

  // ---------------------------------------------------------------- 서비스
  function createService(opts) {
    var S = opts.storage;
    var C = opts.crypto;
    var now = opts.now || function () { return new Date(); };
    function iso() { return now().toISOString(); }

    function T(name) { return S.table(name); }

    // --- 설정
    function getSetting(key, dflt) {
      var rows = T('Settings').all();
      for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value === null ? dflt : rows[i].value;
      return dflt;
    }
    function setSetting(key, value) {
      var t = T('Settings');
      if (!t.update('key', key, { value: value })) t.insert({ key: key, value: value });
    }
    function log(actor, action, detail) {
      try { T('Log').insert({ at: iso(), actor: actor, action: action, detail: typeof detail === 'string' ? detail : JSON.stringify(detail || {}) }); } catch (e) { /* 로그 실패는 무시 */ }
    }

    // --- 토큰 (HMAC 서명, 서버에 세션 저장 불필요)
    function secret() {
      var s = S.props.get('TOKEN_SECRET');
      if (!s) { s = C.randomHex(32); S.props.set('TOKEN_SECRET', s); }
      return s;
    }
    function makeToken(role, sub, hours) {
      var exp = Math.floor(now().getTime() / 1000) + Math.round(hours * 3600);
      var body = role + '.' + encodeURIComponent(sub) + '.' + exp;
      return body + '.' + C.hmacHex(secret(), body).slice(0, 40);
    }
    function readToken(token, role) {
      var parts = str(token).split('.');
      if (parts.length !== 4 || parts[0] !== role) fail('AUTH', '로그인이 필요합니다.');
      var body = parts.slice(0, 3).join('.');
      if (C.hmacHex(secret(), body).slice(0, 40) !== parts[3]) fail('AUTH', '로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.');
      if (Number(parts[2]) * 1000 < now().getTime()) fail('AUTH', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
      return decodeURIComponent(parts[1]);
    }
    function requireStudent(token) {
      var id = readToken(token, 's');
      var st = findStudent(id);
      if (!st || !st.active) fail('AUTH', '등록되지 않은 학생 번호입니다.');
      return st;
    }
    function requireAdmin(token) { readToken(token, 'a'); return 'admin'; }

    function rateCheck(key) {
      var n = Number(S.cache.get('fail:' + key) || 0);
      if (n >= R.loginMaxFails) fail('LOCKED', '로그인 시도가 너무 많습니다. ' + R.loginLockMinutes + '분 뒤에 다시 시도하세요.');
    }
    function rateFail(key) {
      var n = Number(S.cache.get('fail:' + key) || 0) + 1;
      S.cache.put('fail:' + key, String(n), R.loginLockMinutes * 60);
    }
    function rateClear(key) { S.cache.put('fail:' + key, '0', 1); }

    function hashPassword(pw, salt) { return salt + '$' + C.sha256Hex(salt + '|' + pw); }
    function setAdminPassword(pw) {
      if (charLen(pw) < 8) fail('VALIDATION', '관리자 비밀번호는 8자 이상이어야 합니다.');
      S.props.set('ADMIN_HASH', hashPassword(pw, C.randomHex(8)));
    }
    function checkAdminPassword(pw) {
      var h = S.props.get('ADMIN_HASH');
      if (!h) fail('SETUP', '관리자 비밀번호가 설정되지 않았습니다. setup()을 먼저 실행하세요.');
      return hashPassword(pw, h.split('$')[0]) === h;
    }

    // --- 조회 헬퍼
    function findStudent(id) {
      id = str(id).trim();
      var rows = T('Students').all();
      for (var i = 0; i < rows.length; i++) if (rows[i].studentId === id) return rows[i];
      return null;
    }
    function currentSubmission(studentId, day) {
      var rows = T('Submissions').all();
      for (var i = rows.length - 1; i >= 0; i--) {
        var r = rows[i];
        if (r.studentId === studentId && r.day === Number(day) && r.status === 'current') return r;
      }
      return null;
    }
    function photosById() {
      var m = {};
      T('Photos').all().forEach(function (p) { m[p.photoId] = p; });
      return m;
    }
    function locks() { return getSetting('locks', {}) || {}; }
    function openMode() { return getSetting('openMode', 'all'); }
    function tokyoDate() {
      // YYYY-MM-DD (도쿄 시각)
      var d = new Date(now().getTime() + 9 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    }
    function dayState(day) {
      var d = P.getDay(day);
      if (locks()[day]) return 'locked';
      if (openMode() === 'byDate' && tokyoDate() < d.date) return 'notyet';
      return 'open';
    }
    function publicStudent(st) {
      return { studentId: st.studentId, displayName: st.displayName || defaultDisplayName(st.studentId) };
    }
    function statusFor(st) {
      return program.days.map(function (d) {
        var cur = currentSubmission(st.studentId, d.day);
        return {
          day: d.day,
          state: dayState(d.day),
          submitted: !!cur,
          submittedAt: cur ? cur.submittedAt : null,
          revision: cur ? cur.revision : 0
        };
      });
    }

    // ============================================================ 학생 API
    function studentLogin(p) {
      var id = clean(p.studentId);
      var pin = clean(p.pin);
      if (!new RegExp(R.studentIdPattern).test(id)) fail('VALIDATION', '학생 번호 형식을 확인하세요.');
      rateCheck('s:' + id);
      var st = findStudent(id);
      if (!st || !st.active || st.pin !== pin) {
        rateFail('s:' + id);
        log('s:' + id, 'login-fail', '');
        fail('AUTH', '학생 번호 또는 PIN이 맞지 않습니다.');
      }
      rateClear('s:' + id);
      log('s:' + id, 'login', '');
      return { token: makeToken('s', id, R.studentTokenHours), student: publicStudent(st), status: statusFor(st), today: tokyoDate() };
    }

    function myStatus(p) {
      var st = requireStudent(p.token);
      return { student: publicStudent(st), status: statusFor(st), today: tokyoDate() };
    }

    function uploadPhoto(p) {
      var st = requireStudent(p.token);
      var day = Number(p.day);
      if (!dayValid(day)) fail('VALIDATION', '날짜(DAY) 정보가 올바르지 않습니다.');
      if (dayState(day) !== 'open') fail('CLOSED', '이 날짜의 제출이 마감되었거나 아직 열리지 않았습니다.');
      var cuid = clean(p.clientUploadId);
      if (!cuid) fail('VALIDATION', '업로드 ID가 없습니다.');
      // 같은 업로드 재시도 → 기존 결과 반환 (네트워크 재시도 안전)
      var existing = T('Photos').all().filter(function (x) { return x.clientUploadId === cuid && x.studentId === st.studentId; })[0];
      if (existing) return { photoId: existing.photoId, reused: true };

      var orig = p.original || {};
      var disp = p.display || {};
      var mime = str(orig.mime).toLowerCase() || 'image/jpeg';
      if (!/^image\/(jpeg|jpg|png|webp|heic|heif|gif)$/.test(mime)) fail('VALIDATION', '사진 파일(JPG, PNG, HEIC)만 올릴 수 있습니다.');
      var ob = stripDataUrl(orig.base64);
      var db = stripDataUrl(disp.base64);
      if (!ob || !db) fail('VALIDATION', '사진 데이터가 비어 있습니다.');
      var oBytes = b64Bytes(ob);
      if (oBytes > R.maxOriginalBytes) fail('VALIDATION', '사진 1장은 20MB 이하만 가능합니다.');
      if (b64Bytes(db) > R.maxDisplayBytes) fail('VALIDATION', '출력용 사진이 너무 큽니다.');

      var photoId = 'P' + C.uuid().replace(/-/g, '').slice(0, 16);
      var base = st.studentId + '_D' + day + '_' + photoId;
      var ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      var originalFileId = S.files.save('original/DAY' + day, base + '_orig.' + ext, mime, ob);
      var displayFileId = S.files.save('display/DAY' + day, base + '_print.jpg', 'image/jpeg', db);
      var row = {
        photoId: photoId, studentId: st.studentId, day: day, clientUploadId: cuid,
        originalFileId: originalFileId, displayFileId: displayFileId, mime: mime,
        originalName: clean(orig.name).slice(0, 120), bytes: oBytes,
        width: Number(disp.width) || 0, height: Number(disp.height) || 0,
        caption: '', mission: '', exhibit: false, uploadedAt: iso(), submissionId: ''
      };
      S.lock(function () { T('Photos').insert(row); });
      return { photoId: photoId, reused: false };
    }

    function validateSubmission(p) {
      var errors = {};
      var reflection = clean(p.reflection);
      var essay = clean(p.essay);
      var oneLine = clean(p.oneLine).replace(/\n/g, ' ');
      var rl = charLen(reflection), el = charLen(essay), ol = charLen(oneLine);
      if (rl < R.reflectionMin) errors.reflection = '성찰 질문 답변을 ' + R.reflectionMin + '자 이상 써 주세요. (현재 ' + rl + '자)';
      if (rl > R.reflectionMax) errors.reflection = '성찰 질문 답변은 ' + R.reflectionMax + '자 이하로 써 주세요.';
      if (el < R.essayMin) errors.essay = '소감문을 ' + R.essayMin + '자 이상 써 주세요. (현재 ' + el + '자)';
      if (el > R.essayMax) errors.essay = '소감문은 ' + R.essayMax + '자 이하로 써 주세요.';
      if (ol < 2) errors.oneLine = '오늘을 표현하는 한 줄을 써 주세요.';
      if (ol > R.oneLineMax) errors.oneLine = '한 줄 기록은 ' + R.oneLineMax + '자 이하로 써 주세요.';
      var photos = Array.isArray(p.photos) ? p.photos : [];
      if (photos.length < R.minPhotos) errors.photos = '사진을 ' + R.minPhotos + '장 이상 올려 주세요.';
      if (photos.length > R.maxPhotos) errors.photos = '사진은 최대 ' + R.maxPhotos + '장까지 올릴 수 있습니다.';
      return { errors: errors, reflection: reflection, essay: essay, oneLine: oneLine, photos: photos };
    }

    function submit(p) {
      var st = requireStudent(p.token);
      var day = Number(p.day);
      if (!dayValid(day)) fail('VALIDATION', '날짜(DAY) 정보가 올바르지 않습니다.');
      if (dayState(day) !== 'open') fail('CLOSED', '이 날짜의 제출이 마감되었거나 아직 열리지 않았습니다.');
      var v = validateSubmission(p);
      if (Object.keys(v.errors).length) fail('VALIDATION', '입력 내용을 확인해 주세요.', { fields: v.errors });
      var cid = clean(p.clientSubmissionId);
      if (!cid) fail('VALIDATION', '제출 ID가 없습니다.');

      return S.lock(function () {
        var subs = T('Submissions');
        // 1) 같은 제출 재전송(버튼 연타, 재시도) → 그대로 성공 처리
        var same = subs.all().filter(function (x) { return x.clientSubmissionId === cid && x.studentId === st.studentId; })[0];
        if (same) return { status: 'duplicate', receipt: receipt(same) };

        // 2) 사진 소유권 확인
        var pmap = photosById();
        var ids = [];
        v.photos.forEach(function (ph) {
          var id = str(ph && ph.photoId);
          var row = pmap[id];
          if (!row || row.studentId !== st.studentId || row.day !== day) fail('VALIDATION', '사진 정보가 올바르지 않습니다. 사진을 다시 올려 주세요.');
          if (ids.indexOf(id) < 0) ids.push(id);
        });

        // 3) 이미 제출한 날짜 → 덮어쓰기 확인 필요
        var cur = currentSubmission(st.studentId, day);
        if (cur && !p.confirmOverwrite) {
          return { status: 'exists', existing: receipt(cur) };
        }
        var revision = 1;
        if (cur) {
          revision = cur.revision + 1;
          subs.update('submissionId', cur.submissionId, { status: 'superseded' });
        }
        var rec = {
          submissionId: 'S' + C.uuid().replace(/-/g, '').slice(0, 16),
          clientSubmissionId: cid, studentId: st.studentId, day: day, revision: revision,
          status: 'current', submittedAt: iso(),
          reflection: v.reflection, essay: v.essay, oneLine: v.oneLine, photoIds: ids,
          editedReflection: '', editedEssay: '', editedOneLine: '',
          featuredPhotoId: ids[0] || '', topics: null, reviewStatus: 'pending', teacherNote: '',
          editedAt: '', userAgent: clean(p.userAgent).slice(0, 200)
        };
        subs.insert(rec);
        var ptable = T('Photos');
        v.photos.forEach(function (ph) {
          ptable.update('photoId', ph.photoId, {
            caption: clean(ph.caption).slice(0, R.captionMax),
            mission: clean(ph.mission).slice(0, 10),
            submissionId: rec.submissionId
          });
        });
        log('s:' + st.studentId, cur ? 'resubmit' : 'submit', { day: day, revision: revision });
        return { status: cur ? 'updated' : 'created', receipt: receipt(rec) };
      });
    }

    function receipt(sub) {
      return {
        submissionId: sub.submissionId, day: sub.day, revision: sub.revision,
        submittedAt: sub.submittedAt, oneLine: sub.oneLine,
        photoCount: (sub.photoIds || []).length
      };
    }

    function mySubmission(p) {
      var st = requireStudent(p.token);
      var cur = currentSubmission(st.studentId, p.day);
      if (!cur) return { submission: null };
      var pmap = photosById();
      return {
        submission: {
          day: cur.day, revision: cur.revision, submittedAt: cur.submittedAt,
          reflection: cur.reflection, essay: cur.essay, oneLine: cur.oneLine,
          photos: (cur.photoIds || []).map(function (id) {
            var ph = pmap[id] || {};
            return { photoId: id, caption: ph.caption || '', mission: ph.mission || '', width: ph.width, height: ph.height };
          })
        }
      };
    }

    function myPhoto(p) {
      var st = requireStudent(p.token);
      var ph = photosById()[str(p.photoId)];
      if (!ph || ph.studentId !== st.studentId) fail('FORBIDDEN', '사진에 접근할 수 없습니다.');
      var f = S.files.read(ph.displayFileId);
      return { photoId: ph.photoId, dataUrl: 'data:' + f.mime + ';base64,' + f.base64 };
    }

    // ============================================================ 관리자 API
    function adminLogin(p) {
      rateCheck('admin');
      if (!checkAdminPassword(str(p.password))) {
        rateFail('admin');
        log('admin', 'login-fail', '');
        fail('AUTH', '관리자 비밀번호가 맞지 않습니다.');
      }
      rateClear('admin');
      log('admin', 'login', '');
      return { token: makeToken('a', 'admin', R.adminTokenHours) };
    }

    function adminOverview(p) {
      requireAdmin(p.token);
      var students = T('Students').all();
      var subs = T('Submissions').all().filter(function (s) { return s.status === 'current'; });
      var cells = {};
      subs.forEach(function (s) {
        cells[s.studentId] = cells[s.studentId] || {};
        cells[s.studentId][s.day] = {
          submissionId: s.submissionId, submittedAt: s.submittedAt, revision: s.revision,
          reviewStatus: s.reviewStatus, photoCount: (s.photoIds || []).length,
          edited: !!(s.editedReflection || s.editedEssay || s.editedOneLine)
        };
      });
      var perDay = program.days.map(function (d) {
        var n = subs.filter(function (s) { return s.day === d.day; }).length;
        return { day: d.day, submitted: n, state: dayState(d.day) };
      });
      return {
        students: students.map(function (s) {
          return { studentId: s.studentId, displayName: s.displayName || defaultDisplayName(s.studentId), name: s.name, active: s.active, exhibitConsent: s.exhibitConsent };
        }),
        cells: cells, perDay: perDay, totalStudents: students.filter(function (s) { return s.active; }).length,
        settings: { locks: locks(), openMode: openMode(), heroes: getSetting('heroes', {}) || {} }
      };
    }

    function adminSubmissions(p) {
      requireAdmin(p.token);
      var pmap = photosById();
      var smap = {};
      T('Students').all().forEach(function (s) { smap[s.studentId] = s; });
      var rows = T('Submissions').all().filter(function (s) {
        if (s.status !== 'current') return false;
        if (p.day && s.day !== Number(p.day)) return false;
        if (p.studentId && s.studentId !== p.studentId) return false;
        return true;
      });
      rows.sort(function (a, b) { return a.day - b.day || (a.studentId < b.studentId ? -1 : 1); });
      return {
        submissions: rows.map(function (s) {
          var st = smap[s.studentId] || {};
          var o = JSON.parse(JSON.stringify(s));
          o.displayName = st.displayName || defaultDisplayName(s.studentId);
          o.name = st.name || '';
          o.exhibitConsent = st.exhibitConsent !== false;
          o.autoTopics = classifyTopics([s.reflection, s.essay, s.oneLine].join(' '));
          o.photos = (s.photoIds || []).map(function (id) {
            var ph = pmap[id] || {};
            return { photoId: id, caption: ph.caption, mission: ph.mission, exhibit: ph.exhibit, width: ph.width, height: ph.height, bytes: ph.bytes, originalName: ph.originalName, originalFileId: ph.originalFileId };
          });
          return o;
        })
      };
    }

    function adminHistory(p) {
      requireAdmin(p.token);
      return {
        revisions: T('Submissions').all().filter(function (s) { return s.studentId === p.studentId && s.day === Number(p.day); })
          .sort(function (a, b) { return b.revision - a.revision; })
      };
    }

    var EDITABLE = ['editedReflection', 'editedEssay', 'editedOneLine', 'featuredPhotoId', 'topics', 'reviewStatus', 'teacherNote'];
    function adminUpdateSubmission(p) {
      requireAdmin(p.token);
      var patch = {};
      EDITABLE.forEach(function (k) { if (p.patch && Object.prototype.hasOwnProperty.call(p.patch, k)) patch[k] = p.patch[k]; });
      ['editedReflection', 'editedEssay', 'teacherNote'].forEach(function (k) { if (k in patch) patch[k] = clean(patch[k]).slice(0, R.essayMax); });
      if ('editedOneLine' in patch) patch.editedOneLine = clean(patch.editedOneLine).replace(/\n/g, ' ').slice(0, R.oneLineMax + 10);
      if ('reviewStatus' in patch && ['pending', 'approved', 'hold'].indexOf(patch.reviewStatus) < 0) fail('VALIDATION', '검토 상태 값이 올바르지 않습니다.');
      if ('topics' in patch && patch.topics !== null && !Array.isArray(patch.topics)) fail('VALIDATION', '주제 값이 올바르지 않습니다.');
      patch.editedAt = iso();
      var updated = S.lock(function () { return T('Submissions').update('submissionId', p.submissionId, patch); });
      if (!updated) fail('NOTFOUND', '제출물을 찾을 수 없습니다.');
      log('admin', 'edit', { submissionId: p.submissionId, fields: Object.keys(patch) });
      return { submission: updated };
    }

    function adminUpdatePhoto(p) {
      requireAdmin(p.token);
      var patch = {};
      if (p.patch && 'exhibit' in p.patch) patch.exhibit = !!p.patch.exhibit;
      if (p.patch && 'caption' in p.patch) patch.caption = clean(p.patch.caption).slice(0, R.captionMax);
      var u = S.lock(function () { return T('Photos').update('photoId', p.photoId, patch); });
      if (!u) fail('NOTFOUND', '사진을 찾을 수 없습니다.');
      return { photo: { photoId: u.photoId, exhibit: u.exhibit, caption: u.caption } };
    }

    function adminPhotos(p) {
      requireAdmin(p.token);
      var ids = (p.photoIds || []).slice(0, 12);
      var pmap = photosById();
      var out = {};
      ids.forEach(function (id) {
        var ph = pmap[id];
        if (!ph) return;
        var f = S.files.read(p.kind === 'original' ? ph.originalFileId : ph.displayFileId);
        out[id] = 'data:' + f.mime + ';base64,' + f.base64;
      });
      return { photos: out };
    }

    function adminStudents(p) {
      requireAdmin(p.token);
      return { students: T('Students').all() };
    }

    function adminUpsertStudent(p) {
      requireAdmin(p.token);
      var s = p.student || {};
      var id = clean(s.studentId);
      if (!new RegExp(R.studentIdPattern).test(id)) fail('VALIDATION', '학생 번호는 영문/숫자 12자 이내입니다.');
      var patch = {};
      ['name', 'displayName', 'group', 'teacherComment'].forEach(function (k) { if (k in s) patch[k] = clean(s[k]).slice(0, 500); });
      if ('exhibitConsent' in s) patch.exhibitConsent = !!s.exhibitConsent;
      if ('active' in s) patch.active = !!s.active;
      if ('pin' in s) {
        if (!new RegExp(R.pinPattern).test(clean(s.pin))) fail('VALIDATION', 'PIN은 숫자 4~6자리입니다.');
        patch.pin = clean(s.pin);
      }
      return S.lock(function () {
        var t = T('Students');
        var u = t.update('studentId', id, patch);
        if (!u) {
          u = {
            studentId: id, pin: patch.pin || randomPin(), name: patch.name || '',
            displayName: patch.displayName || defaultDisplayName(id), group: patch.group || '',
            exhibitConsent: 'exhibitConsent' in patch ? patch.exhibitConsent : true,
            teacherComment: patch.teacherComment || '', active: 'active' in patch ? patch.active : true, createdAt: iso()
          };
          t.insert(u);
        }
        return { student: u };
      });
    }

    function randomPin() {
      var hex = C.randomHex(4);
      return P.pad2(parseInt(hex.slice(0, 4), 16) % 100) + P.pad2(parseInt(hex.slice(4, 8), 16) % 100);
    }

    function generateStudents(count, startAt) {
      var created = [];
      S.lock(function () {
        var t = T('Students');
        var existing = {};
        t.all().forEach(function (s) { existing[s.studentId] = true; });
        for (var i = 0; i < count; i++) {
          var id = P.pad2((startAt || 1) + i);
          if (existing[id]) continue;
          var row = { studentId: id, pin: randomPin(), name: '', displayName: defaultDisplayName(id), group: '', exhibitConsent: true, teacherComment: '', active: true, createdAt: iso() };
          t.insert(row);
          created.push(row);
        }
      });
      return created;
    }
    function adminGenerateStudents(p) {
      requireAdmin(p.token);
      var n = Math.min(Math.max(Number(p.count) || 20, 1), 60);
      return { created: generateStudents(n, Number(p.startAt) || 1) };
    }

    function adminSettings(p) {
      requireAdmin(p.token);
      if (p.set) {
        if ('locks' in p.set) setSetting('locks', p.set.locks || {});
        if ('openMode' in p.set) setSetting('openMode', p.set.openMode === 'byDate' ? 'byDate' : 'all');
        if ('heroes' in p.set) setSetting('heroes', p.set.heroes || {});
        log('admin', 'settings', p.set);
      }
      return { locks: locks(), openMode: openMode(), heroes: getSetting('heroes', {}) || {}, appUrl: S.appUrl ? S.appUrl() : '' };
    }

    // 결과물 레이아웃이 사용하는 데이터 묶음 (실명 제외)
    function buildDataset(approvedOnly) {
      var pmap = photosById();
      var students = T('Students').all().filter(function (s) { return s.active; });
      var smap = {};
      students.forEach(function (s) { smap[s.studentId] = s; });
      var entries = [];
      T('Submissions').all().forEach(function (s) {
        if (s.status !== 'current' || !smap[s.studentId]) return;
        if (approvedOnly && s.reviewStatus !== 'approved') return;
        if (s.reviewStatus === 'hold') return;
        var st = smap[s.studentId];
        var eff = effective(s);
        var consent = st.exhibitConsent !== false;
        var photos = consent ? (s.photoIds || []).map(function (id) {
          var ph = pmap[id] || {};
          return { id: id, w: ph.width || 4, h: ph.height || 3, caption: ph.caption || '', mission: ph.mission || '', exhibit: !!ph.exhibit };
        }) : [];
        var featured = consent ? (s.featuredPhotoId && (s.photoIds || []).indexOf(s.featuredPhotoId) >= 0 ? s.featuredPhotoId : (s.photoIds || [])[0]) : '';
        entries.push({
          submissionId: s.submissionId, day: s.day, studentId: s.studentId,
          displayName: st.displayName || defaultDisplayName(s.studentId),
          reflection: eff.reflection, essay: eff.essay, oneLine: eff.oneLine,
          photos: photos, featuredPhotoId: featured || '',
          topics: Array.isArray(s.topics) && s.topics.length ? s.topics : classifyTopics([eff.reflection, eff.essay, eff.oneLine].join(' ')),
          reviewStatus: s.reviewStatus, submittedAt: s.submittedAt
        });
      });
      entries.sort(function (a, b) { return a.day - b.day || (a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0); });
      return {
        generatedAt: iso(),
        students: students.map(function (s) {
          return { studentId: s.studentId, displayName: s.displayName || defaultDisplayName(s.studentId), teacherComment: s.teacherComment || '', exhibitConsent: s.exhibitConsent !== false };
        }).sort(function (a, b) { return a.studentId < b.studentId ? -1 : 1; }),
        entries: entries,
        heroes: getSetting('heroes', {}) || {}
      };
    }
    function adminDataset(p) {
      requireAdmin(p.token);
      return buildDataset(!!p.approvedOnly);
    }

    function adminSaveOutput(p) {
      requireAdmin(p.token);
      var name = clean(p.name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'output';
      var r = S.files.saveOutput(name, str(p.mime) || 'application/octet-stream', stripDataUrl(p.base64));
      log('admin', 'save-output', name);
      return r;
    }

    function adminPurge(p) {
      requireAdmin(p.token);
      if (p.confirm !== 'DELETE') fail('VALIDATION', '확인 문구(DELETE)가 필요합니다.');
      return S.lock(function () {
        var photos = T('Photos').all();
        photos.forEach(function (ph) {
          try { S.files.trash(ph.originalFileId); S.files.trash(ph.displayFileId); } catch (e) { /* 이미 삭제됨 */ }
        });
        T('Photos').clear();
        T('Submissions').clear();
        setSetting('heroes', {});
        if (p.students) T('Students').clear();
        log('admin', 'purge', { photos: photos.length, students: !!p.students });
        return { deletedPhotos: photos.length };
      });
    }

    // ------------------------------------------------------------ 디스패처
    var ACTIONS = {
      studentLogin: studentLogin, myStatus: myStatus, uploadPhoto: uploadPhoto, submit: submit,
      mySubmission: mySubmission, myPhoto: myPhoto,
      adminLogin: adminLogin, adminOverview: adminOverview, adminSubmissions: adminSubmissions,
      adminHistory: adminHistory, adminUpdateSubmission: adminUpdateSubmission, adminUpdatePhoto: adminUpdatePhoto,
      adminPhotos: adminPhotos, adminStudents: adminStudents, adminUpsertStudent: adminUpsertStudent,
      adminGenerateStudents: adminGenerateStudents, adminSettings: adminSettings, adminDataset: adminDataset,
      adminSaveOutput: adminSaveOutput, adminPurge: adminPurge
    };

    function api(action, payload) {
      try {
        if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) fail('NOTFOUND', '알 수 없는 요청입니다: ' + action);
        return { ok: true, data: ACTIONS[action](payload || {}) };
      } catch (e) {
        if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message, extra: e.extra } };
        log('system', 'error', { action: action, message: String(e && e.stack || e) });
        return { ok: false, error: { code: 'SERVER', message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' } };
      }
    }

    return {
      api: api,
      setAdminPassword: setAdminPassword,
      generateStudents: generateStudents,
      buildDataset: buildDataset,
      setSetting: setSetting,
      getSetting: getSetting
    };
  }

  return {
    SCHEMA: SCHEMA,
    rowToObj: rowToObj,
    objToRow: objToRow,
    classifyTopics: classifyTopics,
    createService: createService,
    charLen: charLen
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BUT_Core;
