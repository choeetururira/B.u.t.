/*
 * 로컬 테스트용 저장소: data/db.json + data/files/ (Google Sheets/Drive와 같은 인터페이스)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('../shared/core.js');

function createLocalStorage(dir) {
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const dbFile = path.join(dir, 'db.json');
  let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : {};
  for (const name of Object.keys(Core.SCHEMA)) db[name] = db[name] || [];
  db.__props = db.__props || {};
  const cache = new Map();

  function persist() {
    const tmp = dbFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    fs.renameSync(tmp, dbFile);
  }
  // 시트와 같은 동작을 위해 저장 시 행 인코딩→디코딩을 거친다 (타입 변환 버그를 로컬에서도 잡기 위함)
  const roundTrip = (name, obj) => Core.rowToObj(name, Core.objToRow(name, obj));

  function table(name) {
    if (!Core.SCHEMA[name]) throw new Error('unknown table ' + name);
    return {
      all: () => db[name].map((r) => roundTrip(name, r)),
      insert(obj) {
        db[name].push(roundTrip(name, obj));
        persist();
        return obj;
      },
      update(keyField, keyVal, patch) {
        const i = db[name].findIndex((r) => String(r[keyField]) === String(keyVal));
        if (i < 0) return null;
        db[name][i] = roundTrip(name, Object.assign({}, db[name][i], patch));
        persist();
        return db[name][i];
      },
      clear() {
        db[name] = [];
        persist();
      }
    };
  }

  const files = {
    save(folder, name, mime, base64) {
      const rel = path.join(folder, name);
      const abs = path.join(dir, 'files', rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, Buffer.from(base64, 'base64'));
      fs.writeFileSync(abs + '.mime', mime);
      return rel;
    },
    read(id) {
      const abs = path.join(dir, 'files', id);
      if (!abs.startsWith(path.join(dir, 'files'))) throw new Error('bad path');
      return { base64: fs.readFileSync(abs).toString('base64'), mime: fs.readFileSync(abs + '.mime', 'utf8') };
    },
    path(id) {
      return path.join(dir, 'files', id);
    },
    trash(id) {
      if (!id) return;
      const abs = path.join(dir, 'files', id);
      for (const f of [abs, abs + '.mime']) if (fs.existsSync(f)) fs.unlinkSync(f);
    },
    saveOutput(name, mime, base64) {
      const rel = files.save('outputs', name, mime, base64);
      return { id: rel, url: '/files/' + rel.split(path.sep).join('/') };
    }
  };

  return {
    table,
    files,
    props: {
      get: (k) => db.__props[k] || null,
      set: (k, v) => {
        db.__props[k] = v;
        persist();
      }
    },
    cache: {
      get: (k) => {
        const e = cache.get(k);
        return e && e.exp > Date.now() ? e.v : null;
      },
      put: (k, v, sec) => cache.set(k, { v, exp: Date.now() + sec * 1000 })
    },
    lock: (fn) => fn() // Node 단일 스레드
  };
}

const nodeCrypto = {
  hmacHex: (secret, msg) => crypto.createHmac('sha256', secret).update(msg, 'utf8').digest('hex'),
  sha256Hex: (msg) => crypto.createHash('sha256').update(msg, 'utf8').digest('hex'),
  randomHex: (n) => crypto.randomBytes(n).toString('hex'),
  uuid: () => crypto.randomUUID()
};

module.exports = { createLocalStorage, nodeCrypto };
