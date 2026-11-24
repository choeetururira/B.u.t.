/* B.U.T. TOKYO 2026 — 학생용 모바일 웹앱 */
(function () {
  'use strict';
  var PROG = BUT_Program.program;
  var R = PROG.rules;
  var api = BUT_API.call, esc = BUT_API.esc, store = BUT_API.store, toast = BUT_API.toast;
  var $app = document.getElementById('app');
  var $file = document.getElementById('file');

  var S = {
    token: store.get('but.token'),
    student: store.get('but.student'),
    status: null,
    day: null,
    forms: {}, // day → { photos:[], reflection, essay, oneLine, editing }
    view: 'form', // form | done
    lastReceipt: null,
    busy: false
  };

  function dayInfo(n) { return BUT_Program.getDay(n); }
  function charLen(s) { return Array.from(String(s || '')).length; }
  function draftKey(day) { return 'but.draft.' + (S.student && S.student.studentId) + '.' + day; }

  function form(day) {
    if (!S.forms[day]) {
      var d = store.get(draftKey(day)) || {};
      S.forms[day] = { photos: [], reflection: d.reflection || '', essay: d.essay || '', oneLine: d.oneLine || '', editing: false, clientSubmissionId: null, savedAt: d.savedAt || null };
    }
    return S.forms[day];
  }
  var saveTimer = null;
  function saveDraft(day) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var f = form(day);
      f.savedAt = new Date().toISOString();
      store.set(draftKey(day), { reflection: f.reflection, essay: f.essay, oneLine: f.oneLine, savedAt: f.savedAt });
      var el = document.getElementById('saved');
      if (el) el.textContent = '임시저장 ' + BUT_API.fmtTime(f.savedAt).split(' ')[1];
    }, 500);
  }

  function setDayColor(n) {
    document.documentElement.style.setProperty('--day', dayInfo(n).color);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', '#F5F0E6');
  }

  function pickDefaultDay(status, today) {
    var d = PROG.days.filter(function (x) { return x.date === today; })[0];
    if (d) return d.day;
    if (today > PROG.days[PROG.days.length - 1].date) return PROG.days[PROG.days.length - 1].day;
    var firstOpen = status.filter(function (s) { return s.state === 'open' && !s.submitted; })[0];
    return firstOpen ? firstOpen.day : 1;
  }

  function handleError(e, fallback) {
    if (e && e.code === 'AUTH') { logout(true); toast(e.message); return; }
    toast((e && e.message) || fallback || '오류가 발생했습니다.', 4000);
  }

  // ------------------------------------------------------------ 로그인
  function renderLogin(msg) {
    $app.innerHTML =
      '<section class="card login">' +
      '<span class="label">STEP 1</span><h2>학생 번호로 시작하기</h2>' +
      '<p class="muted" style="margin:4px 0 18px;font-size:14px">선생님께 받은 학생 번호와 PIN을 입력하세요.</p>' +
      '<form id="loginForm" novalidate>' +
      '<div class="pin-row">' +
      '<label class="field"><span class="field-label">학생 번호</span><input class="input" id="sid" inputmode="numeric" autocomplete="username" placeholder="예: 07" maxlength="12" required></label>' +
      '<label class="field"><span class="field-label">PIN</span><input class="input" id="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="숫자 4자리" maxlength="6" required></label>' +
      '</div>' +
      '<label class="consent"><input type="checkbox" id="agree"><span>제출한 사진과 글은 국외현장체험학습 결과물(포스터·기록지·팜플렛) 제작에 사용되며, 인솔 교사만 원본을 볼 수 있다는 안내를 읽었습니다.</span></label>' +
      '<div class="err" id="loginErr" role="alert">' + esc(msg || '') + '</div>' +
      '<button class="btn block accent" id="loginBtn" type="submit">기록 시작하기</button>' +
      '</form></section>';
    document.getElementById('loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var sid = document.getElementById('sid').value.trim();
      var pin = document.getElementById('pin').value.trim();
      var $err = document.getElementById('loginErr');
      if (!sid || !pin) { $err.textContent = '학생 번호와 PIN을 모두 입력하세요.'; return; }
      if (!document.getElementById('agree').checked) { $err.textContent = '안내 사항을 확인하고 체크해 주세요.'; return; }
      var btn = document.getElementById('loginBtn');
      btn.disabled = true; btn.textContent = '확인 중…';
      api('studentLogin', { studentId: sid, pin: pin }).then(function (r) {
        S.token = r.token; S.student = r.student; S.status = r.status;
        store.set('but.token', r.token); store.set('but.student', r.student);
        S.day = pickDefaultDay(r.status, r.today);
        S.view = 'form';
        renderMain();
      }).catch(function (e) {
        $err.textContent = e.message || '로그인에 실패했습니다.';
        btn.disabled = false; btn.textContent = '기록 시작하기';
      });
    });
  }

  function logout(silent) {
    store.del('but.token'); store.del('but.student');
    S.token = null; S.student = null; S.status = null; S.forms = {};
    renderLogin(silent ? '다시 로그인해 주세요.' : '');
  }

  // ------------------------------------------------------------ 메인
  function stateOf(day) { return (S.status || []).filter(function (s) { return s.day === day; })[0] || {}; }

  function renderMain() {
    setDayColor(S.day);
    var d = dayInfo(S.day);
    var st = stateOf(S.day);
    var f = form(S.day);
    var html = '';
    html += '<div class="me"><div><span class="label">기록하는 사람</span><br><strong>' + esc(S.student.displayName) + '</strong> <span class="muted" style="font-size:13px">(번호 ' + esc(S.student.studentId) + ')</span></div>' +
      '<button class="btn ghost small" id="logout">로그아웃</button></div>';
    html += '<nav class="tabs" role="tablist">' + PROG.days.map(function (x) {
      var s = stateOf(x.day);
      return '<button class="tab' + (s.state && s.state !== 'open' ? ' locked' : '') + '" role="tab" aria-selected="' + (x.day === S.day) + '" data-day="' + x.day + '">' +
        (s.submitted ? '<span class="dot" aria-label="제출 완료">✓</span>' : '') +
        '<b>DAY ' + BUT_Program.pad2(x.day) + '</b><small>' + x.dateLabel + ' ' + x.weekday + '</small></button>';
    }).join('') + '</nav>';

    html += '<section class="card mission">' +
      '<span class="label">' + esc(PROG.brand) + '</span>' +
      '<div style="display:flex;align-items:flex-end;gap:12px;margin-top:6px"><div class="day-no">' + BUT_Program.pad2(d.day) + '</div>' +
      '<div class="muted" style="font-size:13px;padding-bottom:4px">2026. ' + d.dateLabel + ' (' + d.weekday + ')</div></div>' +
      '<h2>' + esc(d.theme) + '</h2><div class="muted" style="font-size:14px">' + esc(d.themeSub) + '</div>' +
      '<div class="places">' + d.places.map(function (p) { return '<span class="chip">' + esc(p) + '</span>'; }).join('') + '</div>' +
      '<ol>' + d.missions.map(function (m, i) { return '<li><i>미션 ' + (i ? '②' : '①') + '</i><span>' + esc(m) + '</span></li>'; }).join('') + '</ol>' +
      '<div class="question"><span class="label">성찰 질문</span>' + esc(d.question) + '</div>' +
      '</section>';

    if (S.view === 'done' && S.lastReceipt && S.lastReceipt.day === S.day) {
      html += renderDone();
      $app.innerHTML = html;
      bindCommon();
      document.getElementById('editAgain').addEventListener('click', function () { S.view = 'form'; loadExisting(S.day); });
      var next = document.getElementById('nextDay');
      if (next) next.addEventListener('click', function () { S.day = Number(next.dataset.day); S.view = 'form'; renderMain(); window.scrollTo(0, 0); });
      return;
    }

    if (st.state === 'locked' || st.state === 'notyet') {
      html += '<section class="card status-banner closed"><div><b>' + (st.state === 'locked' ? '제출이 마감되었어요' : '아직 열리지 않은 날이에요') + '</b><div class="muted" style="font-size:13px">' +
        (st.state === 'locked' ? '수정이 필요하면 인솔 선생님께 말해 주세요.' : d.dateLabel + '에 열립니다. 미션을 미리 읽어 두세요!') + '</div></div></section>';
      $app.innerHTML = html;
      bindCommon();
      return;
    }

    if (st.submitted && !f.editing) {
      html += '<section class="card status-banner"><div><b>✓ 제출 완료</b><div class="muted" style="font-size:13px">' + BUT_API.fmtTime(st.submittedAt) + ' · ' + st.revision + '회차 제출</div></div>' +
        '<button class="btn small" id="editBtn">내용 수정하기</button></section>';
      $app.innerHTML = html;
      bindCommon();
      document.getElementById('editBtn').addEventListener('click', function () { loadExisting(S.day); });
      return;
    }

    html += renderForm(d, f, st);
    $app.innerHTML = html;
    bindCommon();
    bindForm(d, f);
  }

  function bindCommon() {
    document.getElementById('logout').addEventListener('click', function () {
      if (confirm('로그아웃할까요? 작성 중인 글은 이 기기에 임시저장되어 있어요.')) logout();
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.addEventListener('click', function () { S.day = Number(b.dataset.day); S.view = 'form'; renderMain(); });
    });
  }

  function counter(id, len, min, max) {
    var bad = (min && len < min) || len > max;
    return '<span class="counter' + (bad ? ' bad' : '') + '" id="' + id + '">' + len + (min ? ' / 최소 ' + min : '') + ' · 최대 ' + max + '자</span>';
  }

  function renderForm(d, f, st) {
    var h = '<section class="card form" id="formCard">';
    h += '<h3><span class="label" style="color:var(--day)">STEP 2</span> 오늘의 기록' + (f.editing ? ' <span class="badge warn">수정 중 · ' + (st.revision + 1) + '회차</span>' : '') + '</h3>';

    h += '<div class="field" id="f-photos"><div class="field-label">사진 <span class="hint">1~3장 · 미션 장면을 담아 주세요</span></div>' +
      '<div class="photos">' + f.photos.map(function (p, i) {
        return '<div class="ph"><img src="' + esc(p.preview) + '" alt="사진 ' + (i + 1) + '">' +
          '<button class="rm" type="button" data-rm="' + i + '" aria-label="사진 ' + (i + 1) + ' 삭제">×</button>' +
          (p.photoId ? '<span class="st">' + (p.kept ? '이전 사진' : '업로드 완료') + '</span>' : '') + '</div>';
      }).join('') +
      (f.photos.length < R.maxPhotos ? '<button type="button" class="add-ph" id="addPh"><span><b>+</b>사진 추가<br>(' + f.photos.length + '/' + R.maxPhotos + ')</span></button>' : '') +
      '</div>' +
      (f.photos.length ? '<div class="ph-meta">' + f.photos.map(function (p, i) {
        return '<div class="row"><img src="' + esc(p.preview) + '" alt=""><input class="input" data-cap="' + i + '" maxlength="' + R.captionMax + '" placeholder="사진 설명 (선택)" value="' + esc(p.caption || '') + '">' +
          '<select class="select" data-mis="' + i + '" aria-label="관련 미션"><option value="">미션</option><option value="1"' + (p.mission === '1' ? ' selected' : '') + '>미션 ①</option><option value="2"' + (p.mission === '2' ? ' selected' : '') + '>미션 ②</option></select></div>';
      }).join('') + '</div>' : '') +
      '<div class="err" data-err="photos"></div></div>';

    h += '<label class="field" id="f-reflection"><span class="field-label">성찰 질문 답변 ' + counter('c-reflection', charLen(f.reflection), R.reflectionMin, R.reflectionMax) + '</span>' +
      '<div class="muted" style="font-size:13px;margin-bottom:6px;font-family:var(--font-body)">Q. ' + esc(d.question) + '</div>' +
      '<textarea class="textarea" id="reflection" maxlength="' + R.reflectionMax + '" placeholder="질문에 대한 나의 생각을 솔직하게 써 주세요.">' + esc(f.reflection) + '</textarea><div class="err" data-err="reflection"></div></label>';

    h += '<label class="field" id="f-essay"><span class="field-label">소감문 ' + counter('c-essay', charLen(f.essay), R.essayMin, R.essayMax) + '</span>' +
      '<div class="muted" style="font-size:13px;margin-bottom:6px">오늘 한 일, 미션 ①·② 수행 과정, 느낀 점을 자유롭게.</div>' +
      '<textarea class="textarea" id="essay" style="min-height:220px" maxlength="' + R.essayMax + '" placeholder="오늘 가장 기억에 남는 장면은…">' + esc(f.essay) + '</textarea><div class="err" data-err="essay"></div></label>';

    h += '<label class="field" id="f-oneLine"><span class="field-label">오늘을 표현하는 한 줄 ' + counter('c-oneLine', charLen(f.oneLine), 0, R.oneLineMax) + '</span>' +
      '<input class="input" id="oneLine" maxlength="' + (R.oneLineMax + 5) + '" placeholder="예: ' + esc(d.sampleOneLine) + '" value="' + esc(f.oneLine) + '"><div class="err" data-err="oneLine"></div></label>';

    h += '<div class="field"><div class="field-label">전시 카드 미리보기 <span class="hint">포스터에 이렇게 실려요</span></div><div class="preview-wrap">' +
      '<div class="pcard"><div class="label">' + esc(PROG.brand) + '</div><div class="d">DAY ' + BUT_Program.pad2(d.day) + '</div>' +
      '<div class="im">' + (f.photos[0] ? '<img src="' + esc(f.photos[0].preview) + '" alt="">' : '') + '</div>' +
      '<div class="t" id="pv-one">' + esc(f.oneLine || d.sampleOneLine) + '</div><div class="m">' + esc(S.student.displayName) + ' / ' + d.dateLabel + '</div><div class="ln"></div></div>' +
      '<div class="muted" style="font-size:13px">첫 번째 사진과 한 줄 기록이 날짜별 포스터의 카드가 됩니다. 성찰 답변과 소감문은 개인 성장 기록지와 팜플렛에 실려요.</div></div></div>';

    h += '</section>';
    h += '<div class="submit-bar"><div class="inner">' +
      (f.editing ? '<button class="btn ghost" id="cancelEdit" type="button">취소</button>' : '') +
      '<span class="saved" id="saved">' + (f.savedAt ? '임시저장 ' + BUT_API.fmtTime(f.savedAt).split(' ')[1] : '') + '</span>' +
      '<button class="btn accent block" id="submitBtn" type="button">' + (f.editing ? '수정 내용 제출' : 'DAY ' + BUT_Program.pad2(d.day) + ' 기록 제출') + '</button></div></div>';
    return h;
  }

  function bindForm(d, f) {
    var add = document.getElementById('addPh');
    if (add) add.addEventListener('click', function () { $file.value = ''; $file.click(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-rm]'), function (b) {
      b.addEventListener('click', function () { f.photos.splice(Number(b.dataset.rm), 1); renderMain(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-cap]'), function (inp) {
      inp.addEventListener('input', function () { f.photos[Number(inp.dataset.cap)].caption = inp.value; });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-mis]'), function (sel) {
      sel.addEventListener('change', function () { f.photos[Number(sel.dataset.mis)].mission = sel.value; });
    });
    [['reflection', R.reflectionMin, R.reflectionMax], ['essay', R.essayMin, R.essayMax], ['oneLine', 0, R.oneLineMax]].forEach(function (cfg) {
      var el = document.getElementById(cfg[0]);
      el.addEventListener('input', function () {
        f[cfg[0]] = el.value;
        var len = charLen(el.value);
        var c = document.getElementById('c-' + cfg[0]);
        c.textContent = len + (cfg[1] ? ' / 최소 ' + cfg[1] : '') + ' · 최대 ' + cfg[2] + '자';
        c.classList.toggle('bad', (cfg[1] && len < cfg[1]) || len > cfg[2]);
        if (cfg[0] === 'oneLine') document.getElementById('pv-one').textContent = el.value || d.sampleOneLine;
        saveDraft(d.day);
      });
    });
    var cancel = document.getElementById('cancelEdit');
    if (cancel) cancel.addEventListener('click', function () { f.editing = false; f.photos = []; renderMain(); });
    document.getElementById('submitBtn').addEventListener('click', function () { submitDay(d.day); });
  }

  // ------------------------------------------------------------ 사진 처리
  function readAsDataURL(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function loadImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return loadViaImg(file); });
    }
    return loadViaImg(file);
  }
  function loadViaImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  function makeDisplay(file) {
    return loadImage(file).then(function (img) {
      var w = img.width, h = img.height;
      var k = Math.min(1, R.displayMaxEdge / Math.max(w, h));
      var cw = Math.round(w * k), ch = Math.round(h * k);
      var cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      if (img.close) img.close();
      return { dataUrl: cv.toDataURL('image/jpeg', 0.86), width: cw, height: ch };
    });
  }

  $file.addEventListener('change', function () {
    var f = form(S.day);
    var files = Array.prototype.slice.call($file.files || []);
    var room = R.maxPhotos - f.photos.length;
    if (files.length > room) toast('사진은 최대 ' + R.maxPhotos + '장까지예요. 앞의 ' + room + '장만 추가했어요.');
    files = files.slice(0, room);
    var jobs = files.map(function (file) {
      if (file.size > R.maxOriginalBytes) { toast('20MB가 넘는 사진은 올릴 수 없어요: ' + file.name, 4000); return null; }
      return makeDisplay(file).then(function (disp) {
        f.photos.push({ file: file, preview: disp.dataUrl, display: disp, caption: '', mission: '', clientUploadId: BUT_API.uuid(), photoId: null });
      }).catch(function () {
        toast('이 사진 형식은 열 수 없어요(HEIC 등). 카메라 설정을 ‘호환성 우선(JPG)’으로 바꾸거나 다른 사진을 골라 주세요.', 5000);
      });
    }).filter(Boolean);
    Promise.all(jobs).then(function () { renderMain(); });
  });

  // ------------------------------------------------------------ 기존 제출물 불러오기(수정)
  function loadExisting(day) {
    showBusy('이전 기록을 불러오는 중…', 0);
    api('mySubmission', { token: S.token, day: day }).then(function (r) {
      var f = form(day);
      var sub = r.submission;
      if (!sub) { hideBusy(); f.editing = false; renderMain(); return; }
      f.reflection = sub.reflection; f.essay = sub.essay; f.oneLine = sub.oneLine;
      f.editing = true; f.clientSubmissionId = null;
      f.photos = [];
      return sub.photos.reduce(function (p, ph) {
        return p.then(function () {
          return api('myPhoto', { token: S.token, photoId: ph.photoId }).then(function (x) {
            f.photos.push({ photoId: ph.photoId, kept: true, preview: x.dataUrl, caption: ph.caption, mission: ph.mission });
          });
        });
      }, Promise.resolve()).then(function () { hideBusy(); renderMain(); });
    }).catch(function (e) { hideBusy(); handleError(e); });
  }

  // ------------------------------------------------------------ 제출
  var $busy = null;
  function showBusy(msg, pct) {
    if (!$busy) {
      $busy = document.createElement('div');
      $busy.className = 'overlay';
      $busy.innerHTML = '<div class="dialog" role="alertdialog" aria-live="assertive"><h3 id="busyMsg"></h3><div class="progress"><i id="busyBar"></i></div><p class="muted" style="font-size:13px;margin:0">화면을 끄거나 다른 앱으로 이동하지 마세요.</p></div>';
      document.body.appendChild($busy);
    }
    document.getElementById('busyMsg').textContent = msg;
    document.getElementById('busyBar').style.width = Math.round((pct || 0) * 100) + '%';
  }
  function hideBusy() { if ($busy) { $busy.remove(); $busy = null; } }

  function ask(title, body, okText) {
    return new Promise(function (resolve) {
      var o = document.createElement('div');
      o.className = 'overlay';
      o.innerHTML = '<div class="dialog" role="dialog" aria-modal="true"><h3>' + esc(title) + '</h3><p class="muted" style="margin:0">' + body + '</p>' +
        '<div class="actions"><button class="btn ghost" data-a="0">취소</button><button class="btn accent" data-a="1">' + esc(okText) + '</button></div></div>';
      document.body.appendChild(o);
      o.addEventListener('click', function (ev) {
        var a = ev.target.getAttribute && ev.target.getAttribute('data-a');
        if (a === null) return;
        o.remove();
        resolve(a === '1');
      });
    });
  }

  function showErrors(errs) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-err]'), function (el) {
      var k = el.getAttribute('data-err');
      el.textContent = errs[k] || '';
      var fld = document.getElementById('f-' + k);
      if (fld) fld.classList.toggle('invalid', !!errs[k]);
    });
    var first = Object.keys(errs)[0];
    if (first) {
      var el = document.getElementById('f-' + first);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function localValidate(f) {
    var e = {};
    var rl = charLen(f.reflection.trim()), el = charLen(f.essay.trim()), ol = charLen(f.oneLine.trim());
    if (f.photos.length < R.minPhotos) e.photos = '사진을 ' + R.minPhotos + '장 이상 올려 주세요.';
    if (rl < R.reflectionMin) e.reflection = '성찰 질문 답변을 ' + R.reflectionMin + '자 이상 써 주세요. (현재 ' + rl + '자)';
    if (rl > R.reflectionMax) e.reflection = R.reflectionMax + '자 이하로 줄여 주세요.';
    if (el < R.essayMin) e.essay = '소감문을 ' + R.essayMin + '자 이상 써 주세요. (현재 ' + el + '자)';
    if (el > R.essayMax) e.essay = R.essayMax + '자 이하로 줄여 주세요.';
    if (ol < 2) e.oneLine = '오늘을 표현하는 한 줄을 써 주세요.';
    if (ol > R.oneLineMax) e.oneLine = R.oneLineMax + '자 이하로 줄여 주세요. (현재 ' + ol + '자)';
    return e;
  }

  function uploadOne(f, p, i, n, day) {
    if (p.photoId) return Promise.resolve();
    showBusy('사진 올리는 중 (' + (i + 1) + '/' + n + ')', (i + 0.3) / (n + 1));
    return readAsDataURL(p.file).then(function (orig) {
      return api('uploadPhoto', {
        token: S.token, day: day, clientUploadId: p.clientUploadId,
        original: { base64: orig, mime: p.file.type || 'image/jpeg', name: p.file.name },
        display: { base64: p.display.dataUrl, width: p.display.width, height: p.display.height }
      }, { retries: 3 });
    }).then(function (r) { p.photoId = r.photoId; });
  }

  function submitDay(day) {
    if (S.busy) return;
    var f = form(day);
    var errs = localValidate(f);
    showErrors(errs);
    if (Object.keys(errs).length) return;
    S.busy = true;
    if (!f.clientSubmissionId) f.clientSubmissionId = BUT_API.uuid();
    var n = f.photos.length;
    var chain = Promise.resolve();
    f.photos.forEach(function (p, i) { chain = chain.then(function () { return uploadOne(f, p, i, n, day); }); });
    chain.then(function () {
      showBusy('기록 제출 중…', n / (n + 1));
      return send(false);
    }).catch(function (e) {
      hideBusy(); S.busy = false;
      if (e && e.extra && e.extra.fields) showErrors(e.extra.fields);
      handleError(e, '제출하지 못했어요. 다시 시도해 주세요.');
    });

    function send(confirmOverwrite) {
      return api('submit', {
        token: S.token, day: day, clientSubmissionId: f.clientSubmissionId, confirmOverwrite: confirmOverwrite,
        reflection: f.reflection, essay: f.essay, oneLine: f.oneLine, userAgent: navigator.userAgent,
        photos: f.photos.map(function (p) { return { photoId: p.photoId, caption: p.caption || '', mission: p.mission || '' }; })
      }, { retries: 3 }).then(function (r) {
        if (r.status === 'exists') {
          hideBusy();
          return ask('이미 제출한 기록이 있어요',
            'DAY ' + BUT_Program.pad2(day) + ' 기록을 ' + esc(BUT_API.fmtTime(r.existing.submittedAt)) + '에 제출했어요 (' + r.existing.revision + '회차).<br>지금 쓴 내용으로 <b>바꿔서</b> 제출할까요? 이전 기록은 선생님만 볼 수 있게 보관돼요.',
            '새 내용으로 바꾸기').then(function (ok) {
            if (!ok) { S.busy = false; return; }
            showBusy('기록 제출 중…', 0.9);
            return send(true);
          });
        }
        finish(r);
      });
    }

    function finish(r) {
      hideBusy(); S.busy = false;
      store.del(draftKey(day));
      S.forms[day] = null; delete S.forms[day];
      S.lastReceipt = r.receipt; S.lastReceipt.status = r.status;
      S.view = 'done';
      api('myStatus', { token: S.token }).then(function (x) { S.status = x.status; renderMain(); }).catch(function () {
        var s = stateOf(day); s.submitted = true; s.submittedAt = r.receipt.submittedAt; s.revision = r.receipt.revision; renderMain();
      });
      window.scrollTo(0, 0);
    }
  }

  function renderDone() {
    var r = S.lastReceipt;
    var next = PROG.days.filter(function (x) { return x.day > r.day && !stateOf(x.day).submitted && stateOf(x.day).state === 'open'; })[0];
    return '<section class="card done" id="doneCard"><div class="stamp">벗</div>' +
      '<h2>' + (r.status === 'updated' ? '수정 제출 완료!' : '제출 완료!') + '</h2>' +
      '<p class="muted" style="margin:6px 0 0">“' + esc(r.oneLine) + '”</p>' +
      '<div class="receipt"><div><span>날짜</span><b>DAY ' + BUT_Program.pad2(r.day) + '</b></div>' +
      '<div><span>제출 시각</span><b>' + esc(BUT_API.fmtTime(r.submittedAt)) + '</b></div>' +
      '<div><span>회차</span><b>' + r.revision + '회차' + (r.revision > 1 ? ' (최신 내용으로 교체됨)' : '') + '</b></div>' +
      '<div><span>사진</span><b>' + r.photoCount + '장</b></div>' +
      '<div><span>접수 번호</span><b style="font-size:12px">' + esc(r.submissionId) + '</b></div></div>' +
      '<div style="display:grid;gap:8px"><button class="btn ghost block" id="editAgain">내용 다시 수정하기</button>' +
      (next ? '<button class="btn block" id="nextDay" data-day="' + next.day + '">DAY ' + BUT_Program.pad2(next.day) + ' 미션 보기</button>' : '') + '</div></section>';
  }

  // ------------------------------------------------------------ 시작
  if (S.token && S.student) {
    $app.innerHTML = '<p class="muted">불러오는 중…</p>';
    api('myStatus', { token: S.token }).then(function (r) {
      S.status = r.status; S.student = r.student;
      S.day = pickDefaultDay(r.status, r.today);
      renderMain();
    }).catch(function (e) { if (e.code === 'AUTH') logout(true); else { renderLogin(e.message); } });
  } else {
    renderLogin();
  }

  window.addEventListener('beforeunload', function (ev) {
    if (S.busy) { ev.preventDefault(); ev.returnValue = ''; }
  });
})();
