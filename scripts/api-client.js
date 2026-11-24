/* Node용 API 클라이언트: 로컬 서버(/api) 또는 Apps Script 웹앱(exec)에 JSON POST */
async function call(base, action, payload, tries = 3) {
  const url = /\/exec(\?.*)?$/.test(base) ? base : base.replace(/\/?$/, '/') + 'api';
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
        redirect: 'follow'
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (e) { throw new Error('JSON 아님 (' + res.status + '): ' + text.slice(0, 200)); }
      if (!json.ok) {
        const err = new Error(json.error.message);
        err.code = json.error.code;
        err.extra = json.error.extra;
        err.api = true;
        throw err;
      }
      return json.data;
    } catch (e) {
      if (e.api || i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

function args(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const m = argv[i].match(/^--([\w-]+)(?:=(.*))?$/);
    if (m) o[m[1]] = m[2] !== undefined ? m[2] : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

module.exports = { call, args };
