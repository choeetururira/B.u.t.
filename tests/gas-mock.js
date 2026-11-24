/*
 * Apps Script 런타임 모형 — dist/gas/Code.js 를 Node vm에서 그대로 실행해 검증합니다.
 * 실제 Sheets처럼 서식이 '@'(텍스트)가 아니면 "01" → 1, "TRUE" → true 로 자동 변환해
 * 저장 형식 버그(PIN 앞자리 0 사라짐 등)를 잡아냅니다.
 */
const crypto = require('crypto');
const vm = require('vm');
const fs = require('fs');

function signed(buf) { return Array.from(buf).map((b) => (b > 127 ? b - 256 : b)); }
function unsigned(arr) { return Buffer.from(arr.map((b) => (b < 0 ? b + 256 : b))); }

function createGasEnv(opts = {}) {
  const props = {};
  const cache = new Map();
  const files = new Map();
  let idSeq = 0;
  const nextId = (p) => p + (++idSeq).toString(36).padStart(6, '0');
  const logs = [];
  const active = { email: opts.activeUser === undefined ? 'teacher@school.kr' : opts.activeUser };

  // ---------------- Sheets
  function makeSheet(name) {
    const cells = []; // [row][col] = {v, f}
    let maxRows = 1000;
    const sheet = {
      getName: () => name,
      getMaxRows: () => maxRows,
      getLastRow: () => {
        for (let r = cells.length - 1; r >= 0; r--) if (cells[r] && cells[r].some((c) => c && c.v !== '' && c.v !== undefined)) return r + 1;
        return 0;
      },
      setFrozenRows: () => sheet,
      deleteRows: (start, n) => { cells.splice(start - 1, n); },
      getRange: (r, c, nr = 1, nc = 1) => {
        const range = {
          setValues(vals) {
            for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
              cells[r - 1 + i] = cells[r - 1 + i] || [];
              const cell = (cells[r - 1 + i][c - 1 + j] = cells[r - 1 + i][c - 1 + j] || { v: '', f: '' });
              let v = vals[i][j];
              if (cell.f !== '@' && typeof v === 'string') {
                if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
                else if (v === 'TRUE' || v === 'FALSE') v = v === 'TRUE';
              }
              cell.v = v;
            }
            if (r - 1 + nr > maxRows) maxRows = r - 1 + nr;
            return range;
          },
          getValues() {
            const out = [];
            for (let i = 0; i < nr; i++) {
              const row = [];
              for (let j = 0; j < nc; j++) { const cell = cells[r - 1 + i] && cells[r - 1 + i][c - 1 + j]; row.push(cell ? cell.v : ''); }
              out.push(row);
            }
            return out;
          },
          setNumberFormat(f) {
            for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
              cells[r - 1 + i] = cells[r - 1 + i] || [];
              const cell = (cells[r - 1 + i][c - 1 + j] = cells[r - 1 + i][c - 1 + j] || { v: '', f: '' });
              cell.f = f;
            }
            return range;
          },
          setFontWeight: () => range,
          setBackground: () => range
        };
        return range;
      },
      _cells: cells
    };
    return sheet;
  }
  const books = new Map();
  function makeBook(id, title) {
    const sheets = [makeSheet('Sheet1')];
    const book = {
      getId: () => id,
      getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id,
      getName: () => title,
      getSheetByName: (n) => sheets.find((s) => s.getName() === n) || null,
      insertSheet: (n) => { const s = makeSheet(n); sheets.push(s); return s; },
      getSheets: () => sheets.slice(),
      deleteSheet: (s) => { sheets.splice(sheets.indexOf(s), 1); }
    };
    books.set(id, book);
    files.set(id, { id, name: title, mime: 'application/vnd.google-apps.spreadsheet', bytes: Buffer.alloc(0), trashed: false });
    return book;
  }
  const SpreadsheetApp = {
    create: (title) => makeBook(nextId('ss'), title),
    openById: (id) => { const b = books.get(id); if (!b) throw new Error('no spreadsheet ' + id); return b; },
    flush: () => {}
  };

  // ---------------- Drive
  const folders = new Map();
  function makeFolder(name, parent) {
    const id = nextId('fd');
    const children = [];
    const f = {
      getId: () => id, getName: () => name, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      createFolder: (n) => { const c = makeFolder(n, f); children.push(c); return c; },
      getFoldersByName: (n) => { const list = children.filter((c) => c.getName() === n); let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; },
      createFile: (blob) => fileObj(saveFile(blob, id))
    };
    folders.set(id, f);
    return f;
  }
  function saveFile(blob, folderId) {
    const id = nextId('fl');
    files.set(id, { id, name: blob.getName(), mime: blob.getContentType(), bytes: blob._bytes, trashed: false, folderId });
    return id;
  }
  function fileObj(id) {
    const rec = files.get(id);
    if (!rec || rec.trashed) throw new Error('파일 없음: ' + id);
    return {
      getId: () => id, getUrl: () => 'https://drive.google.com/file/d/' + id, getName: () => rec.name,
      getBlob: () => blobOf(rec.bytes, rec.mime, rec.name),
      setTrashed: (t) => { rec.trashed = !!t; },
      moveTo: (folder) => { rec.folderId = folder.getId(); }
    };
  }
  function blobOf(bytes, mime, name) {
    return { _bytes: Buffer.from(bytes), getBytes: () => signed(Buffer.from(bytes)), getContentType: () => mime, getName: () => name };
  }
  const DriveApp = {
    createFolder: (n) => makeFolder(n, null),
    getFolderById: (id) => { const f = folders.get(id); if (!f) throw new Error('폴더 없음'); return f; },
    getFileById: (id) => fileObj(id)
  };

  const Utilities = {
    Charset: { UTF_8: 'utf8' },
    DigestAlgorithm: { SHA_256: 'sha256' },
    newBlob: (bytes, mime, name) => blobOf(unsigned(bytes), mime, name),
    base64Decode: (s) => signed(Buffer.from(s, 'base64')),
    base64Encode: (bytes) => unsigned(bytes).toString('base64'),
    computeHmacSha256Signature: (msg, key) => signed(crypto.createHmac('sha256', key).update(msg, 'utf8').digest()),
    computeDigest: (alg, msg) => signed(crypto.createHash('sha256').update(msg, 'utf8').digest()),
    getUuid: () => crypto.randomUUID()
  };
  const scriptProps = {
    getProperty: (k) => (k in props ? props[k] : null),
    setProperty: (k, v) => { props[k] = String(v); return scriptProps; },
    deleteProperty: (k) => { delete props[k]; return scriptProps; }
  };
  let lockHeld = false;
  const env = {
    SpreadsheetApp, DriveApp, Utilities,
    PropertiesService: { getScriptProperties: () => scriptProps },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, String(v)) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { if (lockHeld) throw new Error('잠금 중첩'); lockHeld = true; }, releaseLock: () => { lockHeld = false; } }) },
    Session: { getActiveUser: () => ({ getEmail: () => active.email }), getEffectiveUser: () => ({ getEmail: () => 'teacher@school.kr' }) },
    Logger: { log: (m) => logs.push(String(m)) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }) },
    HtmlService: {
      createHtmlOutputFromFile: (name) => {
        const out = { _file: name, _title: '', setTitle(t) { out._title = t; return out; }, addMetaTag() { return out; }, getContent: () => opts.htmlFiles ? opts.htmlFiles[name] : '' };
        return out;
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (t) => { const o = { _text: t, setMimeType: () => o, getContent: () => t }; return o; }
    },
    console
  };
  return { env, props, files, books, logs, active, isLocked: () => lockHeld };
}

function loadGas(codePath, opts) {
  const g = createGasEnv(opts);
  const ctx = vm.createContext(Object.assign({}, g.env));
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), ctx, { filename: 'Code.js' });
  return { ctx, ...g };
}

module.exports = { loadGas };
