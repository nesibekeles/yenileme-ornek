/* düğün.com Saha Satış Paneli
   Vanilla JS, no build step, no CDN — the panel has to open from a USB stick in
   a venue with no wifi. Data comes from data/content.js, data/pricing.js and
   data/renewal.js, all loaded as classic scripts before this file. */
(function () {
"use strict";

var C = window.CONTENT, P = window.PRICING, R = window.RENEWAL_DATA;
var CFG = window.APP_CONFIG;

/* Scope rules live in data/config.js so the panel and the deck cannot drift:
   every city picker is the six main cities plus Mersin, every category picker
   is venue categories only. */
function cityList(list) { return CFG.filterCities(list || CFG.cities); }
function catList(list) { return CFG.filterCats(list); }

/* ------------------------------------------------------------------ utils */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
  return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

var NF = new Intl.NumberFormat("tr-TR");
function n(v, d) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 0 : d }).format(v);
}
function tl(v) { return v == null || isNaN(v) ? "—" : NF.format(Math.round(v)) + " ₺"; }
/* Turkish writes the percent sign in front: %60, not 60%. */
function pct(v, d) { return v == null || isNaN(v) ? "—" : "%" + n(v * 100, d == null ? 1 : d); }
function hrs(v) {
  if (v == null || isNaN(v)) return "—";
  if (v < 1 / 60) return n(v * 3600, 0) + " sn";     // sub-minute replies exist
  if (v < 1) return n(v * 60, 0) + " dk";
  if (v < 48) return n(v, 1) + " sa";
  return n(v / 24, 1) + " gün";
}
function dt(s) {
  if (!s) return "—";
  var p = String(s).split("-");
  return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : s;
}
function today() {
  var d = new Date();
  return String(d.getDate()).padStart(2, "0") + "." +
    String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
}
function daysUntil(s) {
  if (!s) return null;
  var d = new Date(s + "T00:00:00"), t = new Date(R.meta.asof + "T00:00:00");
  return Math.round((d - t) / 86400000);
}
function div(a, b) { return (b && a != null) ? a / b : null; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* Guidance written for the rep, not the venue. Hidden by Sunum Modu. */
function repNote(html) {
  return '<div class="rep-note"><b class="tag">Satışçı notu</b>' + html + "</div>";
}

/* --------------------------------------------------------------- SVG charts */
function lineChart(labels, series, opt) {
  opt = opt || {};
  var W = 720, H = opt.h || 200, L = 44, Rr = 12, T = 12, B = 26;
  var iw = W - L - Rr, ih = H - T - B;
  var all = [];
  series.forEach(function (s) { s.v.forEach(function (x) { if (x != null) all.push(x); }); });
  var max = Math.max.apply(null, all.concat([1])), min = 0;
  var step = labels.length > 1 ? iw / (labels.length - 1) : iw;
  var x = function (i) { return L + i * step; };
  var y = function (v) { return T + ih - (v - min) / (max - min || 1) * ih; };
  var g = "";
  for (var k = 0; k <= 4; k++) {
    var yy = T + ih * k / 4, val = max - (max - min) * k / 4;
    g += '<line class="gl" x1="' + L + '" y1="' + yy + '" x2="' + (W - Rr) + '" y2="' + yy + '"/>' +
         '<text class="ax" x="' + (L - 6) + '" y="' + (yy + 3) + '" text-anchor="end">' + n(val, max < 10 ? 1 : 0) + "</text>";
  }
  labels.forEach(function (lb, i) {
    if (labels.length > 8 && i % 2) return;
    g += '<text class="ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + "</text>";
  });
  series.forEach(function (s) {
    var d = "", started = false;
    s.v.forEach(function (v, i) {
      if (v == null) return;
      d += (started ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
      started = true;
    });
    g += '<path class="' + (s.cls || "ln") + '" d="' + d + '"/>';
    if (!s.cls || s.cls === "ln") {
      s.v.forEach(function (v, i) {
        if (v == null) return;
        g += '<circle class="dot" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3"/>';
      });
    }
  });
  return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" ' +
         'style="height:' + H + 'px">' + g + "</svg>";
}

function barChart(labels, values, opt) {
  opt = opt || {};
  var W = 720, H = opt.h || 170, L = 44, Rr = 12, T = 12, B = 26;
  var iw = W - L - Rr, ih = H - T - B;
  var max = Math.max.apply(null, values.filter(function (v) { return v != null; }).concat([1]));
  var bw = iw / labels.length * 0.62, gap = iw / labels.length;
  var g = "";
  for (var k = 0; k <= 3; k++) {
    var yy = T + ih * k / 3;
    g += '<line class="gl" x1="' + L + '" y1="' + yy + '" x2="' + (W - Rr) + '" y2="' + yy + '"/>' +
         '<text class="ax" x="' + (L - 6) + '" y="' + (yy + 3) + '" text-anchor="end">' +
         n(max - max * k / 3, max < 10 ? 1 : 0) + "</text>";
  }
  labels.forEach(function (lb, i) {
    var v = values[i] || 0, h = v / max * ih;
    var cx = L + gap * i + gap / 2;
    g += '<rect class="bar' + (opt.hl === i ? " hl" : "") + '" x="' + (cx - bw / 2).toFixed(1) +
         '" y="' + (T + ih - h).toFixed(1) + '" width="' + bw.toFixed(1) +
         '" height="' + Math.max(0, h).toFixed(1) + '" rx="3"/>';
    g += '<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + "</text>";
  });
  return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" ' +
         'style="height:' + H + 'px">' + g + "</svg>";
}

/* Two series side by side — the shape the Pro Start renewal karne uses to put
   a venue next to its competitors. Values are shares (0-1). */
function groupedBars(labels, mine, peer, opt) {
  opt = opt || {};
  var W = 720, H = opt.h || 190, L = 30, Rr = 12, T = 14, B = 34;
  var iw = W - L - Rr, ih = H - T - B;
  var max = Math.max.apply(null, mine.concat(peer).concat([0.1])) * 1.18;
  var slot = iw / labels.length, bw = Math.min(34, slot * 0.3);
  var g = "";
  for (var k = 0; k <= 2; k++) {
    var yy = T + ih * k / 2;
    g += '<line class="gl" x1="' + L + '" y1="' + yy + '" x2="' + (W - Rr) + '" y2="' + yy + '"/>';
  }
  labels.forEach(function (lb, i) {
    var cx = L + slot * i + slot / 2;
    [[mine[i], "var(--pink)", -1], [peer[i], "var(--mute-2)", 1]].forEach(function (pair) {
      var v = pair[0] || 0, hh = v / max * ih;
      var x = cx + pair[2] * (bw / 2 + 2) - bw / 2;
      g += '<rect x="' + x.toFixed(1) + '" y="' + (T + ih - hh).toFixed(1) +
        '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, hh).toFixed(1) +
        '" rx="3" fill="' + pair[1] + '"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (T + ih - hh - 4).toFixed(1) +
        '" text-anchor="middle" font-size="10.5" font-weight="800" fill="' + pair[1] + '">' +
        (v ? "%" + n(v * 100, 0) : "") + "</text>";
    });
    g += '<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 12) +
      '" text-anchor="middle" font-size="11">' + esc(lb) + "</text>";
  });
  return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" ' +
    'style="height:' + H + 'px">' + g + "</svg>" +
    '<div class="legend"><span><i style="background:var(--pink)"></i>Siz</span>' +
    '<span><i style="background:var(--mute-2)"></i>Rakipleriniz</span></div>';
}

/* -------------------------------------------------------------- app state */
var state = {
  tab: "ren",
  sec: { new: "setup", ren: "pick" },
  cust: null, prov: null, obj: null,
  meeting: null            // set by the meeting-setup screen
};

var RENDER = {};

function show(tab, sec) {
  state.tab = tab;
  if (sec) state.sec[tab] = sec;
  $$(".tab").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === tab); });
  $("#nav-new").hidden = tab !== "new";
  $("#nav-ren").hidden = tab !== "ren";
  var cur = state.sec[tab];
  $$(".nav-item").forEach(function (b) { b.setAttribute("aria-current", b.dataset.sec === cur); });
  $$(".view").forEach(function (v) { v.classList.toggle("on", v.id === "v-" + cur); });
  drawRibbon();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (RENDER[cur]) RENDER[cur]();
}
window.__go = function (tab, sec) { show(tab, sec); };

/* ------------------------------------------------------------ meeting mode */
function drawRibbon() {
  var el = $("#meeting-ribbon"), m = state.meeting;
  if (!m || state.tab !== "new" || state.sec.new === "setup") { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = '<div><div class="who">' + esc(m.firm) + " · İş Ortaklığı Görüşmesi</div>" +
    '<div class="sub">' + [m.city, m.cat, m.person].filter(Boolean).map(esc).join(" · ") +
    " · " + today() + "</div></div><span class='spacer'></span>" +
    '<button onclick="__go(\'new\',\'setup\')">Kurulumu düzenle</button>';
}

/* ---------------------------------------------------------------- notes */
var Notes = (function () {
  var KEY = "dc_sale_notes_v1", list = [], tag = "Feedback";
  function load() {
    try { list = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { list = []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
    badge();
  }
  function badge() {
    var b = $("#note-count");
    b.hidden = !list.length;
    b.textContent = list.length;
  }
  function where() {
    var lbl = $$(".nav-item").filter(function (x) {
      return x.getAttribute("aria-current") === "true"; })[0];
    return lbl ? lbl.textContent.trim() : "";
  }
  function render() {
    $("#notes-list").innerHTML = list.length ? list.map(function (nt, i) {
      return '<div class="sticky"><button class="del" data-i="' + i + '" title="Sil">✕</button>' +
        esc(nt.t).replace(/\n/g, "<br>") +
        '<div class="meta"><span class="pill neu">' + esc(nt.tag) + "</span>" +
        '<span class="where">' + esc(nt.where) + "</span><span>" + esc(nt.at) + "</span></div></div>";
    }).join("") : "<p style='color:#9a8a55;font-size:13px;margin:6px 0'>Henüz not yok.</p>";
    $$("#notes-list .del").forEach(function (b) {
      b.addEventListener("click", function () {
        list.splice(+b.dataset.i, 1); save(); render();
      });
    });
  }
  function toggle(force) {
    var p = $("#notes-panel");
    var on = force == null ? p.hidden : force;
    p.hidden = !on;
    $("#btn-note").classList.toggle("on", on);
    if (on) { render(); $("#note-text").focus(); }
  }
  function add() {
    var t = $("#note-text").value.trim();
    if (!t) return;
    var d = new Date();
    list.unshift({ t: t, tag: tag, where: where(),
      at: today() + " " + String(d.getHours()).padStart(2, "0") + ":" +
          String(d.getMinutes()).padStart(2, "0") });
    $("#note-text").value = "";
    save(); render();
  }
  function boot() {
    load(); badge();
    $("#btn-note").addEventListener("click", function () { toggle(); });
    $("#notes-close").addEventListener("click", function () { toggle(false); });
    $("#note-add").addEventListener("click", add);
    $("#note-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add();
    });
    $$("#note-tags .chip").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#note-tags .chip").forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
        tag = b.dataset.tag;
      });
    });
    $("#notes-copy").addEventListener("click", function () {
      var txt = list.map(function (x) {
        return "[" + x.tag + "] " + x.where + " · " + x.at + "\n" + x.t;
      }).join("\n\n");
      var ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      ta.remove();
      $("#notes-copy").textContent = "Kopyalandı ✓";
      setTimeout(function () { $("#notes-copy").textContent = "Kopyala"; }, 1400);
    });
  }
  return { boot: boot, toggle: toggle };
})();

/* -------------------------------------------------- shared drawing engine */
function makePainter(canvas) {
  var ctx = null, drawing = false, snaps = [];
  var col = "#E21B71", w = 3, alpha = 1, straight = false, startY = 0;
  function fit() {
    var img = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width));
    canvas.height = Math.max(1, Math.round(r.height));
    ctx = canvas.getContext("2d");
    if (img) ctx.putImageData(img, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
  }
  function pt(e) {
    var t = e.touches ? e.touches[0] : e, r = canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  function start(e) {
    if (!ctx) fit();
    e.preventDefault();
    if (snaps.length > 14) snaps.shift();
    snaps.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    drawing = true;
    var p = pt(e);
    startY = p.y;
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.lineCap = straight ? "butt" : "round";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + .01, p.y); ctx.stroke();
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    var p = pt(e);
    /* a highlighter never wanders off the line it started on */
    ctx.lineTo(p.x, straight ? startY : p.y); ctx.stroke();
  }
  function end() { drawing = false; }
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("touchstart", start, { passive: false });
  window.addEventListener("mousemove", move);
  canvas.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("mouseup", end);
  window.addEventListener("touchend", end);
  return {
    fit: fit,
    setColor: function (c) { col = c; },
    /* "mark" behaves like a PDF highlighter: a fat straight band in a light
       colour. The canvas itself is mix-blend-mode: multiply, so the text
       underneath shows through instead of being painted over. */
    setPen: function (kind) {
      straight = (kind === "mark");
      if (kind === "thin") { w = 3; alpha = 1; }
      else if (kind === "thick") { w = 9; alpha = 1; }
      else { w = 20; alpha = .55; }
    },
    undo: function () { var s = snaps.pop(); if (s && ctx) ctx.putImageData(s, 0, 0); },
    clear: function () { snaps = []; if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); },
    hasCtx: function () { return !!ctx; }
  };
}

/* screen-wide overlay pen */
var Draw = (function () {
  var cv = $("#draw"), bar = $("#draw-bar"), painter = null, on = false;
  function toggle(force) {
    on = force == null ? !on : force;
    cv.classList.toggle("on", on);
    bar.classList.toggle("on", on);
    $("#btn-pen").classList.toggle("on", on);
    if (on) {
      if (!painter) painter = makePainter(cv);
      painter.fit();
    }
  }
  window.addEventListener("resize", function () { if (on && painter) painter.fit(); });
  $$(".draw-bar .swatch").forEach(function (s) {
    s.addEventListener("click", function () {
      $$(".draw-bar .swatch").forEach(function (o) { o.setAttribute("aria-pressed", o === s); });
      if (painter) painter.setColor(s.dataset.col);
    });
  });
  $$(".draw-bar [data-pen]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$(".draw-bar [data-pen]").forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
      if (!painter) return;
      painter.setPen(b.dataset.pen);
      /* switching to the marker picks yellow, switching back picks ink */
      var want = b.dataset.pen === "mark" ? "#FFE24A" : "#E21B71";
      var sw = $$(".draw-bar .swatch").filter(function (o) { return o.dataset.col === want; })[0];
      if (sw) {
        $$(".draw-bar .swatch").forEach(function (o) { o.setAttribute("aria-pressed", o === sw); });
        painter.setColor(want);
      }
    });
  });
  $("#pen-undo").onclick = function () { if (painter) painter.undo(); };
  $("#pen-clear").onclick = function () { if (painter) painter.clear(); };
  $("#pen-close").onclick = function () { toggle(false); };
  return { toggle: toggle };
})();

/* ============================================================= YENİ SATIŞ */

/* ---------------------------------------------------------- 0. setup */
var setupDraft = { mode: null, firm: "", person: "", city: "İstanbul", cat: "", pkg: "",
                   criteria: [], objections: [] };

RENDER.setup = function () {
  var v = $("#v-setup"), d = setupDraft;
  var cities = cityList(P.geo.sahaIller);
  var cats = catList(
    P.sas.blocks[0].rows.map(function (r) { return r.category.trim(); }));

  var h = '<div class="sec-head"><span class="kick">Görüşme başlangıcı</span>' +
    "<h2>Bu görüşmeyi nasıl açacaksınız?</h2>" +
    "<p>Genel sunum her firmaya uyar. Görüşmeye özel sunum, firmayı dinledikten sonra " +
    "yalnızca onun konuştuğu başlıkları öne çıkarır.</p></div>";

  h += '<div class="mode-pick">' +
    '<button class="mode-card" data-mode="genel" aria-pressed="' + (d.mode === "genel") + '">' +
    '<div class="ic">📖</div><h3>Genel Sunum</h3>' +
    "<p>Standart akış: tanıtım → AVM benzetmesi → simülatör → teklif. Hazırlık gerektirmez.</p></button>" +
    '<button class="mode-card" data-mode="ozel" aria-pressed="' + (d.mode === "ozel") + '">' +
    '<div class="ic">🎯</div><h3>Görüşmeye Özel Sunum</h3>' +
    "<p>Firmayı dinlerken işaretleyin, sonra açın. Ekranda firmanın adı ve tam da " +
    "konuştuğunuz başlıklar çıkar.</p></button></div>";

  if (d.mode === "ozel") {
    h += '<div class="card" style="margin-top:14px">' + repNote(
      "Bu ekranı <b>firmaya göstermeden</b> doldurun. Firma konuşurken siz işaretleyin; " +
      "\"Sunumu Hazırla\" dedikten sonra ekranı çevirin.") +
      '<div class="grid g2"><div><label class="fld">Firma adı *</label>' +
      '<input type="text" id="su-firm" value="' + esc(d.firm) + '" placeholder="Örn. Düğün Köşkü"></div>' +
      '<div><label class="fld">Görüştüğünüz kişi</label>' +
      '<input type="text" id="su-person" value="' + esc(d.person) + '" placeholder="Örn. Ayşe Hanım"></div></div>' +
      '<div class="grid g3" style="margin-top:12px"><div><label class="fld">Şehir</label><select id="su-city">' +
      cities.map(function (c) {
        return '<option' + (c === d.city ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") +
      '</select></div><div><label class="fld">Kategori</label><select id="su-cat"><option value="">Seçilmedi</option>' +
      cats.map(function (c) {
        return '<option' + (c === d.cat ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") +
      '</select></div><div><label class="fld">İlgilendiği paket</label><select id="su-pkg">' +
      ["", "Pro Start 6", "Pro Start 12", "Winner 2X", "Winner 4X", "Winner 6X"].map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === d.pkg ? " selected" : "") + ">" +
          (c || "Seçilmedi") + "</option>"; }).join("") +
      "</select></div></div>";

    h += '<div style="margin-top:18px"><label class="fld">Firma neye önem veriyor?</label>' +
      '<div class="chips" id="su-crit">' + C.criteria.map(function (c) {
        return '<button class="chip" data-k="' + esc(c.k) + '" aria-pressed="' +
          (d.criteria.indexOf(c.k) >= 0) + '">' + c.icon + " " + esc(c.t) + "</button>";
      }).join("") + "</div></div>";

    h += '<div style="margin-top:18px"><label class="fld">Hangi itirazları duydunuz?</label>' +
      '<div class="chips" id="su-obj">' + C.objections.map(function (o) {
        return '<button class="chip" data-k="' + o.id + '" aria-pressed="' +
          (d.objections.indexOf(o.id) >= 0) + '">' + o.icon + " " + esc(o.tag) + "</button>";
      }).join("") + "</div></div>";

    h += '<div style="margin-top:20px" class="chips"><button class="btn" id="su-go">Sunumu Hazırla →</button>' +
      (state.meeting ? '<button class="btn ghost" id="su-clear">Görüşmeyi kapat</button>' : "") +
      "</div></div>";
  } else if (d.mode === "genel") {
    h += '<div class="card" style="margin-top:14px"><h3>Hazır</h3>' +
      "<p style='color:var(--mute)'>Standart sunumla ilerleyeceksiniz.</p>" +
      '<button class="btn" id="su-genel">Sunumu Aç →</button></div>';
  }

  v.innerHTML = h;

  $$("#v-setup .mode-card").forEach(function (b) {
    b.addEventListener("click", function () { setupDraft.mode = b.dataset.mode; RENDER.setup(); });
  });
  ["firm", "person"].forEach(function (k) {
    var el = $("#su-" + k);
    if (el) el.addEventListener("input", function () { setupDraft[k] = this.value; });
  });
  ["city", "cat", "pkg"].forEach(function (k) {
    var el = $("#su-" + k);
    if (el) el.addEventListener("change", function () { setupDraft[k] = this.value; });
  });
  function multi(sel, key) {
    $$(sel + " .chip").forEach(function (b) {
      b.addEventListener("click", function () {
        var arr = setupDraft[key], k = b.dataset.k, i = arr.indexOf(k);
        if (i >= 0) arr.splice(i, 1); else arr.push(k);
        b.setAttribute("aria-pressed", i < 0);
      });
    });
  }
  multi("#su-crit", "criteria");
  multi("#su-obj", "objections");

  var go = $("#su-go");
  if (go) go.addEventListener("click", function () {
    var f = ($("#su-firm").value || "").trim();
    if (!f) { $("#su-firm").focus(); return; }
    state.meeting = {
      firm: f, person: setupDraft.person, city: setupDraft.city,
      cat: setupDraft.cat, pkg: setupDraft.pkg,
      criteria: setupDraft.criteria.slice(), objections: setupDraft.objections.slice()
    };
    resetNewSale();
    show("new", "intro");
  });
  var cl = $("#su-clear");
  if (cl) cl.addEventListener("click", function () {
    state.meeting = null; resetNewSale(); RENDER.setup(); drawRibbon();
  });
  var gn = $("#su-genel");
  if (gn) gn.addEventListener("click", function () {
    state.meeting = null; resetNewSale(); show("new", "intro");
  });
};

function resetNewSale() {
  ["intro", "avm", "packages", "objections", "stories", "app", "flow", "sim", "board"]
    .forEach(function (k) {
      var el = $("#v-" + k);
      if (el) { el.dataset.done = ""; el.innerHTML = ""; }
    });
  offerLines = null;
}

/* ---------------------------------------------------------- 1. intro */
RENDER.intro = function () {
  var v = $("#v-intro");
  if (v.dataset.done) return; v.dataset.done = "1";
  var I = C.intro, m = state.meeting;

  var h = '<div class="hero"><div class="kick">' + esc(I.kicker) + "</div>" +
    "<h1>" + esc(I.title) + "</h1>" +
    "<p>" + (m ? "<b>" + esc(m.firm) + "</b> için hazırlandı. " : "") + esc(I.lead) + "</p></div>";

  h += '<div class="grid g' + Math.min(5, I.stats.length) + '" style="margin-top:14px">' +
    I.stats.map(function (s) {
      return '<div class="stat"><div class="v num">' + esc(s.v) + '</div><div class="l">' + esc(s.l) +
        '</div><div class="s">' + esc(s.s) + "</div></div>";
    }).join("") + "</div>";

  if (m && m.criteria.length) {
    h += '<div class="card" style="margin-top:22px;border-color:var(--pink-20);background:var(--pink-05)">' +
      "<h3 class='accent'>" + esc(m.firm) + " için öne çıkanlar</h3>" +
      "<p style='font-size:13.5px;color:var(--ink-2);margin:6px 0 10px'>Görüşmede konuştuğumuz başlıklar:</p>" +
      '<div class="grid g2">' + m.criteria.map(function (k) {
        var c = C.criteria.filter(function (x) { return x.k === k; })[0];
        return c ? '<div style="display:flex;gap:10px;align-items:flex-start">' +
          '<span style="font-size:19px">' + c.icon + '</span><span><b>' + esc(c.t) + "</b><br>" +
          "<span style='font-size:13px;color:var(--ink-2)'>" + esc(c.answer) + "</span></span></div>" : "";
      }).join("") + "</div></div>";
  }

  h += '<div class="sec-head" style="margin-top:26px"><span class="kick">Ne sunuyoruz</span>' +
    "<h2>Bir listelemeden çok daha fazlası, <span class='accent'>kapsamlı bir iş ortaklığı</span></h2></div>" +
    repNote("Firma sahibi genelde \"listelenme\" satın aldığını sanır. Bu dördünü tek tek sayın — algılanan değer burada oluşur.") +
    '<div class="grid g4">' + I.pillars.map(function (p) {
      return '<div class="card pillar"><div class="ic">' + p.icon + "</div><h3>" + esc(p.t) +
        "</h3><p>" + esc(p.d) + '</p><div class="pf">' + esc(p.proof) + "</div></div>";
    }).join("") + "</div>";

  h += '<div class="grid g2" style="margin-top:26px;align-items:start">';
  h += '<div class="card"><div class="sec-head"><span class="kick">Çiftin yolculuğu</span>' +
    "<h2>Çift size nasıl ulaşıyor?</h2></div>" +
    '<div class="funnel">' + I.funnel.map(function (f, i) {
      return '<div class="fstep"><div class="no num">' + (i + 1) + '</div><div style="flex:1"><div class="t">' +
        esc(f.t) + '</div><div class="d">' + f.d + "</div>" +
        (i === 0 ? '<div class="gsearch"><input type="text" id="g-q" value="' +
          esc((m && m.city ? m.city + " " : "") + (m && m.cat ? m.cat : "düğün mekanları")) +
          '"><button class="btn" id="g-go">Google\'da ara ↗</button></div>' : "") +
        "</div></div>";
    }).join("") + "</div></div>";

  var T = I.traffic, cols = { pink: "var(--pink)", green: "var(--green)", teal: "var(--teal)", soft: "var(--soft-pink)" };
  h += '<div class="card"><div class="sec-head"><span class="kick">Kanıt</span><h2>' + esc(T.title) + "</h2></div>" +
    '<div class="tstack">' + T.parts.map(function (p) {
      return '<div style="flex:' + p.v + ";background:" + cols[p.c] + '">%' + p.v + "</div>";
    }).join("") + "</div>" +
    '<div class="tlegend">' + T.parts.map(function (p) {
      return '<span><i style="background:' + cols[p.c] + '"></i>' + esc(p.l) + "</span>";
    }).join("") + "</div>" +
    '<div class="punch">' + esc(T.punch) + "</div>" +
    '<div class="note">' + esc(T.note) + "</div>" +
    '<button class="btn sm" style="margin-top:12px" onclick="__go(\'new\',\'sim\')">Simülatörde firmaya özel hesapla →</button></div>';
  h += "</div>";

  /* Live proof sits right after the "where do couples come from" argument:
     first we say it, then they watch it happen. */
  h += '<div style="margin-top:26px">' + liveMapCard() + "</div>";

  h += '<div class="card rep-only" style="margin-top:26px"><div class="sec-head"><span class="kick">Bağlantılar</span>' +
    "<h2>Görüşmede açabileceğiniz kaynaklar</h2></div><div class=\"chips\">" +
    [["B2B sayfamız", C.links.b2b], ["Başarı hikâyeleri", C.links.stories],
     ["Instagram (iş ortağım)", C.links.instagram], ["YouTube kanalı", C.links.youtube],
     ["Eğitim videosu", C.links.eduVideo], ["Yeni özellikler sunumu", C.links.features]]
      .map(function (l) {
        return '<a class="chip" target="_blank" rel="noopener" href="' + l[1] + '">' + esc(l[0]) + " ↗</a>";
      }).join("") + "</div></div>";

  v.innerHTML = h;
  startLiveMap();
  $$("#v-intro .fstep").forEach(function (s) {
    s.addEventListener("click", function (e) {
      if (e.target.closest(".gsearch")) return;
      $$("#v-intro .fstep").forEach(function (o) { o.classList.toggle("on", o === s); });
    });
  });
  function goSearch() {
    var q = ($("#g-q").value || "").trim();
    if (q) window.open("https://www.google.com/search?q=" + encodeURIComponent(q), "_blank", "noopener");
  }
  $("#g-go").addEventListener("click", goSearch);
  $("#g-q").addEventListener("keydown", function (e) { if (e.key === "Enter") goSearch(); });
};

/* ---------------------------------------------------------- 2. AVM */
RENDER.avm = function () {
  var v = $("#v-avm");
  if (v.dataset.done) return; v.dataset.done = "1";
  var A = C.avm;

  var hot = function (k, x, y, w, hh) {
    return '<g class="hot" data-k="' + k + '"><rect class="hit" x="' + x + '" y="' + y +
      '" width="' + w + '" height="' + hh + '" rx="6"/></g>';
  };

  /* Floors run 2. kat → 1. kat → giriş, with the door and the couples at the
     bottom, so "better package = closer to the customers" reads correctly. */
  var svg =
  '<svg class="mall" viewBox="0 0 640 400">' +
    '<rect x="0" y="344" width="640" height="56" fill="#5b6472"/>' +
    '<g stroke="#f3f4f6" stroke-width="4" stroke-dasharray="26 20"><line x1="0" y1="374" x2="640" y2="374"/></g>' +
    '<text x="14" y="393" fill="#e9edf2" font-size="11.5" font-weight="700">Google — çifti buraya getiren yol</text>' +
    /* building */
    '<rect x="120" y="34" width="470" height="278" rx="12" fill="#ffffff" stroke="#cfd8e3" stroke-width="2"/>' +
    '<rect x="120" y="34" width="470" height="30" rx="12" fill="#E21B71"/>' +
    '<text x="355" y="55" text-anchor="middle" fill="#FFFAF0" font-size="14" font-weight="800">düğün.com</text>' +
    '<line x1="120" y1="146" x2="590" y2="146" stroke="#e2e8f0" stroke-width="2"/>' +
    '<line x1="120" y1="228" x2="590" y2="228" stroke="#e2e8f0" stroke-width="2"/>' +
    '<text x="130" y="80" fill="#94a3b8" font-size="10" font-weight="800">2. KAT</text>' +
    '<text x="130" y="162" fill="#94a3b8" font-size="10" font-weight="800">1. KAT</text>' +
    '<text x="130" y="244" fill="#94a3b8" font-size="10" font-weight="800">GİRİŞ KAT</text>' +
    /* other tenants, so empty floors do not look broken */
    '<g fill="#eef2f6">' +
      '<rect x="252" y="72" width="140" height="58" rx="7"/><rect x="434" y="72" width="140" height="58" rx="7"/></g>' +
    '<text x="413" y="106" text-anchor="middle" fill="#b6c0cd" font-size="10.5" font-weight="700">diğer firmalar</text>' +
    /* entrance at the bottom, where the couples are */
    '<rect x="298" y="296" width="112" height="16" rx="4" fill="#960A4B"/>' +
    '<text x="354" y="308" text-anchor="middle" fill="#FFFAF0" font-size="9.5" font-weight="800">GİRİŞ</text>' +
    /* info desk */
    '<rect x="130" y="252" width="102" height="34" rx="8" fill="#26B2AB"/>' +
    '<text x="181" y="273" text-anchor="middle" fill="#fff" font-size="10.5" font-weight="800">DANIŞMA · WP</text>' +
    /* couples on the street */
    '<g fill="#8D80E5"><circle cx="300" cy="330" r="6"/><circle cx="318" cy="330" r="6"/>' +
      '<circle cx="356" cy="332" r="6"/><circle cx="374" cy="332" r="6"/></g>' +
    '<text x="398" y="336" fill="#e9edf2" font-size="11" font-weight="700">evlenecek çiftler</text>' +
    /* the shop that moves */
    '<g id="store" style="transition:transform .55s cubic-bezier(.16,1,.3,1)">' +
      '<rect x="0" y="0" width="140" height="62" rx="8" fill="#FFE9F1" stroke="#E21B71" stroke-width="2.5"/>' +
      '<rect id="vitrin" x="8" y="8" width="124" height="30" rx="5" fill="#FFAFC8"/>' +
      '<text x="70" y="54" text-anchor="middle" fill="#960A4B" font-size="10.5" font-weight="800">MEKANINIZ</text>' +
    "</g>" +
    /* instagram shop on the street */
    '<rect x="14" y="252" width="86" height="60" rx="8" fill="#fff" stroke="#cfd8e3" stroke-width="2"/>' +
    '<text x="57" y="278" text-anchor="middle" font-size="18">📱</text>' +
    '<text x="57" y="300" text-anchor="middle" fill="#64748b" font-size="9" font-weight="800">INSTAGRAM</text>' +
    hot("yol", 0, 344, 640, 56) +
    hot("avm", 120, 34, 470, 30) +
    hot("kat", 120, 64, 62, 248) +
    hot("danisma", 126, 248, 110, 42) +
    hot("sokak", 10, 248, 94, 68) +
    hot("kapi", 294, 292, 120, 24) +
    hot("magaza", 250, 230, 326, 66) +
    hot("vitrin", 250, 234, 326, 34) +
    hot("etiket", 450, 150, 130, 70) +
  "</svg>";

  var h = '<div class="sec-head"><span class="kick">' + esc(A.kicker) + "</span><h2>" + esc(A.title) + "</h2>" +
    "<p>" + A.lead + "</p></div>" +
    repNote("Her parçaya dokunun ve karşılığını anlatın. Paket seçicisini kullanarak mağazayı kat değiştirin — " +
      "metafor, hareket edince akılda kalıyor. Kalemi açıp binanın üstüne çizmek de işe yarıyor.");

  h += '<div class="avm-stage"><div>' + svg +
    '<div class="card" style="margin-top:12px"><label class="fld">Paketi değiştirin — mağaza kat değiştirsin</label>' +
    '<div class="chips" id="avm-x">' + A.floors.map(function (f) {
      return '<button class="chip" data-x="' + f.x + '" aria-pressed="' + (f.x === 6) + '">' + esc(f.label) + "</button>";
    }).join("") + "</div>" +
    '<div style="margin-top:12px"><label class="fld">Profil kalitesi — vitrin doluluğu</label>' +
    '<input type="range" id="avm-q" min="0" max="100" value="70"></div>' +
    '<div id="avm-state" class="note"></div></div></div>' +
    '<div><div class="card avm-info" id="avm-info"></div></div></div>';

  h += '<div class="card" style="margin-top:14px"><div class="sec-head"><h3>Metaforun tüm parçaları</h3></div>' +
    '<div class="grid g3">' + A.parts.map(function (p) {
      return '<div style="padding:12px;border:1px solid var(--line);border-radius:var(--r-field)">' +
        '<div style="font-size:18px">' + p.icon + '</div><div style="font-weight:800;font-size:13.5px;margin:4px 0">' +
        esc(p.t) + '</div><div style="font-size:12.5px;color:var(--mute)">' + esc(p.d) + "</div></div>";
    }).join("") + "</div></div>";

  v.innerHTML = h;

  /* 6X sits next to the door; the weaker the package, the further away/upstairs */
  /* One lane per floor. 6X sits directly above the door; 4X is the far corner
     of the same floor; 3X/2X are a floor up. The gap has to be visible or the
     metaphor does not land. */
  var POS = { 6: [252, 232], 4: [434, 232], 3: [252, 150], 2: [434, 150], 0: [14, 252] };
  function setX(x) {
    var p = POS[x] || POS[6];
    $("#store").setAttribute("transform", "translate(" + p[0] + "," + p[1] + ")");
    var f = A.floors.filter(function (o) { return o.x === x; })[0];
    $("#avm-state").innerHTML = "Konum: <b>" + esc(f.floor) + "</b> · görünürlük ağırlığı <b>" +
      f.weight + "</b>" + (x === 0 ? " — AVM'nin dışındasınız, sizi sadece adresinizi bilen bulur." : "");
  }
  function setQ(q) {
    var el = $("#vitrin");
    el.setAttribute("fill", q > 75 ? "#E21B71" : q > 45 ? "#FFAFC8" : "#e2e8f0");
    el.setAttribute("opacity", 0.45 + q / 180);
  }
  function pick(k) {
    var p = A.parts.filter(function (o) { return o.k === k; })[0];
    if (!p) return;
    $$("#v-avm .hot").forEach(function (g) { g.classList.toggle("on", g.dataset.k === k); });
    $("#avm-info").innerHTML = '<div class="ic">' + p.icon + "</div><h3>" + esc(p.t) + "</h3><p>" +
      esc(p.d) + '</p><div class="avm-say rep-only"><b>Şöyle söyleyin</b>' + esc(p.say) + "</div>";
  }
  $$("#v-avm .hot").forEach(function (g) { g.addEventListener("click", function () { pick(g.dataset.k); }); });
  $$("#avm-x .chip").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("#avm-x .chip").forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
      setX(+b.dataset.x);
    });
  });
  $("#avm-q").addEventListener("input", function () { setQ(+this.value); });
  setX(6); setQ(70); pick("avm");
};

/* Live-activity map. Real Turkey outline (CONTENT.turkeyMap), placeholder
   events (CONTENT.liveMap.events). When the rep has set up a meeting for a
   given city, only that city's activity is shown — the venue should see its
   own market, not the country. */
var liveTimer = null;

/* Same feed as the deck: data/livemap.js, built from real providers and real
   trailing-week demand, restricted to the panel's city and category scope. */
var LIVE = (function () {
  var src = window.LIVEMAP || {};
  return {
    title: "Son 1 haftada neler oldu?",
    info: "Bu haritada; Düğün.com üzerinden firmalara ulaşıp teklif isteyen "
        + "veya anlaşma sağlayan çiftlerin son 1 haftalık verilerini görmektesiniz.",
    labels: src.labels || { teklif: "adlı çift teklif istedi",
                            anlasma: "adlı çift ile anlaşma yapıldı!" },
    events: (src.events || []).filter(function (e) {
      return CFG.cityAllowed(e.city) && CFG.catAllowed(e.cat);
    })
  };
})();

function liveEvents() {
  var all = LIVE.events;
  var city = state.meeting && state.meeting.city;
  if (city) {
    var mine = all.filter(function (e) { return e.city === city; });
    if (mine.length) return mine;
  }
  return all;
}

function liveMapCard() {
  var M = C.turkeyMap;
  var evs = liveEvents();
  var cities = [];
  evs.forEach(function (e) { if (cities.indexOf(e.city) < 0) cities.push(e.city); });

  var pins = cities.map(function (c) {
    var p = M.cities[c];
    if (!p) return "";
    return '<g class="tr-pin" data-city="' + esc(c) + '">' +
      '<circle class="halo" cx="' + p[0] + '" cy="' + p[1] + '" r="26"/>' +
      '<circle class="dot" cx="' + p[0] + '" cy="' + p[1] + '" r="9"/></g>';
  }).join("");

  return '<div class="card" style="margin-top:12px">' +
    '<div class="live-head"><h3>' + esc(LIVE.title) + "</h3>" +
    '<span class="live-badge week"><i></i>SON 1 HAFTA</span>' +
    '<span class="info-dot" tabindex="0" aria-label="Bilgi">i' +
    '<span class="info-pop">' + esc(LIVE.info) + "</span></span></div>" +
    (state.meeting && state.meeting.city
      ? '<div class="note" style="margin:6px 0 10px">Yalnızca <b>' + esc(state.meeting.city) +
        "</b> verisi gösteriliyor.</div>" : "") +
    '<div class="tr-map"><svg viewBox="' + M.viewBox + '" preserveAspectRatio="xMidYMid meet">' +
    '<path class="tr-land" d="' + M.d + '"/>' + pins +
    '</svg><div class="tr-balloons" id="tr-balloons"></div></div>' +
    '<div class="note">Örnek görünüm — canlı veri bağlantısı kurulacak.</div></div>';
}

function startLiveMap() {
  var M = C.turkeyMap, evs = liveEvents(), host = $("#tr-balloons");
  if (!host) return;
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }

  var vb = M.viewBox.split(" ");
  var VW = +vb[2], VH = +vb[3];
  var SLOTS = 1, STEP = 3200;      // one balloon on screen at a time

  /* Round-robin across cities so four balloons never pile up on one pin.
     With a single-city meeting there is only one bucket, which is fine. */
  var byCity = {}, cityOrder = [];
  evs.forEach(function (e) {
    if (!byCity[e.city]) { byCity[e.city] = []; cityOrder.push(e.city); }
    byCity[e.city].push(e);
  });
  var queue = [], added = true;
  for (var round = 0; added; round++) {
    added = false;
    cityOrder.forEach(function (c) {
      if (byCity[c][round]) { queue.push(byCity[c][round]); added = true; }
    });
  }

  var cursor = 0, active = [];

  function bubble(e) {
    var p = M.cities[e.city];
    if (!p) return null;
    var xp = p[0] / VW * 100, yp = p[1] / VH * 100;
    var el = document.createElement("div");
    /* flip below the pin near the top edge, and pull in near the sides, so a
       balloon can never be clipped by the map frame */
    el.className = "tr-bub " + (e.t === "anlasma" ? "deal " : "offer ") +
      (yp < 42 ? "below " : "") + (xp < 20 ? "alignL" : xp > 80 ? "alignR" : "");
    el.style.left = xp + "%";
    el.style.top = yp + "%";
    el.innerHTML = '<div class="box"><div class="hd">' +
      '<img class="ph" alt="" src="' + esc(e.img || "") + '">' +
      '<div class="tx"><span class="city">' + esc(e.city) +
      (e.d ? " · " + esc(e.d) : "") + "</span>" +
      "<b>" + esc(e.name) + '</b><span class="cat">' + esc(e.cat) + "</span></div></div>" +
      '<div class="act">' + (e.t === "anlasma" ? "🤝 " : "✉️ ") +
      (e.couple ? esc(e.couple) + " " : "") + esc(LIVE.labels[e.t]) +
      (e.ago ? " <i>" + esc(e.ago) + "</i>" : "") + "</div></div>";
    /* A missing cover must never leave a broken-image icon on a customer's
       screen — swap in the venue's initial on the brand gradient instead. */
    var img = el.querySelector(".ph");
    if (img) img.addEventListener("error", function () {
      var fb = document.createElement("div");
      fb.className = "ph ph-fb";
      fb.textContent = (e.name || "?").charAt(0).toLocaleUpperCase("tr");
      if (img.parentNode) img.parentNode.replaceChild(fb, img);
    });
    return el;
  }

  /* The class-based anchoring is a good first guess, but the map box shrinks a
     lot on a phone. Measure the real box and flip it until it is inside. */
  function fitInside(el) {
    var box = el.querySelector(".box");
    /* below the mobile breakpoint the balloons are a stacked feed, not pins on
       the map — there is nothing to nudge */
    if (!box || getComputedStyle(el).position !== "absolute") return;
    for (var pass = 0; pass < 3; pass++) {
      var m = host.getBoundingClientRect(), r = box.getBoundingClientRect();
      var moved = false;
      if (r.right > m.right - 1 && !el.classList.contains("alignR")) {
        el.classList.remove("alignL"); el.classList.add("alignR"); moved = true;
      } else if (r.left < m.left + 1 && !el.classList.contains("alignL")) {
        el.classList.remove("alignR"); el.classList.add("alignL"); moved = true;
      }
      if (r.top < m.top + 1 && !el.classList.contains("below")) {
        el.classList.add("below"); moved = true;
      } else if (r.bottom > m.bottom - 1 && el.classList.contains("below")) {
        el.classList.remove("below"); moved = true;
      }
      if (!moved) return;
    }
  }

  function fade(node) {
    if (!node || !node.parentNode) return;
    node.classList.add("out");
    setTimeout(function () { if (node.parentNode) node.remove(); }, 450);
  }

  function pop() {
    if (!document.body.contains(host)) {      // the page was re-rendered
      clearInterval(liveTimer); liveTimer = null; return;
    }
    /* the AVM view is cached, so the timer outlives navigation — idle while the
       section is off screen instead of churning DOM nobody can see */
    if (!$("#v-intro").classList.contains("on")) return;
    var el = bubble(queue[cursor % queue.length]);
    cursor++;
    if (!el) return;
    host.appendChild(el);
    fitInside(el);
    active.push(el);
    while (active.length > SLOTS) fade(active.shift());
  }

  pop();
  liveTimer = setInterval(pop, STEP);
}

/* ---------------------------------------------------------- 3. simulator */
RENDER.sim = function () {
  var v = $("#v-sim");
  if (v.dataset.done) return; v.dataset.done = "1";
  v.innerHTML =
    '<div class="sec-head"><span class="kick">Rakamı ekran söylesin</span>' +
    "<h2>Yeni Satış Simülatörü</h2><p>Şehir, kategori, paket ve profil kalitesini seçin; " +
    "aylık talep, yıllık toplam ve talep başına maliyet ekranda çıksın. Model 2026 verisine " +
    "dayanır ve tahmindir, taahhüt değildir.</p></div>" +
    repNote("Rakamı <b>siz söylemeyin</b> — simülatörü tarafsız bir üçüncü kişi gibi kullanın.") +
    '<div class="chips" style="margin-bottom:12px">' +
    '<a class="btn sm" target="_blank" rel="noopener" href="' + C.links.simulatorLocal + '">Tam ekran aç ↗</a>' +
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + C.links.simulatorLive + '">Canlı sürüm ↗</a>' +
    '<button class="btn sm ghost" onclick="__go(\'new\',\'packages\')">Teklife geç →</button></div>' +
    '<iframe class="simframe" src="' + C.links.simulatorLocal + '" title="Yeni Satış Simülatörü"></iframe>';
};

/* ============================== YATIRIM & TEKLİF ==========================
   Rebuilt from scratch. Order of the conversation, not order of the data:
   the venue's own numbers first, then the packages, then the price, then the
   return, and only then how they pay.

   Pricing model — this is the part that was wrong before:
     Winner 2X/4X/6X : the sheet value IS the monthly LIST price. The rep sets
                       the discount.
     Pro Start 6/12  : "Liste Fiyatı" (one per category, e.g. 60.500) is the
                       monthly list. "Aylık Fiyat" (33.275) is already the
                       DISCOUNTED sale price for that term, and
                       "Peşin Ödemede Aylık Tutar" is the sale price when the
                       term is paid up front. Both are pre-filled and editable.
     Power Start     : both columns are 6-MONTH totals; divided down to monthly.
   Every package carries its own `term` in months, so a 6-month Pro Start is
   never annualised by twelve.                                              */

var offerLines = null;
var roiState = { weddingProfit: 250000, weddingCount: 2, campaign: false,
                 priced: false, profited: false };
var payMode = "yillik";      // "yillik" = peşin, "aylik" = aydan aya

function sasBlockFor(city) {
  var map = { "İstanbul": "İstanbul", "Ankara": "Ankara", "İzmir": "İzmir", "Bursa": "Bursa",
    "Adana": "Adana - Antalya - Mersin", "Antalya": "Adana - Antalya - Mersin",
    "Mersin": "Adana - Antalya - Mersin" };
  return P.sas.blocks.filter(function (b) { return b.name === (map[city] || "Uydu İller"); })[0] || null;
}
function mosScopeFor(city) {
  return ["İstanbul", "Ankara", "Bursa"].indexOf(city) >= 0 ? city : "Uydu İller";
}
function catToMosBlock(scopeName, cat) {
  var sc = P.mos.scopes.filter(function (s) { return s.name === scopeName; })[0];
  if (!sc) return null;
  return sc.blocks.filter(function (b) { return b.categories.indexOf(cat) >= 0; })[0] || null;
}

function packagesFor(city, cat) {
  var out = [];
  var bl = sasBlockFor(city);
  if (bl) {
    var row = bl.rows.filter(function (r) { return r.category.trim() === cat; })[0];
    if (row) {
      [["Winner 6X", 0, 6], ["Winner 4X", 1, 4], ["Winner 2X", 2, 2]].forEach(function (w) {
        var pz = row.prices[w[1]];
        if (pz) out.push({ team: "SAS", name: w[0], x: w[2], term: 12,
                           listMonthly: pz, saleMonthly: null });
      });
      /* Power Start: list and sale are both 6-month totals in the sheet */
      var psList = row.prices[3], psSale = row.prices[4];
      if (psList && psSale) {
        out.push({ team: "SAS", name: "Power Start", x: 3, term: 6,
                   listMonthly: psList / 6, saleMonthly: psSale / 6 });
      }
    }
  }
  var mb = catToMosBlock(mosScopeFor(city), cat);
  if (mb && mb.list) {
    mb.terms.forEach(function (t) {
      out.push({ team: "MoS", name: t.term, x: 3,
                 term: t.term.indexOf("12") >= 0 ? 12 : 6,
                 listMonthly: mb.list,
                 saleMonthly: t.monthly,
                 prepayMonthly: t.monthlyIfUpfront,
                 prepayTotal: t.annualUpfront });
    });
  }
  return out;
}

function pkgOf(L) {
  return packagesFor(L.city, L.cat).filter(function (p) { return p.name === L.pkg; })[0] || null;
}

/* The sale price a package opens with: fixed products come pre-filled, Winner
   starts at list and waits for the rep. */
function defaultSale(pk) {
  if (!pk) return null;
  if (payMode === "yillik" && pk.prepayMonthly) return pk.prepayMonthly;
  if (pk.saleMonthly) return pk.saleMonthly;
  return pk.listMonthly;
}

function addLine(city, cat, pkg) {
  var opts = packagesFor(city, cat);
  if (!opts.length) return;
  var pk = opts.filter(function (o) { return o.name === pkg; })[0] || opts[0];
  offerLines.push({ city: city, cat: cat, pkg: pk.name, sale: defaultSale(pk) });
  roiState.priced = false; roiState.profited = false;
}

function lineTotals(L) {
  var pk = pkgOf(L);
  if (!pk) return null;
  var sale = L.sale == null ? defaultSale(pk) : L.sale;
  var months = pk.term;
  var listTotal = pk.listMonthly * months;
  /* the 1 ₺ first month replaces one instalment, it does not replace the term */
  var saleTotal = (roiState.campaign && payMode === "aylik")
    ? sale * (months - 1) + 1
    : sale * months;
  return {
    pk: pk, sale: sale, months: months,
    listMonthly: pk.listMonthly, listTotal: listTotal, saleTotal: saleTotal,
    disc: pk.listMonthly ? (1 - sale / pk.listMonthly) : 0
  };
}

function offerTotals() {
  var listTotal = 0, saleTotal = 0, monthlyList = 0, monthlySale = 0, maxTerm = 0;
  offerLines.forEach(function (L) {
    var t = lineTotals(L);
    if (!t) return;
    listTotal += t.listTotal; saleTotal += t.saleTotal;
    monthlyList += t.listMonthly; monthlySale += t.sale;
    maxTerm = Math.max(maxTerm, t.months);
  });
  return { listTotal: listTotal, saleTotal: saleTotal,
           discount: listTotal - saleTotal,
           discPct: listTotal ? (listTotal - saleTotal) / listTotal : 0,
           monthlyList: monthlyList, monthlySale: monthlySale, term: maxTerm };
}

RENDER.packages = function () {
  var v = $("#v-packages"), m = state.meeting;
  if (offerLines === null) {
    offerLines = [];
    if (m && m.city && m.cat) addLine(m.city, m.cat, m.pkg);
  }
  var cities = cityList(P.geo.sahaIller);
  var cats = catList(P.sas.blocks[0].rows.map(function (r) { return r.category.trim(); }));
  var T = offerTotals();
  var has = offerLines.length > 0;

  var h = '<div class="sec-head"><span class="kick">Yatırım &amp; Teklif</span>' +
    "<h2>Düğün.com iş ortaklığı; bir ürün satın alma değil, " +
    "<span class='accent'>yüksek getirili bir yatırımdır</span>.</h2></div>";

  /* ------------------------------------------------------ 1. venue's numbers */
  h += '<div class="card"><h3>1 · İşletmenizin rakamları</h3>' +
    "<p style='color:var(--mute);font-size:13.5px;margin:6px 0 0'>Fiyatı konuşmadan önce, " +
    "bir düğünün sizin için ne ifade ettiğini bilelim.</p>" +
    '<div class="grid g2" style="margin-top:12px">' +
    "<div><label class='fld'>Bir düğünden ortalama kazancınız (₺)</label>" +
    "<input type='number' id='roi-profit' step='10000' min='0' value='" + roiState.weddingProfit + "'></div>" +
    "<div><label class='fld'>Düğün.com'dan yılda kaç düğün beklersiniz?</label>" +
    "<input type='number' id='roi-count' step='1' min='0' value='" + roiState.weddingCount + "'>" +
    "<div class='note' style='margin-top:4px'>Zorunlu değil — boş bırakırsanız 2 kabul edilir.</div></div></div>" +
    repNote("Bu iki rakamı <b>siz doldurmayın, firmaya sorun</b>. Kendi söylediği rakam üzerinden " +
      "yapılan hesabı tartışamaz.") + "</div>";

  /* --------------------------------------------------- 2. packages + payment */
  h += '<div class="card"><h3>2 · Paket seçimi</h3>' +
    '<div style="margin-top:10px"><label class="fld">Ödeme dönemi</label>' +
    '<div class="chips" id="pay-mode">' +
    '<button class="chip" data-mode="yillik" aria-pressed="' + (payMode === "yillik") + '">Peşin ödeme</button>' +
    '<button class="chip" data-mode="aylik" aria-pressed="' + (payMode === "aylik") + '">Aydan aya ödeme</button>' +
    "</div></div>" +
    '<div class="grid g4" style="align-items:end;margin-top:14px">' +
    "<div><label class='fld'>Şehir</label><select id='nl-city'>" +
    cities.map(function (c) {
      return "<option" + ((m && c === m.city) ? " selected" : "") + ">" + esc(c) + "</option>";
    }).join("") +
    "</select></div><div><label class='fld'>Kategori</label><select id='nl-cat'>" +
    cats.map(function (c) {
      return "<option" + ((m && c === m.cat) ? " selected" : "") + ">" + esc(c) + "</option>";
    }).join("") +
    "</select></div><div><label class='fld'>Paket</label><select id='nl-pkg'></select></div>" +
    "<div><button class='btn' id='nl-add'>+ Ekle</button></div></div>";

  if (has) {
    h += '<div class="tbl-wrap" style="margin-top:14px"><table class="offer-tbl"><thead><tr>' +
      "<th>Paket</th><th class='n'>Süre</th><th class='n'>Liste / ay</th>" +
      "<th class='n'>İndirim %</th><th class='n'>Satış / ay</th>" +
      "<th class='n'>Sözleşme toplamı</th><th></th></tr></thead><tbody>" +
      offerLines.map(function (L, i) {
        var t = lineTotals(L);
        if (!t) return "";
        var fixed = !!(t.pk.saleMonthly || t.pk.prepayMonthly);
        return "<tr><td><b>" + esc(L.pkg) + "</b>" +
          (fixed ? ' <span class="pill ok">sabit fiyat</span>' : "") +
          "<div class='sub'>" + esc(L.city) + " · " + esc(L.cat) + "</div></td>" +
          "<td class='n'>" + t.months + " ay</td>" +
          "<td class='n num'>" + tl(t.listMonthly) + "</td>" +
          "<td class='n'><input type='number' class='ln-disc' data-i='" + i +
          "' step='1' min='0' max='95' value='" + n(t.disc * 100, 1).replace(",", ".") + "'></td>" +
          "<td class='n'><input type='number' class='ln-sale' data-i='" + i +
          "' step='500' min='0' value='" + Math.round(t.sale) + "'></td>" +
          "<td class='n num'><b>" + tl(t.saleTotal) + "</b></td>" +
          "<td><button class='line-del' data-i='" + i + "' title='Kaldır'>✕</button></td></tr>";
      }).join("") + "</tbody></table></div>" +
      "<div class='note'>İndirim yüzdesini yazarsanız satış fiyatı, satış fiyatını yazarsanız " +
      "indirim yüzdesi otomatik hesaplanır. Sabit fiyatlı paketler dolu gelir; ek kategori ya da " +
      "referans indirimi için üzerine yazabilirsiniz.</div>";

    if (payMode === "aylik") {
      h += '<div style="margin-top:14px"><label class="fld">Kampanya</label><div class="chips">' +
        '<button class="chip" id="camp-btn" aria-pressed="' + roiState.campaign +
        '">🎁 İlk ay 1 ₺</button></div>' +
        (roiState.campaign
          ? "<div class='note'>İlk ay 1 ₺, kalan " + (T.term - 1) + " ay normal tutar üzerinden.</div>"
          : "") + "</div>";
    }
    h += '<div style="margin-top:16px"><button class="btn" id="calc-price">Hesapla →</button></div>';
  } else {
    h += "<p style='color:var(--mute);margin:14px 0 0'>Bir paket ekleyin.</p>";
  }
  h += "</div>";

  /* ------------------------------------------------------------- 3. the price */
  if (has && roiState.priced) {
    h += '<div class="card reveal" id="price-card"><h3>3 · Teklifiniz</h3>' +
      '<div class="grid g3" style="margin-top:14px">' +
      '<div class="stat"><div class="l">Liste bedeli</div>' +
      '<div class="v num strike" data-count="' + Math.round(T.listTotal) + '">0 ₺</div></div>' +
      '<div class="stat"><div class="l">Toplam indirim</div>' +
      '<div class="v num" style="color:var(--green)" data-count="' + Math.round(T.discount) +
      '" data-prefix="− ">0 ₺</div>' +
      "<div class='s'>" + pct(T.discPct, 0) + " avantaj</div></div>" +
      '<div class="stat" style="border-color:var(--pink);background:var(--pink-05)">' +
      '<div class="l">Satış fiyatı</div>' +
      '<div class="v num" data-count="' + Math.round(T.saleTotal) + '">0 ₺</div>' +
      "<div class='s'>" + T.term + " aylık sözleşme · aylık " +
      tl(T.monthlySale) + "</div></div></div>" +
      '<div style="margin-top:16px"><button class="btn" id="calc-roi">Kârımı hesapla →</button></div></div>';
  }

  /* ------------------------------------------------------------ 4. the return */
  if (has && roiState.priced && roiState.profited) {
    var profit = roiState.weddingProfit || 0;
    var count = roiState.weddingCount || 0;
    var payback = profit ? Math.ceil(T.saleTotal / profit) : null;
    var gross = profit * count;
    var net = gross - T.saleTotal;
    h += '<div class="roi-hero reveal" style="margin-top:14px"><div class="grid g3">' +
      '<div class="roi-cell"><div class="l">Yatırımınız</div>' +
      '<div class="v num" data-count="' + Math.round(T.saleTotal) + '">0 ₺</div></div>' +
      '<div class="roi-cell"><div class="l">' + n(count) + " düğünden kazancınız</div>" +
      '<div class="v num" data-count="' + Math.round(gross) + '">0 ₺</div></div>' +
      '<div class="roi-cell"><div class="l">Yatırımın geri dönüşü</div>' +
      '<div class="v num">' + (T.saleTotal ? n(gross / T.saleTotal, 1) + "×" : "—") + "</div></div></div>";
    if (payback) {
      h += '<div style="margin-top:16px;background:rgba(255,250,240,.16);border-radius:var(--r-field);' +
        'padding:14px 18px;font-size:16px;line-height:1.6;text-align:center">' +
        "<b>" + n(payback) + " düğün</b> yatırımınızı karşılıyor." +
        (count > payback
          ? " Beklediğiniz " + n(count) + " düğünün kalan <b>" + n(count - payback) +
            " tanesi tamamen kârınız</b>: <b>" + tl((count - payback) * profit) + "</b>."
          : " Bundan sonra aldığınız her düğün tamamen kârınıza kalır.") + "</div>";
    }
    h += "</div>";
    if (net > 0) {
      h += '<div class="punch" style="margin-top:12px">Yatırım düşüldükten sonra elinizde kalan: <b>' +
        tl(net) + "</b></div>";
    }
  }

  /* ---------------------------------------------------------- 5. how they pay */
  if (has && roiState.priced) {
    h += '<div class="card"><h3>5 · Ödeme</h3>';
    if (payMode === "yillik") {
      var withCheque = offerLines.some(function (L) {
        var pk = pkgOf(L); return pk && pk.team === "MoS"; });
      h += '<div class="punch">💳 <b>Peşin ödemenin ekstra avantajından faydalanın.</b></div>' +
        '<div style="margin-top:12px"><label class="fld">Ödeme yöntemleri</label><div class="chips">' +
        P.mos.payment.methods.map(function (x) {
          return '<span class="pill pink">' + esc(x) + "</span>"; }).join("") + "</div></div>";
      if (withCheque) {
        var terms = P.mos.payment.checkTerms.filter(function (c) {
          return offerLines.some(function (L) { var pk = pkgOf(L); return pk && pk.name === c.term; });
        });
        if (terms.length) {
          h += "<table style='margin-top:12px'><thead><tr><th>Ürün</th><th>Parçalı çek vadesi</th>" +
            "<th>Başlangıç maks.</th></tr></thead><tbody>" + terms.map(function (c) {
              return "<tr><td><b>" + esc(c.term) + "</b></td><td>" + esc(c.split) + "</td><td>" +
                esc(c.start) + "</td></tr>"; }).join("") + "</tbody></table>";
        }
      }
    } else {
      h += '<div class="punch">📅 <b>Aydan aya ödeme imkanı.</b></div>' +
        "<p style='margin-top:10px;font-size:13.5px'>Aylık <b>" + tl(T.monthlySale) + "</b>" +
        (roiState.campaign ? " · ilk ay <b>1 ₺</b>" : "") +
        " · toplam " + T.term + " ay.</p>";
    }
    h += "</div>";
  }

  h += '<details class="card rep-only"><summary style="cursor:pointer;font-weight:800">' +
    "Tüm liste fiyatları (" + esc(P.updated) + ")</summary>" +
    "<p class='note'>" + esc(P.note) + " " + esc(P.sas.unitNote) + "</p>" +
    priceTables() + "</details>";

  v.innerHTML = h;
  bindPackages();
  countUp();
};

/* Numbers roll up when a card first appears. Time-based, not step-based, and
   with a guaranteed final write: a throttled timer must never leave a wrong
   figure on screen in front of a customer. */
function countUp() {
  $$("#v-packages [data-count]").forEach(function (el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    var target = +el.dataset.count, prefix = el.dataset.prefix || "";
    var DUR = 620, t0 = Date.now();
    var iv = setInterval(function () {
      var p = Math.min(1, (Date.now() - t0) / DUR);
      el.textContent = prefix + tl(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(iv);
    }, 24);
    setTimeout(function () { clearInterval(iv); el.textContent = prefix + tl(target); }, DUR + 300);
  });
}

function bindPackages() {
  function refreshPkgOptions() {
    var opts = packagesFor($("#nl-city").value, $("#nl-cat").value);
    $("#nl-pkg").innerHTML = opts.length
      ? opts.map(function (o) {
          return '<option value="' + esc(o.name) + '">' + esc(o.name) + "</option>"; }).join("")
      : "<option value=''>Bu kategori için fiyat yok</option>";
  }
  $("#nl-city").addEventListener("change", refreshPkgOptions);
  $("#nl-cat").addEventListener("change", refreshPkgOptions);
  refreshPkgOptions();
  $("#nl-add").addEventListener("click", function () {
    var pkg = $("#nl-pkg").value;
    if (!pkg) return;
    addLine($("#nl-city").value, $("#nl-cat").value, pkg);
    RENDER.packages();
  });

  /* discount and sale price are two views of the same number */
  $$("#v-packages .ln-disc").forEach(function (inp) {
    inp.addEventListener("change", function () {
      var L = offerLines[+this.dataset.i], pk = pkgOf(L);
      var d = clamp(parseFloat(String(this.value).replace(",", ".")) || 0, 0, 95);
      L.sale = Math.round(pk.listMonthly * (1 - d / 100));
      roiState.priced = false; roiState.profited = false;
      RENDER.packages();
    });
  });
  $$("#v-packages .ln-sale").forEach(function (inp) {
    inp.addEventListener("change", function () {
      var L = offerLines[+this.dataset.i], pk = pkgOf(L);
      L.sale = clamp(+this.value || 0, 0, pk.listMonthly * 2);
      roiState.priced = false; roiState.profited = false;
      RENDER.packages();
    });
  });
  $$("#v-packages .line-del").forEach(function (b) {
    b.addEventListener("click", function () {
      offerLines.splice(+this.dataset.i, 1);
      roiState.priced = false; roiState.profited = false;
      RENDER.packages();
    });
  });
  $$("#pay-mode .chip").forEach(function (b) {
    b.addEventListener("click", function () {
      payMode = b.dataset.mode;
      /* fixed-price products have a different sale price per payment mode */
      offerLines.forEach(function (L) { L.sale = defaultSale(pkgOf(L)); });
      if (payMode === "yillik") roiState.campaign = false;
      roiState.priced = false; roiState.profited = false;
      RENDER.packages();
    });
  });
  var cb = $("#camp-btn");
  if (cb) cb.addEventListener("click", function () {
    roiState.campaign = !roiState.campaign;
    roiState.priced = false; roiState.profited = false;
    RENDER.packages();
  });
  var pf = $("#roi-profit");
  if (pf) pf.addEventListener("change", function () {
    roiState.weddingProfit = Math.max(0, +this.value || 0);
    roiState.profited = false; RENDER.packages();
  });
  var ct = $("#roi-count");
  if (ct) ct.addEventListener("change", function () {
    var x = parseInt(this.value, 10);
    roiState.weddingCount = isNaN(x) ? 2 : Math.max(0, x);
    roiState.profited = false; RENDER.packages();
  });
  var cp = $("#calc-price");
  if (cp) cp.addEventListener("click", function () {
    roiState.priced = true; RENDER.packages();
    var el = $("#price-card"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  var cr = $("#calc-roi");
  if (cr) cr.addEventListener("click", function () {
    roiState.profited = true; RENDER.packages();
    var el = $("#v-packages .roi-hero");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function priceTables() {
  var out = "";
  P.sas.blocks.forEach(function (bl) {
    var units = bl.units || [];
    out += "<h4 style='margin-top:14px'>" + esc(bl.name) + "</h4><div class='tbl-wrap'><table><thead><tr><th>Kategori</th>" +
      bl.cols.map(function (c, i) {
        return '<th class="n">' + esc(c) + '<br><span style="font-weight:600;text-transform:none;color:var(--mute-2)">' +
          (units[i] === "6ay" ? "6 aylık toplam" : "aylık") + "</span></th>"; }).join("") +
      "</tr></thead><tbody>" + bl.rows.map(function (r) {
        return "<tr><td><b>" + esc(r.category) + "</b></td>" + r.prices.map(function (pz, i) {
          if (!pz) return '<td class="n">—</td>';
          return '<td class="n">' + tl(pz) + (units[i] === "6ay" ?
            '<br><span style="font-size:11px;color:var(--mute)">' + tl(pz / 6) + " / ay</span>" : "") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
  });
  P.mos.scopes.forEach(function (sc) {
    out += "<h4 style='margin-top:14px'>" + esc(sc.name) + " · Pro Start</h4><div class='tbl-wrap'><table><thead><tr>" +
      "<th>Kategori</th><th class='n'>Liste / ay</th><th>Süre</th><th class='n'>Aylık</th>" +
      "<th class='n'>Yıllık peşin</th><th class='n'>Peşinde aylık</th></tr></thead><tbody>" +
      sc.blocks.map(function (b) {
        return b.terms.map(function (t, i) {
          return "<tr>" + (i === 0 ? "<td rowspan='" + b.terms.length + "'><b>" + esc(b.label) + "</b></td>" +
            "<td class='n' rowspan='" + b.terms.length + "'>" + tl(b.list) + "</td>" : "") +
            "<td>" + esc(t.term) + "</td><td class='n'>" + tl(t.monthly) + "</td><td class='n'>" +
            tl(t.annualUpfront) + "</td><td class='n'>" + tl(t.monthlyIfUpfront) + "</td></tr>";
        }).join("");
      }).join("") + "</tbody></table></div>";
  });
  return out;
}

/* ---------------------------------------------------------- 5. objections */
RENDER.objections = function () {
  var v = $("#v-objections"), m = state.meeting;
  var h = '<div class="sec-head"><span class="kick">Kapanış aracı</span><h2>İtiraz Kütüphanesi</h2></div>' +
    repNote("İtiraz reddedilmez, köprü kurulur: <b>önce onaylayın, sonra çevirin, sonra tekrar kapanışa gidin.</b>");

  if (!state.obj) {
    if (m && m.objections.length) {
      h += '<div class="card" style="border-color:var(--pink-20);background:var(--pink-05)">' +
        "<h3 class='accent'>" + esc(m.firm) + " görüşmesinde işaretledikleriniz</h3>" +
        '<div class="obj-list" style="margin-top:10px">' + m.objections.map(function (id) {
          var o = C.objections.filter(function (x) { return x.id === id; })[0];
          return o ? '<button class="obj-card" data-id="' + o.id + '"><span class="pill pink">' + esc(o.tag) +
            '</span><div class="ic" style="margin-top:8px">' + o.icon + "</div><h3>" + esc(o.title) +
            "</h3></button>" : "";
        }).join("") + "</div></div>";
    }
    h += '<div class="card rep-only" style="margin:14px 0"><div class="chips">' +
      C.tips.map(function (t) { return '<span class="pill neu" style="font-weight:600">' + t + "</span>"; }).join("") +
      "</div></div>";
    h += '<div class="obj-list">' + C.objections.map(function (o) {
      return '<button class="obj-card" data-id="' + o.id + '"><span class="pill pink">' + esc(o.tag) + "</span>" +
        '<div class="ic" style="margin-top:8px">' + o.icon + "</div><h3>" + esc(o.title) + "</h3>" +
        '<div class="hear rep-only">' + esc(o.hear[0]) + "</div></button>";
    }).join("") + "</div>";
  } else {
    var o = C.objections.filter(function (x) { return x.id === state.obj; })[0];
    h += '<button class="btn sm ghost" id="obj-back">← Tüm itirazlar</button>';
    h += '<div class="card obj-detail" style="margin-top:12px"><span class="pill pink">' + esc(o.tag) + "</span>" +
      '<h2 style="margin:10px 0 4px">' + o.icon + " " + esc(o.title) + "</h2>" +
      '<div class="grid g2 rep-only" style="margin-top:12px"><div><h4>Ne duyuyoruz</h4>' +
      '<ul style="padding-left:18px;margin:6px 0 0;font-size:13.5px;color:var(--mute)">' +
      o.hear.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
      "<div><h4>Aslında ne diyor</h4><p style='font-size:13.5px;color:var(--ink-2);margin-top:6px'>" + o.means + "</p></div></div>" +
      '<div class="bridge rep-only"><b>Köprü cümlesi</b><span>' + o.bridge + "</span></div>" +
      "<h4>Ana argümanlar</h4><div>" + o.moves.map(function (mv, i) {
        return '<div class="move"><div class="no num">' + (i + 1) + '</div><div class="tx">' + mv + "</div></div>";
      }).join("") + "</div>" +
      '<div class="grid g2" style="margin-top:14px"><div><h4>Kanıt</h4><ul style="padding-left:18px;margin:6px 0 0;font-size:13px">' +
      o.proof.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
      '<div class="rep-only"><h4>Yapmayın</h4><div class="avoid" style="margin-top:6px">' + esc(o.avoid) + "</div></div></div>" +
      '<div style="margin-top:16px"><button class="btn" data-tool="' + o.tool.target + '">' + esc(o.tool.label) + " →</button></div></div>";
    var others = C.objections.filter(function (x) { return x.id !== o.id; }).slice(0, 4);
    h += '<div class="card rep-only"><h4>Sık birlikte gelen itirazlar</h4><div class="chips" style="margin-top:8px">' +
      others.map(function (x) { return '<button class="chip" data-id="' + x.id + '">' + x.icon + " " + esc(x.title) + "</button>"; }).join("") +
      "</div></div>";
  }
  v.innerHTML = h;

  $$("#v-objections [data-id]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.obj = b.dataset.id; RENDER.objections(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  var back = $("#obj-back");
  if (back) back.addEventListener("click", function () { state.obj = null; RENDER.objections(); });
  $$("#v-objections [data-tool]").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = b.dataset.tool;
      show("new", t === "stories" ? "stories" : t === "packages" ? "packages"
        : t === "flow" ? "flow" : "sim");
    });
  });
};

/* ---------------------------------------------------------- 6. flow */
RENDER.flow = function () {
  var v = $("#v-flow");
  if (v.dataset.done) return; v.dataset.done = "1";
  function block(f, key) {
    return '<div class="card"><div class="sec-head"><h3>' + esc(f.title) + "</h3><p>" + esc(f.lead) + "</p></div>" +
      f.steps.map(function (s, i) {
        return '<div class="step" data-k="' + key + i + '"><div class="chk">✓</div><div style="flex:1">' +
          '<div class="m">' + (i + 1) + ". ADIM · " + esc(s.m) + '</div><div style="font-weight:800;font-size:15px">' +
          esc(s.t) + '</div><div style="font-size:13.5px;color:var(--ink-2);margin-top:3px">' + s.d + "</div>" +
          (s.ask.length ? '<ul class="ask" style="padding-left:18px">' + s.ask.map(function (a) {
            return "<li>“" + esc(a) + "”</li>"; }).join("") + "</ul>" : "") + "</div></div>";
      }).join("") + '<button class="btn sm ghost" data-reset="' + key + '">Listeyi sıfırla</button></div>';
  }
  v.innerHTML = '<div class="sec-head"><span class="kick">Standart akış</span><h2>Görüşme Akışı</h2></div>' +
    repNote("Bu sayfa tamamen sizin içindir; Sunum Modu açıkken zaten gizlenir. Adımları tamamladıkça işaretleyin.") +
    '<div class="rep-only"><div class="grid g2" style="align-items:start">' +
    block(C.flow.newSale, "n") + block(C.flow.renewal, "r") + "</div></div>";
  $$("#v-flow .step").forEach(function (s) {
    s.addEventListener("click", function () { s.classList.toggle("done"); });
  });
  $$("#v-flow [data-reset]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      $$('#v-flow .step[data-k^="' + b.dataset.reset + '"]').forEach(function (s) { s.classList.remove("done"); });
    });
  });
};

/* ---------------------------------------------------------- 7. whiteboard */
var wbPainter = null;
RENDER.board = function () {
  var v = $("#v-board");
  if (v.dataset.done) { if (wbPainter) wbPainter.fit(); return; }
  v.dataset.done = "1";
  v.innerHTML = '<div class="sec-head"><span class="kick">Kâğıt kalem hissi</span><h2>Beyaz Tahta</h2>' +
    "<p>Boş bir noktalı defter sayfası. Fiyat yazın, üstünü çizin, kroki çizin.</p></div>" +
    '<div class="wb-wrap"><div class="wb-bar">' +
    '<span class="swatch" data-col="#191919" style="background:#191919" aria-pressed="true"></span>' +
    '<span class="swatch" data-col="#E21B71" style="background:#E21B71" aria-pressed="false"></span>' +
    '<span class="swatch" data-col="#26B2AB" style="background:#26B2AB" aria-pressed="false"></span>' +
    '<span class="swatch" data-col="#FF8569" style="background:#FF8569" aria-pressed="false"></span>' +
    '<span class="swatch" data-col="#FFE24A" style="background:#FFE24A" aria-pressed="false"></span>' +
    '<span class="vsep" style="width:1px;height:22px;background:var(--line)"></span>' +
    '<button class="chip" data-pen="thin" aria-pressed="true">İnce</button>' +
    '<button class="chip" data-pen="thick" aria-pressed="false">Kalın</button>' +
    '<button class="chip" data-pen="mark" aria-pressed="false">🖍️ Vurgula</button>' +
    '<span class="spacer" style="flex:1"></span>' +
    '<button class="chip" id="wb-undo">↶ Geri</button>' +
    '<button class="chip" id="wb-clear">Temizle</button></div>' +
    '<canvas id="wb"></canvas></div>' +
    repNote("Panelin <b>her sayfasının üzerine</b> çizmek için üstteki ✏️ Kalem düğmesini " +
      "(ya da <b>P</b> tuşunu) kullanın. Bu sayfa ise tamamen boş bir tahtadır.");

  wbPainter = makePainter($("#wb"));
  wbPainter.fit();
  $$("#v-board .swatch").forEach(function (s) {
    s.addEventListener("click", function () {
      $$("#v-board .swatch").forEach(function (o) { o.setAttribute("aria-pressed", o === s); });
      wbPainter.setColor(s.dataset.col);
    });
  });
  $$("#v-board [data-pen]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("#v-board [data-pen]").forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
      wbPainter.setPen(b.dataset.pen);
      var want = b.dataset.pen === "mark" ? "#FFE24A" : "#191919";
      var sw = $$("#v-board .swatch").filter(function (o) { return o.dataset.col === want; })[0];
      if (sw) {
        $$("#v-board .swatch").forEach(function (o) { o.setAttribute("aria-pressed", o === sw); });
        wbPainter.setColor(want);
      }
    });
  });
  $("#wb-undo").addEventListener("click", function () { wbPainter.undo(); });
  $("#wb-clear").addEventListener("click", function () { wbPainter.clear(); });
  window.addEventListener("resize", function () {
    if (wbPainter && $("#v-board").classList.contains("on")) wbPainter.fit();
  });
};

/* ---------------------------------------------------------- 8. stories */
RENDER.stories = function () {
  var v = $("#v-stories");
  if (v.dataset.done) return; v.dataset.done = "1";
  var m = state.meeting;
  var cities = [];
  C.testimonials.forEach(function (t) { if (cities.indexOf(t.city) < 0) cities.push(t.city); });
  cities = cityList(cities);
  var start = (m && cities.indexOf(m.city) >= 0) ? m.city : "all";
  v.innerHTML = '<div class="sec-head"><span class="kick">Sosyal kanıt</span><h2>Başarı Hikâyeleri</h2></div>' +
    repNote("“Kötü deneyim” ve “garanti yok” itirazlarının en güçlü cevabı üçüncü ağızdan gelir. " +
      "Mümkünse müşterinin <b>kendi şehrinden ve kategorisinden</b> bir firma gösterin.") +
    '<div class="chips" style="margin-bottom:12px"><button class="chip" data-c="all" aria-pressed="' +
    (start === "all") + '">Tümü</button>' +
    cities.map(function (c) {
      return '<button class="chip" data-c="' + esc(c) + '" aria-pressed="' + (c === start) + '">' + esc(c) + "</button>";
    }).join("") +
    '<a class="chip" target="_blank" rel="noopener" href="' + C.links.stories + '">Tam listeyi aç ↗</a></div>' +
    '<div class="quotes" id="q-list">' + C.testimonials.map(function (t) {
      return '<div class="quote" data-c="' + esc(t.city) + '"' +
        (start !== "all" && t.city !== start ? ' style="display:none"' : "") + "><q>" + esc(t.q) +
        '</q><div class="who">' + esc(t.n) + '</div><div class="meta">' + esc(t.c) + " · " + esc(t.city) + "</div></div>";
    }).join("") + "</div>";
  $$("#v-stories .chip[data-c]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("#v-stories .chip[data-c]").forEach(function (o) { o.setAttribute("aria-pressed", o === b); });
      $$("#q-list .quote").forEach(function (q) {
        q.style.display = (b.dataset.c === "all" || q.dataset.c === b.dataset.c) ? "" : "none";
      });
    });
  });
};

/* ---------------------------------------------------------- 9. connect */
RENDER.app = function () {
  var v = $("#v-app");
  if (v.dataset.done) return; v.dataset.done = "1";
  var A = C.intro.app;
  v.innerHTML = '<div class="sec-head"><span class="kick">Ürünün görünmeyen yarısı</span><h2>' + esc(A.title) +
    "</h2><p>" + esc(A.lead) + "</p></div>" +
    '<div class="phone-grid">' + A.shots.map(function (s) {
      return '<div class="phone"><div class="shot" data-src="assets/connect/' + s.f + '">' +
        /* not lazy: 12 small screenshots, and a rep scrolling in a meeting
           should never wait for a placeholder to resolve */
        '<img src="assets/connect/' + s.f + '" alt="' + esc(s.t) + '"></div>' +
        '<div class="cap">' + esc(s.t) + '</div><div class="cd">' + esc(s.d) + "</div></div>";
    }).join("") + "</div>" +
    '<div class="card rep-only" style="margin-top:18px"><h3>Görüşmede söyleyeceğiniz cümle</h3>' +
    '<div class="punch">“Size sadece çift göndermiyoruz. Cebinizde, hangi çiftte nerede kaldığınızı gösteren ve ' +
    "sıradaki adımı söyleyen bir uygulama da veriyoruz. Talebi kaybetmeyin diye.”</div>" +
    '<div class="chips" style="margin-top:12px">' +
    '<a class="chip" target="_blank" rel="noopener" href="' + C.links.features + '">Yeni özellikler sunumu ↗</a>' +
    '<a class="chip" target="_blank" rel="noopener" href="' + C.links.eduVideo + '">Eğitim videosu ↗</a></div></div>';

  $$("#v-app .shot").forEach(function (s) {
    s.addEventListener("click", function () {
      var lb = document.createElement("div");
      lb.className = "lightbox";
      lb.innerHTML = '<img src="' + s.dataset.src + '" alt="">';
      lb.addEventListener("click", function () { lb.remove(); });
      document.body.appendChild(lb);
    });
  });
};

/* ================================================================ YENİLEME */
var BENCH_LABEL = {
  card_view_pxd: "Listede görünme", page_view_pxd: "Sayfa görüntüleme",
  org_lead_pxd: "Organik talep", ctr: "Kart tıklama oranı", cr: "Sayfa → teklif dönüşümü",
  response_rate: "Teklif dönüş oranı", response_hr: "Medyan dönüş süresi",
  in1h_rate: "1 saat içinde dönüş", in24h_rate: "24 saat içinde dönüş",
  profile_score: "Profil skoru", image_count: "Fotoğraf", video_count: "Video",
  review_count: "Yorum", discount_count: "Kampanya",
  deal_per_org_lead: "Teklif → anlaşma", value_per_org_lead: "Teklif başına maliyet",
  rank: "Liste sırası",
  pv_per_cv: "Listeden sayfaya geçiş", offer_per_pv: "Sayfadan teklife dönüş"
};
var BENCH_DIR = { response_hr: -1, value_per_org_lead: -1, rank: -1 };

function pvals(p) {
  var a = p.agg12 || {}, o = p.offers || {}, pr = p.profile || {};
  return {
    card_view_pxd: a.card_view_pxd, page_view_pxd: a.page_view_pxd,
    org_lead_pxd: a.org_lead_pxd, total_lead_pxd: a.total_lead_pxd,
    ctr: a.ctr, cr: a.cr, lead_per_card_view: a.lead_per_card_view,
    pv_per_cv: div(a.page_view, a.card_view), offer_per_pv: div(o.total, a.page_view),
    deal_per_org_lead: a.deal_per_org_lead, value_per_org_lead: a.value_per_org_lead,
    /* average, matching both what the karne prints and what the builder puts in
       the benchmark — mixing median and average here read as "%71 better" while
       the venue was actually slower than its peers */
    response_rate: o.respRate, response_hr: o.avgSec ? o.avgSec / 3600 : null,
    in1h_rate: o.in1hRate, in24h_rate: o.in24hRate,
    profile_score: pr.score, image_count: pr.images, video_count: pr.videos,
    review_count: pr.reviews, discount_count: pr.discounts, rank: a.rank_avg
  };
}
function bench(p) { return R.benchmarks[p.bench] || null; }
function score(p, key) {
  var b = bench(p); if (!b) return null;
  var v = pvals(p)[key], bv = b[key];
  if (v == null || bv == null || bv === 0) return null;
  return BENCH_DIR[key] === -1 ? bv / v : v / bv;
}
function stripParen(t) {
  return String(t || "").replace(/\s*\([^)]*\)/g, "").toLocaleLowerCase("tr");
}
function verdictClass(r) { return r == null ? "" : r >= 1.15 ? "good" : r <= 0.85 ? "bad" : "mid"; }

var F = { i: function (x) { return n(x, 0); }, d1: function (x) { return n(x, 1); },
          p: function (x) { return pct(x, 1); }, h: hrs, tl: tl };
function benchText(bv, fmtd) {
  if (bv == null) return "—";
  if (fmtd === F.i && bv % 1 !== 0 && Math.abs(bv) < 10) return n(bv, 1);
  return fmtd(bv);
}
function kpi(p, key, value, fmtd, label) {
  var r = score(p, key), b = bench(p), cls = verdictClass(r);
  var bv = b ? b[key] : null, cmp = "—";
  if (r != null) {
    cmp = "emsal " + benchText(bv, fmtd) + " · <b>%" + Math.round(Math.abs(r - 1) * 100) +
      " daha " + (r >= 1 ? "iyi" : "zayıf") + "</b>";
  }
  return '<div class="kpi ' + cls + '"><div class="lb">' + esc(label || BENCH_LABEL[key] || key) + "</div>" +
    '<div class="v num">' + fmtd(value) + '</div><div class="cmp">' + cmp + "</div></div>";
}

function curveAt(p, pwf) {
  var cur = (p.sim && R.curves.buckets[p.sim.bucket]) || R.curves.pooled;
  if (!cur || !cur.length) return null;
  if (pwf <= cur[0][0]) return cur[0][1];
  if (pwf >= cur[cur.length - 1][0]) return cur[cur.length - 1][1];
  for (var i = 1; i < cur.length; i++) {
    if (pwf <= cur[i][0]) {
      var a = cur[i - 1], b = cur[i];
      return a[1] + (b[1] - a[1]) * (pwf - a[0]) / (b[0] - a[0]);
    }
  }
  return cur[cur.length - 1][1];
}
function simulateX(p, newX) {
  var s = p.sim; if (!s || !s.pwf || !s.pw) return null;
  var pwNew = (R.xw[s.scope] || {})[String(newX)];
  if (!pwNew) return null;
  var pwfNew = clamp(s.pwf * pwNew / s.pw, 0, 100);
  var c0 = curveAt(p, s.pwf), c1 = curveAt(p, pwfNew);
  if (!c0 || !c1) return null;
  return { x: newX, pw: pwNew, pwf: Math.round(pwfNew), lift: c1 / c0 };
}
/* deal rate observed for a given median response time (R.speedCurve) */
function dealRateForHours(hr) {
  var c = R.speedCurve || [];
  for (var i = 0; i < c.length; i++) {
    if (c[i].maxHr == null || hr < c[i].maxHr) return c[i];
  }
  return c[c.length - 1] || null;
}

function currentProvider() {
  if (!state.cust) return null;
  var c = R.customers.filter(function (x) { return x.id === state.cust; })[0];
  if (!c) return null;
  return c.providers.filter(function (x) { return x.id === state.prov; })[0] || c.providers[0];
}
function currentCustomer() {
  return R.customers.filter(function (x) { return x.id === state.cust; })[0] || null;
}
function needPick(id) {
  $("#" + id).innerHTML = '<div class="card" style="text-align:center;padding:44px">' +
    '<div style="font-size:36px">🔍</div><h3 style="margin:10px 0 6px">Önce bir firma seçin</h3>' +
    "<p style='color:var(--mute)'>Yenileme sekmesindeki <b>Firma Seç</b> ekranından müşteriyi ve sayfasını seçin.</p>" +
    "<button class='btn' onclick=\"__go('ren','pick')\">Firma Seç →</button></div>";
}

/* ------------------------------------------------------------- pick */
var pickQ = { q: "", city: "all" };
RENDER.pick = function () {
  var v = $("#v-pick");
  var cities = cityList(R.customers.map(function (c) { return c.city; }))
    .filter(function (c, i, a) { return a.indexOf(c) === i; });
  var list = R.customers.filter(function (c) {
    if (pickQ.city !== "all" && c.city !== pickQ.city) return false;
    if (!pickQ.q) return true;
    var q = pickQ.q.toLocaleLowerCase("tr");
    return (c.title || "").toLocaleLowerCase("tr").indexOf(q) >= 0 ||
      c.providers.some(function (p) { return (p.name || "").toLocaleLowerCase("tr").indexOf(q) >= 0; });
  });

  var h = '<div class="sec-head"><span class="kick">Yenileme görüşmesi</span><h2>Firma Seç</h2>' +
    "<p>Müşteri adı ya da sayfa adı yazarak arayın. Bir müşterinin birden fazla sayfası varsa " +
    "her sayfa ayrı değerlendirilir.<br><b>Veri:</b> " + esc(R.meta.asof) + " tarihine kadar · " +
    esc(R.meta.window[0]) + " – " + esc(R.meta.window[1]) + " penceresi · " + esc(R.meta.sampleNote) + "</p></div>";

  h += '<div class="cust-pick"><div class="card"><input type="search" id="pick-q" placeholder="Firma ara…" value="' +
    esc(pickQ.q) + '"><div class="chips" style="margin:10px 0"><button class="chip" data-city="all" aria-pressed="' +
    (pickQ.city === "all") + '">Tümü</button>' +
    cities.map(function (c) {
      return '<button class="chip" data-city="' + esc(c) + '" aria-pressed="' + (pickQ.city === c) + '">' + esc(c) + "</button>";
    }).join("") + '</div><div class="cust-list">' +
    (list.length ? list.map(function (c) {
      return '<button class="cust-row" data-cust="' + c.id + '" aria-current="' + (c.id === state.cust) + '">' +
        '<div class="n">' + esc(c.title) + '</div><div class="m">' + esc(c.city) + " · " +
        c.providers.length + " sayfa</div></button>";
    }).join("") : "<p style='color:var(--mute);padding:12px'>Eşleşen firma yok.</p>") + "</div></div>";

  var c = currentCustomer();
  if (!c) {
    h += '<div class="card" style="display:grid;place-items:center;text-align:center;color:var(--mute)">' +
      "<div><div style='font-size:38px'>👈</div><p>Soldan bir firma seçin.</p></div></div></div>";
  } else {
    h += '<div class="card"><div class="sec-head"><span class="kick">' + esc(c.city) + '</span><h2>' +
      esc(c.title) + "</h2><p>Üyelik " + n(c.membership) + " ay</p></div><h4>Sayfalar</h4><div style='margin-top:8px'>" +
      c.providers.map(function (p) {
        var d = daysUntil(p.ends);
        var risk = d == null ? "" : d < 0 ? '<span class="pill bad">süresi doldu</span>' :
          d < 60 ? '<span class="pill warn">' + d + " gün kaldı</span>" :
          '<span class="pill ok">' + d + " gün kaldı</span>";
        return '<button class="cust-row" data-prov="' + p.id + '" aria-current="' + (p.id === state.prov) + '" ' +
          'style="display:flex;gap:12px;align-items:center;border:1px solid var(--line);margin-bottom:8px">' +
          (p.img ? '<img src="' + esc(p.img) + '" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:8px" ' +
            'onerror="this.style.visibility=\'hidden\'">' : "") +
          '<span style="flex:1"><span class="n" style="display:block">' + esc(p.name) + "</span>" +
          '<span class="m">' + esc(p.cat) + " · " + esc(p.district || p.city) + " · <b>" + esc(p.product) +
          "</b></span></span>" + risk + "</button>";
      }).join("") + "</div>" +
      '<div style="margin-top:12px" class="chips"><button class="btn" onclick="__go(\'ren\',\'karne\')">Karneyi aç →</button>' +
      '<button class="btn ghost hide-present" onclick="__go(\'ren\',\'brief\')">🔒 Görüşme öncesi brief</button>' +
      '<a class="btn ghost hide-present" target="_blank" rel="noopener" href="' + esc(c.crm) + '">CRM ↗</a></div></div></div>';
  }

  v.innerHTML = h;
  var qi = $("#pick-q");
  qi.addEventListener("input", function () {
    pickQ.q = this.value; RENDER.pick();
    var f = $("#pick-q"); f.focus(); f.setSelectionRange(f.value.length, f.value.length);
  });
  $$("#v-pick [data-city]").forEach(function (b) {
    b.addEventListener("click", function () { pickQ.city = b.dataset.city; RENDER.pick(); });
  });
  $$("#v-pick [data-cust]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.cust = +b.dataset.cust; state.prov = null; resetRenewal(); RENDER.pick();
    });
  });
  $$("#v-pick [data-prov]").forEach(function (b) {
    b.addEventListener("click", function () { state.prov = +b.dataset.prov; resetRenewal(); RENDER.pick(); });
  });
};

function resetRenewal() {
  renewOffer.disc = null;
  whatIf = null;
  ["karne", "trend", "verdict", "upsell", "offer", "brief"].forEach(function (k) {
    var el = $("#v-" + k); if (el) { el.dataset.done = ""; el.innerHTML = ""; }
  });
}

/* ------------------------------------------------------------- karne */
function mixBar(items, key, valKey, total, palette) {
  var cols = palette || ["var(--pink)", "var(--green)", "var(--purple)", "var(--amber)",
                         "var(--teal)", "var(--soft-pink)"];
  if (!total) return "<div class='note'>Veri yok.</div>";
  return '<div class="mixbar">' + items.map(function (it, i) {
    var share = it[valKey] / total;
    return '<div style="flex:' + (share * 100).toFixed(2) + ";background:" + cols[i % cols.length] +
      '" title="' + esc(it[key]) + " %" + n(share * 100, 0) + '">' +
      (share > .1 ? "%" + n(share * 100, 0) : "") + "</div>";
  }).join("") + "</div>";
}
function mixLegend(items, key, palette) {
  var cols = palette || ["var(--pink)", "var(--green)", "var(--purple)", "var(--amber)",
                         "var(--teal)", "var(--soft-pink)"];
  return '<div class="tlegend">' + items.map(function (it, i) {
    return '<span><i style="background:' + cols[i % cols.length] + '"></i>' + esc(it[key]) + "</span>";
  }).join("") + "</div>";
}

RENDER.karne = function () {
  var p = currentProvider();
  if (!p) return needPick("v-karne");
  var v = $("#v-karne"), a = p.agg12 || {}, o = p.offers || {}, pr = p.profile || {}, b = bench(p);
  var d = daysUntil(p.ends);

  /* ---------- hero ---------- */
  var h = '<div class="card prov-hero"><div class="ph">' +
    (p.img ? '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" onerror="this.remove()">' : "") +
    '<span class="noimg">kapak görseli</span></div><div>' +
    '<span class="pill pink">' + esc(p.cat) + "</span> " +
    '<span class="pill neu">' + esc(p.district || p.city) + "</span>" +
    "<h1 style='margin:10px 0 4px'>" + esc(p.name) + "</h1>" +
    "<p style='color:var(--mute);margin:0'>" +
    (p.membership != null ? n(p.membership) + " aydır iş ortağımız" : "") + "</p>" +
    '<div class="grid g4" style="margin-top:14px;gap:10px">' +
    "<div><div style='font-size:11px;color:var(--mute);font-weight:800'>PAKET</div><b>" + esc(p.product) + "</b></div>" +
    "<div><div style='font-size:11px;color:var(--mute);font-weight:800'>BAŞLANGIÇ</div><b>" + dt(p.started) + "</b></div>" +
    "<div><div style='font-size:11px;color:var(--mute);font-weight:800'>BİTİŞ</div><b>" + dt(p.ends) + "</b></div>" +
    "<div><div style='font-size:11px;color:var(--mute);font-weight:800'>KALAN</div><b>" +
    (d == null ? "—" : d < 0 ? Math.abs(d) + " gün geçti" : d + " gün") + "</b></div></div>" +
    '<div class="chips" style="margin-top:14px"><a class="btn sm ghost" target="_blank" rel="noopener" href="' +
    esc(p.url) + '">Sayfayı aç ↗</a>' +
    '<button class="btn sm ghost" onclick="__go(\'ren\',\'trend\')">Aylık seyir →</button>' +
    '<button class="btn sm" onclick="__go(\'ren\',\'upsell\')">Ya olsaydı? →</button></div></div></div>';

  h += repNote("Sırayla ilerleyin: <b>profil → görünürlük → teklif → kaçan teklifler</b>. " +
    "Önce iyi giden metrikleri söyleyin, eksikleri sonra açın.");

  /* ---------- 1. profile ---------- */
  h += '<div class="sec-head" style="margin-top:22px"><span class="kick">Son 12 ay · ' +
    esc(R.meta.window[0]) + " – " + esc(R.meta.window[1]) + '</span><h2>1 · Profiliniz</h2>' +
    "<p>Her şey buradan başlıyor. Profiliniz ne kadar doluysa listede o kadar üstte çıkar, " +
    "o kadar çok tıklanırsınız.</p></div>";
  h += '<div class="grid g4">' +
    kpi(p, "profile_score", pr.score, F.p) +
    kpi(p, "image_count", pr.images, F.i) +
    kpi(p, "review_count", pr.reviews, F.i) +
    kpi(p, "discount_count", pr.discounts, F.i) + "</div>" +
    '<div class="grid g4" style="margin-top:10px">' +
    [["Video", pr.videos, !pr.videos],
     ["Yorum puanı", pr.reviewScore ? n(pr.reviewScore, 1) + " / 5" : "—", false],
     ["WhatsApp", pr.whatsapp ? "Açık" : "Kapalı", !pr.whatsapp],
     ["Özel Fiyat kampanyası", pr.specialOffer ? "Aktif" : "Yok", !pr.specialOffer]]
      .map(function (x) {
        return '<div class="kpi ' + (x[2] ? "bad" : "") + '"><div class="lb">' + esc(x[0]) + "</div>" +
          '<div class="v" style="font-size:20px">' + esc(String(x[1])) + "</div></div>";
      }).join("") + "</div>";

  /* ---------- 2. visibility funnel ---------- */
  var teklif = o.total != null ? o.total : a.total_lead;
  var steps = [
    { lb: "Listede görünme", v: a.card_view, s: "arama sonuçlarında kartınız" },
    { lb: "Sayfa ziyareti", v: a.page_view, s: "kartınıza tıklayıp sayfanızı açan çift" },
    { lb: "Teklif", v: teklif, s: "size ulaşan çift" },
    { lb: "Dönülen teklif", v: o.responded, s: "sizin geri döndüğünüz" }
  ];
  h += '<div class="sec-head" style="margin-top:26px"><h2>2 · Sayfa istatistikleriniz</h2>' +
    "<p>Çiftin sizi görmesinden teklife kadar olan yol. Her oktaki yüzde, bir önceki adımdan " +
    "kaçının ilerlediğini gösterir.</p></div>";
  h += '<div class="funnel-flow">';
  steps.forEach(function (st, i) {
    h += '<div class="fn-step"><div class="lb">' + esc(st.lb) + '</div><div class="v num">' +
      n(st.v) + '</div><div class="s">' + esc(st.s) + "</div></div>";
    if (i < steps.length - 1) {
      var nx = steps[i + 1].v, r = div(nx, st.v);
      var bkey = i === 0 ? "pv_per_cv" : i === 1 ? "offer_per_pv" : "response_rate";
      var sc = score(p, bkey), cls = verdictClass(sc);
      h += '<div class="fn-arrow"><div><div class="pctv ' +
        (cls === "good" ? "delta up" : cls === "bad" ? "delta dn" : "") + '">' + pct(r, 1) + "</div>" +
        '<div class="ar">➜</div><div class="pctl">' +
        (b && b[bkey] != null ? "emsal " + pct(b[bkey], 1) : "") + "</div></div></div>";
    }
  });
  h += "</div>";
  h += '<div class="grid g3" style="margin-top:12px">' +
    '<div class="kpi"><div class="lb">Instagram yönlendirme</div><div class="v num">' + n(a.instagram_visit) + "</div>" +
    '<div class="cmp">sayfanızdan Instagram\'ınıza geçen çift</div></div>' +
    '<div class="kpi"><div class="lb">Yol tarifi</div><div class="v num">' + n(a.directions) + "</div>" +
    '<div class="cmp">mekanınıza yol tarifi alan çift</div></div>' +
    '<div class="kpi"><div class="lb">Favoriye ekleme</div><div class="v num">' + n(a.favorite) + "</div>" +
    '<div class="cmp">sayfanızı sonra dönmek üzere kaydeden çift</div></div></div>';

  /* ---------- 3. offer management ---------- */
  h += '<div class="sec-head" style="margin-top:26px"><h2>3 · Teklif yönetiminiz</h2>' +
    "<p>Sadece teklif almak ile iş bitmiyor, teklifleri nasıl yönettiğimiz oldukça kıymetli — " +
    "ve anlaşma oranını en çok bu belirliyor. Aynı çift ortalama 4-6 mekana birden yazıyor; " +
    "ilk dönen konuşmayı başlatıyor.</p></div>";
  h += '<div class="grid g4">' +
    kpi(p, "response_rate", o.respRate, F.p) +
    kpi(p, "response_hr", o.avgSec ? o.avgSec / 3600 : null, F.h, "Ortalama dönüş süresi") +
    kpi(p, "in1h_rate", o.in1hRate, F.p) +
    kpi(p, "in24h_rate", o.in24hRate, F.p) + "</div>";

  /* How fast — read cumulatively, because that is the only way the comparison
     is unambiguous. Being "+4 points" in the 1-10 hour band is not a win if the
     competition answers within the hour; the couple is already gone. */
  if (o.buckets && o.total) {
    var BANDS = ["0-1 saat", "1-10 saat", "10-24 saat", "24 saatten uzun"];
    var tmix = {};
    ((b && b.timeMix) || []).forEach(function (x) { tmix[x.b] = x.share; });
    var mineB = BANDS.map(function (lb) {
      var f2 = o.buckets.filter(function (x) { return x.b === lb; })[0];
      return f2 ? f2.n / o.total : 0;
    });
    var peerB = BANDS.map(function (lb) { return tmix[lb] || 0; });

    /* cumulative "within X" shares — higher is always better */
    var cum = function (arr, upto) {
      var t2 = 0; for (var i = 0; i <= upto; i++) t2 += arr[i]; return t2;
    };
    var gap1 = mineB[0] - peerB[0];
    var verdict = gap1 < -0.03
      ? { cls: "fix", t: "Rakipleriniz ilk saatte sizden daha hızlı dönüyor",
          p: "Tekliflerin <b>" + pct(mineB[0], 0) + "</b>'ine ilk saat içinde döndünüz; " +
             "aynı segmentteki mekanlar <b>" + pct(peerB[0], 0) + "</b>. Çift aynı anda 4-6 " +
             "mekana yazıyor ve ilk dönenle konuşmaya başlıyor — bu fark doğrudan kaybedilen çift demek." }
      : gap1 > 0.03
        ? { cls: "win", t: "İlk saatte rakiplerinizden hızlısınız",
            p: "Tekliflerin <b>" + pct(mineB[0], 0) + "</b>'ine ilk saat içinde döndünüz; " +
               "rakipleriniz <b>" + pct(peerB[0], 0) + "</b>. Çiftle ilk konuşan siz oluyorsunuz." }
        : { cls: "win", t: "İlk saatteki dönüş hızınız rakiplerinizle aynı seviyede",
            p: "Siz <b>" + pct(mineB[0], 0) + "</b>, rakipleriniz <b>" + pct(peerB[0], 0) +
               "</b>. Buradaki her puan doğrudan anlaşma oranına yansıyor." };

    h += '<div class="card"><h3>Tekliflere ne kadar sürede dönüyorsunuz?</h3>' +
      '<div class="verdict ' + verdict.cls + '" style="margin:10px 0 14px"><h4>' +
      esc(verdict.t) + "</h4><p>" + verdict.p + "</p></div>" +
      groupedBars(BANDS, mineB, peerB, { h: 200 }) +
      '<div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>Ne kadar sürede</th>' +
      '<th class="n">Sizin payınız</th><th class="n">Rakip payı</th><th class="n">Fark</th>' +
      "</tr></thead><tbody>" +
      [["1 saat içinde", 0], ["10 saat içinde", 1], ["24 saat içinde", 2]].map(function (row) {
        var mv = cum(mineB, row[1]), pv = cum(peerB, row[1]), d = mv - pv;
        return "<tr><td><b>" + esc(row[0]) + "</b></td><td class='n'><b>" + pct(mv, 0) +
          "</b></td><td class='n'>" + pct(pv, 0) + "</td><td class='n'><span class='delta " +
          (d > 0.02 ? "up" : d < -0.02 ? "dn" : "") + "'>" + (d >= 0 ? "+" : "") +
          n(d * 100, 0) + " puan</span></td></tr>";
      }).join("") +
      "<tr><td><b>24 saatten uzun</b><div class='sub' style='font-size:11.5px;color:var(--mute)'>" +
      "burada düşük olmak iyidir</div></td><td class='n'><b>" + pct(mineB[3], 0) +
      "</b></td><td class='n'>" + pct(peerB[3], 0) + "</td><td class='n'><span class='delta " +
      ((mineB[3] - peerB[3]) < -0.02 ? "up" : (mineB[3] - peerB[3]) > 0.02 ? "dn" : "") + "'>" +
      ((mineB[3] - peerB[3]) >= 0 ? "+" : "") + n((mineB[3] - peerB[3]) * 100, 0) +
      " puan</span></td></tr>" +
      "</tbody></table></div>" +
      "<div class='note'>Yüzdeler birikimlidir: “10 saat içinde”, ilk saat içindekileri de kapsar. " +
      "İlk üç satırda yüksek olmak, son satırda düşük olmak iyidir.</div></div>";
  }

  /* Through which channel. Every channel is listed even when the venue never
     used it — a zero next to "Telefonla aradınız" is the point of the table. */
  if (o.total) {
    var ML = C.responseMethods || {};
    var ORDER = ["Telefon", "Telefona Cevap", "Sms", "E-mail"];
    var mineMap = {}, mineSec = {};
    (o.methods || []).forEach(function (x) { mineMap[x.m] = x.n; mineSec[x.m] = x.sec; });
    var pmix = {};
    if (b && b.methodMix) b.methodMix.forEach(function (x) { pmix[x.m] = x.share; });
    var mtot = ORDER.reduce(function (a2, k) { return a2 + (mineMap[k] || 0); }, 0);
    if (mtot) {
      var mlab = ORDER.map(function (k) { return ML[k] || k; });
      var mineM = ORDER.map(function (k) { return (mineMap[k] || 0) / mtot; });
      var peerM = ORDER.map(function (k) { return pmix[k] || 0; });
      var phoneShare = mineM[0] + mineM[1], peerPhone = peerM[0] + peerM[1];
      h += '<div class="card"><h3>Çiftlere hangi yolla dönüyorsunuz?</h3>' +
        "<p style='font-size:13px;color:var(--mute);margin:5px 0 12px'>İlk dönüş kanalınız. " +
        "<b>Telefonla dönüş en kıymetlisi</b> — çiftle aynı anda konuşmaya başlar, " +
        "e-posta ise sıraya girer.</p>" +
        groupedBars(mlab, mineM, peerM, { h: 190 }) +
        '<div class="tbl-wrap" style="margin-top:14px"><table><thead><tr><th>Yöntem</th>' +
        '<th class="n">Teklif</th><th class="n">Sizin payınız</th><th class="n">Rakip payı</th>' +
        '<th class="n">Ortalama dönüşünüz</th></tr></thead><tbody>' +
        ORDER.map(function (k, i) {
          var cnt = mineMap[k] || 0;
          return "<tr" + (cnt ? "" : " style='opacity:.55'") + "><td><b>" + esc(ML[k] || k) +
            "</b></td><td class='n'>" + n(cnt) + "</td><td class='n'><b>" + pct(mineM[i], 0) +
            "</b></td><td class='n'>" + pct(peerM[i], 0) + "</td><td class='n'>" +
            (cnt ? hrs((mineSec[k] || 0) / 3600) + " (medyan)" : "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div class="verdict ' + (phoneShare < peerPhone - 0.05 ? "fix" : "win") +
        '" style="margin-top:12px"><h4>Telefonla dönüş: siz ' + pct(phoneShare, 0) +
        " · rakipleriniz " + pct(peerPhone, 0) + "</h4><p>" +
        (phoneShare < peerPhone - 0.05
          ? "Rakipleriniz çiftle daha sık telefonda konuşuyor. Yazılı dönüş, çiftin sizi " +
            "sıraya koymasına izin veriyor."
          : "Çiftle telefonda konuşma oranınız iyi — bu, anlaşmaya en hızlı giden yol.") +
        "</p></div></div>";
    }
  }

  /* where the offers came from */
  if (o.types && o.types.length) {
    var LT = C.leadTypes || {};
    var ttot = o.types.reduce(function (a2, x) { return a2 + x.n; }, 0);
    h += '<div class="card"><h3>Teklifleriniz nereden geldi?</h3>' +
      "<p style='font-size:13px;color:var(--mute);margin:5px 0 12px'>Çiftin size ulaşma yolu. " +
      "Hepsi Düğün.com üzerinden gelen taleptir.</p>" +
      '<div class="tbl-wrap"><table><thead><tr><th>Kaynak</th><th class="n">Teklif</th>' +
      '<th class="n">Pay</th><th style="width:34%">&nbsp;</th></tr></thead><tbody>' +
      o.types.map(function (x) {
        var meta = LT[x.t] || { t: x.t, d: "" };
        var share = x.n / ttot;
        return "<tr><td><b>" + esc(meta.t) + "</b>" +
          (meta.d ? "<div style='font-size:11.5px;color:var(--mute)'>" + esc(meta.d) + "</div>" : "") +
          "</td><td class='n'>" + n(x.n) + "</td><td class='n'><b>" + pct(share, 0) + "</b></td>" +
          '<td><div class="rb" style="height:9px;border-radius:5px;background:var(--line-2);overflow:hidden">' +
          '<i style="display:block;height:100%;border-radius:5px;background:var(--grad);width:' +
          (share * 100).toFixed(0) + '%"></i></div></td></tr>';
      }).join("") + "</tbody></table></div></div>";
  }

  /* ---------- 4. missed offers ---------- */
  if (o.reject && o.reject.length) {
    var rt = o.reject.reduce(function (a2, x) { return a2 + x.n; }, 0);
    h += '<div class="sec-head" style="margin-top:26px"><h2>4 · Kaçan teklifler</h2>' +
      "<p>Wedding Planner ekibimiz mekanınızı bir çifte önerdiğinde, çift teklif almak " +
      "istemediyse gerekçesini kaydediyoruz. Bu, elinizdeki en somut yol haritası.</p></div>";
    h += '<div class="card"><h3>Çift neden teklif almak istemedi?</h3>' +
      "<p style='font-size:12.5px;color:var(--mute);margin:5px 0 10px'>" + n(rt) + " kayıt</p>" +
      o.reject.map(function (x) {
        var share = x.n / rt;
        return '<div class="reason-row"><div><b>' + esc(x.r) + "</b></div>" +
          '<div class="num" style="text-align:right;font-weight:800">' + pct(share, 0) + "</div>" +
          '<div class="rb"><i style="width:' + (share * 100).toFixed(0) + '%"></i></div></div>';
      }).join("") + "</div>";
  }

  h += '<div class="note">Karşılaştırmalar; sizinle <b>aynı şehirde, aynı kategoride ve ' +
    "aynı bütçe aralığında</b> hizmet veren firmalarla yapılmıştır. Tüm rakamlar " +
    esc(R.meta.window[0]) + " – " + esc(R.meta.window[1]) + " dönemine aittir.</div>";

  v.innerHTML = h;
};

/* ------------------------------------------------------------- trend */
RENDER.trend = function () {
  var p = currentProvider();
  if (!p) return needPick("v-trend");
  var m = p.months || [], lab = m.map(function (x) { return x.label; });
  var v = $("#v-trend");

  var h = '<div class="sec-head"><span class="kick">' + esc(p.name) + "</span><h2>Aylık Seyir</h2>" +
    "<p>Son " + m.length + " ay. Son sütun içinde bulunduğumuz ay olduğu için eksiktir.</p></div>";

  h += '<div class="card"><h3>Görünürlük</h3><div class="legend">' +
    '<span><i style="background:var(--pink)"></i>Sayfa ziyareti</span>' +
    '<span><i style="background:var(--green)"></i>Listede görünme (÷10)</span></div>' +
    lineChart(lab, [
      { v: m.map(function (x) { return x.pv; }) },
      { v: m.map(function (x) { return x.cv == null ? null : x.cv / 10; }), cls: "ln2" }
    ], { h: 210 }) + "</div>";

  h += '<div class="card"><h3>Teklif</h3><div class="legend">' +
    '<span><i style="background:var(--pink)"></i>Toplam teklif</span>' +
    '<span><i style="background:var(--green)"></i>Dönülen teklif</span></div>' +
    lineChart(lab, [
      { v: m.map(function (x) { return x.tot; }) },
      { v: m.map(function (x) { return x.resp; }), cls: "ln2" }
    ], { h: 210 }) + "</div>";

  h += '<div class="card"><h3>Aylık tablo</h3><div class="tbl-wrap"><table><thead><tr><th>Ay</th>' +
    '<th class="n">Listede</th><th class="n">Sayfa</th><th class="n">Teklif</th>' +
    '<th class="n">Dönülen</th><th class="n">Dönüşüm</th></tr></thead><tbody>' +
    m.slice().reverse().map(function (x) {
      return "<tr" + (x.partial ? ' style="opacity:.55"' : "") + "><td><b>" + esc(x.label) + "</b>" +
        (x.partial ? ' <span class="pill neu">eksik ay</span>' : "") + "</td>" +
        '<td class="n">' + n(x.cv) + '</td><td class="n">' + n(x.pv) + '</td><td class="n">' + n(x.tot) +
        '</td><td class="n">' + n(x.resp) + '</td><td class="n">' + pct(div(x.tot, x.pv), 1) + "</td></tr>";
    }).join("") + "</tbody></table></div></div>";

  v.innerHTML = h;
};

/* ------------------------------------------------------------ verdict */
function buildVerdicts(p) {
  var wins = [], fixes = [], a = p.agg12 || {}, pr = p.profile, o = p.offers || {}, he = p.health || {};
  function add(key, winTxt, fixTxt, doTxt) {
    var r = score(p, key); if (r == null) return;
    if (r >= 1.15) wins.push({ t: BENCH_LABEL[key], p: winTxt(r) });
    else if (r <= 0.85) fixes.push({ t: BENCH_LABEL[key], p: fixTxt(r), d: doTxt });
  }
  var up = function (r) { return "Emsalinizden <b>%" + Math.round((r - 1) * 100) + " daha iyi</b> durumdasınız."; };
  var dn = function (r) { return "Emsalinizden <b>%" + Math.round((1 - r) * 100) + " daha zayıf</b> durumdasınız."; };

  add("profile_score", function (r) { return up(r) + " Profiliniz dolu."; },
    function (r) { return dn(r) + " Profil skoru listedeki sıranızı doğrudan etkiliyor."; },
    "Eksik alanları PY'nizle birlikte tek tek kapatın.");
  add("image_count", function (r) { return up(r) + " Galeriniz zengin."; },
    function (r) { return dn(r) + " Fotoğraf sayınız emsalin altında."; },
    "Emsal ortancasına ulaşacak kadar yeni fotoğraf yükleyin; kapak görselini mevsime göre yenileyin.");
  add("review_count", function (r) { return up(r) + " Yorumlarınız güven veriyor."; },
    function (r) { return dn(r) + " Yorum sayısı, çiftin karar anındaki en güçlü sinyalidir."; },
    "Connect → Anlaşma İstatistikleri → “Yorum İste” ile anlaştığınız her çiftten yorum talep edin.");
  add("card_view_pxd", function (r) { return up(r) + " Listede aynı bütçeyle daha çok görünüyorsunuz."; },
    function (r) { return dn(r) + " Aynı parayı ödeyen komşu mekan sizden daha sık listeleniyor."; },
    "Paket seviyesini ve profil skorunu birlikte ele alın — ikisi de listede görünme sıklığını besler.");
  add("ctr", function (r) { return up(r) + " Kapak görseliniz ve fiyat etiketiniz işini yapıyor."; },
    function (r) { return dn(r) + " Kartınız listede görünüyor ama tıklanmıyor — sorun vitrinde."; },
    "Kapak görselini değiştirin, Özel Fiyat kampanyası açın, fiyat aralığını güncelleyin.");
  add("cr", function (r) { return up(r) + " Sayfanızı açan çiftin daha büyük kısmı size yazıyor."; },
    function (r) { return dn(r) + " Sayfanıza giren çift teklif göndermeden çıkıyor."; },
    "Galeriyi ve menüyü güncelleyin, kapasite ve fiyat bilgisini netleştirin, yorum sayısını artırın.");
  add("response_rate", function (r) { return up(r) + " Gelen teklifi boşa düşürmüyorsunuz."; },
    function (r) { return dn(r) + " Gelen tekliflerin bir kısmı cevapsız kalıyor — doğrudan kaybedilmiş düğün."; },
    "Connect uygulamasında bildirimleri açın; “Yeni Teklif” listesini her gün sıfırlayın.");
  add("response_hr", function (r) { return up(r) + " Hızlı dönüyorsunuz — aynı çifte yazan diğer mekanların önündesiniz."; },
    function (r) { return dn(r) + " Çift aynı anda 4-6 mekana yazıyor; ilk dönen konuşmayı başlatıyor."; },
    "Hazır mesaj şablonlarını kurun; ilk dönüşü 1 saat içinde yapacak bir kişi belirleyin.");
  add("in1h_rate", function (r) { return up(r) + " İlk saatte dönüş oranınız yüksek."; },
    function (r) { return dn(r) + " İlk saatte dönülen teklif oranınız emsalin altında."; },
    "Telefonla dönüşü öne alın; e-posta en yavaş kanal.");
  add("value_per_org_lead", function (r) { return up(r) + " Teklif başına maliyetiniz emsalden düşük — verimli çalışıyorsunuz."; },
    function (r) { return dn(r) + " Teklif başına maliyetiniz emsalden yüksek."; },
    "Talebi artıracak kaldıraçlar (profil, kampanya, paket) devreye alınmalı; birim maliyet böyle düşer.");

  if (!pr.specialOffer) fixes.push({ t: "Özel Fiyat kampanyası kapalı",
    p: "Kampanya rozeti, listede kartınızı görsel olarak farklılaştırıyor ve tıklanma oranını yükseltiyor.",
    d: "Connect → Kampanya Oluştur ile indirim/taksit/hediye kampanyası tanımlayın." });
  if (!pr.videos) fixes.push({ t: "Sayfanızda video yok",
    p: "Video, çiftin mekanı gezmeden hayal etmesini sağlayan tek içerik türü.", d: "En az 1 tanıtım videosu ekleyin." });
  if (!pr.whatsapp) fixes.push({ t: "WhatsApp kapalı",
    p: "WhatsApp en hızlı dönülen kanal. Kapalıyken çift form doldurmak zorunda kalıyor.",
    d: "Panelden WhatsApp iletişimini açın." });
  if (he.daysSinceSeen != null && he.daysSinceSeen > 7) fixes.push({ t: "Panele uzun süredir girilmemiş",
    p: n(he.daysSinceSeen) + " gündür panele/uygulamaya giriş yok. Bekleyen teklifler görülmemiş olabilir.",
    d: "Connect uygulamasını telefona kurun ve bildirimleri açın." });
  if (pr.reviewScore && pr.reviewScore >= 4.5 && pr.reviews >= 10) wins.push({ t: "Yorum puanı",
    p: "Ortalama <b>" + n(pr.reviewScore, 1) + "/5</b> · " + n(pr.reviews) + " yorum. Listedeki en güçlü ikna unsurlarından biri." });
  if (o.total >= 100) wins.push({ t: "Teklif hacmi",
    p: "Son 12 ayda <b>" + n(o.total) + "</b> teklif aldınız. Platform kapınıza çift getiriyor." });

  /* the biggest missed-offer reason is always worth an action */
  if (o.reject && o.reject.length) {
    var top = o.reject[0], rt = o.reject.reduce(function (s, x) { return s + x.n; }, 0);
    var ACT = {
      "Bütçe uymadı": "Fiyat aralığınızı ve menü seçeneklerinizi gözden geçirin; daha erişilebilir bir paket ekleyin.",
      "Lokasyon uymadı": "Bu değiştirilemez — ama yol tarifi, ulaşım ve otopark bilgisini sayfanızda öne çıkarın.",
      "Konsept uymadı": "Galeriye farklı konseptlerden kareler ekleyin; tek tip görsel tek tip çift getiriyor.",
      "Kapasite Uymadı": "Kapasite bilgisini güncelleyin; alt/üst sınırı yanlışsa doğru çiftlere çıkmıyorsunuz.",
      "Tarih uygunluğu yok": "Takviminizi güncel tutun; boş kalan hafta içi/gündüz tarihlerini öne çıkarın.",
      "Daha önce görüştü": "Eski görüşmeleri takip listesine alın — bu çiftler hâlâ karar aşamasında."
    };
    fixes.push({ t: "Çiftlerin en sık gerekçesi: " + top.r,
      p: "Wedding Planner önerisi sonrası teklif almak istemeyen çiftlerin <b>%" +
         n(top.n / rt * 100, 0) + "</b>'i bu gerekçeyi verdi.",
      d: ACT[top.r] || "PY'nizle birlikte bu gerekçenin sebebini inceleyin." });
  }
  return { wins: wins, fixes: fixes };
}

RENDER.verdict = function () {
  var p = currentProvider();
  if (!p) return needPick("v-verdict");
  var vd = buildVerdicts(p), v = $("#v-verdict");
  var h = '<div class="sec-head"><span class="kick">' + esc(p.name) + "</span><h2>Değerlendirme</h2></div>" +
    repNote("<b>Önce sol sütunu</b> okuyun. Kutlama yapılmadan aksiyon listesi verilirse firma savunmaya geçer. " +
      "Aynı görüşmede üçten fazla eksik saymayın.");
  h += '<div class="grid g2" style="align-items:start"><div>' +
    '<h3 style="color:#12726d;margin-bottom:10px">✅ İyi gidenler (' + vd.wins.length + ")</h3>" +
    (vd.wins.length ? vd.wins.map(function (x) {
      return '<div class="verdict win"><h4>' + esc(x.t) + "</h4><p>" + x.p + "</p></div>";
    }).join("") : "<div class='card'><p style='color:var(--mute);margin:0'>Emsalin belirgin üstünde bir metrik çıkmadı.</p></div>") +
    "</div>";
  h += '<div><h3 style="color:#a33f26;margin-bottom:10px">⚠️ Daha iyi olabilirdi (' + vd.fixes.length + ")</h3>" +
    (vd.fixes.length ? vd.fixes.map(function (x) {
      return '<div class="verdict fix"><h4>' + esc(x.t) + "</h4><p>" + x.p + "</p>" +
        (x.d ? '<div class="do">→ ' + esc(x.d) + "</div>" : "") + "</div>";
    }).join("") : "<div class='card'><p style='color:var(--mute);margin:0'>Zayıf metrik yok. Bu firmayla konuşma " +
      "doğrudan <b>büyüme</b> üzerine kurulmalı.</p></div>") + "</div></div>";
  h += '<div class="card" style="margin-top:14px"><h3>Görüşme cümlesi</h3><div class="punch">' +
    (vd.fixes.length
      ? "“Geçen dönem " + esc(stripParen((vd.wins[0] || { t: "birçok konu" }).t)) +
        " tarafında iyi iş çıkardınız. Önümüzdeki dönemde " + esc(stripParen((vd.fixes[0] || {}).t || "")) +
        " konusunu birlikte düzeltirsek, aynı bütçeyle daha fazla teklif alırsınız.”"
      : "“Bu dönem her metrikte emsalinizin üstündesiniz. Şimdi konuşmamız gereken şey daha iyi olmak değil, " +
        "daha görünür olmak — çünkü altyapınız fazlasını kaldırıyor.”") + "</div>" +
    '<div class="chips" style="margin-top:12px"><button class="btn" onclick="__go(\'ren\',\'upsell\')">Ya olsaydı? →</button>' +
    '<button class="btn ghost" onclick="__go(\'ren\',\'offer\')">Yenileme teklifi →</button></div></div>';
  v.innerHTML = h;
};

/* ---------------------------------------------------- demo: "Ya olsaydı?" = the simulator
   yenileme-ornek only (spliced in by tools/build_demo_yenileme.py in place of the
   panel's own what-if page). Nes, 22.09.2026: the Satış Küpü simulator IS the
   new Ya olsaydı — the whole results page (settings row, the six KPI cards,
   ROI, "Paketler yan yana") as one flowing column, every setting pre-selected from the selected provider, and no second
   scrollbar: the frame is as tall as its content, the page scrolls as one.

   The simulator is same-origin, so its state is set straight from here
   (S, applyCode, showPage, render live in the frame's global scope). */
var DEMO_SIM_CSS =
  "header,#foot,#minibar,#dotsNav,.codeline,.scrollhint{display:none!important}" +
  ":root{--hdr:0px!important;--mb:0px!important}" +
  "html,body{background:transparent!important;overflow:hidden!important;height:auto!important;min-height:0!important}" +
  "#page2{display:block!important}" +
  /* one flowing column instead of the snap deck: the whole page 2 (settings,
     the six KPI cards, ROI and the package comparison) top to bottom */
  ".snap{height:auto!important;margin:0!important;overflow:visible!important;scroll-snap-type:none!important}" +
  ".snap section{min-height:0!important;display:block!important;padding:0 0 26px!important;max-width:none!important}" +
  /* the firm is chosen in the panel, not inside the frame */
  ".filters .head button{display:none!important}" +
  "[data-rev]{opacity:1!important;transform:none!important;transition:none!important}";

var DEMO_SIM_GRP = {
  "Kır Düğünü": "Kır",
  "Düğün Salonları": "Balo+Salon", "Balo ve Davet Salonları": "Balo+Salon",
  "Söz, Nişan Mekanları": "Söz Nişan",
  "Kına ve Bekarlığa Veda Mekan": "Kına"
};

/* the simulator's inputs for a provider; null when it cannot model the firm */
function demoSimPreset(p, meta) {
  var city = null;
  if (meta.cities.indexOf(p.city) >= 0) city = p.city;
  else Object.keys(meta.city_groups || {}).forEach(function (g) {
    if (meta.city_groups[g].indexOf(p.city) >= 0) city = g;
  });
  if (!city) return null;
  var venueCats = ["Otel Düğünü", "Tarihi Mekanlar", "Nikah Salonları", "Nikah Sonrası Yemeği",
    "Tekne Düğünü", "After Party", "Sosyal Tesisler"];
  var grp = DEMO_SIM_GRP[p.cat] || (venueCats.indexOf(p.cat) >= 0 || p.catGroup === "Venue" ? "Diğer Mekan" : null);
  if (!grp) return null;
  var s = p.sim || {}, o = p.offers || {}, pr = p.profile || {};
  /* Pro Start (3) is an entry package, never a renewal target — compare from 4X */
  var x = s.x || p.x, X = x === 3 || [2, 4, 6].indexOf(x) < 0 ? 4 : x;
  /* profile level: the panel's profile.score is the provider's position among
     its peers (0–1) → the simulator's four levels by quarter */
  var sc = pr.score == null ? 0.5 : pr.score;
  var ps = sc < 0.25 ? "Zayıf" : sc < 0.5 ? "Orta" : sc < 0.75 ? "İyi" : "Çok İyi";
  var hr = o.medianSec ? o.medianSec / 3600 : 6;
  var rt = hr <= 0.5 ? "30 dk" : hr <= 2 ? "2 saat" : hr <= 6 ? "6 saat" : "24 saat";
  var rate = o.respRate == null ? 1 : o.respRate;
  var rr = rate < 0.375 ? "%25" : rate < 0.625 ? "%50" : rate < 0.875 ? "%75" : "%100";
  return { city: city, grp: grp, X: X, ps: ps, rt: rt, rr: rr, x: x };
}

function demoUpsell() {
  var p = currentProvider();
  if (!p) return needPick("v-upsell");
  var sec = $("#v-upsell");
  if (sec.dataset.pid === String(p.id) && $("#demo-sim")) return;   /* same firm: keep the frame */
  sec.dataset.pid = p.id;
  var head = '<div class="sec-head"><span class="kick">' + esc(p.name) + "</span><h2>Ya olsaydı?</h2>" +
    "<p>Mekanın bugünkü paketi, profil kalitesi ve teklife dönüş alışkanlığı seçili gelir; " +
    "farklı bir paketle kaç çiftin iletişime geçeceğini ve yatırımın geri dönüşünü birlikte okuyun. " +
    "Benzer mekanların gerçekleşen verisinden hesaplanır — <b>tahmindir</b>, taahhüt değildir.</p></div>";
  sec.innerHTML = head +
    '<div class="card" style="padding:0;overflow:hidden;background:transparent;border:0;box-shadow:none">' +
    '<iframe id="demo-sim" src="simulator/yeni_satis_simulatoru.html?v=demo5" title="Paketler yan yana" ' +
    'style="display:block;width:100%;height:420px;border:0"></iframe></div>' +
    '<div class="chips" style="margin-top:14px;align-items:center;gap:12px">' +
    '<button class="btn sm" id="demo-sim-reset" type="button">↺ Firma Metriklerine Dön</button>' +
    '<span class="note" id="demo-sim-note" style="margin:0"></span></div>';
  var f = $("#demo-sim");
  f.addEventListener("load", function () {
    var w = f.contentWindow, doc = f.contentDocument;
    var st = doc.createElement("style");
    st.textContent = DEMO_SIM_CSS;
    doc.head.appendChild(st);
    var meta = JSON.parse(doc.getElementById("model").textContent).meta;
    var pre = demoSimPreset(p, meta);
    if (!pre) {
      f.remove();
      $("#demo-sim-note").innerHTML = "<div class='card'><b>Bu sayfa için paket karşılaştırması yok.</b> " +
        "Simülatör yalnızca mekan kategorilerini ve satış şehirlerini modeller; " + esc(p.city) + " · " +
        esc(p.cat) + " bu kapsamın dışında.</div>";
      return;
    }
    /* the comparison code, then the provider's own settings, then page 2.
       "Firma Metriklerine Dön" replays the same settings after the rep has
       walked through what-if scenarios (showPage(2) also empties the ROI
       inputs, as the simulator does on every entry). */
    var own = JSON.stringify({ city: pre.city, grp: pre.grp, X: pre.X, ps: pre.ps,
      rt: pre.rt, rr: pre.rr, scen: "mid", dist: "", cust: null });
    var reset = function () { w.eval("closeMenu();Object.assign(S, " + own + ");showPage(2);"); };
    w.eval("applyCode('2460', SIM_CODES['2460']);");
    reset();
    $("#demo-sim-reset").addEventListener("click", function () {
      reset();
      window.scrollTo({ top: sec.offsetTop - 12, behavior: "smooth" });
    });
    /* the deck's wording: the method line leads, the "no promise" line steps back */
    $$(".warnband", doc).forEach(function (wb) {
      var span = wb.querySelector("span:last-child");
      if (span) span.innerHTML =
        "<b>Benzer mekanların gerçekleşen verisinden hesaplanır.</b> " +
        '<span style="font-weight:400">Sonuçlar mekanın profiline eklediği ' +
        "<u>fotoğraf kalitesi, kampanya çıkıp çıkmadığı, kendisine ulaşan çiftlere " +
        "ne kadar sürede geri döndüğü</u> gibi çeşitli metriklere göre değişir.</span>" +
        "<small>Tüm rakamlar tahmini ortalamalardır — taahhüt değildir.</small>";
    });
    var who = doc.getElementById("whoTxt");
    if (who) who.textContent = p.name + " · " + pre.city + " · " + w.eval("GRP_LABEL")[pre.grp];
    /* "seçili" in the table = the package being compared; say what the firm has today */
    $("#demo-sim-note").textContent = "Seçili gelen ayarlar: " +
      (pre.x === 3 ? "Pro Start (karşılaştırma 4X üzerinden)" : pre.x + "X paket") +
      " · " + pre.ps + " profil · " + pre.rt + " dönüş süresi · " + pre.rr +
      " dönüş oranı — hepsi mekanın kendi verisinden. Senaryoları deneyin; bu düğme mekanın kendi ayarlarına geri getirir.";
    /* no second scrollbar: the frame is exactly as tall as its content */
    var fit = function () {
      var h = Math.ceil(doc.documentElement.getBoundingClientRect().height || doc.body.scrollHeight);
      if (h > 40) f.style.height = h + "px";
    };
    fit();
    new w.ResizeObserver(fit).observe(doc.body);
    window.addEventListener("resize", fit);
  });
}

/* ------------------------------------------------------- what-if / upsell */
var whatIf = null;

RENDER.upsell = demoUpsell;

/* ------------------------------------------------------------- offer */
var renewOffer = { disc: null };

RENDER.offer = function () {
  var p = currentProvider();
  if (!p) return needPick("v-offer");
  var v = $("#v-offer"), a = p.agg12 || {}, o = p.offers || {};
  var bl = sasBlockFor(p.city);
  var row = bl ? (bl.rows.filter(function (r) { return r.category.trim() === p.cat; })[0] || null) : null;
  var units = bl ? (bl.units || []) : [];
  var IDX = { 2: 2, 4: 1, 6: 0 };
  var curX = p.x, curAnnual = p.value ? p.value * 12 : null;

  function listMonthly(x) {
    if (!row) return null;
    var pz = row.prices[IDX[x]];
    return pz ? (units[IDX[x]] === "6ay" ? pz / 6 : pz) : null;
  }
  if (renewOffer.disc == null) {
    var lm0 = listMonthly(curX);
    renewOffer.disc = (lm0 && p.value) ? clamp(Math.round((1 - p.value / lm0) * 100), 0, 80) : 60;
  }
  var d = renewOffer.disc / 100;

  var h = '<div class="sec-head"><span class="kick">' + esc(p.name) + " · " + esc(p.city) + " · " + esc(p.cat) +
    '</span><h2>Yenileme Teklifi</h2><p>Yenilemede <b>Winner</b> paketleriyle devam edilir. ' +
    "Liste fiyatları " + esc(P.updated) + " tarihli ve <b>aylık</b>tır (KDV hariç).</p></div>";

  h += '<div class="card"><div class="grid g4">' +
    '<div class="kpi"><div class="lb">Mevcut paket</div><div class="v">' + esc(p.product) + "</div>" +
    '<div class="cmp">' + tl(p.value) + " / ay</div></div>" +
    '<div class="kpi"><div class="lb">Mevcut yıllık değer</div><div class="v num">' + tl(curAnnual) + "</div></div>" +
    '<div class="kpi"><div class="lb">12 ayda gelen teklif</div><div class="v num">' + n(o.total) + "</div></div>" +
    '<div class="kpi"><div class="lb">Geçen dönem teklif başına maliyet</div><div class="v num">' +
    tl(div((a.value_avg || 0) * (a.months || 12), o.total)) + "</div>" +
    '<div class="cmp">fiilen ödediğiniz ÷ teklif</div></div></div></div>';

  if (!row) {
    h += "<div class='card'><p>Bu şehir/kategori için liste fiyatı bulunamadı — Yatırım &amp; Teklif sekmesinden bakın.</p></div>";
    v.innerHTML = h; return;
  }

  h += '<div class="card"><div class="grid g2" style="align-items:center">' +
    "<div><label class='fld'>Liste üzerinden indirim</label>" +
    "<input type='range' id='of-disc' min='0' max='80' step='1' value='" + renewOffer.disc + "'>" +
    "</div><div style='text-align:center'><div class='stat' style='border:0;box-shadow:none'>" +
    "<div class='v num' id='of-disc-v'>%" + renewOffer.disc + "</div><div class='l'>uygulanan indirim</div></div></div></div>";

  h += '<div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Paket</th>' +
    '<th class="n">Aylık liste</th><th class="n">Teklif / ay</th><th class="n">Teklif / yıl</th>' +
    '<th class="n">Tahmini yıllık teklif</th><th class="n">Teklif başına</th>' +
    '<th class="n">Ek teklif başına</th></tr></thead><tbody>';
  [2, 4, 6].forEach(function (x) {
    var lm = listMonthly(x), offer = lm ? lm * (1 - d) : null;
    var smx = simulateX(p, x);
    var lift = (x === curX) ? 1 : (smx ? smx.lift : null);
    var leads = (o.total != null && lift) ? o.total * lift : null;
    var annual = offer ? offer * 12 : null;
    var cpl = (annual && leads) ? annual / leads : null;
    var marg = "—";
    if (x !== curX && annual && curAnnual && leads != null && o.total != null && leads > o.total) {
      marg = "<b>" + tl((annual - curAnnual) / (leads - o.total)) + "</b>";
    }
    var isCur = x === curX;
    h += "<tr" + (isCur ? ' class="hi"' : "") + "><td><b>Winner " + x + "X</b>" +
      (isCur ? ' <span class="pill pink">mevcut</span>' : "") + "</td>" +
      '<td class="n">' + tl(lm) + '</td><td class="n"><b>' + tl(offer) + '</b></td><td class="n">' + tl(annual) + "</td>" +
      '<td class="n">' + (leads ? n(leads) : "—") +
      (lift && !isCur ? ' <span class="pill ' + (lift >= 1 ? "ok" : "bad") + '">' +
        (lift >= 1 ? "+" : "") + n((lift - 1) * 100, 0) + "%</span>" : "") + "</td>" +
      '<td class="n">' + tl(cpl) + '</td><td class="n">' + marg + "</td></tr>";
  });
  h += "</tbody></table></div>" +
    '<div class="note">“Ek teklif başına” = bir üst pakete geçmenin marjinal maliyeti: ' +
    "(yeni yıllık tutar − bugünkü yıllık tutar) ÷ (ek gelen teklif). Yükseltme kararı bu kolonda verilir.</div></div>";

  var mrows = [2, 4, 6].map(function (x) {
    return { x: x, m: R.market[p.city + "|" + p.cat + "|Winner " + x + "X"] };
  }).filter(function (r) { return r.m; });
  if (mrows.length) {
    h += '<div class="internal"><div class="tagline">🔒 İç bilgi · müşteriye göstermeyin</div>' +
      "<h4>Emsal firmaların bu pakete fiilen ödediği</h4>" +
      '<div class="tbl-wrap"><table><thead><tr><th>Paket</th><th class="n">Firma</th>' +
      '<th class="n">Alt çeyrek</th><th class="n">Medyan</th><th class="n">Üst çeyrek</th></tr></thead><tbody>' +
      mrows.map(function (r) {
        return "<tr><td><b>Winner " + r.x + "X</b></td><td class='n'>" + n(r.m.n) + "</td><td class='n'>" +
          tl(r.m.p25) + "</td><td class='n'><b>" + tl(r.m.median) + "</b></td><td class='n'>" + tl(r.m.p75) + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }

  h += '<div class="card rep-only"><h3>Kademe merdiveni</h3>' +
    "<p style='color:var(--mute);font-size:13.5px'>İndirime <b>en son</b> inilir. Sırayla deneyin:</p>" +
    "<ol style='padding-left:20px;font-size:14px'>" +
    ["<b>Süre:</b> daha uzun taahhüt / erken yenileme avantajı.",
     "<b>Ödeme yapısı:</b> yıllık peşin, kredi kartı taksit, parçalı çek.",
     "<b>Ek değer:</b> ek kategori indirimi, Turbo dönemi, eğitim.",
     "<b>Paket takası:</b> bir üst pakete indirimli geçiş — ödediği rakam çok değişmez, görünürlük artar.",
     "<b>Fiyat indirimi:</b> yalnızca yukarıdakiler tükendiğinde ve karşılığında bir taahhüt alarak."]
      .map(function (x) { return "<li style='margin-bottom:6px'>" + x + "</li>"; }).join("") + "</ol></div>";

  v.innerHTML = h;
  var sl = $("#of-disc");
  if (sl) {
    sl.addEventListener("input", function () { $("#of-disc-v").textContent = "%" + this.value; });
    sl.addEventListener("change", function () {
      renewOffer.disc = +this.value; RENDER.offer();
      var again = $("#of-disc"); if (again) again.focus();
    });
  }
};

/* ------------------------------------------------------------- brief */
RENDER.brief = function () {
  var p = currentProvider(), c = currentCustomer();
  if (!p) return needPick("v-brief");
  var v = $("#v-brief"), nt = p.notes || {}, he = p.health || {}, a = p.agg12 || {}, o = p.offers || {};
  var d = daysUntil(p.ends);

  var h = '<div class="sec-head"><span class="kick">Yalnızca iç kullanım</span><h2>Görüşme Öncesi Brief</h2>' +
    "<p>Bu sayfadaki her şey iç bilgidir. Sunum Modu açıkken tamamen gizlenir.</p></div>";

  h += '<div class="internal"><div class="tagline">🔒 İç bilgi · müşteriye göstermeyin</div>' +
    '<div class="grid g4">' +
    '<div class="kpi"><div class="lb">Sağlık bayrağı</div><div class="v">' + esc(he.flag || "—") + "</div>" +
    '<div class="cmp">' + n(he.flagCount) + " uyarı</div></div>" +
    '<div class="kpi"><div class="lb">Sözleşme bitişi</div><div class="v">' + dt(p.ends) + "</div>" +
    '<div class="cmp">' + (d == null ? "—" : d < 0 ? Math.abs(d) + " gün geçti" : d + " gün kaldı") + "</div></div>" +
    '<div class="kpi"><div class="lb">Anlaşma kaydı (12 ay)</div><div class="v num">' + n(a.feedback) + "</div>" +
    '<div class="cmp">gerçek anlaşma sayısı bundan yüksektir</div></div>' +
    '<div class="kpi"><div class="lb">Portföy Yöneticisi</div><div class="v" style="font-size:17px">' +
    esc(p.py || "—") + '</div><div class="cmp">CRM: ' + esc(p.crmStatus || "—") + "</div></div></div>";

  h += "<div class='note' style='margin-top:8px'>Anlaşma sayısı düğün sonrası çift aramalarıyla toplandığı için " +
    "her zaman gerçeğin altındadır — <b>firmaya bu rakamı söylemeyin</b>, sadece kendi değerlendirmenizde kullanın." +
    (o.deals != null ? " (Panelde işaretlenen anlaşma: " + n(o.deals) + ")" : "") + "</div>";

  if (nt.py) {
    h += "<h4 style='margin-top:16px'>Son PY notu" + (nt.pyDate ? " · " + dt(nt.pyDate) : "") + "</h4>" +
      "<div class='card' style='margin-top:6px'>" +
      (nt.pyChurn ? '<span class="pill bad">' + esc(nt.pyChurn) + "</span> " : "") +
      (nt.pyReason ? '<span class="pill warn">' + esc(nt.pyReason) + "</span>" : "") +
      "<p style='margin:8px 0 0;font-size:14px'>" + esc(nt.py) + "</p></div>" +
      "<div class='note'>Not, sona eren ürün dönemine ait olabilir. Görüşmede doğrudan alıntılamayın.</div>";
  } else {
    h += "<h4 style='margin-top:16px'>Son PY notu</h4><p style='color:var(--mute)'>Kayıtlı bir PY notu yok.</p>";
  }
  if (c && c.pmNote) h += "<h4 style='margin-top:14px'>Müşteri notu</h4><p>" + esc(c.pmNote) + "</p>";

  var flags = he.flags || {};
  var FLAGL = { response_rate: "Dönüş oranı", response_time: "Dönüş süresi", last_seen: "Panele giriş",
    gallery: "Galeri", review: "Yorum", campaign: "Kampanya", cr: "Dönüşüm oranı", lead_count: "Teklif adedi" };
  var raised = Object.keys(flags).filter(function (k) { return flags[k]; });
  h += "<h4 style='margin-top:14px'>Açık sağlık uyarıları</h4>" +
    (raised.length ? '<div class="chips" style="margin-top:6px">' + raised.map(function (k) {
      return '<span class="pill bad">' + esc(FLAGL[k] || k) + "</span>"; }).join("") + "</div>"
      : "<p style='color:var(--mute)'>Açık uyarı yok.</p>");

  var hist = p.b2b || [];
  h += "<h4 style='margin-top:16px'>B2B geçmişi</h4>" +
    (hist.length
      ? '<div class="tbl-wrap" style="margin-top:6px"><table><thead><tr><th>Ay</th><th>Durum</th><th>Detay</th></tr></thead><tbody>' +
        hist.slice().reverse().map(function (e) {
          var cls = { Renewal: "ok", Churn: "bad", Decay: "warn", Drop: "warn", New: "ok" }[e.status] || "neu";
          return "<tr><td><b>" + esc(e.month) + '</b></td><td><span class="pill ' + cls + '">' +
            esc(e.status) + "</span></td><td>" + esc(e.sub || "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : "<p style='color:var(--mute)'>Değişiklik kaydı yok — dönem boyunca kesintisiz devam etmiş.</p>");

  h += "<h4 style='margin-top:16px'>Görüşme açılışı önerisi</h4><div class='punch'>" +
    (a.feedback >= 3
      ? "İyi bir dönem geçirmişler. Açılışta teklif hacmini söyleyin: “Son 12 ayda platformdan " +
        n(o.total) + " teklif aldınız.” Sonra büyüme konuşun."
      : "Nötr açılış: karnedeki en güçlü metrikle başlayın, ardından tek bir gelişim alanına odaklanın. " +
        "Aynı görüşmede üçten fazla eksik saymayın.") + "</div>";

  h += '<div class="chips" style="margin-top:14px">' +
    (c ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + esc(c.crm) + '">CRM kaydı ↗</a>' : "") +
    '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + esc(p.url) + '">Firma sayfası ↗</a>' +
    '<button class="btn sm" onclick="document.getElementById(\'btn-present\').click()">🎬 Sunum Moduna geç</button></div></div>';

  v.innerHTML = h;
};

/* ------------------------------------------------------------------ boot */
function boot() {
  $$(".tab").forEach(function (b) {
    b.addEventListener("click", function () { show(b.dataset.tab); });
  });
  $$(".nav-item").forEach(function (b) {
    b.addEventListener("click", function () { show(state.tab, b.dataset.sec); });
  });
  $("#btn-present").addEventListener("click", function () {
    var on = document.body.classList.toggle("present");
    this.classList.toggle("on", on);
    this.textContent = on ? "🎬 Sunum Modu: AÇIK" : "🎬 Sunum Modu";
  });
  $("#btn-pen").addEventListener("click", function () { Draw.toggle(); });
  $("#btn-print").addEventListener("click", function () { window.print(); });
  document.addEventListener("keydown", function (e) {
    var t = e.target.tagName;
    if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
    if (e.key === "p" || e.key === "P") Draw.toggle();
    if (e.key === "n" || e.key === "N") Notes.toggle();
    if (e.key === "Escape") { Draw.toggle(false); Notes.toggle(false); }
  });
  Notes.boot();
  show("ren", "pick");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

})();
