/* ── 狀態 ── */
const S = {
  labor:    { monthly:0, lump:0, active:true,  mode:null },
  national: { monthly:0, lump:0, active:false },
  civil:    { monthly:0, lump:0, active:false },
  military: { monthly:0, lump:0, active:false },
};
let laborPayMode = null;
let natMode      = 'auto';
let civilMode      = 'lump';
let civIsNewSystem = false;  // 新制（112年後/私校）→ 年資上限40年；舊制 → 35年
let civPreferred   = false;  // 辦理優惠存款 → 一次金上限36個月

/* ── 工具 ── */
const $      = id => document.getElementById(id);
const fmt    = n  => (isNaN(n)||n==null) ? '—' : Math.round(n).toLocaleString('zh-TW') + ' 元';
const fmtM   = n  => (isNaN(n)||n==null) ? '—' : Math.round(n).toLocaleString('zh-TW') + ' 元／月';
const getNum = id => parseFloat($(id)?.value) || 0;
const show   = (id,v) => { const e=$(id); if(e) e.style.display=v?'':'none'; };
const setTxt = (id,t) => { const e=$(id); if(e) e.textContent=t; };

/* ── 展開/收合 ── */
function toggleBlock(name) {
  $('block-'+name).classList.toggle('open');
}

/* ── 開關 ── */
function onToggleCheck(name) {
  const on = $('chk-'+name).checked;
  S[name].active = on;
  const inner = $(name+'-inner');
  if(inner) inner.classList.toggle('block-disabled', !on);
  if(on) $('block-'+name).classList.add('open');
  updateSummary();
}

/* ════ 勞保 ════ */
function setHasOld(flag) {
  laborPayMode = null;
  $('btn-old-yes').classList.toggle('active',  flag);
  $('btn-old-no' ).classList.toggle('active', !flag);
  ['old-lump','new-lump','annuity'].forEach(s=>show('section-'+s,false));
  show('labor-divider',false);
  show('labor-result', false);

  const q2 = $('q2-options');
  q2.innerHTML = '';
  if(flag) {
    addLBtn(q2,'old-lump','📄 舊制一次請領老年給付','98年前年資適用，依基數一次領取');
    addLBtn(q2,'new-lump','💰 新制老年一次金給付',  '年資未滿15年適用');
    addLBtn(q2,'annuity', '📅 老年年金給付',         '年資滿15年，按月領取');
    setTxt('q2-note','※ 選擇並經勞保局核付後不得變更，請謹慎選擇。');
  } else {
    addLBtn(q2,'new-lump','💰 老年一次金給付','年資未滿15年適用');
    addLBtn(q2,'annuity', '📅 老年年金給付',  '年資滿15年，按月領取');
    setTxt('q2-note','※ 98年後初次參保者不得選擇一次請領老年給付。');
  }
  show('q2-block',true);
  S.labor.monthly=0; S.labor.lump=0;
  updateSummary();
}

function addLBtn(c,v,label,hint) {
  const b=document.createElement('button');
  b.className='sub-option-btn';
  b.innerHTML=`${label}<br><span style="font-size:10px;font-weight:400;opacity:.7">${hint}</span>`;
  b.style.cssText='text-align:left;line-height:1.6';
  b.dataset.mode=v;
  b.onclick=()=>setLaborMode(v);
  c.appendChild(b);
}

function setLaborMode(mode) {
  laborPayMode=mode;
  document.querySelectorAll('#q2-options .sub-option-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  ['old-lump','new-lump','annuity'].forEach(s=>show('section-'+s,false));
  show('section-'+mode,true);
  show('labor-divider',true);
  show('labor-result', true);
  calcLabor();
}

function calcLabor() {
  if(!laborPayMode) return;
  let monthly=0,lump=0,label='',note='',sub='';

  if(laborPayMode==='old-lump') {
    const yrs=getNum('old-years'), sal=getNum('old-salary');
    const b1=Math.min(yrs,15), b2=Math.max(yrs-15,0);
    const mos=Math.min(b1+b2*2,45);
    lump=sal*mos;
    label='舊制一次請領老年給付';
    note=`前${b1}年×1月 + 超過${b2}年×2月 = ${mos}個月`;
    sub=`${mos}個月 × ${sal.toLocaleString()}元`;
    setTxt('val-labor',fmt(lump));

  } else if(laborPayMode==='new-lump') {
    const yrs=getNum('new-lump-years'), sal=getNum('new-lump-salary');
    const mos=Math.min(yrs,20);
    lump=sal*mos;
    label='新制老年一次金給付';
    note=`年資${yrs}年 → 給付${mos}個月`;
    sub=`${mos}個月 × ${sal.toLocaleString()}元`;
    setTxt('val-labor',fmt(lump));

  } else if(laborPayMode==='annuity') {
    const yrs=getNum('ann-years'), sal=getNum('ann-salary');
    const adj=parseInt($('ann-adjust')?.value??'0');
    const a=sal*yrs*0.00775+3000, b=sal*yrs*0.0155;
    const base=Math.max(a,b), fml=a>=b?'A式':'B式';
    monthly=base*(1+adj*-4/100);
    label=`老年年金給付（${fml}）`;
    note=fml==='A式'
      ?`${sal.toLocaleString()} × ${yrs} × 0.775% + 3,000 = ${fmt(base)}`
      :`${sal.toLocaleString()} × ${yrs} × 1.55% = ${fmt(base)}`;
    if(adj!==0) sub=adj>0?`提前${adj}年減給${adj*4}%`:`展延${-adj}年增給${-adj*4}%`;
    setTxt('val-labor',fmtM(monthly));
  }

  setTxt('labor-result-label',label);
  setTxt('labor-result-note', note);
  setTxt('labor-result-sub',  sub);
  S.labor.monthly=monthly; S.labor.lump=lump; S.labor.mode=laborPayMode;
  updateSummary();
}

/* ════ 國民年金 ════ */
let natCanA = true;  // 是否可選 A 式

function setNatCanA(canA) {
  natCanA = canA;
  $('nat-btn-canA-yes').classList.toggle('active',  canA);
  $('nat-btn-canA-no' ).classList.toggle('active', !canA);
  // 若不能選 A 式，強制切到 B 式或自動
  if(!canA && natMode==='A') {
    setNatMode('B');
  }
  // 禁用/啟用 A 式按鈕
  $('nat-btn-A').style.opacity = canA ? '1' : '0.4';
  $('nat-btn-A').style.pointerEvents = canA ? 'auto' : 'none';
  calcNational();
}

function setNatMode(mode) {
  // 若不能選 A 式，阻止選擇 A
  if(mode==='A' && !natCanA) { mode='B'; }
  natMode=mode;
  ['auto','A','B'].forEach(m=>$('nat-btn-'+m).classList.toggle('active',m===mode));
  calcNational();
}

function calcNational() {
  if(!S.national.active) return;
  const yrs = getNum('nat-years');            // 保險年資（年）
  const sal = getNum('nat-salary') || 21103;  // 月投保金額（113年起 21,103 元）

  // A 式：(月投保金額 × 保險年資 × 0.65%) + 4,049
  const formulaA = Math.round(sal * yrs * 0.0065) + 4049;
  // B 式：月投保金額 × 保險年資 × 1.3%
  const formulaB = Math.round(sal * yrs * 0.013);

  let monthly = 0, note = '', detail = '';

  if(yrs === 0) {
    monthly = 0;
    note = '請輸入保險年資';
  } else if(!natCanA || natMode === 'B') {
    // 不能選 A 式，或手動選 B 式
    monthly = formulaB;
    note = 'B式（純年資計算）';
    detail = `${sal.toLocaleString()} × ${yrs} × 1.3% = ${fmt(formulaB)}`;
    if(!natCanA) note += '　⚠️ 因限制條件，僅適用 B 式';
  } else if(natMode === 'A') {
    monthly = formulaA;
    note = 'A式（含基礎保障）';
    detail = `(${sal.toLocaleString()} × ${yrs} × 0.65%) + 4,049 = ${fmt(formulaA)}`;
  } else {
    // 自動擇優
    if(natCanA) {
      monthly = Math.max(formulaA, formulaB);
      const chosen = formulaA >= formulaB ? 'A' : 'B';
      note = `自動擇優 → ${chosen}式`;
      if(chosen === 'A') {
        detail = `A式 ${fmt(formulaA)} > B式 ${fmt(formulaB)}`;
      } else {
        detail = `B式 ${fmt(formulaB)} > A式 ${fmt(formulaA)}`;
      }
    } else {
      monthly = formulaB;
      note = '自動擇優 → B式　⚠️ 因限制條件，僅適用 B 式';
      detail = `B式 ${fmt(formulaB)}`;
    }
  }

  setTxt('val-national', fmtM(monthly));
  setTxt('nat-result-note', note);
  setTxt('nat-result-detail', detail);

  // 更新試算範例文字
  const exA = Math.round(sal * yrs * 0.0065) + 4049;
  const exB = Math.round(sal * yrs * 0.013);
  if(yrs > 0) {
    const chosen = exA >= exB ? 'A式' : 'B式';
    setTxt('nat-example-text',
      `以 ${yrs} 年年資為例：A式 = (${sal.toLocaleString()} × ${yrs} × 0.65%) + 4,049 = ${exA.toLocaleString()} 元　` +
      `B式 = ${sal.toLocaleString()} × ${yrs} × 1.3% = ${exB.toLocaleString()} 元 → 選 ${chosen}`
    );
  } else {
    setTxt('nat-example-text',
      '以 15 年年資為例：A式 = (21,103 × 15 × 0.65%) + 4,049 = 6,107 元　B式 = 21,103 × 15 × 1.3% = 4,115 元 → 選 A 式'
    );
  }

  S.national.monthly = monthly;
  updateSummary();
}

/* ════ 公保 ════ */
function setCivSystem(isNew) {
  civIsNewSystem = isNew;
  $('civ-btn-system-old').classList.toggle('active', !isNew);
  $('civ-btn-system-new').classList.toggle('active',  isNew);
  const cap = isNew ? 40 : 35;
  const label = isNew ? `${cap} 年（新制）` : `${cap} 年（舊制）`;
  setTxt('civ-year-cap-label', label);
  calcCivil();
}

function setCivilMode(mode) {
  civilMode=mode;
  $('civ-btn-lump').classList.toggle('active',   mode==='lump');
  $('civ-btn-annuity').classList.toggle('active',mode==='annuity');
  show('civ-section-lump',    mode==='lump');
  show('civ-section-annuity', mode==='annuity');
  calcCivil();
}

function setCivPreferred(preferred) {
  civPreferred=preferred;
  $('civ-btn-no-preferred').classList.toggle('active', !preferred);
  $('civ-btn-preferred').classList.toggle('active',     preferred);
  calcCivil();
}

function calcCivil() {
  if(!S.civil.active) return;
  let monthly=0, lump=0, label='', note='';

  if(civilMode==='lump') {
    /* ── 一次養老給付 ── */
    const yrs=getNum('civ-lump-years'), sal=getNum('civ-lump-salary');
    const maxMos=civPreferred ? 36 : 42;
    const mos=Math.min(yrs*1.2, maxMos);
    lump=sal*mos;
    label='一次養老給付';
    note=`${yrs}年 × 1.2月 = ${mos.toFixed(1)}個月（上限${maxMos}月）`;
    setTxt('val-civil', fmt(lump));

  } else {
    /* ── 月退年金給付 ── */
    const yrs    = getNum('civ-ann-years');
    const sal    = getNum('civ-ann-salary');
    const rate   = parseFloat($('civ-ann-rate')?.value)   || 0.013;
    const adj    = parseInt($('civ-ann-adjust')?.value ?? '0');
    const maxYrs = civIsNewSystem ? 40 : 35;
    const effYrs = Math.min(yrs, maxYrs);

    const base = sal * effYrs * rate;
    monthly = base * (1 - adj * 0.04);

    label='月退年金給付';
    note=`${sal.toLocaleString()} × ${effYrs}年 × ${(rate*100).toFixed(2)}% = ${fmtM(base)}`;
    if(adj > 0) note += `　提前${adj}年 減額${adj*4}%`;

    /* 上限試算（退撫＋公保總額不得超過上限），保俸直接使用已輸入的 sal */
    show('civ-limit-info', false);
    show('civ-limit-warn', false);
    if(sal > 0) {
      const capYrs  = Math.min(yrs, 35);  // 上限計算固定以35年為準
      const capPct  = Math.min(Math.min(capYrs,15)*2 + Math.max(capYrs-15,0)*2.5, 80) / 100;
      const cap     = sal * 2 * capPct;
      const retirePension = getNum('civ-retire-pension');
      const total   = monthly + retirePension;
      if(retirePension > 0 && total > cap) {
        const minVal = sal * effYrs * 0.0075;
        const capVal = Math.max(cap - retirePension, minVal);
        setTxt('civ-limit-warn',
          `⚠️ 退撫金（${fmtM(retirePension)}）＋ 公保年金（${fmtM(monthly)}）= ${fmtM(total)}，` +
          `超過上限 ${fmtM(cap)}（${Math.round(capPct*100)}%）。` +
          `公保年金調降至 ${fmtM(capVal)}`
        );
        show('civ-limit-warn', true);
        monthly = capVal;
      } else {
        const remain = cap - (retirePension > 0 ? total : monthly);
        setTxt('civ-limit-info',
          `退休年金給與上限：${fmtM(cap)}（${Math.round(capPct*100)}%）` +
          (retirePension > 0 ? `　目前合計：${fmtM(total)}　剩餘空間：${fmtM(remain)}` : `　公保年金：${fmtM(monthly)}　剩餘空間：${fmtM(remain)}`)
        );
        show('civ-limit-info', true);
      }
    }
    setTxt('val-civil', fmtM(monthly));
  }

  setTxt('civ-result-label', label);
  setTxt('civ-result-note',  note);
  S.civil.monthly=monthly; S.civil.lump=lump;
  updateSummary();
}

/* ════ 軍保 ════ */
function calcMilitary() {
  if(!S.military.active) return;
  const yrs=getNum('mil-years'), sal=getNum('mil-salary');

  if(yrs===0) {
    setTxt('val-military','—');
    setTxt('mil-result-note','');
    setTxt('mil-bases-note','');
    S.military.lump=0; updateSummary(); return;
  }
  if(yrs<5) {
    setTxt('val-military','退還自付保費');
    setTxt('mil-result-note',`年資未滿5年（${yrs}年），不予給付`);
    setTxt('mil-bases-note','');
    S.military.lump=0; updateSummary(); return;
  }

  /* 累進基數計算
     滿5年：5基　第6–10年：每年+1　第11–15年：每年+2
     第16–20年：每年+3　第21年起：每年+1　上限45基 */
  let bases = 5;
  bases += Math.max(Math.min(yrs,10)-5,  0) * 1;
  bases += Math.max(Math.min(yrs,15)-10, 0) * 2;
  bases += Math.max(Math.min(yrs,20)-15, 0) * 3;
  bases += Math.max(yrs-20, 0)              * 1;
  bases  = Math.min(bases, 45);

  const lump=sal*bases;
  setTxt('val-military', fmt(lump));
  setTxt('mil-result-note', `${yrs}年 → ${bases}個基數 × ${sal.toLocaleString()}元`);
  setTxt('mil-bases-note', `共 ${bases} 個基數`);
  S.military.lump=lump;
  updateSummary();
}

/* ════ 總覽 ════ */
function updateSummary() {
  /* 勞保卡片 */
  const lbMonthly = S.labor.mode==='annuity';
  setTxt('sum-labor',     lbMonthly ? fmtM(S.labor.monthly) : (S.labor.lump>0?fmt(S.labor.lump):'—'));
  setTxt('sum-labor-sub', lbMonthly ? '每月領取' : (S.labor.lump>0?'一次領取':'尚未設定'));

  /* 國年卡片 */
  setTxt('sum-national', S.national.active ? fmtM(S.national.monthly) : '未啟用');

  /* 公保卡片 */
  const civMonthly = civilMode==='annuity';
  setTxt('sum-civil',     !S.civil.active ? '未啟用' : civMonthly ? fmtM(S.civil.monthly) : fmt(S.civil.lump));
  setTxt('sum-civil-sub', !S.civil.active ? '—'      : civMonthly ? '每月領取'            : '一次領取');

  /* 軍保卡片 */
  setTxt('sum-military', S.military.active && S.military.lump>0 ? fmt(S.military.lump) : '未啟用');

  /* 合計 */
  const mTotal = (S.labor.active?S.labor.monthly:0) + (S.national.active?S.national.monthly:0) + (S.civil.active?S.civil.monthly:0);
  const lTotal = (S.labor.active?S.labor.lump:0)    + (S.civil.active?S.civil.lump:0)           + (S.military.active?S.military.lump:0);
  const yr20   = mTotal*240 + lTotal;

  setTxt('sum-monthly-total', fmtM(mTotal));
  setTxt('sum-lump-total',    fmt(lTotal));
  setTxt('sum-20yr',          fmt(yr20));

  /* Gap bar */
  const pct=Math.min(yr20/12000000*100,100), mis=100-pct;
  const pe=$('gap-prepared'), me=$('gap-missing');
  if(pe) pe.style.width=pct+'%';
  if(me) me.style.width=mis+'%';
  setTxt('gap-prepared-label', pct>=8?Math.round(pct)+'%':'');
  setTxt('gap-missing-label',  mis>=8?'缺口 '+Math.round(mis)+'%':'');
}

updateSummary();


function initRetirementPage() {
  if (!$('labor-result')) return;
  try {
    onToggleCheck('labor');
    onToggleCheck('national');
    onToggleCheck('civil');
    onToggleCheck('military');
    setHasOld(false);
  } catch (err) {
    console.error('[initRetirementPage] 初始化失敗', err);
  }
}

Object.assign(window, {
  toggleBlock,
  onToggleCheck,
  setHasOld,
  setLaborMode,
  calcLabor,
  setNatMode,
  calcNational,
  setCivilMode,
  setCivSystem,
  setCivPreferred,
  calcCivil,
  calcMilitary,
  initRetirementPage
});

/* =============================================
   pension2.js — 退休金第二層試算
   勞工退休金・公教退撫・軍人退撫・私校退撫儲金
   ============================================= */

/* ── 狀態 ── */
const S2 = {
  laborOld: { lump:0, active:false },
  labor:    { monthly:0, lump:0, active:true  },
  civil:    { monthly:0, lump:0, active:false },
  military: { monthly:0, lump:0, active:false },
  private:  { monthly:0, lump:0, active:false },
};

let laborPensionMode = 'lump';    // 'lump' | 'monthly'
let civilPensionMode = 'db';      // 'db'   | 'dc'
let milPensionMode   = 'monthly'; // 'monthly' | 'lump'

/* ── 工具 ── */
const $2      = id => document.getElementById(id);
const fmt2    = n  => (isNaN(n)||n==null) ? '—' : Math.round(n).toLocaleString('zh-TW') + ' 元';
const fmtM2   = n  => (isNaN(n)||n==null) ? '—' : Math.round(n).toLocaleString('zh-TW') + ' 元／月';
const getNum2 = id => parseFloat($2(id)?.value) || 0;
const show2   = (id,v) => { const e=$2(id); if(e) e.style.display=v?'':'none'; };
const setTxt2 = (id,t) => { const e=$2(id); if(e) e.textContent=t; };

/* 定期定額複利終值 FV = PMT × [(1+r)^n − 1] / r */
function fvAnnuity(pmt, annualRatePct, years) {
  const n = years * 12;
  const r = annualRatePct / 100 / 12;
  if(n === 0) return 0;
  if(r === 0) return pmt * n;
  return pmt * ((Math.pow(1 + r, n) - 1) / r);
}

/* ── 展開/收合 ── */
function toggleBlock2(name) {
  $2('block2-'+name).classList.toggle('open');
}

/* ── 開關 ── */
function onToggleCheck2(name) {
  const on = $2('chk2-'+name).checked;
  S2[name].active = on;
  const inner = $2(name+'-inner2');
  if(inner) inner.classList.toggle('block-disabled', !on);
  if(on) $2('block2-'+name).classList.add('open');
  updateSummary2();
}

/* ════ 勞工退休金（新制）════ */
function setLaborPensionMode(mode) {
  laborPensionMode = mode;
  $2('lp-btn-lump').classList.toggle('active',    mode==='lump');
  $2('lp-btn-monthly').classList.toggle('active', mode==='monthly');
  show2('lp-life-row', mode==='monthly');
  calcLaborPension();
}

function calcLaborPension() {
  if(!S2.labor.active) return;
  const salary         = getNum2('lp-salary');
  const selfRate       = getNum2('lp-self-rate') / 100;
  const years          = getNum2('lp-years');
  const retRate        = getNum2('lp-return-rate');
  const pvFactor       = getNum2('lp-pv-factor') || 240;
  const currentBalance = getNum2('lp-current-balance');

  const empRate   = 0.06;
  const pmt       = salary * (empRate + selfRate);
  const futureAcc = fvAnnuity(pmt, retRate, years);
  // 目前餘額也以相同報酬率複利成長
  const r = retRate / 100 / 12;
  const n = years * 12;
  const currentGrown = currentBalance * (r > 0 ? Math.pow(1 + r, n) : 1);
  const lump    = futureAcc + currentGrown;
  const monthly = pvFactor > 0 ? lump / (pvFactor * 12) : 0;

  S2.labor.lump    = lump;
  S2.labor.monthly = laborPensionMode === 'monthly' ? monthly : 0;

  setTxt2('lp-pmt-display',
    `每月提撥：${Math.round(pmt).toLocaleString()} 元（雇主 ${Math.round(salary*empRate).toLocaleString()} ＋ 自提 ${Math.round(salary*selfRate).toLocaleString()}）`
  );

  if(laborPensionMode === 'lump') {
    setTxt2('val2-labor',     fmt2(lump));
    setTxt2('lp-result-note', `現有 ${Math.round(currentGrown).toLocaleString()} 元（複利後）＋ 未來提撥 ${Math.round(futureAcc).toLocaleString()} 元`);
    setTxt2('lp-result-label','帳戶餘額（一次請領）');
  } else {
    setTxt2('val2-labor',     fmtM2(monthly));
    setTxt2('lp-result-note', `帳戶 ${Math.round(lump).toLocaleString()} 元 ÷ (年金現值因子 ${pvFactor} × 12)`);
    setTxt2('lp-result-label','月領換算金額');
  }
  updateSummary2();
}

/* ════ 公教退撫 ════ */
function setCivilPensionMode(mode) {
  civilPensionMode = mode;
  $2('cp-btn-db').classList.toggle('active', mode==='db');
  $2('cp-btn-dc').classList.toggle('active', mode==='dc');
  show2('cp-section-db', mode==='db');
  show2('cp-section-dc', mode==='dc');
  calcCivilPension();
}

function calcCivilPension() {
  if(!S2.civil.active) return;
  let monthly = 0, lump = 0, label = '', note = '';

  if(civilPensionMode === 'db') {
    const yrs      = getNum2('cp-db-years');
    const sal      = getNum2('cp-db-salary');
    const adjRate  = getNum2('cp-db-adj-rate'); // 年改所得替代率%

    /* 原始月退俸率：前35年每年2%（最高70%），第36-40年每年1%，上限75% */
    const r1 = Math.min(yrs, 35) * 2;
    const r2 = Math.max(Math.min(yrs, 40) - 35, 0) * 1;
    const origRatePct = Math.min(r1 + r2, 75);

    /* (A) 月退俸 = 退休前15年平均本俸 × 2 × 原始月退俸率 */
    const monthlyA = sal * 2 * origRatePct / 100;
    /* (B) 月退俸 = 退休前15年平均本俸 × 2 × 年改所得替代率 */
    const monthlyB = adjRate > 0 ? sal * 2 * adjRate / 100 : Infinity;

    monthly = Math.min(monthlyA, monthlyB);
    label = '月退俸（確定給付）';
    if(adjRate > 0) {
      const chosen = monthlyA <= monthlyB ? 'A' : 'B';
      note = `A式 ${fmtM2(monthlyA)} vs B式 ${fmtM2(monthlyB)}，取小 → ${chosen}式`;
    } else {
      note = `退休前15年平均本俸 ${sal.toLocaleString()} × 2 × ${origRatePct.toFixed(0)}%`;
    }
    setTxt2('val2-civil', fmtM2(monthly));
  } else {
    const sal      = getNum2('cp-dc-salary');
    const years    = getNum2('cp-dc-years');
    const empRate  = getNum2('cp-dc-emp-rate')  / 100;
    const selfRate = getNum2('cp-dc-self-rate') / 100;
    const retRate  = getNum2('cp-dc-return');
    const pmt  = sal * (empRate + selfRate);
    lump = fvAnnuity(pmt, retRate, years);
    label = '帳戶累積（確定提撥）';
    note  = `每月提撥 ${Math.round(pmt).toLocaleString()} 元（政府${getNum2('cp-dc-emp-rate')}% ＋ 個人${getNum2('cp-dc-self-rate')}%）× ${years}年`;
    setTxt2('val2-civil', fmt2(lump));
  }

  setTxt2('cp2-result-label', label);
  setTxt2('cp2-result-note',  note);
  S2.civil.monthly = monthly;
  S2.civil.lump    = lump;
  updateSummary2();
}

/* ════ 軍人退撫 ════ */
function setMilPensionMode(mode) {
  milPensionMode = mode;
  $2('mp-btn-monthly').classList.toggle('active', mode==='monthly');
  $2('mp-btn-lump').classList.toggle('active',    mode==='lump');
  show2('mp-section-monthly', mode==='monthly');
  show2('mp-section-lump',    mode==='lump');
  calcMilitaryPension();
}

function calcMilitaryPension() {
  if(!S2.military.active) return;
  let monthly = 0, lump = 0, label = '', note = '';

  if(milPensionMode === 'monthly') {
    const yrs  = getNum2('mp-m-years');
    const sal  = getNum2('mp-m-salary');
    const type = $2('mp-m-type')?.value || 'officer'; // 'officer' 軍官 | 'nco' 士官
    const cap  = type === 'nco' ? 95 : 90;

    if(yrs < 20) {
      setTxt2('val2-military',   yrs === 0 ? '—' : '未達資格');
      setTxt2('mp2-result-label','月退俸');
      setTxt2('mp2-result-note', yrs > 0 ? `服役${yrs}年，需滿20年（志願役）方可月退` : '');
      S2.military.monthly = 0; S2.military.lump = 0;
      updateSummary2(); return;
    }
    /* 服役20年55%，每增1年+2%，上限軍官90%/士官95% */
    const ratePct = Math.min(55 + (yrs - 20) * 2, cap);
    /* 月退俸 = 最後1/5服役時間的本俸平均 × 2 × 起支俸率 */
    monthly = sal * 2 * ratePct / 100;
    label = '月退俸';
    note  = `最後1/5本俸平均 ${sal.toLocaleString()} × 2 × ${ratePct}%（服役${yrs}年，${type==='nco'?'士官':'軍官'}上限${cap}%）`;
    setTxt2('val2-military', fmtM2(monthly));
  } else {
    const yrs = getNum2('mp-l-years');
    const sal = getNum2('mp-l-salary');
    /* 1–35年：每年1.5個基數，上限60基數；一次金 = 退伍當月本俸 × 2 × 基數 */
    const base = Math.min(yrs * 1.5, 60);
    lump = sal * 2 * base;
    label = '一次退伍金';
    note  = `退伍當月本俸 ${sal.toLocaleString()} × 2 × ${base.toFixed(1)} 基數（服役${yrs}年）`;
    setTxt2('val2-military', fmt2(lump));
  }

  setTxt2('mp2-result-label', label);
  setTxt2('mp2-result-note',  note);
  S2.military.monthly = monthly;
  S2.military.lump    = lump;
  updateSummary2();
}

/* ════ 私校退撫儲金 ════ */
function calcPrivatePension() {
  if(!S2.private.active) return;
  const sal       = getNum2('pp-salary');
  const selfRate  = getNum2('pp-self-rate')   / 100;
  const schRate   = getNum2('pp-school-rate') / 100;
  const years     = getNum2('pp-years');
  const retRate   = getNum2('pp-return-rate');
  const lifeYears = getNum2('pp-life-years') || 25;

  const pmt     = sal * (selfRate + schRate);
  const lump    = fvAnnuity(pmt, retRate, years);
  const monthly = lifeYears > 0 ? lump / (lifeYears * 12) : 0;

  S2.private.lump    = lump;
  S2.private.monthly = monthly;

  setTxt2('val2-private',    fmt2(lump));
  setTxt2('pp-result-note',  `每月提撥 ${Math.round(pmt).toLocaleString()} 元（個人${getNum2('pp-self-rate')}% ＋ 學校${getNum2('pp-school-rate')}%）× ${years}年`);
  setTxt2('pp-monthly-note', `月領換算：${fmtM2(monthly)}（以${lifeYears}年餘命計）`);
  updateSummary2();
}

/* ════ 勞工退休金（舊制）════ */
function calcLaborOldPension() {
  if(!S2.laborOld.active) return;
  const salary = getNum2('lop-salary');
  const years  = getNum2('lop-years');
  const months = Math.min(getNum2('lop-months'), 11);

  // 不足年數的月份換算成基數加成
  let fracBase = 0;
  if(months >= 6) {
    fracBase = 1; // 滿半年以一年計（1基數或依年資段）
  } else if(months > 0) {
    fracBase = 0.5; // 未滿半年以半年計
  }

  // 整年基數
  const wholeYrs = years;
  const base1 = Math.min(wholeYrs, 15) * 2;          // 前15年：每年2基數
  const base2 = Math.max(wholeYrs - 15, 0) * 1;      // 第16年起：每年1基數
  let totalBase = base1 + base2;

  // 不足年月份的基數（依所在年資段決定每基數率）
  if(fracBase > 0) {
    const nextYr = wholeYrs + 1;
    const fracRate = nextYr <= 15 ? 2 : 1; // 第幾年決定基數率
    totalBase += fracBase * (fracRate / 1); // 0.5年 × 基數率 = 基數加成
    // 注意：0.5基數 or 1基數，不受基數率影響（題目說0.5基數/1基數）
    // 重新依規定：未滿半年+0.5基數，滿半年+1基數（不含基數率倍率）
    totalBase = base1 + base2 + fracBase; // fracBase已是0.5或1
  }

  totalBase = Math.min(totalBase, 45); // 上限45基數

  const lump = salary * totalBase;
  S2.laborOld.lump = lump;

  // 資格判斷
  let qualifyMsg = '';
  if(years >= 25) {
    qualifyMsg = `✅ 年資滿25年，符合請領資格`;
  } else if(years >= 15) {
    qualifyMsg = `⚠️ 年資滿15年，需年滿55歲方可請領`;
  } else if(years >= 10) {
    qualifyMsg = `⚠️ 年資滿10年，需年滿60歲方可請領`;
  } else {
    qualifyMsg = `❌ 年資未滿10年，不符合請領資格`;
  }
  const qualNote = $2('lop-qualify-note');
  if(qualNote) { qualNote.textContent = qualifyMsg; qualNote.style.display = ''; }

  setTxt2('lop-result-label', '舊制退休金（一次給付）');
  setTxt2('lop-result-note',  `平均工資 ${salary.toLocaleString()} × 總基數 ${totalBase}`);
  setTxt2('val2-laborOld',    fmt2(lump));
  updateSummary2();
}

/* ════ 總覽 ════ */
function updateSummary2() {
  /* 勞退舊制卡片 */
  setTxt2('sum2-laborOld',     S2.laborOld.active && S2.laborOld.lump>0 ? fmt2(S2.laborOld.lump) : '未啟用');
  setTxt2('sum2-laborOld-sub', S2.laborOld.active && S2.laborOld.lump>0 ? '一次給付' : '—');

  /* 勞退卡片 */
  const lpMonthly = laborPensionMode === 'monthly';
  setTxt2('sum2-labor',     lpMonthly ? fmtM2(S2.labor.monthly) : (S2.labor.lump>0 ? fmt2(S2.labor.lump) : '—'));
  setTxt2('sum2-labor-sub', lpMonthly ? '月領換算' : (S2.labor.lump>0 ? '帳戶餘額' : '尚未設定'));

  /* 公教退撫卡片 */
  if(!S2.civil.active) {
    setTxt2('sum2-civil', '未啟用'); setTxt2('sum2-civil-sub', '—');
  } else if(civilPensionMode === 'db') {
    setTxt2('sum2-civil', fmtM2(S2.civil.monthly)); setTxt2('sum2-civil-sub', '月退俸');
  } else {
    setTxt2('sum2-civil', fmt2(S2.civil.lump)); setTxt2('sum2-civil-sub', '帳戶餘額');
  }

  /* 軍人退撫卡片 */
  if(!S2.military.active) {
    setTxt2('sum2-military', '未啟用'); setTxt2('sum2-military-sub', '—');
  } else if(milPensionMode === 'monthly') {
    setTxt2('sum2-military',     S2.military.monthly>0 ? fmtM2(S2.military.monthly) : '未達資格');
    setTxt2('sum2-military-sub', '月退俸');
  } else {
    setTxt2('sum2-military',     S2.military.lump>0 ? fmt2(S2.military.lump) : '—');
    setTxt2('sum2-military-sub', '一次退伍金');
  }

  /* 私校退撫卡片 */
  setTxt2('sum2-private',     S2.private.active && S2.private.lump>0 ? fmt2(S2.private.lump) : '未啟用');
  setTxt2('sum2-private-sub', S2.private.active && S2.private.lump>0 ? '帳戶餘額' : '—');

  /* 合計 */
  const mTotal =
    (S2.labor.active    ? S2.labor.monthly    : 0) +
    (S2.civil.active    ? S2.civil.monthly    : 0) +
    (S2.military.active ? S2.military.monthly : 0) +
    (S2.private.active  ? S2.private.monthly  : 0);
  const lTotal =
    (S2.laborOld.active ? S2.laborOld.lump : 0) +
    (S2.labor.active    ? S2.labor.lump    : 0) +
    (S2.civil.active    ? S2.civil.lump    : 0) +
    (S2.military.active ? S2.military.lump : 0) +
    (S2.private.active  ? S2.private.lump  : 0);
  const yr20 = mTotal * 240 + lTotal;

  setTxt2('sum2-monthly-total', fmtM2(mTotal));
  setTxt2('sum2-lump-total',    fmt2(lTotal));
  setTxt2('sum2-20yr',          fmt2(yr20));
}

updateSummary2();

function initPension2Page() {
  if(!$2('val2-labor')) return;
  try {
    onToggleCheck2('labor');
    onToggleCheck2('civil');
    onToggleCheck2('military');
    onToggleCheck2('private');
    setLaborPensionMode('lump');
    setCivilPensionMode('db');
    setMilPensionMode('monthly');
  } catch(err) {
    console.error('[initPension2Page]', err);
  }
}

Object.assign(window, {
  toggleBlock2,
  onToggleCheck2,
  setLaborPensionMode,
  calcLaborPension,
  setCivilPensionMode,
  calcCivilPension,
  setMilPensionMode,
  calcMilitaryPension,
  calcPrivatePension,
  initPension2Page,
});

/* ── 頁面初始化 ── */
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (typeof initRetirementPage === 'function') initRetirementPage();
  } catch (err) {
    console.error('[initRetirementPage]', err);
  }

  try {
    if (typeof initPension2Page === 'function') initPension2Page();
  } catch (err) {
    console.error('[initPension2Page]', err);
  }
});
