/* =============================================
   app.js — 頁面導覽、動態載入、快取管理
   ============================================= */

// 快取已載入的頁面 HTML，避免重複 fetch
const pageCache = {};

// 快取「已經渲染過」的頁面實際 DOM 節點：切換頁籤時把節點暫存起來，
// 回到該頁面時直接把同一個節點放回去，而不是用 HTML 字串重新產生一份。
// 這樣使用者輸入的數值、勾選狀態、展開/收合狀態才不會在切換頁籤後消失。
const pageNodeCache = {};
let currentPageName = null;

/**
 * 從 pages/ 資料夾非同步載入 HTML 片段
 * @param {string} pageName - 對應 pages/<pageName>.html
 * @returns {Promise<string>} HTML 字串
 */
async function loadPage(pageName) {
  if (pageCache[pageName]) return pageCache[pageName];

  try {
    const res = await fetch(`pages/${pageName}.html`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    pageCache[pageName] = html;
    return html;
  } catch (err) {
    console.error(`[loadPage] 無法載入頁面: ${pageName}`, err);
    return `
      <div class="page-content">
        <div class="page-hero">
          <div class="hero-icon">⚠️</div>
          <p class="page-desc">頁面「${pageName}」載入失敗，請確認 pages/ 資料夾中是否存在對應檔案。</p>
        </div>
      </div>`;
  }
}

/**
 * 切換頁面：更新側邊欄 active 狀態、標題文字、主內容區
 * @param {HTMLElement} el - 被點擊的 .nav-item 元素
 */
async function navigate(el) {
  // 1. 更新側邊欄 active
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');

  const page  = el.dataset.page;
  const label = el.dataset.label;

  // 2. 標題淡出 → 換字 → 淡入
  const titleEl = document.getElementById('main-title');
  titleEl.classList.add('fade');
  setTimeout(() => {
    titleEl.textContent = label;
    titleEl.classList.remove('fade');
  }, 200);

  // 點擊目前已經顯示中的分頁：不做任何重新載入，避免把正在編輯的內容清空
  if (page === currentPageName) return;

  const container = document.getElementById('page-container');

  // 3. 把目前顯示中的頁面節點收進快取（保留使用者輸入與畫面狀態），再清空容器
  if (currentPageName && container.firstElementChild) {
    pageNodeCache[currentPageName] = container.firstElementChild;
  }
  container.innerHTML = '';
  container.style.animation = 'none';
  container.offsetHeight;          // 強制 reflow
  container.style.animation = '';

  // 4a. 若曾經渲染過這個頁面，直接把快取的節點放回去，不重新產生、不重跑初始化
  if (pageNodeCache[page]) {
    container.appendChild(pageNodeCache[page]);
    delete pageNodeCache[page];
    currentPageName = page;
    return;
  }

  // 4b. 第一次進入這個頁面：載入 HTML 並注入，執行對應的初始化
  container.innerHTML = '<div class="loading-state">載入中…</div>';
  const html = await loadPage(page);
  container.style.animation = 'none';
  container.offsetHeight;
  container.style.animation = '';
  container.innerHTML = html;
  currentPageName = page;

  if (page === 'retirement') {
    if (typeof window.initRetirementPage === 'function') window.initRetirementPage();
    // 退休金第二層試算（pension2）的內容也在 retirement.html 裡，一併初始化
    if (typeof window.initPension2Page === 'function') window.initPension2Page();
  }
  if (page === 'finance' && typeof window.initFinancePage === 'function') {
    window.initFinancePage();
  }
}

/* ===== 初始化：預設載入退休金缺口 ===== */
document.addEventListener('DOMContentLoaded', () => {
  const defaultItem = document.querySelector('.nav-item[data-page="retirement"]');
  if (defaultItem) navigate(defaultItem);
});
