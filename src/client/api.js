/*
 * 서버 호출 어댑터: Apps Script에서는 google.script.run, 로컬 서버에서는 fetch('/api')
 * 네트워크 오류는 자동 재시도, 서버가 돌려준 오류(검증 실패 등)는 그대로 전달
 */
var BUT_API = (function () {
  var isGAS = typeof google !== 'undefined' && google.script && google.script.run;

  function once(action, payload) {
    return new Promise(function (resolve, reject) {
      if (isGAS) {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(function (err) { reject({ network: true, message: String(err && err.message || err) }); })
          .api(action, payload);
      } else {
        fetch('api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, payload: payload }) })
          .then(function (r) { if (!r.ok && r.status >= 500) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(resolve)
          .catch(function (e) { reject({ network: true, message: String(e && e.message || e) }); });
      }
    });
  }

  function call(action, payload, opts) {
    opts = opts || {};
    var tries = opts.retries === undefined ? 2 : opts.retries;
    function attempt(n) {
      return once(action, payload).then(function (res) {
        if (res && res.ok) return res.data;
        var err = (res && res.error) || { code: 'SERVER', message: '알 수 없는 오류' };
        throw err;
      }, function (netErr) {
        if (n < tries) return new Promise(function (r) { setTimeout(r, 1200 * Math.pow(2, n)); }).then(function () { return attempt(n + 1); });
        throw { code: 'NETWORK', message: '인터넷 연결이 불안정합니다. 와이파이/데이터를 확인하고 다시 시도해 주세요.', detail: netErr.message };
      });
    }
    return attempt(0);
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가(사생활 보호 모드) */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
  };

  function toast(msg, ms) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 2600);
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtTime(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  return { call: call, uuid: uuid, store: store, toast: toast, esc: esc, fmtTime: fmtTime, isGAS: !!isGAS };
})();
