/*
 * 문서 모델 → HTML (미리보기 · 브라우저 인쇄 · Playwright PDF)
 * resolve(photoId) → 이미지 src(data URL 또는 URL) | null
 */
var BUT_RenderHTML = (function () {
  var P = typeof BUT_Program !== 'undefined' ? BUT_Program : require('./program.js');
  var QR = typeof qrcode !== 'undefined' ? qrcode : (typeof require !== 'undefined' ? require('qrcode-generator') : null);
  var F = P.program.design.fonts;
  var FONT = {
    title: "'" + F.title + "', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
    body: "'" + F.body + "', 'AppleMyungjo', 'Batang', serif"
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function n(v) { return Math.round(v * 1000) / 1000; }
  function box(e) { return 'left:' + n(e.x) + 'mm;top:' + n(e.y) + 'mm;width:' + n(e.w) + 'mm;height:' + n(e.h) + 'mm;'; }
  function rot(e) { return e.rot ? 'transform:rotate(' + e.rot + 'deg);' : ''; }

  function qrSvg(data) {
    if (!QR) return '';
    var q = QR(0, 'M');
    q.addData(String(data));
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  function el(e, resolve) {
    switch (e.t) {
      case 'rect':
      case 'ellipse':
        return '<div class="e" style="' + box(e) + rot(e) +
          (e.fill ? 'background:' + e.fill + ';' : '') +
          (e.stroke && e.sw ? 'border:' + n(e.sw) + 'mm solid ' + e.stroke + ';' : '') +
          'border-radius:' + (e.t === 'ellipse' ? '50%' : n(e.r) + 'mm') + ';' +
          (e.op < 1 ? 'opacity:' + e.op + ';' : '') + '"></div>';
      case 'line': {
        // 높이 0인 SVG는 그려지지 않으므로 선 굵기만큼 여백을 둔 상자에 그린다
        var pad = Math.max(e.sw, 0.2);
        var x = Math.min(e.x1, e.x2) - pad, y = Math.min(e.y1, e.y2) - pad;
        var w = Math.abs(e.x2 - e.x1) + pad * 2, h = Math.abs(e.y2 - e.y1) + pad * 2;
        return '<svg class="e" style="left:' + n(x) + 'mm;top:' + n(y) + 'mm;width:' + n(w) + 'mm;height:' + n(h) + 'mm;overflow:visible" viewBox="0 0 ' + n(w) + ' ' + n(h) + '" preserveAspectRatio="none">' +
          '<line x1="' + n(e.x1 - x) + '" y1="' + n(e.y1 - y) + '" x2="' + n(e.x2 - x) + '" y2="' + n(e.y2 - y) + '" stroke="' + e.color + '" stroke-width="' + n(e.sw) + '"' +
          (e.dash ? ' stroke-dasharray="' + n(e.sw * 4) + ' ' + n(e.sw * 3) + '"' : '') + ' vector-effect="none"/></svg>';
      }
      case 'text': {
        var jc = e.valign === 'middle' ? 'center' : e.valign === 'bottom' ? 'flex-end' : 'flex-start';
        return '<div class="e t" style="' + box(e) + rot(e) + 'justify-content:' + jc + ';text-align:' + e.align + ';' +
          'font-family:' + FONT[e.font === 'body' ? 'body' : 'title'] + ';font-size:' + e.pt + 'pt;line-height:' + e.lh + ';' +
          'color:' + e.color + ';' + (e.bold ? 'font-weight:700;' : '') + (e.ls ? 'letter-spacing:' + n(e.ls) + 'pt;' : '') +
          '"><span>' + esc(e.text) + '</span></div>';
      }
      case 'img': {
        var src = resolve ? resolve(e.src) : null;
        return '<div class="e" style="' + box(e) + 'border-radius:' + n(e.r) + 'mm;overflow:hidden;background:' + P.program.design.paperDeep + ';">' +
          (src ? '<img src="' + esc(src) + '" alt="">' : '') + '</div>';
      }
      case 'qr':
        return '<div class="e qr" style="' + box(e) + '">' + qrSvg(e.data) + '</div>';
    }
    return '';
  }

  function pageHTML(doc, page, resolve) {
    return '<section class="but-page" style="width:' + doc.size.w + 'mm;height:' + doc.size.h + 'mm;background:' + page.bg + ';">' +
      page.els.map(function (e) { return el(e, resolve); }).join('') + '</section>';
  }

  function css(doc) {
    return [
      '@page{size:' + doc.size.w + 'mm ' + doc.size.h + 'mm;margin:0}',
      '.but-page{position:relative;overflow:hidden;box-sizing:border-box;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.but-page:last-child{break-after:auto;page-break-after:auto}',
      '.but-page .e{position:absolute;box-sizing:border-box;margin:0}',
      '.but-page .t{display:flex;flex-direction:column;white-space:pre;overflow:visible;word-break:keep-all}',
      '.but-page img{width:100%;height:100%;object-fit:cover;display:block}',
      '.but-page .qr svg{width:100%;height:100%;display:block}'
    ].join('\n');
  }

  function pagesHTML(doc, resolve) {
    return doc.pages.map(function (p) { return pageHTML(doc, p, resolve); }).join('\n');
  }

  // 단독 HTML 문서 (편집 가능한 원본 · 인쇄용)
  function documentHTML(doc, resolve, fontCss) {
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(doc.name) + '</title>' +
      (fontCss || '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Gowun+Dodum&display=swap">') +
      '<style>html,body{margin:0;padding:0;background:#fff}' + css(doc) + '</style></head><body>' + pagesHTML(doc, resolve) + '</body></html>';
  }

  return { css: css, pagesHTML: pagesHTML, pageHTML: pageHTML, documentHTML: documentHTML, qrSvg: qrSvg };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BUT_RenderHTML;
