// Cost calculator + FAQ accordion. Ported verbatim from the product repo's inline
// CLIENT_SCRIPT (src/marketing/index.ts). External file → covered by CSP script-src 'self',
// needs no inline-script hash. No frameworks, no deps.
(function () {
  // Stops cover key tier boundaries: free ceiling ~3M (100k/day WAE * 30), paid $5 up to 10M, overage above.
  var stops = [10000, 100000, 500000, 1000000, 3000000, 5000000, 10000000, 50000000, 100000000];
  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toString().replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000) + 'K';
    return String(n);
  }
  // Cost model per spec §9:
  //   <= 3M/mo  -> $0 (Cloudflare free tier)
  //   3M-10M    -> $5 (Workers Paid base plan)
  //   > 10M     -> $5 + (pv - 10M)/1M * 0.55  (WAE + Workers overage)
  function calcCost(pv) {
    if (pv <= 3000000) return 0;
    if (pv <= 10000000) return 5;
    return Math.round(5 + (pv - 10000000) / 1000000 * 0.55);
  }
  function updateCalc(idx) {
    var pv = stops[idx];
    var cost = calcCost(pv);
    document.getElementById('calc-pv').textContent = fmt(pv);
    document.getElementById('calc-cost').textContent = '$' + cost;
    document.getElementById('calc-note').textContent = cost === 0
      ? "You're inside Cloudflare's free tier (up to ~3M events/mo) — $0/mo. Skopia is open source, so there's nothing else to pay."
      : cost === 5
        ? "You're on the Workers Paid plan ($5/mo base). WAE and Workers capacity up to 10M events/mo are included — no meaningful overage."
        : 'Roughly $' + cost + '/mo on Cloudflare Workers + Analytics Engine at this volume. Skopia stays free — you only pay Cloudflare for what you use.';
  }
  var slider = document.getElementById('calc-slider');
  if (slider) {
    slider.addEventListener('input', function () { updateCalc(parseInt(this.value, 10)); });
    updateCalc(parseInt(slider.value, 10));
  }

  // FAQ accordion — first item starts open (set in markup; this toggles the rest).
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var btn = item.querySelector('.faq-btn');
    var body = item.querySelector('.faq-body');
    var icon = item.querySelector('.faq-icon');
    if (!btn || !body || !icon) return;
    btn.addEventListener('click', function () {
      var open = body.style.display === 'block';
      document.querySelectorAll('.faq-body').forEach(function (b) { b.style.display = 'none'; });
      document.querySelectorAll('.faq-icon').forEach(function (ic) { ic.style.color = '#6a7184'; ic.style.transform = 'none'; });
      if (!open) {
        body.style.display = 'block';
        icon.style.color = '#4d86ff';
        icon.style.transform = 'rotate(45deg)';
      }
    });
  });

  // Mobile nav — hamburger toggles the collapsed menu; tapping a link closes it.
  // Selectors are unique to the nav, so no overlap with the calculator/FAQ handlers above.
  var burger = document.querySelector('.nav-burger');
  var navMenu = document.getElementById('nav-menu');
  if (burger && navMenu) {
    burger.addEventListener('click', function () {
      var open = navMenu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();
