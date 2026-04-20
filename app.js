/* ============ RFA 退休金複習 — interactions ============ */
(function(){
  'use strict';

  // ── Tab switching ──
  const tabs = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.panel');
  function showTab(id) {
    panels.forEach(p => p.classList.remove('active'));
    tabs.forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('tab-' + id);
    const btn = document.querySelector(`.nav-btn[data-tab="${id}"]`);
    if (panel) panel.classList.add('active');
    if (btn) {
      btn.classList.add('active');
      btn.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    }
    window.scrollTo({top:0, behavior:'smooth'});
    localStorage.setItem('rfa_tab', id);
  }
  tabs.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  const savedTab = localStorage.getItem('rfa_tab');
  if (savedTab && document.getElementById('tab-' + savedTab)) showTab(savedTab);

  // ── Card toggle ──
  window.toggleCard = function(head) {
    head.closest('.card').classList.toggle('collapsed');
  };

  // ── Expand / collapse all ──
  document.getElementById('expand-all').addEventListener('click', () => {
    document.querySelectorAll('.panel.active .card').forEach(c => c.classList.remove('collapsed'));
  });
  document.getElementById('collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.panel.active .card').forEach(c => c.classList.add('collapsed'));
  });

  // ── Progress bar ──
  const prog = document.getElementById('progress-bar');
  const backTop = document.getElementById('back-top');
  backTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  window.addEventListener('scroll', () => {
    const s = window.scrollY;
    const t = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (s / t * 100) + '%';
    backTop.classList.toggle('visible', s > 400);
  });

  // ── Practice Q interactive ──
  document.querySelectorAll('.pq').forEach(pq => {
    const correct = parseInt(pq.dataset.correct, 10);
    const opts = pq.querySelectorAll('.pq-opt');
    const ans = pq.querySelector('.pq-ans');
    opts.forEach((opt, i) => {
      opt.addEventListener('click', () => {
        if (pq.dataset.done) return;
        pq.dataset.done = '1';
        opts.forEach((o, j) => {
          if (j === correct) o.classList.add('correct');
          else if (j === i) o.classList.add('wrong');
        });
        ans.classList.add('visible');
      });
    });
  });

  // ── Format helpers ──
  const fmt = n => {
    if (!isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  };

  // ── 國保試算 ──
  function calcGuomin() {
    const ins = +document.getElementById('gm-insured').value || 0;
    const y = +document.getElementById('gm-years').value || 0;
    const a = ins * y * 0.0065 + 4049;
    const b = ins * y * 0.013;
    document.getElementById('gm-a').textContent = fmt(a);
    document.getElementById('gm-b').textContent = fmt(b);
    const best = Math.max(a, b);
    document.getElementById('gm-best').textContent = fmt(best);
    document.getElementById('gm-pick').textContent = (best === a ? 'A 式勝出' : 'B 式勝出');
  }
  ['gm-insured','gm-years'].forEach(id => document.getElementById(id).addEventListener('input', calcGuomin));
  calcGuomin();

  // ── 勞保試算 ──
  function calcLaobao() {
    const s = +document.getElementById('lb-salary').value || 0;
    const y = +document.getElementById('lb-years').value || 0;
    const off = +document.getElementById('lb-offset').value || 0;
    const b = s * y * 0.0155;
    const a = s * y * 0.00775 + 3000;
    const adjust = 1 + (off * 0.04);
    const base = Math.max(a, b);
    const adjusted = base * adjust;
    document.getElementById('lb-a').textContent = fmt(a);
    document.getElementById('lb-b').textContent = fmt(b);
    document.getElementById('lb-best').textContent = fmt(adjusted);
    const pick = (base === a ? 'A 式' : 'B 式');
    const txt = off === 0 ? pick + ' · 法定年齡' : pick + ` · ${off>0?'延後 +':'提前 '}${Math.abs(off)} 年 ${off>0?'+':'-'}${Math.abs(off*4)}%`;
    document.getElementById('lb-pick').textContent = txt;
  }
  ['lb-salary','lb-years','lb-offset'].forEach(id => document.getElementById(id).addEventListener('input', calcLaobao));
  calcLaobao();

  // ── 勞退新制試算 ──
  function calcLaotui() {
    const salary = +document.getElementById('lt-salary').value || 0;
    const selfP = (+document.getElementById('lt-self').value || 0) / 100;
    const years = +document.getElementById('lt-years').value || 0;
    const wage = (+document.getElementById('lt-wage').value || 0) / 100;
    const roi = (+document.getElementById('lt-roi').value || 0) / 100;
    const age = +document.getElementById('lt-age').value || 65;
    const rate = 0.06 + selfP;
    const monthlyPmt = salary * rate;
    const yearlyPmt = monthlyPmt * 12;

    // Accumulation with salary growth
    let fv;
    if (Math.abs(roi - wage) < 1e-9) {
      fv = yearlyPmt * years * Math.pow(1 + roi, years);
    } else {
      fv = (Math.pow(1+roi, years) - Math.pow(1+wage, years)) / (roi - wage) * yearlyPmt * (1 + roi);
    }

    // Monthly annuity: use 113-year longevity months × rate 1.1473%
    const months = { 60: 276, 65: 228, 70: 168 }[age] || 228;
    const iM = 0.011473 / 12;
    const monthly = fv * iM / (1 - Math.pow(1 + iM, -months));

    document.getElementById('lt-pmt').textContent = fmt(monthlyPmt);
    document.getElementById('lt-fv').textContent = fmt(fv);
    document.getElementById('lt-month').textContent = fmt(monthly);
  }
  ['lt-salary','lt-self','lt-years','lt-wage','lt-roi','lt-age'].forEach(id =>
    document.getElementById(id).addEventListener('input', calcLaotui));
  calcLaotui();

  // ── 退休金缺口補足 ──
  function calcGap() {
    const fv = +document.getElementById('gap-amt').value || 0;
    const y = +document.getElementById('gap-years').value || 0;
    const r = (+document.getElementById('gap-roi').value || 0) / 100;
    const pv = fv / Math.pow(1 + r, y);
    // BGN annuity: PMT = FV * (i/12) / ((1+i/12) * ((1+i/12)^N - 1))
    const iM = r / 12;
    const N = y * 12;
    const pmt = iM === 0 ? fv / N : fv * iM / ((1 + iM) * (Math.pow(1 + iM, N) - 1));
    document.getElementById('gap-pv').textContent = fmt(pv);
    document.getElementById('gap-pmt').textContent = fmt(pmt);
  }
  ['gap-amt','gap-years','gap-roi'].forEach(id => document.getElementById(id).addEventListener('input', calcGap));
  calcGap();

  // ── Flashcards ──
  const cards = [
    {c:'國民年金', q:'國民年金 A 式公式？', a:'月領 = <strong>投保 21,103 × 年資 × 0.65% + 4,049 元</strong>'},
    {c:'國民年金', q:'國民年金 B 式公式？', a:'月領 = <strong>投保 21,103 × 年資 × 1.3%</strong>'},
    {c:'國民年金', q:'114 年國保費率？每年調升多少？上限多少？', a:'114/1/1 起 <strong>10.5%</strong>，每年 +0.5%，上限 <strong>12%</strong>'},
    {c:'國民年金', q:'誰不能領 A 式？（4 項）', a:'① 欠費 ② 領社福津貼 ③ 領勞保/公保年金 ④ <strong>112/10/1 後</strong>領公保/軍保/勞保一次給付者'},
    {c:'勞保', q:'勞保新制 A 式公式？', a:'月領 = <strong>最高 60 月平均投保薪資 × 年資 × 0.775% + 3,000 元</strong>'},
    {c:'勞保', q:'勞保新制 B 式公式？', a:'月領 = <strong>最高 60 月平均投保薪資 × 年資 × 1.55%</strong>'},
    {c:'勞保', q:'勞保提前/延後領年金如何調整？', a:'提前每年 <strong>−4%</strong>，延後每年 <strong>+4%</strong>（最多 ±5 年）'},
    {c:'勞保', q:'民國 49 年次勞保請領年齡？', a:'<strong>63 歲</strong>（111/112 適用）'},
    {c:'勞保', q:'勞保舊制計算薪資基準？', a:'退休前 <strong>3 年</strong>平均投保薪資（與勞退舊制 6 個月不同）'},
    {c:'勞保', q:'勞保財務預估何時破產？', a:'<strong>2031 年</strong>，為台灣社保最大隱憂'},
    {c:'勞退', q:'勞退舊制計算薪資基準？基數最高？', a:'退休前 <strong>6 個月</strong>平均；前 15 年×2 + 後 15 年×1 = 最多 <strong>45 基數</strong>'},
    {c:'勞退', q:'勞退新制提撥率？可自提多少？', a:'雇主 ≥ <strong>6%</strong>；勞工可自提 <strong>≤ 6%</strong>（享稅優）'},
    {c:'勞退', q:'勞退新制保證收益率？（113/110 版）', a:'110 版 <strong>0.987%</strong>；113 版 <strong>1.1473%</strong>'},
    {c:'公保', q:'公保一次養老給付計算基準？', a:'<strong>事故當月保俸</strong>（退休當月）× 基數，最多 <strong>42 基數</strong>'},
    {c:'公保', q:'公保養老年金計算基準？', a:'<strong>最後 10 年平均保俸</strong> × 年資 × 給付率（0.75%~1.3%）'},
    {c:'公教退撫', q:'公教退撫新制月退公式？', a:'月退 = <strong>均俸（本俸×2）× 所得替代率</strong>；1~35 年每年 2% 最高 70%'},
    {c:'公教退撫', q:'112/7/1 新進公教退撫？', a:'第二層改為 <strong>DC 確定提撥制</strong>，提撥費率 15%（個人 5.25%、政府 9.75%）'},
    {c:'軍保', q:'軍保基數計算（5/10/15/20/30 年）？', a:'5 + 5×1 + 5×2 + 5×3 + 10×1 = 5+5+10+15+10 = <strong>45 基數</strong>上限'},
    {c:'私校', q:'私校退撫保費分擔？', a:'個人 <strong>32.5%</strong> + 學校 <strong>32.5%</strong> + 政府 <strong>35%</strong>'},
    {c:'計算機', q:'實質報酬率使用時機？', a:'儲蓄資產又受物價影響時 → <strong>名目報酬率 − 通膨率</strong>。勞保/國保年金（隨 CPI 調整）、生活費、長照費都用實質。'},
  ];

  let deck = cards.slice();
  let idx = 0;
  const fFront = document.getElementById('f-front');
  const fFrontCat = document.getElementById('f-front-cat');
  const fBack = document.getElementById('f-back');
  const fBackCat = document.getElementById('f-back-cat');
  const fNow = document.getElementById('f-now');
  const fTotal = document.getElementById('f-total');
  const fCat = document.getElementById('f-cat');
  const flashcard = document.getElementById('flashcard');

  function renderCard() {
    flashcard.classList.remove('flipped');
    const c = deck[idx];
    fFront.innerHTML = c.q;
    fFrontCat.textContent = c.c;
    fBack.innerHTML = c.a;
    fBackCat.textContent = c.c;
    fNow.textContent = idx + 1;
    fTotal.textContent = deck.length;
    fCat.textContent = c.c;
  }
  flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));
  document.getElementById('f-next').addEventListener('click', e => {
    e.stopPropagation();
    idx = (idx + 1) % deck.length;
    renderCard();
  });
  document.getElementById('f-prev').addEventListener('click', e => {
    e.stopPropagation();
    idx = (idx - 1 + deck.length) % deck.length;
    renderCard();
  });
  document.getElementById('f-shuffle').addEventListener('click', e => {
    e.stopPropagation();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    idx = 0;
    renderCard();
  });
  document.addEventListener('keydown', e => {
    const tabActive = document.getElementById('tab-flashcards').classList.contains('active');
    if (!tabActive) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowRight') { idx = (idx + 1) % deck.length; renderCard(); }
    else if (e.key === 'ArrowLeft') { idx = (idx - 1 + deck.length) % deck.length; renderCard(); }
    else if (e.key === ' ') { e.preventDefault(); flashcard.classList.toggle('flipped'); }
  });
  renderCard();

  // Animate gauge bars when calc tab shown
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.querySelectorAll('.gauge-fill').forEach(g => {
          const w = g.style.width;
          g.style.width = '0%';
          requestAnimationFrame(() => setTimeout(() => g.style.width = w, 50));
        });
      }
    });
  }, {threshold: .3});
  document.querySelectorAll('.panel').forEach(p => observer.observe(p));

})();
