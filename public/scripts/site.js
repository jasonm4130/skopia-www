// Skopia landing: simulated live feed, pageview trace, script ruler, cost calculator.
// Everything here is progressive: the page is complete and readable without it.
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------------------------------------------------------------- mobile menu
  var nav = $('#nav'), menuBtn = $('.menu-btn');
  if (menuBtn) {
    var setMenu = function (open) {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      $('.menu-t', menuBtn).textContent = open ? 'Close' : 'Menu';
    };
    menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    $$('.nav-links a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); }
    });
  }

  // ---------------------------------------------------------------- odometer
  function Odo(el) {
    this.el = el;
    this.value = parseInt(el.getAttribute('data-value'), 10) || 0;
    this.render();
  }
  Odo.prototype.render = function () {
    var str = this.value.toLocaleString('en-US');
    var el = this.el;
    var shape = str.replace(/\d/g, '0');
    if (el.getAttribute('data-shape') !== shape) {
      el.setAttribute('data-shape', shape);
      el.textContent = '';
      for (var i = 0; i < str.length; i++) {
        var ch = str[i], s = document.createElement('span');
        s.setAttribute('aria-hidden', 'true');
        if (/\d/.test(ch)) {
          s.className = 'd';
          var col = document.createElement('i');
          for (var n = 0; n < 10; n++) { var b = document.createElement('b'); b.textContent = n; col.appendChild(b); }
          s.appendChild(col);
        } else { s.className = 'sep'; s.textContent = ch; }
        el.appendChild(s);
      }
    }
    el.setAttribute('aria-label', str);
    var cells = el.children;
    for (var j = 0; j < str.length; j++) {
      var c = cells[j];
      if (c && c.className === 'd') c.firstChild.style.transform = 'translateY(' + (-parseInt(str[j], 10) * 1.25) + 'em)';
    }
  };
  Odo.prototype.set = function (v) { this.value = v; this.render(); };

  // ---------------------------------------------------------------- feed data
  var COUNTRIES = [
    ['US', 18, 'Chicago'], ['GB', 9, 'Leeds'], ['DE', 9, 'Hamburg'], ['IN', 7, 'Pune'], ['CA', 5, 'Toronto'],
    ['AU', 5, 'Sydney'], ['FR', 5, 'Lyon'], ['NL', 5, 'Utrecht'], ['BR', 4, 'Recife'], ['JP', 4, 'Osaka'],
    ['SE', 3, 'Malmö'], ['ES', 3, 'Valencia'], ['PL', 3, 'Kraków'], ['KR', 3, 'Busan'], ['NZ', 2, 'Wellington'],
    ['IE', 2, 'Cork'], ['MX', 2, 'Monterrey'], ['ZA', 2, 'Durban'], ['NO', 2, 'Bergen']
  ];
  var PATHS = [['/', 8], ['/pricing', 4], ['/docs/install', 4], ['/blog', 3], ['/blog/cookieless', 2], ['/changelog', 2], ['/about', 1]];
  var REFS = [['(direct)', 7, ''], ['google.com', 6, 'https://www.google.com/'], ['news.ycombinator.com', 3, 'https://news.ycombinator.com/'],
    ['github.com', 3, 'https://github.com/'], ['duckduckgo.com', 2, 'https://duckduckgo.com/'], ['lobste.rs', 1, 'https://lobste.rs/'], ['bing.com', 1, 'https://www.bing.com/']];
  var DEVS = [
    ['desktop', 5, 'Chrome', 'macOS', 1440], ['desktop', 3, 'Firefox', 'Windows', 1920], ['desktop', 2, 'Safari', 'macOS', 1512],
    ['mobile', 5, 'Safari', 'iOS', 390], ['mobile', 3, 'Chrome', 'Android', 412], ['tablet', 1, 'Safari', 'iPadOS', 820]
  ];
  function pick(list) {
    var t = 0, i; for (i = 0; i < list.length; i++) t += list[i][1];
    var r = Math.random() * t;
    for (i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i]; }
    return list[0];
  }
  function hex(n) { var s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; }
  var recentVids = [];
  var lastCC = null;
  function makeEvent() {
    var c = pick(COUNTRIES);
    if (c[0] === lastCC) c = pick(COUNTRIES); // fewer back-to-back repeats, so arrivals read as movement
    lastCC = c[0];
    var p = pick(PATHS), r = pick(REFS), d = pick(DEVS);
    // a returning visitor keeps today's hash (same salt, same IP, same UA)
    var vid = (recentVids.length && Math.random() < .3) ? recentVids[Math.floor(Math.random() * recentVids.length)] : hex(16);
    if (recentVids.indexOf(vid) < 0) { recentVids.unshift(vid); recentVids = recentVids.slice(0, 6); }
    return {
      t: new Date().toISOString().slice(11, 19), cc: c[0], city: c[2], path: p[0], ref: r[0], rfull: r[2],
      dev: d[0], br: d[2], os: d[3], w: d[4], vid: vid
    };
  }

  // ---------------------------------------------------------------- map
  var groups = {};
  $$('.map-svg .c').forEach(function (g) { groups[g.getAttribute('data-c')] = g; });
  // Warmth decays over a minute. One 1s tick writes each warm country's opacity and a
  // 1s linear CSS transition interpolates between ticks, so the map never becomes a
  // permanent choropleth and big countries don't stay lit.
  var warm = {}; // cc -> arrival time (ms)
  var lastGroup = null;
  var readV = $('#mr-v');
  function warmth(ageS) {
    if (ageS >= 60) return 0;
    if (ageS < 2.4) return 1 - (ageS / 2.4) * .38;
    if (ageS < 18) return .62 - ((ageS - 2.4) / 15.6) * .28;
    return .34 * (1 - (ageS - 18) / 42);
  }
  function paint() {
    var now = Date.now();
    Object.keys(warm).forEach(function (cc) {
      var f = groups[cc] && groups[cc].firstElementChild;
      var o = warmth((now - warm[cc]) / 1000);
      if (f) { f.style.transition = ''; f.style.opacity = o.toFixed(3); }
      if (o === 0) delete warm[cc];
    });
  }
  setInterval(paint, 1000);
  function restart(g, cls) { g.classList.remove(cls); void g.getBoundingClientRect(); g.classList.add(cls); }
  function light(cc, ageSec, path) {
    var g = groups[cc]; if (!g) return;
    warm[cc] = Date.now() - (ageSec || 0) * 1000;
    var f = g.firstElementChild;
    f.style.transition = ageSec ? 'none' : 'opacity .15s ease-out';
    f.style.opacity = warmth(ageSec || 0).toFixed(3);
    if (path != null) {
      if (lastGroup && lastGroup !== g) lastGroup.classList.remove('ping');
      if (!reduce) restart(g, 'ping');
      lastGroup = g;
      if (readV) {
        readV.innerHTML = '';
        var b = document.createElement('b'); b.textContent = cc;
        readV.appendChild(b); readV.appendChild(document.createTextNode(path));
        if (!reduce) { readV.classList.remove('swap'); void readV.offsetWidth; readV.classList.add('swap'); }
      }
    }
  }

  // ---------------------------------------------------------------- ledger
  var rows = $('#rows');
  var pvOdo = $('#pv-count') ? new Odo($('#pv-count')) : null;
  var onOdo = $('#online-count') ? new Odo($('#online-count')) : null;

  // restamp the server-rendered rows so they read as the last minute, in UTC,
  // and warm their countries by age, so the map and ledger agree from the first frame
  if (rows) {
    var now0 = Date.now(), age = 0, gaps = [4, 6, 9, 3, 8, 7, 5, 8, 6, 4];
    $$('li', rows).forEach(function (li, i) {
      age += gaps[i % gaps.length];
      li.firstElementChild.textContent = new Date(now0 - age * 1000).toISOString().slice(11, 19);
      li._age = age;
    });
    $$('li', rows).reverse().forEach(function (li) { light(li.children[1].textContent, li._age); });
  }

  var latest = null, paused = false, timer = null;

  function rowFor(e) {
    var li = document.createElement('li');
    [e.t, e.cc, e.path, e.ref, e.dev].forEach(function (v, i) {
      var s = document.createElement('span');
      if (i === 3) s.className = 'l-ref';
      if (i === 4) s.className = 'l-dev';
      s.textContent = v; li.appendChild(s);
    });
    return li;
  }

  function push(e) {
    latest = e;
    if (rows) {
      var first = rows.firstElementChild;
      var h = first ? first.getBoundingClientRect().height : 38;
      var li = rowFor(e);
      li.className = 'fresh';
      rows.insertBefore(li, first);
      $$('li.fresh', rows).forEach(function (x) { if (x !== li) x.classList.remove('fresh'); });
      if (!reduce) {
        // one motion only: the whole list slides down one row (FLIP)
        rows.style.transition = 'none';
        rows.style.transform = 'translateY(' + (-h) + 'px)';
        void rows.offsetHeight;
        rows.style.transition = 'transform .8s cubic-bezier(.2,.7,.2,1)';
        rows.style.transform = 'translateY(0)';
      }
      while (rows.children.length > 12) rows.removeChild(rows.lastElementChild);
    }
    light(e.cc, 0, e.path);
    if (pvOdo) pvOdo.set(pvOdo.value + 1);
    if (onOdo && Math.random() < .35) {
      var v = onOdo.value + (Math.random() < .5 ? -1 : 1);
      onOdo.set(Math.max(3, Math.min(14, v)));
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (paused) return;
    var wait = reduce ? 6000 : 1800 + Math.random() * 2400;
    timer = setTimeout(function () { if (!document.hidden) push(makeEvent()); schedule(); }, wait);
  }

  var pauseBtn = $('.pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      $('.pause-t', pauseBtn).textContent = paused ? 'Resume feed' : 'Pause feed';
      schedule();
    });
  }
  setTimeout(function () { push(makeEvent()); schedule(); }, reduce ? 0 : 800);

  // ---------------------------------------------------------------- trace (inspector)
  var track = $('#track');
  var nowEl = $('#insp-now');
  function run(animateFields) {
    if (!track || reduce) return;
    track.classList.toggle('full', !!animateFields);
    track.classList.remove('run'); void track.offsetWidth; track.classList.add('run');
  }
  function fill(e, animate) {
    var map = { path: e.path, rfull: e.rfull, w: String(e.w), city: e.city, cc: e.cc,
      ua: e.br + ' · ' + e.os + ' · ' + e.dev, ref: e.ref, vid: e.vid, dev: e.dev, br: e.br };
    $$('[data-f]', track).forEach(function (el) {
      var k = el.getAttribute('data-f');
      if (!(k in map)) return;
      el.classList.remove('changed');
      if (el.textContent !== map[k]) {
        el.textContent = map[k];
        if (!reduce && animate) { void el.offsetWidth; el.classList.add('changed'); }
      }
    });
    var jr = $('.jr', track); if (jr) jr.hidden = !e.rfull;
    if (nowEl) nowEl.textContent = 'Showing: ' + e.cc + ', ' + e.path + ' at ' + e.t + ' UTC';
    run(animate);
  }
  var traceBtn = $('#dissect');
  if (traceBtn) traceBtn.addEventListener('click', function () { fill(latest || makeEvent(), true); });

  // ---------------------------------------------------------------- calculator
  var charts = $$('.chart-svg');
  var slider = $('#calc-slider');
  if (charts.length && slider) {
    var cost = function (pv) {
      if (pv <= 900000) return 0;
      if (pv <= 10000000) return 5;
      return 5 + (pv - 10000000) / 1000000 * 0.55;
    };
    var G0 = JSON.parse(charts[0].getAttribute('data-geo'));
    var llo = Math.log10(G0.lo), lhi = Math.log10(G0.hi);
    // each chart (desktop and phone) carries its own geometry
    var geos = charts.map(function (c) {
      var G = JSON.parse(c.getAttribute('data-geo'));
      return { el: c, marker: $('.marker', c), guide: $('.guide', c),
        X: function (pv) { return G.L + (Math.log10(pv) - llo) / (lhi - llo) * (G.W - G.L - G.R); },
        Y: function (v) { return G.T + (1 - v / G.ymax) * (G.H - G.T - G.B); } };
    });
    // the slider runs on the same log scale as the x axis, so thumb and marker share an x
    var pvAt = function (v) {
      var raw = Math.pow(10, llo + (lhi - llo) * v / 1000);
      var mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
      return Math.round(raw / mag) * mag; // two significant figures
    };
    var fmt = function (n) {
      if (n >= 1000000) return (Math.round(n / 100000) / 10).toString().replace(/\.0$/, '') + 'M';
      if (n >= 1000) return Math.round(n / 1000) + 'K';
      return String(n);
    };
    var calc = function (v) {
      var pv = pvAt(v), c = cost(pv), cr = Math.round(c);
      $('#calc-pv').textContent = fmt(pv);
      $('#calc-cost').textContent = '$' + cr;
      slider.setAttribute('aria-valuetext', fmt(pv) + ' pageviews, about $' + cr + ' a month');
      $('#calc-note').textContent = c === 0
        ? "Inside Cloudflare's free tier, which covers roughly 0.9M pageviews a month."
        : c === 5
          ? "Past the free tier you move to Cloudflare's Workers Paid plan, $5 a month, which covers this volume."
          : 'The $5 Workers Paid base plus usage: roughly $' + cr + ' a month at this volume.';
      geos.forEach(function (g) {
        g.marker.style.transform = 'translate(' + g.X(pv) + 'px,' + g.Y(Math.min(c, G0.ymax)) + 'px)';
        g.guide.style.transform = 'translateX(' + g.X(pv) + 'px)';
      });
    };
    // first placement must not animate in from the origin
    charts.forEach(function (c) { c.classList.add('snap'); });
    calc(parseInt(slider.value, 10));
    void charts[0].getBoundingClientRect();
    requestAnimationFrame(function () { requestAnimationFrame(function () { charts.forEach(function (c) { c.classList.remove('snap'); }); }); });
    slider.addEventListener('input', function () { calc(parseInt(this.value, 10)); });
  }

  // ---------------------------------------------------------------- plays when seen
  // Content is fully visible by default; .play only runs a one-shot keyframe once
  // the section is on screen (including at load), and never parks anything hidden.
  $$('#manifest li').forEach(function (li, i) { li.style.setProperty('--n', i); });
  function countTo(el, to, ms) {
    if (!el) return;
    var t0 = performance.now();
    (function tick(t) {
      var k = Math.min(1, Math.max(0, (t - t0) / ms));
      var e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // matches --ease-io on the bar
      el.textContent = Math.round(to * e);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  var plays = [
    ['#ruler', function () { countTo($('#byte-count'), 554, 1500); }],
    ['.pricing'],
    ['.deploy'],
    ['.principles'],
    ['#how', function () { run(false); }]
  ];
  // Plays arm on the first sign of a person (scroll, pointer, key), then run for every
  // section as it is seen, including ones already on screen. A page that is only rendered
  // (a screenshot, a print, a crawler) shows every final state and never a half-drawn one.
  function arm() {
    ['scroll', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.removeEventListener(t, arm); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        en.target.classList.add('play');
        if (en.target._cb) en.target._cb(en.target);
      });
    // Trigger when a section's top reaches the upper three-quarters of the viewport, not on a
    // visible-ratio threshold: tall stacked sections (e.g. #how on a phone) can never be 30% visible.
    }, { threshold: 0, rootMargin: '0px 0px -25% 0px' });
    plays.forEach(function (p) {
      var el = $(p[0]); if (!el) return;
      el._cb = p[1]; io.observe(el);
    });
  }
  if (!reduce && 'IntersectionObserver' in window) {
    ['scroll', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.addEventListener(t, arm, { passive: true }); });
  }
})();
