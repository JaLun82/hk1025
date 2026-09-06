/* =============================================
   finance.js — 財務目標缺口規劃頁面（三區塊版）
   第一區塊 want：列目標，用使用者輸入的投資報酬率折現，換算成「現在」的現值，才能跨目標比較
   第二區塊 have：列既有資產，算出總資產與投資組合加權平均報酬率（僅供參考）
   第三區塊 need：want 扣掉已分配的 have，使用者填投資報酬率，
                  算出補足缺口需要「一次投入」或「每月定期定額」各自多少錢
   ============================================= */

let finGoals = [];
let finAssets = [];
let finGoalNextId = 1;
let finAssetNextId = 1;
let finSelectedPlan = 'A'; // 'A' 一起達成（資金池）｜'B' 分開達成（各目標自算），決定 Excel 匯出用哪個方案

/* ── 工具 ── */
const $F = id => document.getElementById(id);
const fmtF = n => (isNaN(n) || n == null) ? '—' : Math.round(n).toLocaleString('zh-TW') + ' 元';
const fmtFM = n => (isNaN(n) || n == null) ? '—' : Math.round(n).toLocaleString('zh-TW') + ' 元／月';
const getNumF = id => parseFloat($F(id)?.value) || 0;

function defaultGoals() {
  return [
    { id: finGoalNextId++, name: '購車基金', targetAge: 30, useRealRate: false, amountToday: 1000000, annualAmount: 0, annuityYears: 0, returnOverride: null, inflationOverride: null, plannedRate: null },
    { id: finGoalNextId++, name: '購屋房貸', targetAge: 45, useRealRate: true, amountToday: 0, annualAmount: 800000, annuityYears: 20, returnOverride: null, inflationOverride: null, plannedRate: null },
    { id: finGoalNextId++, name: '子女教育金', targetAge: 40, useRealRate: false, amountToday: 2000000, annualAmount: 0, annuityYears: 0, returnOverride: null, inflationOverride: null, plannedRate: null },
    { id: finGoalNextId++, name: '創業開店金', targetAge: 35, useRealRate: false, amountToday: 3000000, annualAmount: 0, annuityYears: 0, returnOverride: null, inflationOverride: null, plannedRate: null },
  ];
}

function defaultAssets() {
  return [
    { id: finAssetNextId++, name: '股票', amount: 500000 },
    { id: finAssetNextId++, name: '基金', amount: 300000 },
    { id: finAssetNextId++, name: '定存', amount: 200000 },
    { id: finAssetNextId++, name: '保單', amount: 100000 },
  ];
}

/* ══════════════════ 第二區塊：既有資產 ══════════════════ */

/* 第二區塊只負責盤點「有多少錢」，不記錄每筆資產的報酬率——
   報酬率統一由基本參數的「投資報酬率」（可於各目標覆寫）決定，
   這樣同一個目標的 want（現值折現）與 need（未來值複利）才會用同一套利率、邏輯一致。 */
function computePortfolio() {
  const total = finAssets.reduce((s, a) => s + (a.amount || 0), 0);
  return { total };
}

function assetRowHTML(asset) {
  return `
    <div class="asset-row" data-id="${asset.id}">
      <div class="input-group">
        <label>名稱</label>
        <input type="text" value="${asset.name}"
          oninput="updateAssetField(${asset.id},'name',this.value)" />
      </div>
      <div class="input-group">
        <label>金額（元）</label>
        <input type="number" min="0" value="${asset.amount}"
          oninput="updateAssetField(${asset.id},'amount',this.value)" />
      </div>
      <button class="goal-remove-btn" onclick="removeAsset(${asset.id})" title="刪除資產">✕</button>
    </div>`;
}

function updateAssetField(id, field, rawValue) {
  const asset = finAssets.find(a => a.id === id);
  if (!asset) return;
  asset[field] = field === 'name' ? rawValue : (parseFloat(rawValue) || 0);
  recalcAndRenderAll();
}

function addAsset() {
  const asset = { id: finAssetNextId++, name: '新資產', amount: 0 };
  finAssets.push(asset);
  renderAssetList();
  const input = document.querySelector(`.asset-row[data-id="${asset.id}"] input[type="text"]`);
  if (input) input.focus();
}

function removeAsset(id) {
  finAssets = finAssets.filter(a => a.id !== id);
  renderAssetList();
}

function renderAssetList() {
  const list = $F('asset-list');
  if (!list) return;
  list.innerHTML = finAssets.map(assetRowHTML).join('');
  recalcAndRenderAll();
}

function renderAssetSummary(portfolioTotal, leftoverAssets) {
  const totalEl = $F('asset-total');
  if (totalEl) totalEl.textContent = fmtF(portfolioTotal);

  const note = $F('fin-asset-note');
  if (note) {
    if (finSelectedPlan === 'B') {
      note.textContent = portfolioTotal > 0
        ? '目前選擇方案B（分開達成），不會用既有資產扣抵各目標缺口，缺口一律依報酬率全額準備'
        : '';
    } else {
      note.textContent = leftoverAssets > 0
        ? `既有資產已扣抵所有目標，尚餘 ${fmtF(leftoverAssets)} 未分配`
        : '';
    }
  }
}

/* ══════════════════ 第一區塊：目標需求 want ══════════════════ */

/* want：
   - 不使用實質報酬率（一次性目標，如買車）：現值 × 通膨率 → 目標年齡當時的名目金額
   - 使用實質報酬率（分期／逐年型，如房貸、學費、開店支出）：want = 每年金額的「期初年金現值」
     （年數＝期間），用實質報酬率折現，代表「達成年齡當年，若不分期、一次結清要準備多少」。
     用期初年金（而不是財務計算機預設的期末年金）是因為這個工具其他地方
     （時間軸、逐年試算表）都把第一筆錢算在達成年齡「當年」發生，
     用期初年金公式（期末年金公式再乘 (1+r)）才會跟這個假設一致，不會少折現一年。

     實質報酬率只用在上面這一步——把「每年會隨通膨成長的一筆付款流」換算成單一金額。
     「現在到達成年齡」這段累積期不會用到實質報酬率：累積期本來就是拿實際的錢去投資，
     該用的是名目投資報酬率，不是拿掉通膨後的實質報酬率。所以 want 算出來後，
     一律用名目投資報酬率折現回「現在」得到 wantPVToday，這個名目報酬率也會是
     第三區塊「每月定期定額」反推時的預設報酬率。 */
function computeGoalBase(goal, currentAge, defInflation, effectiveReturn) {
  const nominalReturn = goal.returnOverride != null ? goal.returnOverride : effectiveReturn;
  const inflationRate = goal.inflationOverride != null ? goal.inflationOverride : defInflation;
  const years = Math.max(goal.targetAge - currentAge, 0);

  let want;
  if (goal.useRealRate) {
    const annualAmount = goal.annualAmount || 0;
    const annuityYears = goal.annuityYears || 0;
    const realRate = ((1 + nominalReturn / 100) / (1 + inflationRate / 100) - 1) * 100;
    const r = realRate / 100;
    if (annuityYears <= 0) {
      want = 0;
    } else if (Math.abs(r) < 1e-9) {
      want = annualAmount * annuityYears;
    } else {
      want = annualAmount * (1 - Math.pow(1 + r, -annuityYears)) / r * (1 + r);
    }
  } else {
    want = goal.amountToday * Math.pow(1 + inflationRate / 100, years);
  }

  const wantPVToday = years === 0 ? want : want / Math.pow(1 + nominalReturn / 100, years);
  return { years, effRate: nominalReturn, want, wantPVToday };
}

function goalWantCardHTML(goal) {
  const basicReturn = getNumF('fin-default-return');
  const defInflation = getNumF('fin-default-inflation');

  const wantInputs = goal.useRealRate
    ? `
        <div class="input-group">
          <label>每年所需金額（元，現值）<span class="tip">如房貸年繳、學費、開店年支出</span></label>
          <input type="number" min="0" value="${goal.annualAmount}"
            oninput="updateGoalField(${goal.id},'annualAmount',this.value)" />
        </div>
        <div class="input-group">
          <label>期間（年）<span class="tip">如貸款年限、就學年數</span></label>
          <input type="number" min="0" max="80" value="${goal.annuityYears}"
            oninput="updateGoalField(${goal.id},'annuityYears',this.value)" />
        </div>`
    : `
        <div class="input-group">
          <label>目標金額（元，以現在物價計算）</label>
          <input type="number" min="0" value="${goal.amountToday}"
            oninput="updateGoalField(${goal.id},'amountToday',this.value)" />
        </div>`;

  return `
    <div class="goal-card" data-id="${goal.id}">
      <div class="goal-card-header">
        <input type="text" class="goal-name-input" value="${goal.name}"
          oninput="updateGoalField(${goal.id},'name',this.value)" />
        <label class="real-rate-toggle" title="分期／逐年型目標建議勾選，如房貸、學費">
          <input type="checkbox" ${goal.useRealRate ? 'checked' : ''}
            onchange="updateGoalField(${goal.id},'useRealRate',this.checked)" />
          <span>使用實質報酬率</span>
        </label>
        <button class="goal-remove-btn" onclick="removeGoal(${goal.id})" title="刪除目標">✕</button>
      </div>

      <div class="goal-input-row${goal.useRealRate ? '' : ' cols-2'}">
        <div class="input-group">
          <label>達成年齡（歲）</label>
          <input type="number" min="0" max="120" value="${goal.targetAge}"
            oninput="updateGoalField(${goal.id},'targetAge',this.value)" />
        </div>
        ${wantInputs}
      </div>

      <div class="goal-input-row goal-advanced">
        <div class="input-group">
          <label>投資報酬率（%）<span class="tip">留空使用預設報酬率 ${basicReturn.toFixed(1)}%</span></label>
          <input type="number" step="0.1" placeholder="預設" value="${goal.returnOverride ?? ''}"
            oninput="updateGoalField(${goal.id},'returnOverride',this.value)" />
        </div>
        <div class="input-group">
          <label>通膨率（%）<span class="tip">留空使用預設 ${defInflation}%</span></label>
          <input type="number" step="0.1" placeholder="預設" value="${goal.inflationOverride ?? ''}"
            oninput="updateGoalField(${goal.id},'inflationOverride',this.value)" />
        </div>
      </div>

      <div class="goal-result">
        <div class="goal-result-item">
          <span>距今</span>
          <strong id="want-years-${goal.id}">—</strong>
        </div>
        <div class="goal-result-item">
          <span>目標年齡當時金額</span>
          <strong id="want-target-${goal.id}">—</strong>
        </div>
        <div class="goal-result-item highlight">
          <span>換算回現在的現值（want）</span>
          <strong id="want-pv-${goal.id}">—</strong>
        </div>
      </div>
    </div>`;
}

function renderGoalWantResult(goal, r) {
  const set = (suffix, text) => { const el = $F(`${suffix}-${goal.id}`); if (el) el.textContent = text; };
  set('want-years', r.years > 0 ? `${r.years} 年` : '已到期');
  set('want-target', fmtF(r.want));
  set('want-pv', fmtF(r.wantPVToday));
}

/* 第一區塊總需求：所有目標的 wantPVToday（已換算回現在年齡的現值）加總 */
function renderWantSummary(results) {
  const el = $F('want-sum-total');
  if (!el) return;
  const total = finGoals.reduce((s, goal) => s + (results.get(goal.id)?.wantPVToday || 0), 0);
  el.textContent = fmtF(total);
}

/* ══════════════════ 第三區塊：缺口與達成 need ══════════════════ */

function goalNeedCardHTML(goal) {
  const currentAge = getNumF('fin-current-age');
  const defInflation = getNumF('fin-default-inflation');
  const basicReturn = getNumF('fin-default-return');
  const { effRate } = computeGoalBase(goal, currentAge, defInflation, basicReturn);

  return `
    <div class="goal-card" data-id="${goal.id}">
      <div class="goal-card-header">
        <div class="goal-name-readonly">
          <span class="goal-name-text">${goal.name}</span>
          <span class="tip goal-age-text">達成年齡 ${goal.targetAge} 歲</span>
        </div>
      </div>

      <div class="goal-result">
        <div class="goal-result-item">
          <span>目標現值（want）</span>
          <strong id="need-want-${goal.id}">—</strong>
        </div>
        <div class="goal-result-item">
          <span>已分配既有資產</span>
          <strong id="need-allocate-${goal.id}">—</strong>
        </div>
        <div class="goal-result-item highlight">
          <span>缺口（need，現值）</span>
          <strong id="need-value-${goal.id}">—</strong>
        </div>
      </div>

      <div class="goal-plan-row">
        <div class="input-group">
          <label>投資報酬率（%）<span class="tip">留空使用第一區塊算出的 ${effRate.toFixed(1)}%</span></label>
          <input type="number" step="0.1" placeholder="${effRate.toFixed(1)}" value="${goal.plannedRate ?? ''}"
            oninput="updateGoalField(${goal.id},'plannedRate',this.value)" />
        </div>
      </div>

      <div class="goal-result">
        <div class="goal-result-item highlight">
          <span>每月定期定額需要多少</span>
          <strong id="need-required-pmt-${goal.id}">—</strong>
        </div>
      </div>

      <div class="goal-outcome" id="need-outcome-${goal.id}"></div>
    </div>`;
}

function renderGoalNeedResult(goal, r) {
  const set = (suffix, text) => { const el = $F(`${suffix}-${goal.id}`); if (el) el.textContent = text; };
  set('need-want', fmtF(r.wantPVToday));
  set('need-allocate', fmtF(r.allocate));

  const outcomeEl = $F(`need-outcome-${goal.id}`);

  if (r.need <= 0) {
    set('need-value', '已無缺口');
    set('need-required-pmt', '—');
    if (outcomeEl) {
      outcomeEl.className = 'goal-outcome ok';
      outcomeEl.innerHTML = '既有資產已足夠支應這個目標，不需要再另外存錢。';
    }
    return;
  }

  set('need-value', fmtF(r.need));

  if (r.years === 0) {
    set('need-required-pmt', '已到期');
    if (outcomeEl) {
      outcomeEl.className = 'goal-outcome warn';
      outcomeEl.innerHTML = `已到期，需一次備妥 ${fmtF(r.need)}`;
    }
    return;
  }

  set('need-required-pmt', fmtFM(r.requiredMonthly));

  if (outcomeEl) {
    outcomeEl.className = 'goal-outcome';
    outcomeEl.innerHTML = `用報酬率 ${r.planRate.toFixed(2)}% 計算，每月存到這個金額就能補足缺口；若想改用一次性投入，直接參考上方「缺口（need，現值）」，並在基本參數調整投資報酬率即可看到對應變化。`;
  }
}

/* ══════════════════ 共用：計算所有目標 ══════════════════ */

/* 依「達成年齡」由近到遠排序，用第二區塊算出的總資產自動扣抵最近的目標，用完為止——
   但這只在方案A（一起達成）才適用。方案B（分開達成）不使用既有資產，
   每個目標的缺口一律等於 want 本身，全額依報酬率準備（既有資產留給方案A的資金池模擬使用）。
   針對每個目標剩餘的缺口，直接用使用者填的報酬率反推「每月定期定額」需要多少錢。
   一次性投入需要多少，就是上面已經算好的 need（缺口現值）本身，不需要另外算：
   如果想知道換一個報酬率時一次投入需要多少，直接調整基本參數的投資報酬率、
   觀察 need 的變化即可，不需要在這裡重複一套公式。 */
function calcAllGoals() {
  const currentAge = getNumF('fin-current-age');
  const defInflation = getNumF('fin-default-inflation');
  const basicReturn = getNumF('fin-default-return');
  const portfolio = computePortfolio();
  const useAssetOffset = finSelectedPlan !== 'B';

  const bases = finGoals.map(goal => ({ goal, ...computeGoalBase(goal, currentAge, defInflation, basicReturn) }));
  const sorted = [...bases].sort((a, b) => a.goal.targetAge - b.goal.targetAge);

  let remaining = portfolio.total;
  const results = new Map();

  sorted.forEach(b => {
    const allocate = useAssetOffset ? Math.min(remaining, b.wantPVToday) : 0;
    remaining -= allocate;
    const needPVToday = b.wantPVToday - allocate;
    const needAtTarget = b.years === 0 ? needPVToday : needPVToday * Math.pow(1 + b.effRate / 100, b.years);

    const planRate = b.goal.plannedRate != null ? b.goal.plannedRate : b.effRate;

    let requiredMonthly = null;
    if (needAtTarget > 0 && b.years > 0) {
      const r = planRate / 100 / 12;
      const n = b.years * 12;
      requiredMonthly = r === 0 ? needAtTarget / n : needAtTarget * r / (Math.pow(1 + r, n) - 1);
    }

    results.set(b.goal.id, {
      years: b.years,
      effRate: b.effRate,
      planRate,
      want: b.want,
      wantPVToday: b.wantPVToday,
      allocate,
      need: needPVToday,
      needAtTarget,
      requiredMonthly,
    });
  });

  return { results, leftoverAssets: remaining, portfolioTotal: portfolio.total };
}

/* ══════════════════ 目標欄位更新 / 新增刪除 ══════════════════ */

function updateGoalField(id, field, rawValue) {
  const goal = finGoals.find(g => g.id === id);
  if (!goal) return;

  if (field === 'useRealRate') {
    goal.useRealRate = !!rawValue;
    renderGoalLists(); // 輸入欄位配置會改變（現值 vs 年金額+年數），整份重新渲染
    return;
  }

  if (field === 'name') {
    goal.name = rawValue;
    const el = document.querySelector(`#goal-need-list .goal-card[data-id="${id}"] .goal-name-text`);
    if (el) el.textContent = rawValue;
  } else if (field === 'returnOverride' || field === 'inflationOverride' || field === 'plannedRate') {
    goal[field] = rawValue === '' ? null : parseFloat(rawValue);
  } else {
    goal[field] = parseFloat(rawValue) || 0;
    if (field === 'targetAge') {
      const el = document.querySelector(`#goal-need-list .goal-card[data-id="${id}"] .goal-age-text`);
      if (el) el.textContent = `達成年齡 ${goal.targetAge} 歲`;
    }
  }

  recalcAndRenderAll();
}

function addGoal() {
  const currentAge = getNumF('fin-current-age');
  const goal = {
    id: finGoalNextId++,
    name: '新目標',
    targetAge: currentAge + 5,
    useRealRate: false,
    amountToday: 1000000,
    annualAmount: 0,
    annuityYears: 0,
    returnOverride: null,
    inflationOverride: null,
    plannedRate: null,
  };
  finGoals.push(goal);
  renderGoalLists();
  const nameInput = document.querySelector(`#goal-want-list .goal-card[data-id="${goal.id}"] .goal-name-input`);
  if (nameInput) nameInput.focus();
}

function removeGoal(id) {
  finGoals = finGoals.filter(g => g.id !== id);
  renderGoalLists();
}

function renderGoalLists() {
  const wantList = $F('goal-want-list');
  const needList = $F('goal-need-list');
  if (wantList) wantList.innerHTML = finGoals.map(goalWantCardHTML).join('');
  if (needList) needList.innerHTML = finGoals.map(goalNeedCardHTML).join('');
  recalcAndRenderAll();
}

/* ── 全域參數變動 ── */
function onGlobalParamChange() {
  recalcAndRenderAll();
}

/* ── 重新計算所有目標並更新整個畫面 ── */
function recalcAndRenderAll() {
  const { results, leftoverAssets, portfolioTotal } = calcAllGoals();
  finGoals.forEach(goal => {
    const r = results.get(goal.id);
    renderGoalWantResult(goal, r);
    renderGoalNeedResult(goal, r);
  });
  renderWantSummary(results);
  renderAssetSummary(portfolioTotal, leftoverAssets);
  updateFinSummary(results);
  renderTimeline(results);
  renderPoolOutcome();
}

/* ── 第三區塊總覽卡片 ── */
function updateFinSummary(results) {
  let totalNeed = 0;
  finGoals.forEach(goal => {
    const r = results.get(goal.id);
    totalNeed += Math.max(r.need, 0);
  });

  const set = (id, text) => { const el = $F(id); if (el) el.textContent = text; };
  set('fin-sum-need', fmtF(totalNeed));
}

/* ══════════════════ 方案切換：一起達成（A）／分開達成（B） ══════════════════ */

function setSelectedPlan(plan) {
  finSelectedPlan = plan;

  const btnA = $F('plan-toggle-A');
  const btnB = $F('plan-toggle-B');
  if (btnA) { btnA.classList.toggle('active', plan === 'A'); btnA.textContent = plan === 'A' ? '✅ 採用方案 A：一起達成' : '採用方案 A：一起達成'; }
  if (btnB) { btnB.classList.toggle('active', plan === 'B'); btnB.textContent = plan === 'B' ? '✅ 採用方案 B：分開達成' : '採用方案 B：分開達成'; }

  const sectionA = $F('plan-section-A');
  const sectionB = $F('plan-section-B');
  if (sectionA) sectionA.hidden = plan !== 'A';
  if (sectionB) sectionB.hidden = plan !== 'B';

  const exportLabel = $F('fin-export-plan-label');
  if (exportLabel) exportLabel.textContent = plan === 'A' ? '方案 A：一起達成' : '方案 B：分開達成';

  recalcAndRenderAll(); // 方案切換會改變 need 是否扣抵既有資產，數字要重新計算
}

/* ══════════════════ 方案 A：一起達成（所有目標共用一筆資金池） ══════════════════ */

/* 用同一筆一次投入＋每月存入＋報酬率，模擬所有目標依到期時間先後扣款，
   起始餘額＝既有資產 + 一次投入；每年成長 = 年初餘額 × 報酬率；
   每年到期的目標會從餘額中扣款（withdraw 全額 want，不是已扣抵既有資產後的 need，
   因為既有資產已經算進起始餘額了，這裡才不會重複扣兩次）。 */
function simulatePooledPlan(lump, monthly, ratePct) {
  const currentAge = getNumF('fin-current-age');
  const defInflation = getNumF('fin-default-inflation');
  const portfolio = computePortfolio();
  const annualSave = monthly * 12;

  const cashflows = finGoals.map(goal => {
    const inflationRate = goal.inflationOverride != null ? goal.inflationOverride : defInflation;
    const startAge = goal.targetAge;
    const endAge = goal.useRealRate
      ? goal.targetAge + Math.max((goal.annuityYears || 0) - 1, 0)
      : goal.targetAge;
    const baseAmount = goal.useRealRate ? (goal.annualAmount || 0) : goal.amountToday;
    return {
      name: goal.name,
      startAge,
      endAge,
      amountAt: age => baseAmount * Math.pow(1 + inflationRate / 100, age - currentAge),
    };
  });

  const endAge = cashflows.length
    ? Math.max(currentAge, ...cashflows.map(c => c.endAge))
    : currentAge;

  let balance = portfolio.total + lump;
  let minBalance = balance;
  let minBalanceAge = currentAge;
  let firstNegativeAge = null;

  for (let age = currentAge; age <= endAge; age++) {
    const growth = balance * (ratePct / 100);
    let expense = 0;
    cashflows.forEach(c => {
      if (age >= c.startAge && age <= c.endAge && c.amountAt(age) > 0) {
        expense += c.amountAt(age);
      }
    });
    balance = balance + growth + annualSave - expense;
    if (balance < minBalance) { minBalance = balance; minBalanceAge = age; }
    if (balance < 0 && firstNegativeAge === null) firstNegativeAge = age;
  }

  return { finalBalance: balance, minBalance, minBalanceAge, firstNegativeAge, endAge };
}

/* 二分法反推：固定報酬率，找出讓資金池整段模擬都不會變負餘額所需的最小投入金額。
   testFn(amount) 回傳「投入這個金額夠不夠」，金額越大餘額只會越高，具單調性，可安全二分。 */
function bisectPoolAmount(testFn) {
  let hi = 10000;
  let iterations = 0;
  while (!testFn(hi) && iterations < 60) { hi *= 2; iterations++; }
  if (!testFn(hi)) return null;

  let lo = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (testFn(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

/* 一次性投入需要多少，等同於用這個報酬率去折現全部目標的缺口（跟上方「總缺口」卡片是同一件事，
   只是換一個報酬率假設），所以這裡不重複算，只算「每月定期定額」這種沒有現成公式可以直接看出來的數字。 */
function computePoolRequiredMonthly(ratePct) {
  if (simulatePooledPlan(0, 0, ratePct).firstNegativeAge == null) return 0;
  return bisectPoolAmount(monthly => simulatePooledPlan(0, monthly, ratePct).firstNegativeAge == null);
}

function renderPoolOutcome() {
  const monthlyEl = $F('pool-required-monthly');
  const outcomeEl = $F('pool-outcome');
  if (!monthlyEl) return;

  if (finGoals.length === 0) {
    monthlyEl.textContent = '—';
    if (outcomeEl) {
      outcomeEl.className = 'goal-outcome';
      outcomeEl.textContent = '尚未新增任何目標';
    }
    return;
  }

  const rate = getNumF('pool-rate');
  const requiredMonthly = computePoolRequiredMonthly(rate);

  monthlyEl.textContent = requiredMonthly != null ? fmtFM(requiredMonthly) : '無法在合理範圍內求解';

  if (outcomeEl) {
    outcomeEl.className = 'goal-outcome';
    outcomeEl.innerHTML = `既有資產已依到期時間先後自動扣抵；這是用報酬率 ${rate.toFixed(2)}% 算出的每月定期定額。若想改用一次性投入，直接參考上方「總缺口（need，現值）」即可（缺口本身就是用報酬率折現算出的一次投入金額）。`;
  }
}

function onPoolInputChange() {
  renderPoolOutcome();
}

/* ══════════════════ 時間軸 ══════════════════ */

const TIMELINE_COLORS = ['blue', 'green', 'yellow', 'red'];

function renderTimeline(results) {
  const container = $F('fin-timeline-list');
  if (!container) return;

  if (finGoals.length === 0) {
    container.innerHTML = '<div class="ms-desc">尚未新增任何目標</div>';
    return;
  }

  const sorted = [...finGoals].sort((a, b) => a.targetAge - b.targetAge);

  container.innerHTML = sorted.map((goal, i) => {
    const r = results.get(goal.id);
    const color = TIMELINE_COLORS[i % TIMELINE_COLORS.length];
    const yearLabel = r.years > 0 ? `${r.years}年內` : '已到期';

    let desc;
    if (r.need <= 0) {
      desc = `want ${fmtF(r.wantPVToday)}（現值）→ 既有資產扣抵 ${fmtF(r.allocate)} → 已無缺口`;
    } else if (r.years === 0) {
      desc = `已到期，缺口 ${fmtF(r.need)}（現值）需一次備妥`;
    } else {
      desc = `缺口 ${fmtF(r.need)}（現值，一次投入即為此金額）→ 用報酬率 ${r.planRate.toFixed(1)}% 計算，每月存 ${fmtFM(r.requiredMonthly)}`;
    }

    return `
      <div class="milestone" data-year="${yearLabel}">
        <div class="ms-dot ${color}"></div>
        <div class="ms-content">
          <div class="ms-name">${goal.name}（${goal.targetAge}歲）</div>
          <div class="ms-desc">${desc}</div>
        </div>
      </div>`;
  }).join('');
}

/* ══════════════════ 逐年試算表 / Excel 匯出 ══════════════════ */

/* 方案A（一起達成）專用：所有目標共用一筆資金池的逐年試算。
   起始餘額＝第二區塊的總資產；每年成長＝總體投資報酬率；
   每年存入＝資金池算出的「全部目標每月定期定額合計」×12（剛好打平的存款計畫）；
   每年花費＝當年到期的目標提領。 */
function buildYearlyProjection() {
  const currentAge = getNumF('fin-current-age');
  const defInflation = getNumF('fin-default-inflation');
  const portfolio = computePortfolio();

  const effectiveReturn = getNumF('pool-rate');
  const annualSave = (computePoolRequiredMonthly(effectiveReturn) || 0) * 12;

  const cashflows = finGoals.map(goal => {
    const inflationRate = goal.inflationOverride != null ? goal.inflationOverride : defInflation;
    const startAge = goal.targetAge;
    const endAge = goal.useRealRate
      ? goal.targetAge + Math.max((goal.annuityYears || 0) - 1, 0)
      : goal.targetAge;
    const baseAmount = goal.useRealRate ? (goal.annualAmount || 0) : goal.amountToday;

    return {
      name: goal.name,
      startAge,
      endAge,
      amountAt: age => baseAmount * Math.pow(1 + inflationRate / 100, age - currentAge),
    };
  });

  const endAge = cashflows.length
    ? Math.max(currentAge, ...cashflows.map(c => c.endAge))
    : currentAge;

  const rows = [];
  let balance = portfolio.total;

  for (let age = currentAge; age <= endAge; age++) {
    const growth = balance * (effectiveReturn / 100);

    let expense = 0;
    const notes = [];
    cashflows.forEach(c => {
      if (age >= c.startAge && age <= c.endAge && c.amountAt(age) > 0) {
        expense += c.amountAt(age);
        notes.push(c.name);
      }
    });

    balance = balance + growth + annualSave - expense;

    rows.push({
      年齡: age,
      距今年數: age - currentAge,
      年度存入金額: Math.round(annualSave),
      年度支出金額: Math.round(expense),
      年度成長金額: Math.round(growth),
      年末總餘額: Math.round(balance),
      說明: notes.join('、'),
    });
  }

  return rows;
}

/* 方案B（分開達成）專用：單一目標從現在累積到達成年齡的逐年試算。
   方案B不使用既有資產，起始餘額固定是 0（r.allocate 在方案B下一定是0）；
   每年成長＝這個目標自己的報酬率；每年存入＝這個目標自己算出的「每月定期定額」×12。
   從「現在」（第0年）就開始存，總共存 years 次，剛好在達成年齡累積到 needAtTarget
   （跟 calcAllGoals 的年金公式假設一致，最後一列不再額外存入，只顯示累積完成的結果）。
   已到期的目標不需要累積過程，回傳單行狀態說明。 */
function buildPerGoalProjection(goal, r, currentAge) {
  if (r.need <= 0) {
    return [{ 年齡: currentAge, 距今年數: 0, 年度存入金額: 0, 年度成長金額: 0, 年末累積餘額: 0, 說明: '目標金額為0，沒有缺口' }];
  }
  if (r.years === 0) {
    return [{ 年齡: currentAge, 距今年數: 0, 年度存入金額: 0, 年度成長金額: 0, 年末累積餘額: Math.round(r.need), 說明: '已到期，需一次備妥' }];
  }

  const rate = r.planRate;
  const annualSave = (r.requiredMonthly || 0) * 12;
  let balance = r.allocate;

  const rows = [];
  for (let age = currentAge; age < goal.targetAge; age++) {
    const growth = balance * (rate / 100);
    balance = balance + growth + annualSave;
    rows.push({
      年齡: age,
      距今年數: age - currentAge,
      年度存入金額: Math.round(annualSave),
      年度成長金額: Math.round(growth),
      年末累積餘額: Math.round(balance),
      說明: '',
    });
  }

  // 最後一列：達成年齡，餘額就是上面存滿 years 次後的結果，這年不再額外存入
  rows.push({
    年齡: goal.targetAge,
    距今年數: goal.targetAge - currentAge,
    年度存入金額: 0,
    年度成長金額: 0,
    年末累積餘額: Math.round(balance),
    說明: '達成年齡',
  });

  return rows;
}

/* Excel 工作表名稱不能超過31字、不能有 \/?*[]: 這些字元，且同一活頁簿不能重複名稱 */
function sanitizeSheetName(name, usedNames) {
  let base = String(name || '目標').replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || '目標';
  let final = base;
  let i = 2;
  while (usedNames.has(final)) {
    const suffix = `_${i}`;
    final = base.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  usedNames.add(final);
  return final;
}

/* 下載Excel時，先看第三區塊目前選的是方案A還是方案B，兩種方案的活頁簿長得不一樣：
   方案A → 一張「共用資金池」逐年試算表；
   方案B → 每個目標各自一張工作表，各自用自己的報酬率跑逐年累積表。 */
function exportFinancePlanToExcel() {
  if (finSelectedPlan === 'B') {
    exportPlanBToExcel();
  } else {
    exportPlanAToExcel();
  }
}

function exportPlanAToExcel() {
  const rows = buildYearlyProjection();
  if (!rows.length) return;

  if (typeof XLSX === 'undefined') {
    exportFinancePlanToCSV(rows, '財務規劃逐年試算_方案A.csv');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '方案A_資金池逐年試算');
  XLSX.writeFile(wb, '財務規劃逐年試算_方案A.xlsx');
}

function exportPlanBToExcel() {
  if (!finGoals.length) return;
  const currentAge = getNumF('fin-current-age');
  const { results } = calcAllGoals();

  if (typeof XLSX === 'undefined') {
    const flatRows = [];
    finGoals.forEach(goal => {
      const r = results.get(goal.id);
      buildPerGoalProjection(goal, r, currentAge).forEach(row => flatRows.push({ 目標: goal.name, ...row }));
    });
    exportFinancePlanToCSV(flatRows, '財務規劃逐年試算_方案B.csv');
    return;
  }

  const wb = XLSX.utils.book_new();
  const usedNames = new Set();
  finGoals.forEach(goal => {
    const r = results.get(goal.id);
    const rows = buildPerGoalProjection(goal, r, currentAge);
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(goal.name, usedNames));
  });
  XLSX.writeFile(wb, '財務規劃逐年試算_方案B.xlsx');
}

function exportFinancePlanToCSV(rows, filename) {
  const headers = Object.keys(rows[0]);
  const escape = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')]
    .concat(rows.map(row => headers.map(h => escape(row[h])).join(',')));
  const csv = '﻿' + lines.join('\r\n'); // BOM，避免 Excel 開啟中文亂碼

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || '財務規劃逐年試算.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── 頁面初始化（由 app.js 的 navigate() 呼叫，僅在第一次進入該頁面時執行；
   之後切換頁籤 app.js 會直接復用同一份 DOM 節點，不會再呼叫這裡） ── */
function initFinancePage() {
  if (!$F('goal-want-list')) return;
  finGoals = defaultGoals();
  finAssets = defaultAssets();
  finSelectedPlan = 'A';
  setSelectedPlan('A');
  renderGoalLists();
  renderAssetList();
}

Object.assign(window, {
  addGoal,
  removeGoal,
  updateGoalField,
  addAsset,
  removeAsset,
  updateAssetField,
  onGlobalParamChange,
  onPoolInputChange,
  setSelectedPlan,
  exportFinancePlanToExcel,
  initFinancePage,
});
