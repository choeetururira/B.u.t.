/*
 * 로컬 테스트 서버 — Apps Script 배포 전에 같은 코드로 전체 흐름을 검증합니다.
 *   npm start            → http://localhost:8080        (학생)
 *                          http://localhost:8080/admin  (관리자)
 * 환경변수: PORT, DATA_DIR(기본 data/local), ADMIN_PASSWORD(기본 test-admin-2026)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createLocalStorage, nodeCrypto } = require('./storage-local.js');
const Core = require('../shared/core.js');
const { buildPage } = require('../../scripts/build.js');

const ROOT = path.join(__dirname, '../..');

function createServer(opts = {}) {
  const dataDir = opts.dataDir || process.env.DATA_DIR || path.join(ROOT, 'data/local');
  const storage = createLocalStorage(dataDir);
  let appUrl = '';
  storage.appUrl = () => appUrl;
  const svc = Core.createService({ storage, crypto: nodeCrypto, now: opts.now });
  if (!storage.props.get('ADMIN_HASH')) svc.setAdminPassword(opts.adminPassword || process.env.ADMIN_PASSWORD || 'test-admin-2026');
  if (opts.seedStudents !== false) svc.generateStudents(opts.students || 20, 1);

  const STATIC = {
    '/vendor/pptxgen.bundle.js': path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js')
  };
  const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
  const pageCache = {};
  const page = (name) => (opts.noCache || !pageCache[name] ? (pageCache[name] = buildPage(name, 'local')) : pageCache[name]);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!appUrl) appUrl = 'http://' + (req.headers.host || 'localhost') + '/';
    const send = (code, type, body) => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    };
    try {
      if (req.method === 'POST' && (url.pathname === '/api' || url.pathname === '/admin/api')) {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
          size += c.length;
          if (size > 60 * 1024 * 1024) req.destroy();
          else chunks.push(c);
        });
        req.on('end', () => {
          let body = {};
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { /* 빈 본문 */ }
          const out = svc.api(String(body.action || ''), body.payload || {});
          send(200, 'application/json; charset=utf-8', JSON.stringify(out));
        });
        return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') return send(200, 'text/html; charset=utf-8', page('student'));
      if (url.pathname === '/admin' || url.pathname === '/admin/') return send(200, 'text/html; charset=utf-8', page('admin'));
      let file = STATIC[url.pathname.replace(/^\/admin/, '')];
      const fm = url.pathname.replace(/^\/admin/, '').match(/^\/fonts\/(gowun-dodum|gowun-batang)\/([\w.-]+(?:\/[\w.-]+)?)$/);
      if (fm) file = path.join(ROOT, 'node_modules/@fontsource', fm[1], fm[2]);
      if (file && fs.existsSync(file)) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
        return fs.createReadStream(file).pipe(res);
      }
      send(404, 'text/plain; charset=utf-8', 'not found');
    } catch (e) {
      send(500, 'text/plain; charset=utf-8', 'server error');
    }
  });
  return { server, svc, storage, dataDir };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  const { server, dataDir } = createServer();
  server.listen(port, () => {
    console.log(`B.U.T. 로컬 서버: http://localhost:${port}  (관리자: /admin, 비밀번호: ${process.env.ADMIN_PASSWORD || 'test-admin-2026'})`);
    console.log(`데이터 폴더: ${dataDir}`);
  });
}

module.exports = { createServer };
