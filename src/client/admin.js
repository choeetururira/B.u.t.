/* B.U.T. TOKYO 2026 — 교사용 관리자 페이지 */
(function () {
  'use strict';
  var PROG = BUT_Program.program;
  var L = BUT_Layout, RH = BUT_RenderHTML, RP = BUT_RenderPPTX;
  var esc = BUT_API.esc, toast = BUT_API.toast, store = BUT_API.store, pad2 = BUT_Program.pad2;
  var $view = document.getElementById('view');
  var A = { token: null, tab: 'overview', overview: null, subs: null, filters: { day: '', studentId: '', status: '' }, photos: {}, settings: null, students: null };
  try { A.token = sessionStorage.getItem('but.admin'); } catch (e) { /* 무시 */ }

  function api(action, payload, opts) {
    payload = payload || {};
    payload.token = A.token;
    return BUT_API.call(action, payload, opts).catch(function (e) {
      if (e && e.code === 'AUTH' && action !== 'adminLogin') { logout(); toast(e.message); }
      throw e;
    });
  }
  function fail(e) { toast((e && e.message) || '오류가 발생했습니다.', 4000); }
  function dayColor(d) { return BUT_Program.getDay(d).color; }

  // ------------------------------------------------------------ 로그인
  function renderLogin(msg) {
    document.getElementById('tabs').classList.add('hidden');
    $view.innerHTML = '<section class="card login"><span class="label">ADMIN</span><h2 style="margin:4px 0 16px">관리자 로그인</h2>' +
      '<form id="lf"><label class="field"><span class="field-label">관리자 비밀번호</span><input class="input" type="password" id="pw" autocomplete="current-password" required></label>' +
      '<div class="err" id="le">' + esc(msg || '') + '</div><button class="btn block" id="lb">로그인</button></form>' +
      '<p class="muted" style="font-size:12px;margin-top:14px">비밀번호는 Apps Script 편집기에서 setup() 또는 resetAdminPassword() 실행 로그에서 확인합니다.</p></section>';
    document.getElementById('lf').addEventListener('submit', function (ev) {
      ev.preventDefault();
      BUT_API.call('adminLogin', { password: document.getElementById('pw').value }).then(function (r) {
        A.token = r.token;
        try { sessionStorage.setItem('but.admin', r.token); } catch (e) { /* 무시 */ }
        start();
      }).catch(function (e) { document.getElementById('le').textContent = e.message; });
    });
  }
  function logout() {
    A.token = null;
    try { sessionStorage.removeItem('but.admin'); } catch (e) { /* 무시 */ }
    renderLogin();
  }

  function start() {
    document.getElementById('tabs').classList.remove('hidden');
    show(A.tab);
  }
  Array.prototype.forEach.call(document.querySelectorAll('#tabs [data-tab]'), function (b) {
    b.addEventListener('click', function () { show(b.dataset.tab); });
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);

  function show(tab) {
    A.tab = tab;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs [data-tab]'), function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    $view.innerHTML = '<p class="muted">불러오는 중…</p>';
    ({ overview: viewOverview, review: viewReview, students: viewStudents, outputs: viewOutputs, settings: viewSettings })[tab]();
  }

  // ------------------------------------------------------------ 사진 캐시
  function loadPhotos(ids, kind) {
    var need = ids.filter(function (id) { return id && !A.photos[id]; });
    var chunks = [];
    for (var i = 0; i < need.length; i += 8) chunks.push(need.slice(i, i + 8));
    return chunks.reduce(function (p, chunk) {
      return p.then(function () {
        return api('adminPhotos', { photoIds: chunk, kind: kind || 'display' }, { retries: 3 }).then(function (r) {
          Object.keys(r.photos).forEach(function (k) { A.photos[k] = r.photos[k]; });
        });
      });
    }, Promise.resolve());
  }
  function scaled(id, maxPx) {
    var key = id + '@' + maxPx;
    if (A.photos[key]) return Promise.resolve(A.photos[key]);
    var src = A.photos[id];
    if (!src) return Promise.resolve(null);
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, maxPx / Math.max(img.width, img.height));
        if (k >= 1) { A.photos[key] = src; return res(src); }
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        A.photos[key] = cv.toDataURL('image/jpeg', 0.85);
        res(A.photos[key]);
      };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }

  // ============================================================ 제출 현황
  function viewOverview() {
    api('adminOverview').then(function (o) {
      A.overview = o;
      var total = o.totalStudents;
      var h = '<div class="grid-stats">';
      o.perDay.forEach(function (d) {
        var info = BUT_Program.getDay(d.day);
        var pct = total ? Math.round((d.submitted / total) * 100) : 0;
        h += '<div class="card stat"><span class="label" style="color:' + info.color + '">DAY ' + pad2(d.day) + ' · ' + info.dateLabel + '</span>' +
          '<b>' + d.submitted + '<span class="muted" style="font-size:16px"> / ' + total + '</span></b>' +
          '<span class="badge ' + (d.state === 'open' ? 'ok' : 'no') + '">' + ({ open: '제출 가능', locked: '마감', notyet: '열리기 전' })[d.state] + '</span>' +
          '<div class="bar"><i style="width:' + pct + '%;background:' + info.color + '"></i></div></div>';
      });
      h += '</div>';
      h += '<section class="card panel"><h2>학생별 · 날짜별 제출 현황 <button class="btn ghost small" id="refresh">새로고침</button> <span class="muted" style="font-size:13px;font-weight:400">칸을 누르면 검토 화면으로 이동합니다 · 1분마다 자동 갱신</span></h2>' +
        '<div class="table-wrap"><table><thead><tr><th>번호</th><th>표시 이름</th>' +
        PROG.days.map(function (d) { return '<th style="color:' + d.color + '">DAY ' + pad2(d.day) + '</th>'; }).join('') + '<th>합계</th></tr></thead><tbody>';
      o.students.forEach(function (s) {
        var cnt = 0;
        h += '<tr' + (s.active ? '' : ' style="opacity:.45"') + '><td class="mono">' + esc(s.studentId) + '</td><td>' + esc(s.displayName) + (s.name ? ' <span class="muted" style="font-size:12px">' + esc(s.name) + '</span>' : '') + (s.exhibitConsent === false ? ' <span class="badge warn">사진 비공개</span>' : '') + '</td>';
        PROG.days.forEach(function (d) {
          var c = o.cells[s.studentId] && o.cells[s.studentId][d.day];
          if (c) cnt++;
          h += '<td>' + (c ? '<button class="cell" data-go="' + d.day + '|' + esc(s.studentId) + '"><span class="badge ' + (c.reviewStatus === 'approved' ? 'ok' : c.reviewStatus === 'hold' ? 'accent' : 'warn') + '">' +
            ({ approved: '승인', hold: '보류', pending: '검토 대기' })[c.reviewStatus] + '</span><small>' + BUT_API.fmtTime(c.submittedAt) + ' · 사진 ' + c.photoCount + (c.revision > 1 ? ' · ' + c.revision + '회차' : '') + (c.edited ? ' · 수정됨' : '') + '</small></button>' : '<span class="badge no">미제출</span>') + '</td>';
        });
        h += '<td><b>' + cnt + '</b>/4</td></tr>';
      });
      h += '</tbody></table></div></section>';
      $view.innerHTML = h;
      document.getElementById('refresh').addEventListener('click', viewOverview);
      Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
        b.addEventListener('click', function () {
          var p = b.dataset.go.split('|');
          A.filters = { day: p[0], studentId: p[1], status: '' };
          show('review');
        });
      });
    }).catch(fail);
  }
  setInterval(function () { if (A.token && A.tab === 'overview' && document.visibilityState === 'visible') viewOverview(); }, 60000);

  // ============================================================ 검토 · 편집
  function viewReview() {
    Promise.all([api('adminSubmissions', { day: A.filters.day || null, studentId: A.filters.studentId || null }), api('adminSettings')]).then(function (rs) {
      A.subs = rs[0].submissions;
      A.settings = rs[1];
      renderReview();
    }).catch(fail);
  }
  function renderReview() {
    var f = A.filters;
    var list = A.subs.filter(function (s) { return !f.status || s.reviewStatus === f.status; });
    var students = {};
    A.subs.forEach(function (s) { students[s.studentId] = s.displayName; });
    var h = '<div class="filters">' +
      '<select class="select" id="fDay"><option value="">모든 날짜</option>' + PROG.days.map(function (d) { return '<option value="' + d.day + '"' + (String(f.day) === String(d.day) ? ' selected' : '') + '>DAY ' + pad2(d.day) + ' · ' + esc(d.theme) + '</option>'; }).join('') + '</select>' +
      '<input class="input" id="fStu" placeholder="학생 번호" value="' + esc(f.studentId) + '" style="max-width:120px">' +
      '<select class="select" id="fSt"><option value="">모든 상태</option><option value="pending"' + (f.status === 'pending' ? ' selected' : '') + '>검토 대기</option><option value="approved"' + (f.status === 'approved' ? ' selected' : '') + '>승인</option><option value="hold"' + (f.status === 'hold' ? ' selected' : '') + '>보류(결과물 제외)</option></select>' +
      '<button class="btn small" id="fGo">적용</button><button class="btn ghost small" id="fReset">초기화</button>' +
      '<span class="muted" style="align-self:center;font-size:13px">' + list.length + '건</span></div>';
    h += list.map(subCard).join('') || '<p class="muted">조건에 맞는 제출물이 없습니다.</p>';
    $view.innerHTML = h;
    document.getElementById('fGo').addEventListener('click', function () {
      A.filters = { day: document.getElementById('fDay').value, studentId: document.getElementById('fStu').value.trim(), status: document.getElementById('fSt').value };
      viewReview();
    });
    document.getElementById('fReset').addEventListener('click', function () { A.filters = { day: '', studentId: '', status: '' }; viewReview(); });
    list.forEach(bindSub);
    var ids = [];
    list.forEach(function (s) { s.photos.forEach(function (p) { ids.push(p.photoId); }); });
    loadPhotos(ids).then(function () {
      ids.forEach(function (id) {
        var img = document.querySelector('img[data-photo="' + id + '"]');
        if (img && A.photos[id]) img.src = A.photos[id];
      });
    }).catch(fail);
  }

  function subCard(s) {
    var d = BUT_Program.getDay(s.day);
    var topics = s.topics || s.autoTopics;
    var heroes = (A.settings && A.settings.heroes) || {};
    var h = '<article class="card sub" id="sub-' + s.submissionId + '" style="border-left:5px solid ' + d.color + '">';
    h += '<div class="sub-photos">' + s.photos.map(function (p) {
      return '<div class="sub-photo"><img data-photo="' + p.photoId + '" alt="">' + (p.caption ? '<span class="cap">' + esc(p.caption) + (p.mission ? ' · 미션 ' + p.mission : '') + '</span>' : '') +
        '<div class="tools">' +
        '<button data-feat="' + p.photoId + '" class="' + (s.featuredPhotoId === p.photoId ? 'on' : '') + '" title="포스터 카드에 쓸 사진">★ 카드</button>' +
        '<button data-exh="' + p.photoId + '" class="' + (p.exhibit ? 'on' : '') + '" title="팜플렛·주제 포스터 우선 사용">전시</button>' +
        '<button data-hero="' + p.photoId + '" data-day="' + s.day + '" class="' + (heroes[s.day] === p.photoId ? 'on' : '') + '" title="날짜별 포스터 대표 사진">메인</button>' +
        '<button data-orig="' + p.photoId + '" title="원본 보기">원본</button></div></div>';
    }).join('') + '<div class="muted" style="font-size:12px">원본 ' + s.photos.map(function (p) { return Math.round((p.bytes || 0) / 1024) + 'KB'; }).join(' · ') + '</div></div>';

    h += '<div><div class="row" style="justify-content:space-between;margin-bottom:10px"><div><span class="label" style="color:' + d.color + '">DAY ' + pad2(s.day) + ' · ' + esc(d.theme) + '</span><h3 style="font-size:17px">' + esc(s.displayName) + ' <span class="muted mono">#' + esc(s.studentId) + '</span>' + (s.name ? ' <span class="muted" style="font-size:13px">' + esc(s.name) + '</span>' : '') + '</h3>' +
      '<span class="muted" style="font-size:12px">' + BUT_API.fmtTime(s.submittedAt) + ' 제출 · ' + s.revision + '회차' + (s.revision > 1 ? ' <a href="#" data-hist="1">이전 회차 보기</a>' : '') + (s.editedAt ? ' · 교사 수정 ' + BUT_API.fmtTime(s.editedAt) : '') + '</span></div>' +
      '<div class="seg" data-seg>' + [['pending', '검토 대기'], ['approved', '승인'], ['hold', '보류']].map(function (x) { return '<button data-st="' + x[0] + '" class="' + (s.reviewStatus === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    h += editField(s, 'oneLine', '한 줄 기록', 'input');
    h += editField(s, 'reflection', '성찰 질문 답변', 'textarea');
    h += editField(s, 'essay', '소감문', 'textarea');
    h += '<div class="field"><div class="field-label">주제 분류 <span class="hint">' + (s.topics ? '교사 지정' : '자동 분류 — 눌러서 바꾸면 교사 지정으로 저장') + '</span></div><div class="row">' +
      PROG.topics.map(function (t) {
        var on = topics.indexOf(t.key) >= 0;
        return '<button class="topic-toggle' + (on ? ' on' : '') + '" data-topic="' + t.key + '" style="' + (on ? 'background:' + t.color + ';border-color:' + t.color : 'color:' + t.color) + '">' + esc(t.title) + '</button>';
      }).join('') + '</div></div>';
    h += '<label class="field"><span class="field-label">교사 메모 <span class="hint">학생에게 보이지 않음</span></span><input class="input" data-k="teacherNote" value="' + esc(s.teacherNote) + '"></label>';
    h += '<div class="row"><button class="btn" data-save>저장</button><span class="muted" style="font-size:13px" data-msg></span></div>';
    h += '</div></article>';
    return h;
  }
  function editField(s, key, label, type) {
    var cap = key.charAt(0).toUpperCase() + key.slice(1);
    var edited = s['edited' + cap];
    var val = edited || s[key];
    var h = '<div class="field"><div class="field-label">' + label + (edited ? ' <span class="badge warn">교사 수정본</span>' : '') + ' <span class="counter">' + Array.from(val).length + '자</span></div>';
    if (edited) h += '<details><summary>학생 원문 보기</summary><div class="orig">' + esc(s[key]) + '</div><button class="btn ghost small" data-restore="' + key + '">원문으로 되돌리기</button></details>';
    h += type === 'input' ? '<input class="input" data-k="' + key + '" value="' + esc(val) + '">' : '<textarea class="textarea" data-k="' + key + '" style="min-height:' + (key === 'essay' ? 200 : 110) + 'px">' + esc(val) + '</textarea>';
    return h + '</div>';
  }

  function bindSub(s) {
    var root = document.getElementById('sub-' + s.submissionId);
    var state = { reviewStatus: s.reviewStatus, topics: s.topics ? s.topics.slice() : null, restore: {} };
    var msg = root.querySelector('[data-msg]');
    root.querySelectorAll('[data-st]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.reviewStatus = b.dataset.st;
        root.querySelectorAll('[data-st]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    root.querySelectorAll('[data-topic]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cur = state.topics || (s.autoTopics || []).slice();
        var k = b.dataset.topic, i = cur.indexOf(k);
        if (i >= 0) cur.splice(i, 1); else cur.push(k);
        state.topics = cur;
        var t = PROG.topics.filter(function (x) { return x.key === k; })[0];
        var on = cur.indexOf(k) >= 0;
        b.classList.toggle('on', on);
        b.style.cssText = on ? 'background:' + t.color + ';border-color:' + t.color : 'color:' + t.color;
      });
    });
    root.querySelectorAll('[data-restore]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.restore;
        root.querySelector('[data-k="' + k + '"]').value = s[k];
        state.restore[k] = true;
        toast('원문을 불러왔습니다. 저장을 눌러 확정하세요.');
      });
    });
    var hist = root.querySelector('[data-hist]');
    if (hist) hist.addEventListener('click', function (ev) {
      ev.preventDefault();
      api('adminHistory', { studentId: s.studentId, day: s.day }).then(function (r) {
        var o = document.createElement('div');
        o.className = 'overlay';
        o.innerHTML = '<div class="dialog" style="width:min(720px,100%);max-height:85vh;overflow:auto"><h3>제출 이력 · ' + esc(s.displayName) + ' DAY ' + pad2(s.day) + '</h3>' +
          r.revisions.map(function (v) { return '<div style="border-top:1px solid var(--line);padding:10px 0"><b>' + v.revision + '회차</b> <span class="muted">' + BUT_API.fmtTime(v.submittedAt) + ' · ' + (v.status === 'current' ? '현재' : '이전') + '</span><div class="orig">“' + esc(v.oneLine) + '”\n\n' + esc(v.reflection) + '\n\n' + esc(v.essay) + '</div></div>'; }).join('') +
          '<div class="actions"><button class="btn">닫기</button></div></div>';
        document.body.appendChild(o);
        o.querySelector('.actions .btn').addEventListener('click', function () { o.remove(); });
      }).catch(fail);
    });
    root.querySelector('[data-save]').addEventListener('click', function () {
      var patch = { reviewStatus: state.reviewStatus, teacherNote: root.querySelector('[data-k="teacherNote"]').value };
      ['oneLine', 'reflection', 'essay'].forEach(function (k) {
        var v = root.querySelector('[data-k="' + k + '"]').value.trim();
        var cap = 'edited' + k.charAt(0).toUpperCase() + k.slice(1);
        patch[cap] = v === s[k].trim() ? '' : v;
      });
      if (state.topics) patch.topics = state.topics;
      msg.textContent = '저장 중…';
      api('adminUpdateSubmission', { submissionId: s.submissionId, patch: patch }).then(function (r) {
        Object.keys(r.submission).forEach(function (k) { s[k] = r.submission[k]; });
        msg.textContent = '저장됨 ' + BUT_API.fmtTime(r.submission.editedAt).split(' ')[1];
      }).catch(function (e) { msg.textContent = ''; fail(e); });
    });
    root.querySelectorAll('[data-feat]').forEach(function (b) {
      b.addEventListener('click', function () {
        api('adminUpdateSubmission', { submissionId: s.submissionId, patch: { featuredPhotoId: b.dataset.feat } }).then(function () {
          s.featuredPhotoId = b.dataset.feat;
          root.querySelectorAll('[data-feat]').forEach(function (x) { x.classList.toggle('on', x === b); });
          toast('포스터 카드 사진으로 지정했습니다.');
        }).catch(fail);
      });
    });
    root.querySelectorAll('[data-exh]').forEach(function (b) {
      b.addEventListener('click', function () {
        var on = !b.classList.contains('on');
        api('adminUpdatePhoto', { photoId: b.dataset.exh, patch: { exhibit: on } }).then(function () { b.classList.toggle('on', on); }).catch(fail);
      });
    });
    root.querySelectorAll('[data-hero]').forEach(function (b) {
      b.addEventListener('click', function () {
        var heroes = Object.assign({}, A.settings.heroes || {});
        heroes[s.day] = b.classList.contains('on') ? '' : b.dataset.hero;
        api('adminSettings', { set: { heroes: heroes } }).then(function (r) {
          A.settings = r;
          document.querySelectorAll('[data-hero]').forEach(function (x) { x.classList.toggle('on', r.heroes[x.dataset.day] === x.dataset.hero); });
          toast(heroes[s.day] ? 'DAY ' + pad2(s.day) + ' 포스터 대표 사진으로 지정했습니다.' : '대표 사진 지정을 해제했습니다.');
        }).catch(fail);
      });
    });
    root.querySelectorAll('[data-orig]').forEach(function (b) {
      b.addEventListener('click', function () {
        var w = window.open('', '_blank');
        api('adminPhotos', { photoIds: [b.dataset.orig], kind: 'original' }).then(function (r) {
          var url = r.photos[b.dataset.orig];
          if (!url) return;
          var blob = dataUrlToBlob(url);
          var obj = URL.createObjectURL(blob);
          if (w) w.location.href = obj; else window.open(obj, '_blank');
        }).catch(function (e) { if (w) w.close(); fail(e); });
      });
    });
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mime = parts[0].replace(/^data:|;base64$/g, '');
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // ============================================================ 학생 관리
  function viewStudents() {
    api('adminStudents').then(function (r) {
      A.students = r.students;
      var h = '<section class="card panel"><h2>학생 관리 <span class="muted" style="font-size:13px;font-weight:400">실명은 관리자 화면에서만 보이고 결과물에는 ‘표시 이름’이 쓰입니다.</span></h2>' +
        '<div class="row" style="margin-bottom:12px"><button class="btn small" id="gen">학생 번호 01~' + pad2(PROG.participants) + ' 생성(없는 번호만)</button>' +
        '<button class="btn ghost small" id="showPin">PIN 보기</button><button class="btn ghost small" id="slips">PIN 배부 카드 · QR 안내문</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>번호</th><th>표시 이름(결과물)</th><th>실명(선택)</th><th>PIN</th><th>사진 전시 동의</th><th>사용</th><th>선생님의 한마디 (성장 기록지)</th><th></th></tr></thead><tbody>' +
        r.students.map(function (s) {
          return '<tr data-sid="' + esc(s.studentId) + '"><td class="mono">' + esc(s.studentId) + '</td>' +
            '<td><input class="input" data-f="displayName" value="' + esc(s.displayName) + '" style="min-width:130px"></td>' +
            '<td><input class="input" data-f="name" value="' + esc(s.name) + '" style="min-width:90px"></td>' +
            '<td><span class="mono pin" data-pin="' + esc(s.pin) + '">••••</span> <button class="btn ghost small" data-newpin>재발급</button></td>' +
            '<td><input type="checkbox" data-f="exhibitConsent"' + (s.exhibitConsent ? ' checked' : '') + '></td>' +
            '<td><input type="checkbox" data-f="active"' + (s.active ? ' checked' : '') + '></td>' +
            '<td><textarea class="textarea" data-f="teacherComment" style="min-height:44px;min-width:240px">' + esc(s.teacherComment) + '</textarea></td>' +
            '<td><button class="btn small" data-save>저장</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="row" style="margin-top:14px"><input class="input" id="newId" placeholder="새 학생 번호" style="max-width:160px"><button class="btn small" id="addStu">학생 추가</button></div></section>';
      $view.innerHTML = h;
      document.getElementById('gen').addEventListener('click', function () {
        api('adminGenerateStudents', { count: PROG.participants, startAt: 1 }).then(function (x) { toast(x.created.length + '명 생성'); viewStudents(); }).catch(fail);
      });
      document.getElementById('showPin').addEventListener('click', function () {
        document.querySelectorAll('.pin').forEach(function (p) { p.textContent = p.textContent === '••••' ? p.dataset.pin : '••••'; });
      });
      document.getElementById('slips').addEventListener('click', function () {
        A.tab = 'outputs';
        show('outputs');
        setTimeout(function () { var b = document.querySelector('[data-out="guide"] [data-act="preview"]'); if (b) b.click(); }, 300);
      });
      document.getElementById('addStu').addEventListener('click', function () {
        var id = document.getElementById('newId').value.trim();
        if (!id) return;
        api('adminUpsertStudent', { student: { studentId: id } }).then(function () { viewStudents(); }).catch(fail);
      });
      document.querySelectorAll('tr[data-sid]').forEach(function (tr) {
        var sid = tr.dataset.sid;
        tr.querySelector('[data-save]').addEventListener('click', function () {
          var st = { studentId: sid };
          tr.querySelectorAll('[data-f]').forEach(function (el) { st[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
          api('adminUpsertStudent', { student: st }).then(function () { toast(sid + '번 저장됨'); }).catch(fail);
        });
        tr.querySelector('[data-newpin]').addEventListener('click', function () {
          if (!confirm(sid + '번 학생의 PIN을 새로 발급할까요? 학생은 새 PIN으로 다시 로그인해야 합니다.')) return;
          var pin = String(Math.floor(1000 + Math.random() * 9000));
          api('adminUpsertStudent', { student: { studentId: sid, pin: pin } }).then(function () {
            var p = tr.querySelector('.pin'); p.dataset.pin = pin; p.textContent = pin; toast('새 PIN: ' + pin);
          }).catch(fail);
        });
      });
    }).catch(fail);
  }

  // ============================================================ 결과물
  var EXTRA = [{ key: 'guide', label: '접속 안내(QR) + PIN 배부 카드 A4' }];
  function photoMax(key) { return /^day|^topic/.test(key) ? 2000 : 1200; }

  function viewOutputs() {
    api('adminSettings').then(function (st) {
      A.settings = st;
      var h = '<section class="card panel"><h2>결과물 자동 생성</h2>' +
        '<p class="muted" style="margin:-4px 0 14px;font-size:14px">미리보기 → <b>PDF 인쇄</b>(브라우저 인쇄 창에서 ‘PDF로 저장’, 여백 없음·배경 그래픽 켜기) / <b>PPTX</b>(PowerPoint·Keynote·Google Slides·Canva에서 편집) / <b>HTML</b>(웹 편집용 원본)</p>' +
        '<div class="row" style="margin-bottom:14px"><label class="row" style="gap:6px"><input type="checkbox" id="approvedOnly"> 승인된 기록만 사용</label>' +
        '<label class="row" style="gap:6px">성장 기록지 대상 <select class="select" id="growthWho" style="width:auto"><option value="">전체 학생</option></select></label>' +
        '<label class="row" style="gap:6px;flex:1;min-width:280px">학생용 주소(QR) <input class="input" id="appUrl" value="' + esc(st.appUrl || '') + '"></label></div>' +
        '<div class="outputs">' + L.OUTPUTS.concat(EXTRA).map(function (o) {
          return '<div class="card out" data-out="' + o.key + '"><span class="label">' + (o.key.indexOf('day') === 0 || o.key.indexOf('topic') === 0 ? 'A1 POSTER' : o.key === 'growth' || o.key === 'guide' ? 'A4' : o.key === 'pamphlet-a4' ? 'A4 BOOKLET' : 'A5') + '</span><h3>' + esc(o.label) + '</h3>' +
            '<div class="row"><button class="btn small" data-act="preview">미리보기</button><button class="btn ghost small" data-act="print">PDF 인쇄</button></div>' +
            '<div class="row"><button class="btn ghost small" data-act="pptx">PPTX</button><button class="btn ghost small" data-act="html">HTML</button>' + (BUT_API.isGAS ? '<button class="btn ghost small" data-act="drive">Drive 저장</button>' : '') + '</div></div>';
        }).join('') + '</div>' +
        '<div class="row" style="margin-top:14px"><button class="btn ghost small" id="csv">Canva 대량 제작용 CSV</button><button class="btn ghost small" id="json">데이터 백업(JSON)</button></div></section>' +
        '<section class="card panel hidden" id="pvPanel"><h2 id="pvTitle">미리보기</h2><div class="preview" id="pv"></div></section>';
      $view.innerHTML = h;
      api('adminStudents').then(function (r) {
        A.students = r.students;
        var sel = document.getElementById('growthWho');
        sel.innerHTML += r.students.map(function (s) { return '<option value="' + esc(s.studentId) + '">' + esc(s.studentId + ' · ' + s.displayName) + '</option>'; }).join('');
      });
      document.querySelectorAll('[data-out]').forEach(function (card) {
        card.querySelectorAll('[data-act]').forEach(function (b) {
          b.addEventListener('click', function () { runOutput(card.dataset.out, b.dataset.act, b); });
        });
      });
      document.getElementById('csv').addEventListener('click', exportCSV);
      document.getElementById('json').addEventListener('click', function () {
        dataset().then(function (ds) { download(new Blob([JSON.stringify(ds, null, 2)], { type: 'application/json' }), 'BUT_TOKYO_2026_데이터.json'); }).catch(fail);
      });
    }).catch(fail);
  }

  function dataset() {
    return api('adminDataset', { approvedOnly: document.getElementById('approvedOnly') && document.getElementById('approvedOnly').checked });
  }

  function buildDoc(key) {
    if (key === 'guide') {
      var url = document.getElementById('appUrl').value.trim() || location.href.split('?')[0];
      var stu = (A.students || []).filter(function (s) { return s.active; }).map(function (s) { return { studentId: s.studentId, displayName: s.displayName, pin: s.pin }; });
      return Promise.resolve({ doc: L.accessGuide(url, stu), key: key });
    }
    return dataset().then(function (ds) {
      var who = document.getElementById('growthWho').value;
      var doc = L.build(key, ds, { studentIds: who ? [who] : null });
      if (key === 'growth' && who) doc.name += '_' + who;
      return { doc: doc, key: key };
    });
  }

  function withPhotos(doc, key) {
    var ids = L.photoIdsOf(doc);
    var max = photoMax(key);
    return loadPhotos(ids).then(function () {
      return Promise.all(ids.map(function (id) { return scaled(id, max); }));
    }).then(function () {
      return function (id) { return A.photos[id + '@' + max] || A.photos[id] || null; };
    });
  }

  function runOutput(key, act, btn) {
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = '준비 중…';
    var done = function () { btn.disabled = false; btn.textContent = label; };
    buildDoc(key).then(function (b) {
      return withPhotos(b.doc, key).then(function (resolve) {
        if (act === 'preview') return preview(b.doc, resolve);
        if (act === 'print') return printDoc(b.doc, resolve);
        if (act === 'html') return download(new Blob([RH.documentHTML(b.doc, resolve)], { type: 'text/html' }), b.doc.name + '.html');
        var pptx = RP.render(b.doc, resolve, window.PptxGenJS);
        if (act === 'pptx') return pptx.write({ outputType: 'blob' }).then(function (blob) { download(blob, b.doc.name + '.pptx'); });
        if (act === 'drive') {
          return pptx.write({ outputType: 'base64' }).then(function (b64) {
            return api('adminSaveOutput', { name: b.doc.name + '.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', base64: b64 }, { retries: 1 });
          }).then(function (r) { toast('Drive에 저장했습니다.'); if (r.url) window.open(r.url, '_blank'); });
        }
      });
    }).then(done).catch(function (e) { done(); fail(e); });
  }

  function preview(doc, resolve) {
    var panel = document.getElementById('pvPanel');
    panel.classList.remove('hidden');
    document.getElementById('pvTitle').innerHTML = esc(doc.name) + ' <span class="muted" style="font-size:13px;font-weight:400">' + doc.pages.length + '쪽 · ' + doc.sizeKey + ' (' + doc.size.w + '×' + doc.size.h + 'mm)</span>';
    var pv = document.getElementById('pv');
    var styleId = 'pv-style';
    var st = document.getElementById(styleId) || document.head.appendChild(Object.assign(document.createElement('style'), { id: styleId }));
    st.textContent = RH.css(doc).replace(/@page[^}]*}/, '');
    var maxW = Math.min(pv.clientWidth - 36, doc.sizeKey === 'A1' ? 760 : 560);
    var pxW = doc.size.w * 3.7795;
    var k = maxW / pxW;
    var limit = 12;
    function draw(n) {
      pv.innerHTML = doc.pages.slice(0, n).map(function (p) {
        return '<div class="pg" style="width:' + Math.round(pxW * k) + 'px;height:' + Math.round(doc.size.h * 3.7795 * k) + 'px;overflow:hidden">' +
          RH.pageHTML(doc, p, resolve).replace('<section class="but-page" style="', '<section class="but-page" style="transform:scale(' + k + ');') + '</div>';
      }).join('') + (doc.pages.length > n ? '<button class="btn" id="more">나머지 ' + (doc.pages.length - n) + '쪽 더 보기</button>' : '');
      var more = document.getElementById('more');
      if (more) more.addEventListener('click', function () { draw(doc.pages.length); });
    }
    draw(limit);
    panel.scrollIntoView({ behavior: 'smooth' });
  }

  function printDoc(doc, resolve) {
    var root = document.getElementById('print-root');
    document.getElementById('print-style').textContent = RH.css(doc);
    root.innerHTML = RH.pagesHTML(doc, resolve);
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    return Promise.all(imgs.map(function (im) { return im.complete ? null : new Promise(function (r) { im.onload = im.onerror = r; }); }))
      .then(function () { return document.fonts ? document.fonts.ready : null; })
      .then(function () {
        toast('인쇄 창에서 ‘PDF로 저장’, 용지 ' + doc.sizeKey + ', 여백 ‘없음’, ‘배경 그래픽’을 선택하세요.', 6000);
        setTimeout(function () {
          window.print();
          setTimeout(function () { root.innerHTML = ''; document.getElementById('print-style').textContent = ''; }, 1500);
        }, 300);
      });
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function exportCSV() {
    dataset().then(function (ds) {
      var head = ['student_label', 'student_id', 'day', 'day_label', 'date', 'theme', 'one_line', 'reflection', 'essay', 'photo1_file', 'photo2_file', 'photo3_file'];
      var rows = ds.entries.map(function (e) {
        var d = BUT_Program.getDay(e.day);
        var files = e.photos.map(function (p) { return e.studentId + '_D' + e.day + '_' + p.id + '_print.jpg'; });
        return [e.displayName, e.studentId, e.day, 'DAY ' + pad2(e.day), d.dateLabel, d.theme, e.oneLine, e.reflection, e.essay, files[0] || '', files[1] || '', files[2] || ''];
      });
      var csv = '﻿' + [head].concat(rows).map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'BUT_TOKYO_2026_Canva_대량제작.csv');
    }).catch(fail);
  }

  // ============================================================ 설정
  function viewSettings() {
    api('adminSettings').then(function (st) {
      A.settings = st;
      var h = '<section class="card panel"><h2>제출 기간 · 마감</h2>' +
        '<div class="kv"><span>제출 가능 날짜</span><select class="select" id="openMode" style="max-width:360px"><option value="all"' + (st.openMode === 'all' ? ' selected' : '') + '>모든 DAY 항상 제출 가능 (테스트·사후 제출)</option><option value="byDate"' + (st.openMode === 'byDate' ? ' selected' : '') + '>해당 날짜(도쿄 시각)부터 제출 가능</option></select>' +
        PROG.days.map(function (d) { return '<span>DAY ' + pad2(d.day) + ' 마감</span><label class="row" style="gap:6px"><input type="checkbox" data-lock="' + d.day + '"' + (st.locks[d.day] ? ' checked' : '') + '> 제출 마감 (학생 수정 불가, 교사 편집은 가능)</label>'; }).join('') +
        '</div><div class="row" style="margin-top:14px"><button class="btn" id="saveSet">저장</button></div></section>';
      h += '<section class="card panel"><h2>학생 접속 주소</h2><div class="kv"><span>주소</span><span class="mono">' + esc(st.appUrl || '(배포 후 표시)') + '</span><span>관리자 주소</span><span class="mono">' + esc((st.appUrl || '') + '?page=admin') + '</span></div>' +
        (st.appUrl ? '<div style="width:160px;margin-top:12px">' + RH.qrSvg(st.appUrl) + '</div>' : '') + '</section>';
      h += '<section class="card panel danger"><h2 style="color:var(--accent)">가상(테스트) 데이터 삭제</h2><p class="muted" style="font-size:14px;margin-top:-4px">실제 학생 사용 전에 테스트 제출물·사진을 모두 지웁니다. 사진 파일은 Drive 휴지통으로 이동합니다(30일 후 영구 삭제).</p>' +
        '<label class="row" style="gap:6px;margin-bottom:10px"><input type="checkbox" id="purgeStudents"> 학생 명단과 PIN도 삭제 (새로 생성 필요)</label>' +
        '<div class="row"><input class="input" id="purgeConfirm" placeholder="DELETE 입력" style="max-width:180px"><button class="btn accent" id="purge">모두 삭제</button></div></section>';
      $view.innerHTML = h;
      document.getElementById('saveSet').addEventListener('click', function () {
        var locks = {};
        document.querySelectorAll('[data-lock]').forEach(function (c) { locks[c.dataset.lock] = c.checked; });
        api('adminSettings', { set: { openMode: document.getElementById('openMode').value, locks: locks } }).then(function () { toast('저장했습니다.'); }).catch(fail);
      });
      document.getElementById('purge').addEventListener('click', function () {
        var c = document.getElementById('purgeConfirm').value.trim();
        if (c !== 'DELETE') { toast('확인 문구로 DELETE를 입력하세요.'); return; }
        if (!confirm('정말 모든 제출물과 사진을 삭제할까요? 되돌릴 수 없습니다.')) return;
        api('adminPurge', { confirm: 'DELETE', students: document.getElementById('purgeStudents').checked }).then(function (r) {
          toast('삭제 완료: 사진 ' + r.deletedPhotos + '장');
          show('overview');
        }).catch(fail);
      });
    }).catch(fail);
  }

  if (A.token) start(); else renderLogin();
})();
