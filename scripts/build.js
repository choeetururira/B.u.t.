/*
 * 빌드: src/ → dist/gas/ (Apps Script에 올릴 파일 4개)
 *   node scripts/build.js            → dist/gas/Code.js, Student.html, Admin.html, appsscript.json
 * 로컬 서버(src/local/server.js)도 같은 buildPage()로 화면을 만듭니다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SHARED = ['src/shared/program.js', 'src/shared/layout.js', 'src/shared/render-html.js', 'src/shared/render-pptx.js'];
const VERSIONS = { pptxgenjs: '4.0.1', qrcode: '1.5.0' };

function scriptTag(code) {
  // </script> 문자열이 코드 안에 있으면 HTML이 깨지므로 이스케이프
  return '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>';
}

function buildPage(name, target) {
  const html = read(`src/client/${name}.html`);
  const fontsGoogle =
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&display=swap">';
  const fontsLocal =
    '<link rel="stylesheet" href="fonts/gowun-dodum/index.css"><link rel="stylesheet" href="fonts/gowun-batang/400.css"><link rel="stylesheet" href="fonts/gowun-batang/700.css">';
  const head = target === 'gas' ? fontsGoogle : fontsLocal;

  const libs = [];
  if (name === 'admin') {
    // QR 생성기는 작아서 인라인, PptxGenJS는 CDN(Apps Script) 또는 로컬 vendor
    libs.push(scriptTag(read('node_modules/qrcode-generator/dist/qrcode.js')));
    libs.push(
      target === 'gas'
        ? `<script src="https://cdn.jsdelivr.net/npm/pptxgenjs@${VERSIONS.pptxgenjs}/dist/pptxgen.bundle.js"></script>`
        : '<script src="vendor/pptxgen.bundle.js"></script>'
    );
    SHARED.forEach((f) => libs.push(scriptTag(read(f))));
  } else {
    libs.push(scriptTag(read('src/shared/program.js')));
  }
  libs.push(scriptTag(read('src/client/api.js')));

  // 함수형 치환: 코드 속 '$&', "$'" 같은 문자열이 치환 패턴으로 해석되지 않도록
  const put = (src, marker, value) => src.replace(marker, () => value);
  let out = html;
  out = put(out, '<!--HEAD-->', head);
  out = put(out, '<!--THEME-->', read('src/client/theme.css'));
  out = put(out, '<!--LIBS-->', libs.join('\n'));
  out = put(out, '<!--APP-->', read(`src/client/${name}.js`).replace(/<\/script/gi, '<\\/script'));
  return out;
}

function buildGas(outDir) {
  outDir = outDir || path.join(ROOT, 'dist/gas');
  fs.mkdirSync(outDir, { recursive: true });
  const code = [
    '// 자동 생성 파일입니다. src/ 를 수정한 뒤 `npm run build` 하세요.',
    read('src/shared/program.js'),
    read('src/shared/core.js'),
    read('src/gas/storage-gas.js'),
    read('src/gas/Code.js')
  ].join('\n\n');
  fs.writeFileSync(path.join(outDir, 'Code.js'), code);
  fs.writeFileSync(path.join(outDir, 'Student.html'), buildPage('student', 'gas'));
  fs.writeFileSync(path.join(outDir, 'Admin.html'), buildPage('admin', 'gas'));
  fs.copyFileSync(path.join(ROOT, 'src/gas/appsscript.json'), path.join(outDir, 'appsscript.json'));
  return outDir;
}

if (require.main === module) {
  const out = buildGas(process.argv[2]);
  for (const f of fs.readdirSync(out)) console.log(path.join(out, f), fs.statSync(path.join(out, f)).size + ' bytes');
}

module.exports = { buildPage, buildGas };
