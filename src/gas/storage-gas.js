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
