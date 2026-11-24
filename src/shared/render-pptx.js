/*
 * 문서 모델 → PPTX (편집 가능한 원본: PowerPoint · Keynote · Google Slides · Canva 가져오기)
 * resolve(photoId) → 'data:image/jpeg;base64,...' | null
 * PptxGenJS: 브라우저는 전역 PptxGenJS, Node는 require('pptxgenjs')
 */
var BUT_RenderPPTX = (function () {
  var P = typeof BUT_Program !== 'undefined' ? BUT_Program : require('./program.js');
  var QR = typeof qrcode !== 'undefined' ? qrcode : (typeof require !== 'undefined' ? require('qrcode-generator') : null);
  var F = P.program.design.fonts;
  var IN = 1 / 25.4;
  function c(hex) { return String(hex || '#000000').replace('#', '').toUpperCase(); }
  function i(mm) { return Math.round(mm * IN * 10000) / 10000; }
  function pt(mm) { return Math.round((mm / 0.3528) * 100) / 100; }

  function qrRects(slide, pptx, e) {
    if (!QR) return;
    var q = QR(0, 'M');
    q.addData(String(e.data));
    q.make();
    var count = q.getModuleCount();
    var cell = e.w / count;
    for (var r = 0; r < count; r++) {
      var run = -1;
      for (var col = 0; col <= count; col++) {
        var dark = col < count && q.isDark(r, col);
        if (dark && run < 0) run = col;
        if (!dark && run >= 0) {
          slide.addShape(pptx.ShapeType.rect, { x: i(e.x + run * cell), y: i(e.y + r * cell), w: i((col - run) * cell), h: i(cell), fill: { color: '000000' }, line: { type: 'none' } });
          run = -1;
        }
      }
    }
  }

  function render(doc, resolve, PptxGenJS) {
    var Ctor = PptxGenJS || (typeof window !== 'undefined' && window.PptxGenJS) || require('pptxgenjs');
    var pptx = new Ctor();
    var layoutName = 'BUT_' + doc.sizeKey;
    pptx.defineLayout({ name: layoutName, width: i(doc.size.w), height: i(doc.size.h) });
    pptx.layout = layoutName;
    pptx.title = doc.name;
    pptx.company = P.program.schoolName;
    pptx.subject = P.program.brand;

    doc.pages.forEach(function (page) {
      var slide = pptx.addSlide();
      slide.background = { color: c(page.bg) };
      page.els.forEach(function (e) {
        switch (e.t) {
          case 'rect':
          case 'ellipse': {
            var o = { x: i(e.x), y: i(e.y), w: i(e.w), h: i(e.h), rotate: e.rot || 0 };
            if (e.fill) o.fill = { color: c(e.fill), transparency: Math.round((1 - (e.op === undefined ? 1 : e.op)) * 100) };
            o.line = e.stroke && e.sw ? { color: c(e.stroke), width: pt(e.sw) } : { type: 'none' };
            var shape = e.t === 'ellipse' ? pptx.ShapeType.ellipse : e.r ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
            if (e.t === 'rect' && e.r) o.rectRadius = i(e.r);
            slide.addShape(shape, o);
            break;
          }
          case 'line': {
            slide.addShape(pptx.ShapeType.line, {
              x: i(Math.min(e.x1, e.x2)), y: i(Math.min(e.y1, e.y2)),
              w: i(Math.abs(e.x2 - e.x1)), h: i(Math.abs(e.y2 - e.y1)),
              line: { color: c(e.color), width: pt(e.sw), dashType: e.dash ? 'dash' : 'solid' }
            });
            break;
          }
          case 'text': {
            slide.addText(e.text, {
              x: i(e.x), y: i(e.y), w: i(e.w), h: i(e.h), margin: 0,
              fontFace: e.font === 'body' ? F.body : F.title, fontSize: e.pt, bold: !!e.bold,
              color: c(e.color), align: e.align, valign: e.valign === 'middle' ? 'middle' : e.valign === 'bottom' ? 'bottom' : 'top',
              lineSpacing: Math.round(e.pt * e.lh * 100) / 100, charSpacing: e.ls || 0, rotate: e.rot || 0,
              fit: 'none', wrap: true, lang: 'ko-KR'
            });
            break;
          }
          case 'img': {
            var src = resolve ? resolve(e.src) : null;
            if (!src) {
              slide.addShape(pptx.ShapeType.rect, { x: i(e.x), y: i(e.y), w: i(e.w), h: i(e.h), fill: { color: c(P.program.design.paperDeep) }, line: { type: 'none' } });
              break;
            }
            var data = src.replace(/^data:/, '');
            slide.addImage({
              data: data, x: i(e.x), y: i(e.y), w: i(e.w), h: i((e.w * e.ih) / e.iw),
              sizing: { type: 'cover', w: i(e.w), h: i(e.h) }
            });
            break;
          }
          case 'qr':
            qrRects(slide, pptx, e);
            break;
        }
      });
    });
    return pptx;
  }

  return { render: render };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BUT_RenderPPTX;
