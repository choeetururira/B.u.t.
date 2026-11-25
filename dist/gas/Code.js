// 자동 생성 파일입니다. src/ 를 수정한 뒤 `npm run build` 하세요.

/*
 * B.U.T. TOKYO 2026 — 프로그램 설정 (일정 · 미션 · 성찰 질문 · 주제 · 디자인 토큰)
 * 이 파일 하나만 고치면 학생 웹앱, 관리자 페이지, 모든 결과물에 반영됩니다.
 * (Apps Script · 브라우저 · Node 공용 파일: ES2019 문법만 사용)
 */
var BUT_Program = (function () {
  var program = {
    code: 'BUT-TOKYO-2026',
    brand: 'B.U.T. TOKYO 2026',
    brandFull: 'Beyond Universal Togetherness',
    title: '벗과 함께 도쿄를 기록하다',
    subtitle: '2026학년도 한일 고등학생 국제교류 국외현장체험학습',
    schoolName: '송호고등학교',
    period: '2026. 12. 7.(월) – 12. 10.(목) · 3박 4일',
    participants: 20,
    timeZone: 'Asia/Tokyo',
    hotel: '신주쿠 워싱턴호텔',

    // 제출 규칙
    rules: {
      minPhotos: 1,
      maxPhotos: 3,
      maxOriginalBytes: 20 * 1024 * 1024, // 원본 1장 최대 20MB
      maxDisplayBytes: 4 * 1024 * 1024,
      displayMaxEdge: 2000, // 출력용 사본 긴 변 픽셀
      reflectionMin: 30,
      reflectionMax: 1000,
      essayMin: 100,
      essayMax: 3000,
      oneLineMax: 30,
      captionMax: 40,
      studentIdPattern: '^[0-9A-Za-z-]{1,12}$',
      pinPattern: '^[0-9]{4,6}$',
      loginMaxFails: 5,
      loginLockMinutes: 60, // 5회 실패 시 60분 잠금 (4자리 PIN 무차별 대입 방지)
      studentTokenHours: 24 * 7,
      adminTokenHours: 8
    },

    days: [
      {
        day: 1,
        date: '2026-12-07',
        dateLabel: '12.07',
        weekday: '월',
        weekdayEn: 'MON',
        theme: '도쿄의 첫인상',
        themeSub: '도시와 청소년 문화',
        places: ['도쿄타워', '시부야', '하라주쿠'],
        missions: [
          '한국의 도시와 다른 풍경 발견하기',
          '일본의 10대 문화를 보여주는 장면 기록하기'
        ],
        question: '일본에 오기 전의 이미지와 직접 경험한 일본은 어떻게 달랐나요?',
        sampleOneLine: '낯선 도시에서 발견한 익숙함',
        color: '#C2432F',
        schedule: [
          ['08:05', '인천국제공항 출발 (진에어 LJ235)'],
          ['10:45', '나리타국제공항 도착 및 입국수속'],
          ['12:30', '중식'],
          ['13:30', '도쿄 시내로 이동'],
          ['15:00', '도쿄타워 전파탑'],
          ['17:00', '시부야·하라주쿠 10대 문화거리 탐방'],
          ['18:30', '석식'],
          ['20:00', '숙소 도착 및 휴식']
        ]
      },
      {
        day: 2,
        date: '2026-12-08',
        dateLabel: '12.08',
        weekday: '화',
        weekdayEn: 'TUE',
        theme: '즐거움 속에서 발견하는 일본',
        themeSub: '대중교통과 공간 디자인',
        places: ['대중교통', '도쿄 디즈니랜드'],
        missions: [
          '일본 대중교통의 안내 및 배려 문화 발견하기',
          '방문객을 위한 서비스나 공간 디자인 관찰하기'
        ],
        question: '오늘 경험한 공간에서 우리 학교나 지역사회에도 적용하고 싶은 아이디어는 무엇인가요?',
        sampleOneLine: '작은 배려가 만드는 즐거움',
        color: '#2F5D8C',
        schedule: [
          ['06:00', '기상 및 호텔 조식'],
          ['08:00', '지하철로 이동 (신주쿠역 – 도쿄역 – 마이하마역)'],
          ['09:00', '도쿄 디즈니랜드 탐방 (전일 자유이용권)'],
          ['20:00', '숙소 도착 및 휴식']
        ]
      },
      {
        day: 3,
        date: '2026-12-09',
        dateLabel: '12.09',
        weekday: '수',
        weekdayEn: 'WED',
        theme: '국경을 넘어 벗이 되다',
        themeSub: '자매학교 교류',
        places: ['도쿄도립 남평고등학교', '도쿄도청'],
        missions: [
          '일본 친구와 나의 공통점과 차이점 발견하기',
          '일본 친구와 소통하며 기억에 남은 순간 기록하기'
        ],
        question: '일본 친구들과 직접 교류하면서 새롭게 알게 된 점과 앞으로 이어가고 싶은 교류는 무엇인가요?',
        sampleOneLine: '언어가 달라도 친구가 될 수 있다',
        color: '#4F7A5A',
        schedule: [
          ['06:00', '기상 및 호텔 조식'],
          ['08:00', '자매학교로 이동 (전용버스)'],
          ['09:00', '자매학교 공식 방문 · 도쿄도립 남평고등학교'],
          ['17:00', '도쿄도청 전망대 — 시내 전경 및 야경 감상'],
          ['20:00', '숙소 도착 및 휴식']
        ]
      },
      {
        day: 4,
        date: '2026-12-10',
        dateLabel: '12.10',
        weekday: '목',
        weekdayEn: 'THU',
        theme: '전통과 미래, 그리고 나의 성장',
        themeSub: '대학 탐방과 전통문화',
        places: ['도쿄대학교', '아사쿠사 센소지', '나카미세 도오리'],
        missions: [
          '대학생과의 질의응답에서 인상 깊었던 내용 기록하기',
          '일본의 전통문화가 현대에 이어지는 모습 발견하기'
        ],
        question: '이번 국외현장체험학습은 나의 진로, 가치관, 다른 문화에 대한 태도에 어떤 변화를 가져왔나요?',
        sampleOneLine: '더 넓은 세상을 꿈꾸게 된 날',
        color: '#8A5A3C',
        schedule: [
          ['06:00', '기상 및 호텔 조식'],
          ['10:00', '도쿄대학 방문 — 한인 재학생과 캠퍼스 투어 및 질의응답'],
          ['12:00', '중식'],
          ['13:00', '아사쿠사 센소지 & 나카미세 도오리'],
          ['15:00', '나리타국제공항으로 이동 및 탑승수속'],
          ['18:50', '나리타국제공항 출발 (진에어 LJ264)'],
          ['21:40', '인천국제공항 도착']
        ]
      }
    ],

    // 주제별 포스터: 교사가 태그를 지정하지 않으면 키워드로 자동 분류
    topics: [
      {
        key: 'friend',
        title: '벗',
        en: 'FRIENDSHIP',
        desc: '말이 서툴러도 마음은 통했다 — 국경을 넘어 친구가 된 순간들',
        color: '#4F7A5A',
        keywords: ['친구', '벗', '교류', '대화', '소통', '함께', '우정', '자매학교', '번역', '인사', '선물', '웃']
      },
      {
        key: 'discover',
        title: '발견',
        en: 'DISCOVERY',
        desc: '낯선 도시에서 처음 마주한 풍경과 문화',
        color: '#C2432F',
        keywords: ['발견', '처음', '새롭', '신기', '다르', '차이', '풍경', '거리', '문화', '시부야', '하라주쿠', '도쿄타워', '야경']
      },
      {
        key: 'care',
        title: '배려',
        en: 'CONSIDERATION',
        desc: '작은 안내판과 친절에서 배운 함께 사는 법',
        color: '#2F5D8C',
        keywords: ['배려', '질서', '친절', '안내', '서비스', '디자인', '깨끗', '조용', '줄', '표지', '대중교통', '지하철']
      },
      {
        key: 'grow',
        title: '성장',
        en: 'GROWTH',
        desc: '전통과 미래 사이에서 그려 본 나의 다음 걸음',
        color: '#8A5A3C',
        keywords: ['꿈', '진로', '성장', '변화', '미래', '목표', '대학', '전통', '공부', '도전', '나의', '생각이 바뀌']
      }
    ],

    design: {
      paper: '#F5F0E6',
      paperDeep: '#EBE3D3',
      card: '#FBF8F2',
      ink: '#23303F',
      inkSoft: '#5B6573',
      line: '#CFCABC',
      accent: '#C2432F',
      indigo: '#2F4A6D',
      sage: '#A9AE9A',
      gold: '#B8925A',
      fonts: {
        title: 'Gowun Dodum',
        body: 'Gowun Batang',
        label: 'Gowun Dodum'
      }
    }
  };

  function getDay(n) {
    for (var i = 0; i < program.days.length; i++) if (program.days[i].day === Number(n)) return program.days[i];
    return null;
  }
  function pad2(n) {
    n = String(n);
    return n.length < 2 ? '0' + n : n;
  }
  function dayLabel(n) {
    return 'DAY ' + pad2(n);
  }

  return { program: program, getDay: getDay, pad2: pad2, dayLabel: dayLabel };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BUT_Program;


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


/*
 * Apps Script 저장소: Google Sheets(표) + Google Drive(사진 원본·출력용 사본·결과물)
 * 스프레드시트와 폴더는 setup()이 만들고, ID는 스크립트 속성에 저장됩니다.
 */
var BUT_GasStorage = (function () {
  function props() { return PropertiesService.getScriptProperties(); }

  function spreadsheet() {
    var id = props().getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('SPREADSHEET_ID 없음: setup()을 먼저 실행하세요.');
    return SpreadsheetApp.openById(id);
  }

  function create() {
    var memo = {};
    var ss = null;
    function book() { return ss || (ss = spreadsheet()); }

    function sheetFor(name) {
      var sh = book().getSheetByName(name);
      var cols = BUT_Core.SCHEMA[name].cols;
      if (!sh) {
        sh = book().insertSheet(name);
        sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[0]; })]).setFontWeight('bold').setBackground('#EBE3D3');
        sh.setFrozenRows(1);
        sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
      }
      return sh;
    }

    function table(name) {
      var cols = BUT_Core.SCHEMA[name].cols;
      function rows() {
        if (memo[name]) return memo[name];
        var sh = sheetFor(name);
        var last = sh.getLastRow();
        var values = last > 1 ? sh.getRange(2, 1, last - 1, cols.length).getValues() : [];
        memo[name] = values.map(function (r) { return BUT_Core.rowToObj(name, r); });
        return memo[name];
      }
      return {
        all: function () { return rows().map(function (r) { return JSON.parse(JSON.stringify(r)); }); },
        insert: function (obj) {
          var sh = sheetFor(name);
          var row = BUT_Core.objToRow(name, obj);
          var r = sh.getLastRow() + 1;
          sh.getRange(r, 1, 1, cols.length).setNumberFormat('@').setValues([row]);
          if (memo[name]) memo[name].push(BUT_Core.rowToObj(name, row));
          return obj;
        },
        update: function (keyField, keyVal, patch) {
          var list = rows();
          var idx = -1;
          for (var i = 0; i < list.length; i++) if (String(list[i][keyField]) === String(keyVal)) { idx = i; break; }
          if (idx < 0) return null;
          var merged = {};
          Object.keys(list[idx]).forEach(function (k) { merged[k] = list[idx][k]; });
          Object.keys(patch).forEach(function (k) { merged[k] = patch[k]; });
          var row = BUT_Core.objToRow(name, merged);
          sheetFor(name).getRange(idx + 2, 1, 1, cols.length).setNumberFormat('@').setValues([row]);
          list[idx] = BUT_Core.rowToObj(name, row);
          return JSON.parse(JSON.stringify(list[idx]));
        },
        clear: function () {
          var sh = sheetFor(name);
          var last = sh.getLastRow();
          if (last > 1) sh.deleteRows(2, last - 1);
          memo[name] = [];
        }
      };
    }

    function rootFolder() {
      var id = props().getProperty('ROOT_FOLDER_ID');
      if (!id) throw new Error('ROOT_FOLDER_ID 없음: setup()을 먼저 실행하세요.');
      return DriveApp.getFolderById(id);
    }
    function folderFor(path) {
      var key = 'FOLDER:' + path;
      var id = props().getProperty(key);
      if (id) {
        try { return DriveApp.getFolderById(id); } catch (e) { /* 삭제된 경우 다시 생성 */ }
      }
      var f = rootFolder();
      path.split('/').forEach(function (part) {
        var it = f.getFoldersByName(part);
        f = it.hasNext() ? it.next() : f.createFolder(part);
      });
      props().setProperty(key, f.getId());
      return f;
    }

    var files = {
      save: function (folder, name, mime, base64) {
        var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, name);
        return folderFor('photos/' + folder).createFile(blob).getId();
      },
      read: function (id) {
        var blob = DriveApp.getFileById(id).getBlob();
        return { base64: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType() };
      },
      trash: function (id) { if (id) DriveApp.getFileById(id).setTrashed(true); },
      saveOutput: function (name, mime, base64) {
        var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, name);
        var file = folderFor('outputs').createFile(blob);
        return { id: file.getId(), url: file.getUrl() };
      }
    };

    return {
      table: table,
      files: files,
      appUrl: function () { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } },
      props: {
        get: function (k) { return props().getProperty(k); },
        set: function (k, v) { props().setProperty(k, v); }
      },
      cache: {
        get: function (k) { return CacheService.getScriptCache().get(k); },
        put: function (k, v, sec) { CacheService.getScriptCache().put(k, v, Math.max(1, sec)); }
      },
      lock: function (fn) {
        var lock = LockService.getScriptLock();
        lock.waitLock(30000);
        memo = {}; // 잠금 안에서는 항상 최신 시트를 다시 읽음
        try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
      }
    };
  }

  function toHex(bytes) {
    return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
  }
  var gasCrypto = {
    hmacHex: function (secret, msg) { return toHex(Utilities.computeHmacSha256Signature(msg, secret, Utilities.Charset.UTF_8)); },
    sha256Hex: function (msg) { return toHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, msg, Utilities.Charset.UTF_8)); },
    randomHex: function (n) {
      var s = '';
      while (s.length < n * 2) s += Utilities.getUuid().replace(/-/g, '');
      return s.slice(0, n * 2);
    },
    uuid: function () { return Utilities.getUuid(); }
  };

  return { create: create, crypto: gasCrypto };
})();


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
