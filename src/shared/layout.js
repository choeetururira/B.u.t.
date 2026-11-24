/*
 * B.U.T. TOKYO 2026 — 결과물 레이아웃 엔진
 * 데이터셋(core.buildDataset) → 문서 모델(페이지·요소 좌표 mm) → HTML/PDF · PPTX 렌더러
 * 줄바꿈과 글자 크기를 여기서 계산하므로 HTML·PDF·PPTX의 배치가 같습니다.
 *
 * 문서 모델: { name, size:{w,h}(mm), pages:[{ bg, els:[요소...] }] }
 *  rect  {t:'rect', x,y,w,h, fill, stroke, sw, r, op, rot}
 *  ellipse {t:'ellipse', x,y,w,h, fill, stroke, sw, rot}
 *  line  {t:'line', x1,y1,x2,y2, color, sw, dash}
 *  text  {t:'text', x,y,w,h, text(줄바꿈 포함), pt, font, color, bold, align, valign, lh, ls, rot}
 *  img   {t:'img', x,y,w,h, src(사진ID), iw, ih, r}
 *  qr    {t:'qr', x,y,w,h, data}
 */
var BUT_Layout = (function () {
  var P = typeof BUT_Program !== 'undefined' ? BUT_Program : require('./program.js');
  var program = P.program;
  var D = program.design;
  var PT = 0.3528; // 1pt = 0.3528mm

  var SIZES = {
    A1: { w: 594, h: 841 },
    A4: { w: 210, h: 297 },
    A5: { w: 148, h: 210 }
  };

  // ------------------------------------------------------------ 글자 폭 추정 (Gowun Dodum/Batang 실측 + 여유)
  function charEm(ch) {
    var c = ch.charCodeAt(0);
    if (c === 32 || c === 160) return 0.33;
    if (c >= 0x1100 && c <= 0x11ff) return 0.92;
    if (c >= 0x3000 && c <= 0x9fff) return 0.94;
    if (c >= 0xac00 && c <= 0xd7af) return 0.92;
    if (c >= 0xff00 && c <= 0xffef) return 0.94;
    if (c >= 48 && c <= 57) return 0.56;
    if (c >= 65 && c <= 90) return 0.68;
    if (c >= 97 && c <= 122) return 0.52;
    if (c < 128) return 0.42;
    if (c >= 0x2460 && c <= 0x24ff) return 0.95; // ①
    return 0.95; // 이모지 등
  }
  function textWidth(s, pt, ls) {
    var em = 0, n = 0;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) { em += 1.1; i++; n++; continue; } // 서로게이트(이모지)
      em += charEm(s[i]);
      n++;
    }
    return em * pt * PT + n * (ls || 0) * PT;
  }

  function wrap(text, width, pt, ls) {
    var out = [];
    String(text || '').split('\n').forEach(function (para) {
      var tokens = para.split(/(\s+)/);
      var line = '';
      tokens.forEach(function (tok) {
        if (tok === '') return;
        if (/^\s+$/.test(tok)) {
          if (line) line += ' ';
          return;
        }
        var cand = line + tok;
        if (textWidth(cand, pt, ls) <= width) { line = cand; return; }
        if (line.trim()) { out.push(line.replace(/\s+$/, '')); line = ''; }
        // 단어가 한 줄보다 길면 글자 단위로 자름
        var chars = Array.from(tok);
        chars.forEach(function (ch) {
          if (textWidth(line + ch, pt, ls) > width && line) { out.push(line); line = ''; }
          line += ch;
        });
      });
      out.push(line.replace(/\s+$/, ''));
    });
    return out;
  }

  function ellipsize(line, width, pt, ls) {
    var chars = Array.from(line);
    while (chars.length && textWidth(chars.join('') + '…', pt, ls) > width) chars.pop();
    return chars.join('').replace(/[\s,.]+$/, '') + '…';
  }

  // 상자(w×h mm)에 맞는 가장 큰 글자 크기를 찾고 줄바꿈된 텍스트를 반환
  function fit(text, w, h, o) {
    var max = o.pt, min = o.min || o.pt, lh = o.lh || 1.4, ls = o.ls || 0;
    var maxLines = o.maxLines || 999;
    for (var pt = max; pt >= min - 0.001; pt -= Math.max(0.5, max / 40)) {
      var lines = wrap(text, w, pt, ls);
      var lineH = pt * PT * lh;
      if (lines.length <= maxLines && lines.length * lineH <= h + 0.01) return { pt: round(pt), lines: lines };
    }
    var lines2 = wrap(text, w, min, ls);
    var cap = Math.max(1, Math.min(maxLines, Math.floor((h + 0.01) / (min * PT * lh))));
    if (lines2.length > cap) {
      lines2 = lines2.slice(0, cap);
      lines2[cap - 1] = ellipsize(lines2[cap - 1], w, min, ls);
    }
    return { pt: round(min), lines: lines2, truncated: true };
  }
  function round(v) { return Math.round(v * 100) / 100; }

  // ------------------------------------------------------------ 페이지 빌더 (scale: A5 기준 좌표를 A4로 키울 때 사용)
  function Page(doc, bg, scale) {
    this.doc = doc;
    this.s = scale || 1;
    this.els = [];
    this.bg = bg || D.paper;
    doc.pages.push(this);
  }
  Page.prototype.rect = function (x, y, w, h, o) {
    o = o || {};
    var s = this.s;
    this.els.push({ t: 'rect', x: x * s, y: y * s, w: w * s, h: h * s, fill: o.fill || null, stroke: o.stroke || null, sw: (o.sw || 0) * s, r: (o.r || 0) * s, op: o.op === undefined ? 1 : o.op, rot: o.rot || 0 });
    return this;
  };
  Page.prototype.ellipse = function (x, y, w, h, o) {
    o = o || {};
    var s = this.s;
    this.els.push({ t: 'ellipse', x: x * s, y: y * s, w: w * s, h: h * s, fill: o.fill || null, stroke: o.stroke || null, sw: (o.sw || 0) * s, op: o.op === undefined ? 1 : o.op, rot: o.rot || 0 });
    return this;
  };
  Page.prototype.line = function (x1, y1, x2, y2, o) {
    o = o || {};
    var s = this.s;
    this.els.push({ t: 'line', x1: x1 * s, y1: y1 * s, x2: x2 * s, y2: y2 * s, color: o.color || D.line, sw: (o.sw || 0.3) * s, dash: !!o.dash });
    return this;
  };
  // text: o = {pt, min, font, color, bold, align, valign, lh, ls, maxLines, rot}
  Page.prototype.text = function (x, y, w, h, text, o) {
    o = o || {};
    var s = this.s;
    var lh = o.lh || 1.35;
    var r = fit(text, w * s, h * s, { pt: o.pt * s, min: (o.min || o.pt) * s, lh: lh, ls: (o.ls || 0) * s, maxLines: o.maxLines });
    this.els.push({
      t: 'text', x: x * s, y: y * s, w: w * s, h: h * s, text: r.lines.join('\n'), pt: r.pt,
      font: o.font || 'title', color: o.color || D.ink, bold: !!o.bold, align: o.align || 'left',
      valign: o.valign || 'top', lh: lh, ls: (o.ls || 0) * s, rot: o.rot || 0
    });
    return r;
  };
  Page.prototype.img = function (x, y, w, h, photo, o) {
    o = o || {};
    var s = this.s;
    if (!photo) return this.placeholder(x, y, w, h, o);
    this.els.push({ t: 'img', x: x * s, y: y * s, w: w * s, h: h * s, src: photo.id, iw: photo.w || 4, ih: photo.h || 3, r: (o.r || 0) * s });
    return this;
  };
  Page.prototype.placeholder = function (x, y, w, h, o) {
    o = o || {};
    this.rect(x, y, w, h, { fill: D.paperDeep, r: o.r || 0 });
    this.text(x, y + h / 2 - 4, w, 8, o.label || 'B.U.T.', { pt: Math.min(14, Math.max(6, h / 6)), color: D.sage, align: 'center', valign: 'middle', ls: 2 });
    return this;
  };
  Page.prototype.qr = function (x, y, w, data) {
    var s = this.s;
    this.els.push({ t: 'qr', x: x * s, y: y * s, w: w * s, h: w * s, data: data });
    return this;
  };
  Page.prototype.toJSON = function () { return { bg: this.bg, els: this.els }; };

  function newDoc(name, sizeKey) {
    return { name: name, sizeKey: sizeKey, size: SIZES[sizeKey], pages: [] };
  }
  function finalize(doc) {
    return { name: doc.name, sizeKey: doc.sizeKey, size: doc.size, pages: doc.pages.map(function (p) { return p.toJSON(); }) };
  }

  // ------------------------------------------------------------ 데이터 헬퍼
  function byDay(ds, day) { return ds.entries.filter(function (e) { return e.day === day; }); }
  function photoIndex(ds) {
    var m = {};
    ds.entries.forEach(function (e) { e.photos.forEach(function (p) { m[p.id] = { photo: p, entry: e }; }); });
    return m;
  }
  function featured(e) {
    if (!e || !e.photos.length) return null;
    for (var i = 0; i < e.photos.length; i++) if (e.photos[i].id === e.featuredPhotoId) return e.photos[i];
    return e.photos[0];
  }
  function dayHero(ds, day) {
    var idx = photoIndex(ds);
    var h = ds.heroes && ds.heroes[day];
    if (h && idx[h] && idx[h].entry.day === day) return idx[h];
    var list = byDay(ds, day);
    for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].photos.length; j++) if (list[i].photos[j].exhibit) return { photo: list[i].photos[j], entry: list[i] };
    for (var k = 0; k < list.length; k++) if (featured(list[k])) return { photo: featured(list[k]), entry: list[k] };
    return null;
  }
  function sentences(text) {
    return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?。~])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function excerpt(text, keywords, max) {
    // 주제어가 들어간 문장(없으면 첫 문장)부터 max 글자 안에서 이어지는 문장을 함께 인용
    var ss = sentences(text);
    var start = -1;
    if (keywords) {
      for (var i = 0; i < ss.length && start < 0; i++) {
        for (var k = 0; k < keywords.length; k++) if (ss[i].indexOf(keywords[k]) >= 0 && Array.from(ss[i]).length >= 15) { start = i; break; }
      }
    }
    if (start < 0) for (var j = 0; j < ss.length && start < 0; j++) if (Array.from(ss[j]).length >= 15) start = j;
    if (start < 0) start = 0;
    var pick = ss[start] || '';
    for (var n = start + 1; n < ss.length; n++) {
      if (Array.from(pick + ' ' + ss[n]).length > max) break;
      pick += ' ' + ss[n];
    }
    var chars = Array.from(pick);
    if (chars.length > max) pick = chars.slice(0, max - 1).join('').replace(/\s+\S*$/, '') + '…';
    return pick;
  }
  function meta(e) {
    var d = P.getDay(e.day);
    return e.displayName + ' / ' + d.dateLabel;
  }
  function topicOf(key) {
    for (var i = 0; i < program.topics.length; i++) if (program.topics[i].key === key) return program.topics[i];
    return null;
  }

  // ------------------------------------------------------------ 공통 장식
  function frame(pg, W, H, inset, label, right) {
    pg.rect(inset, inset, W - inset * 2, H - inset * 2, { stroke: D.line, sw: 0.35 });
    return pg;
  }
  function stamp(pg, x, y, d, text, color, rot) {
    pg.ellipse(x, y, d, d, { fill: D.paper, stroke: color, sw: d * 0.03, rot: rot || 0 });
    pg.ellipse(x + d * 0.08, y + d * 0.08, d * 0.84, d * 0.84, { stroke: color, sw: d * 0.008, rot: rot || 0 });
    var n = Array.from(text).length;
    var pt = (d * (n > 1 ? 0.62 / n : 0.55)) / PT / 0.92;
    pg.text(x, y + d / 2 - (pt * PT * 1.1) / 2, d, pt * PT * 1.15, text, { pt: pt, color: color, bold: true, align: 'center', valign: 'middle', lh: 1.1, rot: rot || 0 });
  }
  function washi(pg, x, y, w, h, color, rot) {
    pg.rect(x, y, w, h, { fill: color, op: 0.55, rot: rot || 0 });
  }
  function decoLines(pg, x, y, w, gap, color) {
    pg.line(x, y, x + w, y, { color: color || D.line, sw: 0.5 });
    pg.line(x, y + gap, x + w, y + gap, { color: color || D.line, sw: 0.5 });
    pg.line(x, y + gap * 2, x + w * 0.62, y + gap * 2, { color: color || D.line, sw: 0.5 });
  }

  // 예시 이미지(Canva 카드)와 같은 구성의 기록 카드. 기준 크기 98×103mm, k배로 확대/축소
  function recordCard(pg, x, y, w, h, e, o) {
    o = o || {};
    var d = P.getDay(e.day);
    var k = h / 103;
    var pad = 6 * k;
    pg.rect(x, y, w, h, { fill: D.card, stroke: D.line, sw: 0.3 * k, r: 3.5 * k });
    pg.text(x + pad, y + 4.5 * k, w - pad * 2, 4.5 * k, program.brand, { pt: 9 * k, color: D.inkSoft, ls: 0.8 * k });
    if (o.showDay) pg.text(x + pad, y + 9.5 * k, w - pad * 2, 9 * k, P.dayLabel(e.day), { pt: 20 * k, bold: true, color: D.ink });
    var py = y + (o.showDay ? 20 : 11) * k;
    var ph = (o.showDay ? 47 : 52) * k;
    pg.img(x + pad, py, w - pad * 2, ph, featured(e), { r: 3.5 * k, label: '사진 비공개' });
    pg.text(x + pad, py + ph + 3.5 * k, w - pad * 2, 17 * k, e.oneLine, { pt: 17 * k, min: 11 * k, bold: true, lh: 1.32, maxLines: 2, color: D.ink });
    pg.text(x + pad, y + 86 * k, w - pad * 2, 5 * k, meta(e), { pt: 11 * k, color: D.inkSoft, ls: 0.4 * k });
    decoLines(pg, x + pad, y + 93.5 * k, w - pad * 2, 2.6 * k, D.line);
  }

  function topBar(pg, W, m, y, pt, right) {
    pg.text(m, y, W / 2, pt * PT * 1.4, program.brand, { pt: pt, color: D.ink, ls: pt * 0.15, bold: true });
    pg.text(W / 2, y, W / 2 - m, pt * PT * 1.4, right || program.brandFull.toUpperCase(), { pt: pt * 0.75, color: D.inkSoft, ls: pt * 0.12, align: 'right', valign: 'middle' });
    pg.line(m, y + pt * PT * 1.9, W - m, y + pt * PT * 1.9, { color: D.ink, sw: pt * 0.02 });
  }
  function footer(pg, W, H, m, left, right, pt) {
    var y = H - m - pt * PT * 1.5;
    pg.line(m, y - 3, W - m, y - 3, { color: D.line, sw: 0.4 });
    pg.text(m, y, W * 0.65, pt * PT * 1.5, left, { pt: pt, color: D.inkSoft });
    pg.text(W * 0.5, y, W * 0.5 - m, pt * PT * 1.5, right, { pt: pt, color: D.inkSoft, align: 'right' });
  }
  function chips(pg, x, y, maxW, items, pt, color) {
    var cx = x, h = pt * PT * 1.9;
    items.forEach(function (it) {
      var w = textWidth(it, pt, 0) + pt * PT * 1.8;
      if (cx + w > x + maxW) return;
      pg.rect(cx, y, w, h, { stroke: color, sw: pt * 0.012, r: h / 2 });
      pg.text(cx, y + (h - pt * PT * 1.3) / 2, w, pt * PT * 1.3, it, { pt: pt, color: color, align: 'center', lh: 1.25 });
      cx += w + pt * PT * 0.8;
    });
  }

  // ============================================================ 1. 날짜별 A1 포스터
  function dayPoster(ds, day) {
    var d = P.getDay(day);
    var doc = newDoc('DAY' + P.pad2(day) + '_A1_포스터', 'A1');
    var W = 594, H = 841, m = 34;
    var pg = new Page(doc, D.paper);
    frame(pg, W, H, 14);
    topBar(pg, W, m, 26, 22, program.title + '  ·  ' + program.brandFull.toUpperCase());

    // 왼쪽 머리글
    var lx = m, lw = 300;
    pg.text(lx, 56, lw, 16, 'DAY', { pt: 40, bold: true, color: d.color, ls: 8 });
    pg.text(lx - 3, 66, lw, 86, P.pad2(day), { pt: 230, bold: true, color: d.color, lh: 1.05 });
    pg.text(lx, 156, lw, 12, '2026. ' + d.dateLabel.replace('.', '. ') + '  ' + d.weekdayEn + '  ·  ' + d.weekday + '요일', { pt: 26, color: D.inkSoft, ls: 2 });
    pg.text(lx, 173, lw, 30, d.theme, { pt: 64, min: 40, bold: true, color: D.ink, lh: 1.15, maxLines: 1 });
    pg.text(lx, 203, lw, 14, d.themeSub, { pt: 32, color: D.inkSoft });
    chips(pg, lx, 222, lw, d.places, 22, d.color);

    pg.rect(lx, 244, lw, 62, { fill: D.card, stroke: D.line, sw: 0.4, r: 4 });
    pg.text(lx + 9, 250, 100, 8, 'MISSION', { pt: 17, bold: true, color: d.color, ls: 4 });
    pg.text(lx + 9, 261, lw - 18, 20, '①  ' + d.missions[0], { pt: 24, min: 18, color: D.ink, lh: 1.3, maxLines: 2 });
    pg.text(lx + 9, 282, lw - 18, 20, '②  ' + d.missions[1], { pt: 24, min: 18, color: D.ink, lh: 1.3, maxLines: 2 });

    pg.text(lx, 313, 120, 8, '성찰 질문  REFLECTION', { pt: 16, bold: true, color: d.color, ls: 2 });
    pg.text(lx, 322, lw, 24, d.question, { pt: 25, min: 18, font: 'body', color: D.ink, lh: 1.4 });

    // 오른쪽 대표 사진
    var hx = 354, hw = W - m - hx, hy = 58, hh = 270;
    var hero = dayHero(ds, day);
    pg.img(hx, hy, hw, hh, hero && hero.photo, { r: 6, label: 'DAY ' + P.pad2(day) });
    washi(pg, hx + hw / 2 - 34, hy - 7, 68, 14, d.color, -4);
    stamp(pg, hx + hw - 36, hy + hh - 36, 50, '벗', D.accent, -8);
    if (hero) pg.text(hx, hy + hh + 3, hw - 40, 7, (hero.photo.caption ? hero.photo.caption + '  ·  ' : '') + 'photo by ' + hero.entry.displayName, { pt: 14, color: D.inkSoft, align: 'right' });

    // 학생 기록 그리드
    var entries = byDay(ds, day);
    var gy = 356, gh = 436, gx = m, gw = W - m * 2;
    var cols = 5, gap = 8;
    var rows = Math.max(1, Math.ceil(entries.length / cols));
    if (rows > 4) { cols = 6; rows = Math.ceil(entries.length / cols); }
    var cw = (gw - gap * (cols - 1)) / cols;
    var ch = Math.min(103 * (cw / 98.8), (gh - gap * (rows - 1)) / rows);
    cw = Math.min(cw, ch * (98.8 / 103));
    var offX = gx + (gw - (cw * cols + gap * (cols - 1))) / 2;
    entries.forEach(function (e, i) {
      var c = i % cols, r = Math.floor(i / cols);
      recordCard(pg, offX + c * (cw + gap), gy + r * (ch + gap), cw, ch, e);
    });
    if (!entries.length) pg.text(gx, gy + 150, gw, 20, '아직 제출된 기록이 없습니다.', { pt: 36, color: D.sage, align: 'center' });

    footer(pg, W, H, m, program.schoolName + '  ·  ' + program.subtitle, 'DAY ' + P.pad2(day) + ' / 04  ·  학생 기록 ' + entries.length + '편', 15);
    return finalize(doc);
  }

  // ============================================================ 2. 주제별 A1 포스터
  function pickForTopic(ds, key, n) {
    var list = ds.entries.filter(function (e) { return e.topics.indexOf(key) >= 0; });
    list.sort(function (a, b) {
      var sa = (a.photos.some(function (p) { return p.exhibit; }) ? 4 : 0) + (a.reviewStatus === 'approved' ? 2 : 0) + (featured(a) ? 1 : 0) + Math.min(Array.from(a.essay).length / 1000, 1);
      var sb = (b.photos.some(function (p) { return p.exhibit; }) ? 4 : 0) + (b.reviewStatus === 'approved' ? 2 : 0) + (featured(b) ? 1 : 0) + Math.min(Array.from(b.essay).length / 1000, 1);
      return sb - sa;
    });
    // 학생이 겹치지 않도록 우선 선택
    var used = {}, out = [], rest = [];
    list.forEach(function (e) { if (!used[e.studentId]) { used[e.studentId] = 1; out.push(e); } else rest.push(e); });
    return { picked: out.concat(rest).slice(0, n), total: list.length, students: Object.keys(used).length };
  }

  function topicPoster(ds, key) {
    var t = topicOf(key);
    var doc = newDoc('주제_' + t.title + '_A1_포스터', 'A1');
    var W = 594, H = 841, m = 34;
    var pg = new Page(doc, D.paper);
    frame(pg, W, H, 14);
    topBar(pg, W, m, 26, 22, '주제로 읽는 도쿄  ·  ' + program.title);
    var sel = pickForTopic(ds, key, 10);

    stamp(pg, m, 58, 112, t.title, t.color, -6);
    var tx = m + 132, tw = W - m - tx;
    pg.text(tx, 62, tw, 12, 'THEME  ·  ' + t.en, { pt: 26, color: t.color, ls: 6, bold: true });
    pg.text(tx, 76, tw, 36, t.title + '의 순간들', { pt: 84, min: 56, bold: true, color: D.ink, lh: 1.15, maxLines: 1 });
    pg.text(tx, 116, tw, 30, t.desc, { pt: 30, min: 22, font: 'body', color: D.ink, lh: 1.4 });
    pg.text(tx, 152, tw, 10, 'DAY 01–04  ·  학생 ' + sel.students + '명의 기록 ' + sel.total + '편에서', { pt: 20, color: D.inkSoft, ls: 1 });

    var heroE = sel.picked[0];
    var y0 = 186;
    if (heroE) {
      pg.img(m, y0, 330, 246, featured(heroE), { r: 6, label: t.en });
      washi(pg, m + 18, y0 - 6, 70, 13, t.color, -5);
      var qx = m + 348, qw = W - m - qx;
      pg.text(qx, y0 - 6, 60, 60, '“', { pt: 160, color: t.color, font: 'body', lh: 1 });
      pg.text(qx, y0 + 42, qw, 150, excerpt(heroE.essay + ' ' + heroE.reflection, t.keywords, 150), { pt: 34, min: 22, font: 'body', color: D.ink, lh: 1.55 });
      pg.text(qx, y0 + 200, qw, 16, '“' + heroE.oneLine + '”', { pt: 26, min: 18, bold: true, color: t.color, maxLines: 1 });
      pg.text(qx, y0 + 222, qw, 10, meta(heroE) + '  ·  DAY ' + P.pad2(heroE.day), { pt: 18, color: D.inkSoft, ls: 1 });
    } else {
      pg.text(m, y0 + 100, W - m * 2, 20, '이 주제로 분류된 기록이 아직 없습니다.', { pt: 36, color: D.sage, align: 'center' });
    }

    var gy = 456, gh = 336, cols = 3, rows = 3, gap = 10;
    var cw = (W - m * 2 - gap * (cols - 1)) / cols, ch = (gh - gap * (rows - 1)) / rows;
    sel.picked.slice(1, 10).forEach(function (e, i) {
      var x = m + (i % cols) * (cw + gap), y = gy + Math.floor(i / cols) * (ch + gap);
      pg.rect(x, y, cw, ch, { fill: D.card, stroke: D.line, sw: 0.3, r: 3.5 });
      var pw = 76;
      pg.img(x + 5, y + 5, pw, ch - 10, featured(e), { r: 3, label: 'TEXT' });
      var bx = x + pw + 11, bw = cw - pw - 17;
      pg.text(bx, y + 7, bw, 9, '“' + e.oneLine + '”', { pt: 17, min: 12, bold: true, color: t.color, maxLines: 1 });
      pg.text(bx, y + 19, bw, ch - 35, excerpt(e.essay + ' ' + e.reflection, t.keywords, 110), { pt: 16, min: 11, font: 'body', color: D.ink, lh: 1.5 });
      pg.text(bx, y + ch - 12, bw, 6, meta(e) + '  ·  DAY ' + P.pad2(e.day), { pt: 12, color: D.inkSoft });
    });
    footer(pg, W, H, m, program.schoolName + '  ·  ' + program.subtitle, '주제 포스터  ·  ' + t.title + ' ' + t.en, 15);
    return finalize(doc);
  }

  // ============================================================ 3. 학생별 A4 개인 성장 기록지 (학생당 2쪽)
  function growthRecord(ds, studentIds) {
    var doc = newDoc('개인성장기록지_A4', 'A4');
    var students = ds.students.filter(function (s) { return !studentIds || studentIds.indexOf(s.studentId) >= 0; });
    students.forEach(function (st) {
      var mine = {};
      ds.entries.forEach(function (e) { if (e.studentId === st.studentId) mine[e.day] = e; });
      growthPages(doc, st, mine);
    });
    return finalize(doc);
  }

  function growthPages(doc, st, mine) {
    var W = 210, H = 297, m = 15;
    // ---- 1쪽
    var pg = new Page(doc, D.paper);
    frame(pg, W, H, 7);
    topBar(pg, W, m, 12, 10, 'PERSONAL GROWTH RECORD');
    pg.text(m, 24, 130, 15, st.displayName, { pt: 32, bold: true, color: D.ink, maxLines: 1 });
    pg.text(m, 39, 150, 6, program.title + '  ·  ' + program.period, { pt: 9.5, color: D.inkSoft });
    stamp(pg, W - m - 25, 21, 25, '벗', D.accent, -8);

    pg.text(m, 49, 100, 5, '나의 4일, 한 줄 기록', { pt: 9, bold: true, color: D.accent, ls: 1 });
    var bw = (W - m * 2 - 3 * 3) / 4;
    program.days.forEach(function (d, i) {
      var x = m + i * (bw + 3), y = 56;
      var e = mine[d.day];
      pg.rect(x, y, bw, 27, { fill: D.card, stroke: D.line, sw: 0.25, r: 2 });
      pg.rect(x, y, bw, 1.6, { fill: d.color });
      pg.text(x + 3, y + 3.5, bw - 6, 4.5, P.dayLabel(d.day) + '  ' + d.dateLabel, { pt: 8, bold: true, color: d.color, ls: 0.4 });
      pg.text(x + 3, y + 9, bw - 6, 16, e ? e.oneLine : '미제출', { pt: 11, min: 8, bold: !!e, color: e ? D.ink : D.sage, lh: 1.3 });
    });
    growthSection(pg, m, 89, W - m * 2, 97, 1, mine[1]);
    growthSection(pg, m, 191, W - m * 2, 97, 2, mine[2]);
    // ---- 2쪽
    var pg2 = new Page(doc, D.paper);
    frame(pg2, W, H, 7);
    topBar(pg2, W, m, 12, 10, st.displayName + '  ·  PERSONAL GROWTH RECORD');
    growthSection(pg2, m, 24, W - m * 2, 97, 3, mine[3]);
    growthSection(pg2, m, 126, W - m * 2, 97, 4, mine[4]);
    var y = 229;
    pg2.rect(m, y, W - m * 2, 46, { fill: D.card, stroke: D.line, sw: 0.25, r: 2.5 });
    pg2.text(m + 5, y + 4, 80, 5, '선생님의 한마디', { pt: 9, bold: true, color: D.accent, ls: 1 });
    if (st.teacherComment) pg2.text(m + 5, y + 11, W - m * 2 - 40, 32, st.teacherComment, { pt: 10.5, min: 8, font: 'body', color: D.ink, lh: 1.6 });
    else for (var i = 0; i < 4; i++) pg2.line(m + 5, y + 18 + i * 7, W - m - 38, y + 18 + i * 7, { color: D.line, sw: 0.3, dash: true });
    stamp(pg2, W - m - 30, y + 12, 24, '인솔', D.accent, -6);
    footer(pg2, W, H, 8, program.schoolName + '  ·  ' + program.brand, st.displayName, 7.5);
  }

  function growthSection(pg, x, y, w, h, day, e) {
    var d = P.getDay(day);
    pg.rect(x, y, 16, 6, { fill: d.color, r: 1.2 });
    pg.text(x, y + 0.9, 16, 4.5, P.dayLabel(day), { pt: 8, bold: true, color: '#FFFFFF', align: 'center', valign: 'middle' });
    pg.text(x + 19, y + 0.4, w - 45, 6, d.theme + '  —  ' + d.themeSub, { pt: 11, bold: true, color: D.ink, maxLines: 1, min: 8 });
    pg.text(x + w - 30, y + 1, 30, 5, d.dateLabel + ' ' + d.weekday, { pt: 8.5, color: D.inkSoft, align: 'right' });
    pg.line(x, y + 8.5, x + w, y + 8.5, { color: D.line, sw: 0.3 });
    var cw = 62;
    var by = y + 11;
    if (!e) {
      pg.placeholder(x, by, cw, 44, { r: 2, label: '미제출' });
      pg.text(x + cw + 6, by, w - cw - 6, 8, '이 날의 기록이 아직 없습니다.', { pt: 10, color: D.sage });
      return;
    }
    var photos = e.photos;
    pg.img(x, by, cw, 44, featured(e), { r: 2, label: '사진 비공개' });
    var others = photos.filter(function (p) { return p !== featured(e); }).slice(0, 2);
    others.forEach(function (p, i) { pg.img(x + i * (cw / 2 + 0.5), by + 46, cw / 2 - 0.5, 24, p, { r: 1.5 }); });
    var qy = by + (others.length ? 73 : 48);
    pg.text(x, qy, cw, h - (qy - y) - 2, '“' + e.oneLine + '”', { pt: 10.5, min: 8, bold: true, color: d.color, lh: 1.3 });

    var rx = x + cw + 6, rw = w - cw - 6;
    pg.text(rx, by - 0.5, rw, 4.5, 'MISSION  ① ' + d.missions[0], { pt: 7.5, color: D.inkSoft, maxLines: 1, min: 6.5 });
    pg.text(rx, by + 4, rw, 4.5, 'MISSION  ② ' + d.missions[1], { pt: 7.5, color: D.inkSoft, maxLines: 1, min: 6.5 });
    pg.text(rx, by + 10, rw, 9, 'Q. ' + d.question, { pt: 8.5, bold: true, color: d.color, lh: 1.35, min: 7 });
    pg.text(rx, by + 20, rw, 24, e.reflection, { pt: 9.5, min: 7.2, font: 'body', color: D.ink, lh: 1.5 });
    pg.line(rx, by + 46, rx + rw, by + 46, { color: D.line, sw: 0.25, dash: true });
    pg.text(rx, by + 48, rw, 4.5, '소감문', { pt: 8, bold: true, color: d.color, ls: 1 });
    pg.text(rx, by + 53.5, rw, h - (by + 53.5 - y) - 1, e.essay, { pt: 9.5, min: 7, font: 'body', color: D.ink, lh: 1.5 });
  }

  // ============================================================ 4. 국제교류 결과물 팜플렛 (A5 16쪽, A4 선택 가능)
  function pamphlet(ds, sizeKey) {
    sizeKey = sizeKey === 'A4' ? 'A4' : 'A5';
    var doc = newDoc('국제교류_팜플렛_' + sizeKey, sizeKey);
    var s = SIZES[sizeKey].w / 148;
    var W = 148, H = 210, m = 12;
    var all = ds.entries;
    function pageNo(pg, n) {
      pg.text(m, H - 9, W - m * 2, 4, (n < 10 ? '0' : '') + n + '  ·  ' + program.brand, { pt: 6.5, color: D.inkSoft, align: n % 2 ? 'right' : 'left', ls: 0.6 });
    }
    // 1. 표지
    var pg = new Page(doc, D.paper, s);
    frame(pg, W, H, 6);
    pg.text(m, 14, W - m * 2, 5, program.brand + '  ·  ' + program.brandFull.toUpperCase(), { pt: 7, color: D.inkSoft, ls: 1.2 });
    pg.text(m, 24, W - m * 2, 30, '벗과 함께\n도쿄를 기록하다', { pt: 27, bold: true, color: D.ink, lh: 1.25 });
    pg.text(m, 55, W - m * 2, 10, program.subtitle, { pt: 8.5, color: D.inkSoft, lh: 1.4 });
    var heroes = program.days.map(function (d) { return dayHero(ds, d.day); });
    pg.img(m, 70, W - m * 2, 76, heroes[0] && heroes[0].photo, { r: 3 });
    var sw2 = (W - m * 2 - 6) / 3;
    [1, 2, 3].forEach(function (i, k) { pg.img(m + k * (sw2 + 3), 149, sw2, 26, heroes[i] && heroes[i].photo, { r: 2 }); });
    washi(pg, m + 8, 67, 30, 6, D.accent, -5);
    stamp(pg, W - m - 26, 58, 24, '벗', D.accent, -8);
    pg.text(m, 182, W - m * 2, 5, program.period, { pt: 8, color: D.ink, bold: true });
    pg.text(m, 188, W - m * 2, 5, program.schoolName + '  ·  참가 학생 ' + ds.students.length + '명', { pt: 7.5, color: D.inkSoft });

    // 2. 소개
    pg = new Page(doc, D.paper, s);
    pg.text(m, 16, W - m * 2, 5, 'ABOUT', { pt: 7.5, bold: true, color: D.accent, ls: 2 });
    pg.text(m, 22, W - m * 2, 12, 'B.U.T., 벗이 되는 여행', { pt: 17, bold: true, color: D.ink });
    pg.text(m, 37, W - m * 2, 46,
      'B.U.T.는 ‘Beyond Universal Togetherness’의 머리글자이자, 우리말 ‘벗’을 닮은 이름입니다. ' +
      '국경과 언어를 넘어 서로의 일상을 이해하고 함께 기록하는 것 — 그것이 이번 국외현장체험학습의 목표였습니다. ' +
      '학생들은 4일 동안 매일 미션을 수행하며 사진과 성찰, 한 줄의 기록을 남겼고, 이 책은 그 기록을 모은 것입니다.',
      { pt: 9, min: 7.5, font: 'body', color: D.ink, lh: 1.7 });
    var rows = [
      ['기간', program.period], ['장소', '일본 도쿄 (도쿄타워 · 시부야 · 디즈니랜드 · 자매학교 · 도쿄대학 · 아사쿠사)'],
      ['참가', '고등학생 ' + ds.students.length + '명'], ['자매학교', '도쿄도립 남평고등학교'], ['숙소', program.hotel]
    ];
    rows.forEach(function (r, i) {
      var y = 90 + i * 11;
      pg.line(m, y, W - m, y, { color: D.line, sw: 0.25 });
      pg.text(m, y + 2.5, 22, 6, r[0], { pt: 8, bold: true, color: D.accent });
      pg.text(m + 22, y + 2.5, W - m * 2 - 22, 8, r[1], { pt: 8, min: 6.5, color: D.ink, lh: 1.3 });
    });
    pg.text(m, 151, W - m * 2, 5, '네 가지 주제', { pt: 8, bold: true, color: D.accent, ls: 1 });
    program.topics.forEach(function (t, i) {
      var x = m + (i % 2) * ((W - m * 2) / 2), y = 158 + Math.floor(i / 2) * 18;
      pg.ellipse(x, y, 12, 12, { stroke: t.color, sw: 0.5 });
      pg.text(x, y + 3.2, 12, 6, t.title, { pt: t.title.length > 1 ? 7 : 10, bold: true, color: t.color, align: 'center' });
      pg.text(x + 15, y + 0.5, (W - m * 2) / 2 - 17, 12, t.en + '\n' + t.desc, { pt: 6.5, color: D.inkSoft, lh: 1.35 });
    });
    pageNo(pg, 2);

    // 3. 일정
    pg = new Page(doc, D.paper, s);
    pg.text(m, 16, W - m * 2, 5, 'ITINERARY', { pt: 7.5, bold: true, color: D.accent, ls: 2 });
    pg.text(m, 22, W - m * 2, 12, '3박 4일의 여정', { pt: 17, bold: true, color: D.ink });
    var y = 38;
    program.days.forEach(function (d) {
      pg.rect(m, y, 15, 5.5, { fill: d.color, r: 1 });
      pg.text(m, y + 0.8, 15, 4, P.dayLabel(d.day), { pt: 6.5, bold: true, color: '#FFFFFF', align: 'center' });
      pg.text(m + 18, y + 0.3, W - m * 2 - 18, 5, d.dateLabel + ' (' + d.weekday + ')  ' + d.theme, { pt: 8.5, bold: true, color: D.ink });
      y += 8;
      d.schedule.forEach(function (it) {
        pg.text(m + 3, y, 14, 4, it[0], { pt: 6.8, color: d.color });
        pg.text(m + 18, y, W - m * 2 - 18, 4, it[1], { pt: 6.8, color: D.ink, maxLines: 1, min: 5.8 });
        y += 4.1;
      });
      y += 4;
    });
    pageNo(pg, 3);

    // 4–11. 날짜별 펼침면
    var n = 4;
    program.days.forEach(function (d) {
      var list = byDay(ds, d.day);
      // (a) 여는 면
      var p1 = new Page(doc, D.paper, s);
      p1.text(m, 14, 40, 6, 'DAY', { pt: 11, bold: true, color: d.color, ls: 3 });
      p1.text(m - 1, 18, 60, 30, P.pad2(d.day), { pt: 64, bold: true, color: d.color, lh: 1.05 });
      p1.text(m + 46, 24, W - m * 2 - 46, 5, d.dateLabel + ' ' + d.weekdayEn, { pt: 8, color: D.inkSoft, ls: 1 });
      p1.text(m + 46, 30, W - m * 2 - 46, 16, d.theme, { pt: 15, min: 11, bold: true, color: D.ink, lh: 1.2 });
      p1.text(m, 50, W - m * 2, 5, d.places.join('  ·  '), { pt: 8, color: d.color });
      var hero = dayHero(ds, d.day);
      p1.img(m, 58, W - m * 2, 74, hero && hero.photo, { r: 3 });
      washi(p1, W - m - 34, 55, 28, 6, d.color, 5);
      p1.rect(m, 137, W - m * 2, 30, { fill: D.card, stroke: D.line, sw: 0.25, r: 2 });
      p1.text(m + 4, 140, 40, 4, 'MISSION', { pt: 6.5, bold: true, color: d.color, ls: 1.5 });
      p1.text(m + 4, 145, W - m * 2 - 8, 10, '① ' + d.missions[0], { pt: 8, min: 7, color: D.ink, lh: 1.3 });
      p1.text(m + 4, 155, W - m * 2 - 8, 10, '② ' + d.missions[1], { pt: 8, min: 7, color: D.ink, lh: 1.3 });
      p1.text(m, 171, W - m * 2, 4, '성찰 질문', { pt: 6.5, bold: true, color: d.color, ls: 1 });
      p1.text(m, 176, W - m * 2, 16, d.question, { pt: 9, min: 7.5, font: 'body', color: D.ink, lh: 1.5 });
      pageNo(p1, n++);
      // (b) 목소리 면
      var p2 = new Page(doc, D.paper, s);
      p2.text(m, 14, W - m * 2, 5, P.dayLabel(d.day) + '  ·  VOICES', { pt: 7.5, bold: true, color: d.color, ls: 2 });
      var picks = list.filter(function (e) { return featured(e) && (!hero || featured(e).id !== hero.photo.id); });
      picks.sort(function (a, b) { return (b.photos.some(function (p) { return p.exhibit; }) ? 1 : 0) - (a.photos.some(function (p) { return p.exhibit; }) ? 1 : 0); });
      var gw = (W - m * 2 - 4) / 2;
      picks.slice(0, 4).forEach(function (e, i) {
        var x = m + (i % 2) * (gw + 4), yy = 22 + Math.floor(i / 2) * 50;
        p2.img(x, yy, gw, 36, featured(e), { r: 2 });
        p2.text(x, yy + 37.5, gw, 9, e.oneLine, { pt: 8, min: 6.5, bold: true, color: D.ink, lh: 1.3, maxLines: 2 });
        p2.text(x, yy + 45.5, gw, 3.5, e.displayName, { pt: 5.8, color: D.inkSoft });
      });
      var quotes = list.slice().sort(function (a, b) { return Array.from(b.essay).length - Array.from(a.essay).length; }).slice(0, 2);
      quotes.forEach(function (e, i) {
        var yy = 126 + i * 36;
        p2.text(m, yy - 2, 8, 10, '“', { pt: 26, color: d.color, font: 'body', lh: 1 });
        p2.text(m + 8, yy, W - m * 2 - 8, 24, excerpt(e.essay, null, 110), { pt: 8.5, min: 7, font: 'body', color: D.ink, lh: 1.6 });
        p2.text(m + 8, yy + 25, W - m * 2 - 8, 4, '— ' + e.displayName, { pt: 6.5, color: D.inkSoft });
      });
      if (!list.length) p2.text(m, 90, W - m * 2, 10, '아직 제출된 기록이 없습니다.', { pt: 10, color: D.sage, align: 'center' });
      pageNo(p2, n++);
    });

    // 12. 우리들의 한 줄
    pg = new Page(doc, D.paper, s);
    pg.text(m, 16, W - m * 2, 5, 'ONE LINE', { pt: 7.5, bold: true, color: D.accent, ls: 2 });
    pg.text(m, 22, W - m * 2, 12, '우리들의 한 줄', { pt: 17, bold: true, color: D.ink });
    var best = ds.students.map(function (st) {
      var es = all.filter(function (e) { return e.studentId === st.studentId; });
      es.sort(function (a, b) { return (b.reviewStatus === 'approved') - (a.reviewStatus === 'approved') || b.day - a.day; });
      return es[0];
    }).filter(Boolean);
    var colW = (W - m * 2 - 6) / 2, per = Math.ceil(best.length / 2);
    var lineH = Math.min(15.5, 150 / Math.max(per, 1));
    best.forEach(function (e, i) {
      var x = m + Math.floor(i / per) * (colW + 6), yy = 38 + (i % per) * lineH;
      pg.text(x, yy, colW, 3.5, e.displayName + '  ·  ' + P.dayLabel(e.day), { pt: 5.8, color: P.getDay(e.day).color, ls: 0.4 });
      pg.text(x, yy + 3.8, colW, lineH - 5, e.oneLine, { pt: 8.2, min: 6.5, bold: true, color: D.ink, lh: 1.25, maxLines: 2 });
    });
    pageNo(pg, n++);

    // 13. 주제로 읽는 도쿄
    pg = new Page(doc, D.paper, s);
    pg.text(m, 16, W - m * 2, 5, 'THEMES', { pt: 7.5, bold: true, color: D.accent, ls: 2 });
    pg.text(m, 22, W - m * 2, 12, '주제로 읽는 도쿄', { pt: 17, bold: true, color: D.ink });
    program.topics.forEach(function (t, i) {
      var yy = 40 + i * 40;
      var sel = pickForTopic(ds, t.key, 1);
      pg.ellipse(m, yy, 16, 16, { stroke: t.color, sw: 0.6 });
      pg.text(m, yy + 4.6, 16, 7, t.title, { pt: t.title.length > 1 ? 8.5 : 12, bold: true, color: t.color, align: 'center' });
      pg.text(m + 20, yy, W - m * 2 - 20, 5, t.en + '  ·  기록 ' + sel.total + '편', { pt: 6.8, bold: true, color: t.color, ls: 1 });
      pg.text(m + 20, yy + 5.5, W - m * 2 - 20, 7, t.desc, { pt: 7.5, color: D.inkSoft, maxLines: 1, min: 6.2 });
      if (sel.picked[0]) {
        pg.text(m + 20, yy + 13, W - m * 2 - 20, 17, '“' + excerpt(sel.picked[0].essay, t.keywords, 90) + '”', { pt: 8, min: 6.8, font: 'body', color: D.ink, lh: 1.55 });
        pg.text(m + 20, yy + 31, W - m * 2 - 20, 4, '— ' + sel.picked[0].displayName + ', ' + P.dayLabel(sel.picked[0].day), { pt: 6, color: D.inkSoft });
      }
    });
    pageNo(pg, n++);

    // 14. 사진 모자이크
    pg = new Page(doc, D.paper, s);
    pg.text(m, 16, W - m * 2, 5, 'MOMENTS', { pt: 7.5, bold: true, color: D.accent, ls: 2 });
    pg.text(m, 22, W - m * 2, 12, '함께한 순간들', { pt: 17, bold: true, color: D.ink });
    var pool = [];
    all.forEach(function (e) { e.photos.forEach(function (p) { if (p.exhibit) pool.push(p); }); });
    all.forEach(function (e) { var f = featured(e); if (f && pool.indexOf(f) < 0) pool.push(f); });
    var mc = 4, mr = 6, mg = 2, mw = (W - m * 2 - mg * (mc - 1)) / mc, mh = (H - 40 - 16 - mg * (mr - 1)) / mr;
    pool.slice(0, mc * mr).forEach(function (p, i) { pg.img(m + (i % mc) * (mw + mg), 38 + Math.floor(i / mc) * (mh + mg), mw, mh, p, { r: 1.2 }); });
    pageNo(pg, n++);

    // 15. 마치며
    pg = new Page(doc, D.paper, s);
    pg.text(m, 16, W - m * 2, 5, 'CLOSING', { pt: 7.5, bold: true, color: D.accent, ls: 2 });
    pg.text(m, 22, W - m * 2, 12, '여행이 끝나도, 벗은 남는다', { pt: 16, bold: true, color: D.ink });
    pg.text(m, 38, W - m * 2, 40,
      '낯선 도시의 풍경에서 시작해, 대중교통의 작은 배려와 자매학교 친구의 웃음, 오래된 사찰과 대학 캠퍼스에서 마주한 미래까지. ' +
      '네 번의 하루가 모여 우리는 조금 더 넓은 세상을 품게 되었습니다. 함께 기록해 준 모든 벗에게 고마움을 전합니다.',
      { pt: 9, min: 7.5, font: 'body', color: D.ink, lh: 1.7 });
    pg.text(m, 86, W - m * 2, 5, '함께한 벗들', { pt: 8, bold: true, color: D.accent, ls: 1 });
    var names = ds.students.map(function (st) { return st.displayName; });
    var nc = 3, nw = (W - m * 2) / nc;
    names.forEach(function (nm, i) { pg.text(m + (i % nc) * nw, 93 + Math.floor(i / nc) * 6, nw - 2, 5, nm, { pt: 7.5, color: D.ink, maxLines: 1, min: 6 }); });
    stamp(pg, W - m - 28, H - 52, 26, '벗', D.accent, -8);
    pg.text(m, H - 30, W - m * 2, 5, program.schoolName + '  ·  ' + program.subtitle, { pt: 7, color: D.inkSoft });
    pageNo(pg, n++);

    // 16. 뒤표지
    pg = new Page(doc, D.ink, s);
    pg.text(m, H / 2 - 22, W - m * 2, 10, program.brand, { pt: 16, bold: true, color: D.paper, align: 'center', ls: 2 });
    pg.text(m, H / 2 - 10, W - m * 2, 6, program.brandFull.toUpperCase(), { pt: 7, color: D.sage, align: 'center', ls: 1.5 });
    pg.line(W / 2 - 10, H / 2, W / 2 + 10, H / 2, { color: D.accent, sw: 0.6 });
    pg.text(m, H / 2 + 5, W - m * 2, 6, program.title, { pt: 9, color: D.paper, align: 'center' });
    pg.text(m, H - 24, W - m * 2, 5, program.schoolName + '  ·  ' + program.period, { pt: 6.5, color: D.sage, align: 'center' });
    return finalize(doc);
  }

  // ============================================================ 5. 기록 카드 (A5, 제출 1건 = 1쪽 — Canva 대량 제작 예시와 같은 디자인)
  function recordCards(ds, day) {
    var doc = newDoc('기록카드_A5' + (day ? '_DAY' + P.pad2(day) : ''), 'A5');
    ds.entries.filter(function (e) { return !day || e.day === day; }).forEach(function (e) {
      var pg = new Page(doc, '#E9E4DA');
      recordCard(pg, 10, 10, 128, 134.5, e, { showDay: true });
      pg.text(14, 150, 120, 4, '오늘의 기록', { pt: 7, bold: true, color: P.getDay(e.day).color, ls: 1 });
      pg.text(14, 155, 120, 45, excerpt(e.essay, null, 200), { pt: 8.5, min: 7, font: 'body', color: D.ink, lh: 1.6 });
    });
    return finalize(doc);
  }

  // ============================================================ 6. 접속 안내 (QR) + PIN 배부 카드
  function accessGuide(url, students) {
    var doc = newDoc('접속안내_QR_A4', 'A4');
    var W = 210, H = 297, m = 18;
    var pg = new Page(doc, D.paper);
    frame(pg, W, H, 8);
    topBar(pg, W, m, 16, 11, 'STUDENT GUIDE');
    pg.text(m, 34, W - m * 2, 30, '벗과 함께\n도쿄를 기록하다', { pt: 30, bold: true, color: D.ink, lh: 1.2 });
    pg.text(m, 68, W - m * 2, 8, 'QR을 찍고, 매일 저녁 오늘의 기록을 남겨 주세요.', { pt: 12, color: D.inkSoft });
    pg.rect(W / 2 - 45, 84, 90, 90, { fill: '#FFFFFF', r: 3, stroke: D.line, sw: 0.3 });
    pg.qr(W / 2 - 40, 89, 80, url);
    washi(pg, W / 2 - 18, 80, 36, 7, D.accent, -4);
    pg.text(m, 178, W - m * 2, 6, url, { pt: 7.5, color: D.inkSoft, align: 'center' });
    var steps = [
      ['1', '학생 번호와 PIN(4자리)으로 로그인'],
      ['2', '오늘 날짜(DAY)의 미션과 성찰 질문 확인'],
      ['3', '사진 1~3장, 성찰 답변, 소감문, 한 줄 기록 작성'],
      ['4', '제출 완료 화면 확인 — 다시 제출하면 최신 내용으로 바뀝니다']
    ];
    steps.forEach(function (st, i) {
      var y = 192 + i * 15;
      pg.ellipse(m, y, 10, 10, { fill: D.accent });
      pg.text(m, y + 2.3, 10, 5, st[0], { pt: 11, bold: true, color: '#FFFFFF', align: 'center' });
      pg.text(m + 14, y + 1.8, W - m * 2 - 14, 7, st[1], { pt: 11.5, color: D.ink });
    });
    pg.text(m, 258, W - m * 2, 14, '※ 사진과 글은 인솔 교사만 볼 수 있으며, 전시물에는 실명 대신 학생 표시 이름이 사용됩니다. 얼굴이 크게 나온 친구 사진은 동의를 받고 올려 주세요.', { pt: 8.5, color: D.inkSoft, lh: 1.5 });

    if (students && students.length) {
      var cols = 2, rows = 5, cw = (W - 20 - 6) / cols, ch = (H - 20 - 4 * 4) / rows;
      students.forEach(function (st, i) {
        if (i % (cols * rows) === 0) pg = new Page(doc, '#FFFFFF');
        var k = i % (cols * rows);
        var x = 10 + (k % cols) * (cw + 6), y = 10 + Math.floor(k / cols) * (ch + 4);
        pg.rect(x, y, cw, ch, { fill: D.paper, stroke: D.line, sw: 0.3, dash: true, r: 2 });
        pg.text(x + 6, y + 5, cw - 40, 5, program.brand, { pt: 7.5, bold: true, color: D.ink, ls: 0.8 });
        pg.text(x + 6, y + 12, cw - 40, 9, st.displayName, { pt: 16, bold: true, color: D.accent, maxLines: 1, min: 10 });
        pg.text(x + 6, y + 24, cw - 40, 6, '학생 번호   ' + st.studentId, { pt: 11, color: D.ink });
        pg.text(x + 6, y + 31, cw - 40, 6, 'PIN   ' + st.pin, { pt: 11, color: D.ink, bold: true });
        pg.text(x + 6, y + 40, cw - 40, 8, 'PIN은 다른 사람에게 알려주지 마세요.', { pt: 7, color: D.inkSoft });
        pg.qr(x + cw - 32, y + 8, 26, url);
      });
    }
    return finalize(doc);
  }

  // ------------------------------------------------------------ 결과물 목록
  var OUTPUTS = [
    { key: 'day1', label: 'DAY 01 A1 포스터', build: function (ds) { return dayPoster(ds, 1); } },
    { key: 'day2', label: 'DAY 02 A1 포스터', build: function (ds) { return dayPoster(ds, 2); } },
    { key: 'day3', label: 'DAY 03 A1 포스터', build: function (ds) { return dayPoster(ds, 3); } },
    { key: 'day4', label: 'DAY 04 A1 포스터', build: function (ds) { return dayPoster(ds, 4); } }
  ].concat(program.topics.map(function (t) {
    return { key: 'topic-' + t.key, label: '주제 A1 포스터 · ' + t.title, build: function (ds) { return topicPoster(ds, t.key); } };
  })).concat([
    { key: 'growth', label: '학생별 A4 개인 성장 기록지 (전체)', build: function (ds, o) { return growthRecord(ds, o && o.studentIds); } },
    { key: 'pamphlet-a5', label: '국제교류 팜플렛 A5 (16쪽)', build: function (ds) { return pamphlet(ds, 'A5'); } },
    { key: 'pamphlet-a4', label: '국제교류 팜플렛 A4 (16쪽)', build: function (ds) { return pamphlet(ds, 'A4'); } },
    { key: 'cards', label: '기록 카드 A5 (제출 1건 = 1쪽)', build: function (ds) { return recordCards(ds); } }
  ]);

  function build(key, ds, opts) {
    for (var i = 0; i < OUTPUTS.length; i++) if (OUTPUTS[i].key === key) return OUTPUTS[i].build(ds, opts || {});
    throw new Error('unknown output ' + key);
  }
  function photoIdsOf(doc) {
    var ids = {};
    doc.pages.forEach(function (p) { p.els.forEach(function (e) { if (e.t === 'img') ids[e.src] = 1; }); });
    return Object.keys(ids);
  }

  return {
    SIZES: SIZES, OUTPUTS: OUTPUTS, build: build, photoIdsOf: photoIdsOf,
    dayPoster: dayPoster, topicPoster: topicPoster, growthRecord: growthRecord, pamphlet: pamphlet,
    recordCards: recordCards, accessGuide: accessGuide,
    _wrap: wrap, _fit: fit, _textWidth: textWidth, excerpt: excerpt
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BUT_Layout;
