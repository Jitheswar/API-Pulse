// ─── Auth State ──────────────────────────────────────────────────────────────
let accessToken = localStorage.getItem('access_token');
let refreshToken = localStorage.getItem('refresh_token');
let currentUser = JSON.parse(localStorage.getItem('current_user') || 'null');

// ─── Auth Helpers ────────────────────────────────────────────────────────────
function saveAuth(data) {
  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  currentUser = data.user;
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('current_user', JSON.stringify(currentUser));
}

function clearAuth() {
  accessToken = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('current_user');
}

async function authFetch(url, options = {}) {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('active');

  if (!options.headers) options.headers = {};
  if (accessToken) options.headers['Authorization'] = 'Bearer ' + accessToken;
  if (!(options.body instanceof FormData)) {
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
  }

  try {
    let resp = await fetch(url, options);

    // Try refreshing the token on 401
    if (resp.status === 401 && refreshToken) {
      const refreshResp = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + refreshToken, 'Content-Type': 'application/json' }
      });
      if (refreshResp.ok) {
        const data = await refreshResp.json();
        accessToken = data.access_token;
        localStorage.setItem('access_token', accessToken);
        options.headers['Authorization'] = 'Bearer ' + accessToken;
        resp = await fetch(url, options);
      } else {
        clearAuth();
        showAuthScreen();
        throw new Error('Session expired');
      }
    }
    return resp;
  } finally {
    if (loader) loader.classList.remove('active');
  }
}

// ─── Auth UI ─────────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('collapsed');
  localStorage.setItem('sidebar_collapsed', sb.classList.contains('collapsed'));
}

// Init: Sidebar state
if (localStorage.getItem('sidebar_collapsed') === 'true') {
  document.getElementById('sidebar').classList.add('collapsed');
}

function showAuthScreen() {
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').style.display = 'grid';
  if (currentUser) {
    const info = document.getElementById('user-info');
    info.innerHTML = esc(currentUser.username) +
      '<span class="role-badge">' + esc(currentUser.role) + '</span>';
  }
}

function logout() {
  clearAuth();
  showAuthScreen();
  showToast('Logged out', 'info');
}

// Auth tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(tab.dataset.authTab + '-form').classList.add('active');
  });
});

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Logging in...';

  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      errEl.textContent = data.error || 'Login failed';
      return;
    }
    saveAuth(data);
    showApp();
    showToast('Welcome back, ' + currentUser.username, 'success');
  } catch (err) {
    errEl.textContent = 'Network error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Creating...';

  try {
    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('reg-username').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      errEl.textContent = data.error || data.details
        ? Object.values(data.details || {}).flat().join(', ') || data.error
        : 'Registration failed';
      return;
    }
    // Auto-login after registration
    const loginResp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('reg-username').value,
        password: document.getElementById('reg-password').value,
      }),
    });
    const loginData = await loginResp.json();
    if (loginResp.ok) {
      saveAuth(loginData);
      showApp();
      showToast('Account created! Welcome, ' + currentUser.username, 'success');
    }
  } catch (err) {
    errEl.textContent = 'Network error';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// Init: check auth state
if (accessToken) {
  showApp();
  loadEnvironments();
} else {
  showAuthScreen();
}

// ─── Toast System ────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  const icons = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };

  toast.className = `toast-notification ${type}`;
  toast.innerHTML = (icons[type] || icons.info) + '<span>' + esc(message) + '</span>';
  
  // Add to body instead of a container for simpler fixed positioning
  document.body.appendChild(toast);

  // Offset multiple toasts
  const existingToasts = document.querySelectorAll('.toast-notification');
  const offset = (existingToasts.length - 1) * 70;
  if (offset > 0) toast.style.bottom = (24 + offset) + 'px';

  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// ─── State ───────────────────────────────────────────────────────────────────
let perfChart = null;
let statusChart = null;
let compareChart = null;

// ─── Navigation ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const currentPage = document.querySelector('.page.active');
    const targetPageId = 'page-' + item.dataset.page;
    const targetPage = document.getElementById(targetPageId);
    if (currentPage && currentPage.id === targetPageId) return;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    if (currentPage) {
      currentPage.style.opacity = '0';
      currentPage.style.transform = 'translateY(15px) scale(0.98)';
      currentPage.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    setTimeout(() => {
      if (currentPage) {
        currentPage.classList.remove('active');
        currentPage.style.opacity = '';
        currentPage.style.transform = '';
      }
      targetPage.classList.add('active');
      targetPage.style.opacity = '0';
      targetPage.style.transform = 'translateY(15px) scale(0.98)';
      requestAnimationFrame(() => {
        targetPage.style.opacity = '1';
        targetPage.style.transform = 'translateY(0) scale(1)';
        targetPage.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      });

      if (item.dataset.page === 'history') loadHistory();
      if (item.dataset.page === 'dashboard') loadDashboard();
      if (item.dataset.page === 'thresholds') loadThresholds();
      if (item.dataset.page === 'environments') loadEnvironments();
    }, 250);
  });
});

// ─── Tabs ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tabs').forEach(tabGroup => {
  tabGroup.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabGroup.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const parent = tabGroup.parentElement;
      parent.querySelectorAll(':scope > .tab-content').forEach(tc => tc.classList.remove('active'));
      const target = parent.querySelector('#' + tab.dataset.tab);
      if (target) {
        target.classList.add('active');
        target.style.animation = 'fadeIn 0.3s ease-out';
      }
    });
  });
});

// ─── Send Request ────────────────────────────────────────────────────────────
async function sendRequest() {
  const method = document.getElementById('req-method').value;
  const url = document.getElementById('req-url').value.trim();
  const collection = document.getElementById('req-collection').value.trim() || 'Default';
  const headersText = document.getElementById('req-headers').value.trim();
  const bodyText = document.getElementById('req-body').value.trim();
  if (!url) {
    document.getElementById('req-url').focus();
    showToast('Please enter a URL', 'error');
    return;
  }
  let headers = {};
  if (headersText) {
    try { headers = JSON.parse(headersText); }
    catch (e) { showToast('Invalid JSON in headers', 'error'); return; }
  }
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending...';
  try {
    const resp = await authFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ url, method, headers, body: bodyText, collection, environment_id: getSelectedEnvId() })
    });
    const data = await resp.json();
    showResponse(data);
    if (data.status_code) {
      showToast('Request completed: ' + data.status_code, data.status_code < 400 ? 'success' : 'error');
    } else if (data.error) {
      showToast(data.error, 'error');
    }
  } catch (err) {
    if (err.message !== 'Session expired') {
      showResponse({ error: 'Failed to reach the server: ' + err.message });
      showToast('Request failed', 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

document.getElementById('req-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') sendRequest();
});

function showResponse(data) {
  const panel = document.getElementById('response-panel');
  const meta = document.getElementById('response-meta');
  const body = document.getElementById('response-body');
  const hdrs = document.getElementById('response-headers');
  panel.style.display = 'block';
  panel.style.animation = 'slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
  if (data.error && !data.status_code) {
    meta.innerHTML = '<span class="badge status-5xx">ERROR</span>';
    body.textContent = data.error;
    hdrs.textContent = '';
    return;
  }
  const statusClass = data.status_code < 300 ? 'status-2xx'
    : data.status_code < 400 ? 'status-3xx'
    : data.status_code < 500 ? 'status-4xx' : 'status-5xx';
  let metaHtml = '<span class="badge ' + statusClass + '">' + data.status_code + '</span>';
  metaHtml += '<span class="badge ' + (data.is_slow ? 'slow' : 'time') + '">' + data.response_time_ms + ' ms</span>';
  if (data.is_slow) metaHtml += '<span class="badge status-4xx">SLOW (threshold: ' + data.threshold_ms + ' ms)</span>';
  meta.innerHTML = metaHtml;
  if (data.response_body !== null && data.response_body !== undefined) {
    const bodyStr = typeof data.response_body === 'object'
      ? JSON.stringify(data.response_body, null, 2) : String(data.response_body);
    // Try Prism.js syntax highlighting for JSON
    let isJson = typeof data.response_body === 'object';
    if (!isJson) { try { JSON.parse(data.response_body); isJson = true; } catch (e) {} }
    if (isJson && window.Prism) {
      body.innerHTML = '<pre style="margin:0;background:transparent;"><code class="language-json">' +
        Prism.highlight(bodyStr, Prism.languages.json, 'json') + '</code></pre>';
    } else {
      body.textContent = bodyStr;
    }
  } else {
    body.textContent = '(empty response)';
  }
  if (data.response_headers) {
    const hdrStr = JSON.stringify(data.response_headers, null, 2);
    if (window.Prism) {
      hdrs.innerHTML = '<pre style="margin:0;background:transparent;"><code class="language-json">' +
        Prism.highlight(hdrStr, Prism.languages.json, 'json') + '</code></pre>';
    } else {
      hdrs.textContent = hdrStr;
    }
  } else {
    hdrs.textContent = '';
  }
}

// ─── History ─────────────────────────────────────────────────────────────────
let historyPage = 1;

async function loadHistory(page) {
  if (page !== undefined) historyPage = page;
  const urlFilter = document.getElementById('history-url-filter').value.trim();
  const collection = document.getElementById('history-collection-filter').value;
  let qs = '?page=' + historyPage + '&per_page=50';
  if (urlFilter) qs += '&url=' + encodeURIComponent(urlFilter);
  if (collection) qs += '&collection=' + encodeURIComponent(collection);

  const skeleton = document.getElementById('history-skeleton');
  const table = document.getElementById('history-table-container');
  skeleton.style.display = 'block';
  table.style.opacity = '0.4';

  try {
    const [histResp, collResp] = await Promise.all([
      authFetch('/api/history' + qs),
      authFetch('/api/collections')
    ]);
    const data = await histResp.json();
    const collections = await collResp.json();
    const history = data.items || [];
    const sel = document.getElementById('history-collection-filter');
    const current = sel.value;
    sel.innerHTML = '<option value="">All Collections</option>';
    collections.forEach(c => {
      sel.innerHTML += '<option value="' + esc(c) + '"' + (c === current ? ' selected' : '') + '>' + esc(c) + '</option>';
    });
    const tbody = document.getElementById('history-tbody');
    const empty = document.getElementById('history-empty');
    if (history.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      renderHistoryPagination(data);
      return;
    }
    empty.style.display = 'none';
    tbody.innerHTML = history.map((h, index) => {
      const statusClass = !h.status_code ? 'status-5xx'
        : h.status_code < 300 ? 'status-2xx'
        : h.status_code < 400 ? 'status-3xx'
        : h.status_code < 500 ? 'status-4xx' : 'status-5xx';
      const isSlow = h.response_time_ms > (h.threshold_ms || 1000);
      const date = new Date(h.created_at).toLocaleString();
      return '<tr style="animation:fadeIn 0.4s ease-out ' + (index * 0.02) + 's backwards">' +
        '<td><span class="method-badge method-' + h.method + '">' + h.method + '</span></td>' +
        '<td class="url-cell" title="' + esc(h.url) + '">' + esc(h.url) + '</td>' +
        '<td><span class="badge ' + statusClass + '">' + (h.status_code || 'ERR') + '</span></td>' +
        '<td class="time-cell ' + (isSlow ? 'slow' : '') + '">' + (h.response_time_ms ? h.response_time_ms + ' ms' : '—') + '</td>' +
        '<td>' + esc(h.collection || '') + '</td>' +
        '<td style="color:var(--text-muted);font-size:12px;">' + date + '</td>' +
        '<td><div style="display:flex;gap:4px;">' +
          '<button class="action-btn" onclick="viewDetail(' + h.id + ')">View</button>' +
          '<button class="action-btn" onclick="replayTest(' + h.id + ')">Replay</button>' +
          '<button class="action-btn danger" onclick="deleteTest(' + h.id + ')">Del</button>' +
        '</div></td></tr>';
    }).join('');
    renderHistoryPagination(data);
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to load history', 'error');
  } finally {
    skeleton.style.display = 'none';
    table.style.opacity = '1';
  }
}

function renderHistoryPagination(data) {
  let paginationEl = document.getElementById('history-pagination');
  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'history-pagination';
    paginationEl.style.cssText = 'display:flex;justify-content:center;align-items:center;gap:12px;padding:16px 0;font-size:13px;color:var(--text-muted);';
    document.getElementById('history-table-container').parentElement.appendChild(paginationEl);
  }
  if (!data.total || data.total === 0) { paginationEl.innerHTML = ''; return; }
  let html = '';
  if (data.has_prev) html += '<button class="btn-sm" onclick="loadHistory(' + (data.page - 1) + ')">← Prev</button>';
  html += '<span>Page ' + data.page + ' of ' + data.pages + ' (' + data.total + ' total)</span>';
  if (data.has_next) html += '<button class="btn-sm" onclick="loadHistory(' + (data.page + 1) + ')">Next →</button>';
  paginationEl.innerHTML = html;
}

document.getElementById('history-url-filter').addEventListener('input', debounce(loadHistory, 400));
document.getElementById('history-collection-filter').addEventListener('change', loadHistory);

async function viewDetail(id) {
  try {
    const resp = await authFetch('/api/history/' + id);
    const data = await resp.json();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-page="tester"]').classList.add('active');
    document.getElementById('page-tester').classList.add('active');
    document.getElementById('req-method').value = data.method;
    document.getElementById('req-url').value = data.url;
    document.getElementById('req-collection').value = data.collection || 'Default';
    if (data.request_headers) {
      document.getElementById('req-headers').value =
        typeof data.request_headers === 'string' ? data.request_headers : JSON.stringify(data.request_headers, null, 2);
    }
    if (data.request_body) {
      document.getElementById('req-body').value =
        typeof data.request_body === 'string' ? data.request_body : JSON.stringify(data.request_body, null, 2);
    }
    showResponse({
      status_code: data.status_code, response_time_ms: data.response_time_ms,
      response_body: data.response_body, response_headers: data.response_headers,
      error: data.error, is_slow: false, threshold_ms: 1000
    });
    showToast('Loaded request details', 'info');
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to load details', 'error');
  }
}

async function deleteTest(id) {
  try {
    const resp = await authFetch('/api/history/' + id, { method: 'DELETE' });
    if (resp.ok) { showToast('Test deleted', 'info'); loadHistory(); }
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Delete failed', 'error');
  }
}

async function clearHistory() {
  if (!confirm('Delete all test history?')) return;
  try {
    const resp = await authFetch('/api/history', { method: 'DELETE' });
    if (resp.ok) { showToast('History cleared', 'info'); loadHistory(); }
    else if (resp.status === 403) showToast('Admin access required to clear history', 'error');
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to clear history', 'error');
  }
}

async function replayTest(id) {
  try {
    const resp = await authFetch('/api/history/' + id);
    const data = await resp.json();
    document.getElementById('req-method').value = data.method;
    document.getElementById('req-url').value = data.url;
    document.getElementById('req-collection').value = data.collection || 'Default';
    if (data.request_headers) {
      document.getElementById('req-headers').value =
        typeof data.request_headers === 'string' ? data.request_headers : JSON.stringify(data.request_headers, null, 2);
    }
    if (data.request_body) {
      document.getElementById('req-body').value =
        typeof data.request_body === 'string' ? data.request_body : JSON.stringify(data.request_body, null, 2);
    }
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-page="tester"]').classList.add('active');
    document.getElementById('page-tester').classList.add('active');
    sendRequest();
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Replay failed', 'error');
  }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  const skeleton = document.getElementById('dashboard-skeleton');
  const content = document.getElementById('dashboard-content');
  skeleton.style.display = 'block';
  content.style.opacity = '0.3';
  try {
    const [summaryResp, perfResp, slowResp] = await Promise.all([
      authFetch('/api/analytics/summary'),
      authFetch('/api/analytics/performance?limit=50'),
      authFetch('/api/analytics/slow')
    ]);
    const summary = await summaryResp.json();
    const perfData = await perfResp.json();
    const slowApis = await slowResp.json();
    const lastUpdated = new Date().toLocaleTimeString();
    document.getElementById('page-dashboard').querySelector('.page-title').innerHTML = 
      `Performance Dashboard <span class="text-xs" style="font-weight:400;color:var(--text-muted);margin-left:12px;">Last updated: ${lastUpdated}</span>`;
    
    const totalTests = summary.reduce((s, r) => s + r.total_tests, 0);
    const totalSuccess = summary.reduce((s, r) => s + r.success_count, 0);
    const totalErrors = summary.reduce((s, r) => s + r.error_count, 0);
    const successRate = totalTests > 0 ? ((totalSuccess / totalTests) * 100).toFixed(1) : 0;
    const avgTime = totalTests > 0
      ? (summary.reduce((s, r) => s + r.avg_time * r.total_tests, 0) / totalTests).toFixed(1) : 0;
    
    document.getElementById('dashboard-stats').innerHTML =
      `<div class="stat-card hover-scale"><div class="label">Total Tests</div><div class="value accent">${totalTests}</div></div>` +
      `<div class="stat-card hover-scale"><div class="label">Unique APIs</div><div class="value accent">${summary.length}</div></div>` +
      `<div class="stat-card hover-scale"><div class="label">Success Rate</div><div class="value green">${successRate}%</div></div>` +
      `<div class="stat-card hover-scale"><div class="label">Errors</div><div class="value red">${totalErrors}</div></div>` +
      `<div class="stat-card hover-scale"><div class="label">Avg Response</div><div class="value ${avgTime > 1000 ? 'orange' : 'green'}">${avgTime} ms</div></div>` +
      `<div class="stat-card hover-scale"><div class="label">Slow APIs</div><div class="value ${slowApis.length > 0 ? 'red' : 'green'}">${slowApis.length}</div></div>`;
    const urlSelect = document.getElementById('dashboard-url-select');
    const currentVal = urlSelect.value;
    urlSelect.innerHTML = '<option value="">All URLs (latest 50)</option>';
    summary.forEach(s => {
      urlSelect.innerHTML += '<option value="' + esc(s.url) + '"' + (s.url === currentVal ? ' selected' : '') + '>' + esc(s.url) + '</option>';
    });
    renderPerfChart(perfData.reverse());
    renderStatusChart(summary);
    renderSlowTable(slowApis);
    renderSummaryTable(summary);
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to load dashboard', 'error');
  } finally {
    skeleton.style.display = 'none';
    content.style.opacity = '1';
  }
}

document.getElementById('dashboard-url-select').addEventListener('change', async () => {
  const url = document.getElementById('dashboard-url-select').value;
  const qs = url ? '?url=' + encodeURIComponent(url) + '&limit=50' : '?limit=50';
  try {
    const resp = await authFetch('/api/analytics/performance' + qs);
    const data = await resp.json();
    renderPerfChart(data.reverse());
  } catch (err) { /* handled */ }
});

function renderPerfChart(data) {
  const ctx = document.getElementById('perf-chart').getContext('2d');
  if (perfChart) perfChart.destroy();
  const labels = data.map(d => new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const times = data.map(d => d.response_time_ms);
  const colors = data.map(d => d.response_time_ms > 1000 ? 'rgba(248,81,73,0.8)' : 'rgba(88,166,255,0.8)');
  perfChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Response Time (ms)', data: times, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161b22', titleColor: '#8b949e', bodyColor: '#f0f6fc',
          borderColor: '#30363d', borderWidth: 1, padding: 12, displayColors: false,
          callbacks: {
            title: items => data[items[0].dataIndex].url,
            label: item => item.raw + ' ms — Status: ' + data[item.dataIndex].status_code
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8b949e', font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: 'rgba(48,54,61,0.3)', drawBorder: false }, ticks: { color: '#8b949e', font: { family: 'Inter', size: 11 }, callback: v => v + ' ms' }, beginAtZero: true }
      }
    }
  });
}

function renderStatusChart(summary) {
  const ctx = document.getElementById('status-chart').getContext('2d');
  if (statusChart) statusChart.destroy();
  const success = summary.reduce((s, r) => s + r.success_count, 0);
  const errors = summary.reduce((s, r) => s + r.error_count, 0);
  const other = summary.reduce((s, r) => s + r.total_tests, 0) - success - errors;
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Success', 'Error', 'Other'],
      datasets: [{ data: [success, errors, Math.max(0, other)], backgroundColor: ['rgba(63,185,80,0.8)', 'rgba(248,81,73,0.8)', 'rgba(210,153,34,0.8)'], borderColor: '#0b0e14', borderWidth: 4, hoverOffset: 10 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: { legend: { position: 'bottom', labels: { color: '#8b949e', padding: 20, usePointStyle: true, font: { family: 'Inter', size: 12, weight: '600' } } } }
    }
  });
}

function renderSlowTable(slowApis) {
  const container = document.getElementById('slow-apis-table');
  if (slowApis.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px;"><div class="glass-card" style="padding:24px;border-radius:var(--radius);"><h3 style="color:var(--green)">No Slow APIs</h3><p>All endpoints are performing within thresholds.</p></div></div>';
    return;
  }
  container.innerHTML = '<table><thead><tr><th>URL</th><th>Avg</th><th>Max</th><th>Slow Runs</th></tr></thead><tbody>' +
    slowApis.map(s => '<tr><td class="url-cell" title="' + esc(s.url) + '">' + esc(s.url) + '</td><td class="time-cell slow">' + s.avg_time + ' ms</td><td class="time-cell slow">' + s.max_time + ' ms</td><td>' + s.slow_count + ' / ' + s.total_tests + '</td></tr>').join('') +
    '</tbody></table>';
}

function renderSummaryTable(summary) {
  const container = document.getElementById('summary-table');
  if (summary.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:40px;"><div class="glass-card" style="padding:24px;border-radius:var(--radius);"><h3>No API Traffic</h3><p>Complete some tests to see aggregated performance data here.</p></div></div>';
    return;
  }
  container.innerHTML = '<table><thead><tr><th>URL</th><th>Tests</th><th>Avg</th><th>Min</th><th>Max</th><th>Success</th><th>Errors</th><th>Last Tested</th></tr></thead><tbody>' +
    summary.map(s => {
      const date = new Date(s.last_tested).toLocaleString();
      return '<tr><td class="url-cell" title="' + esc(s.url) + '">' + esc(s.url) + '</td><td>' + s.total_tests + '</td><td class="time-cell ' + (s.avg_time > 1000 ? 'slow' : '') + '">' + s.avg_time + ' ms</td><td class="time-cell">' + s.min_time + ' ms</td><td class="time-cell">' + s.max_time + ' ms</td><td style="color:var(--green);font-weight:600;">' + s.success_count + '</td><td style="color:' + (s.error_count > 0 ? 'var(--red)' : 'var(--text-muted)') + ';font-weight:600;">' + s.error_count + '</td><td style="color:var(--text-muted);font-size:12px;">' + date + '</td></tr>';
    }).join('') + '</tbody></table>';
}

// ─── Compare ─────────────────────────────────────────────────────────────────
function addCompareUrl() {
  const container = document.getElementById('compare-urls');
  const row = document.createElement('div');
  row.className = 'compare-url-row';
  row.style.animation = 'slideUp 0.3s ease-out';
  row.innerHTML = '<input class="filter-input" style="flex:1" placeholder="https://api.example.com/endpoint" data-compare-url>' +
    '<button class="action-btn danger" onclick="this.parentElement.remove()">Remove</button>';
  container.appendChild(row);
}

async function runCompare() {
  const inputs = document.querySelectorAll('[data-compare-url]');
  const urls = [];
  inputs.forEach(input => { const v = input.value.trim(); if (v) urls.push(v); });
  if (urls.length === 0) { showToast('Enter at least one URL to compare', 'error'); return; }
  const qs = urls.map(u => 'url=' + encodeURIComponent(u)).join('&');
  try {
    const resp = await authFetch('/api/analytics/compare?' + qs);
    const data = await resp.json();
    renderCompare(data, urls);
    document.getElementById('compare-results').style.display = 'block';
    document.getElementById('compare-results').style.animation = 'fadeIn 0.5s ease-out';
    showToast('Comparison updated', 'success');
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Comparison failed', 'error');
  }
}

function renderCompare(data, urls) {
  const ctx = document.getElementById('compare-chart').getContext('2d');
  if (compareChart) compareChart.destroy();
  const chartColors = ['rgba(88,166,255,0.8)', 'rgba(63,185,80,0.8)', 'rgba(210,153,34,0.8)', 'rgba(248,81,73,0.8)', 'rgba(188,140,255,0.8)', 'rgba(255,166,87,0.8)'];
  const datasets = urls.map((url, i) => {
    const urlData = data[url];
    if (!urlData) return null;
    const runs = urlData.runs.slice().reverse();
    const color = chartColors[i % chartColors.length];
    return {
      label: shortenUrl(url), data: runs.map(r => r.response_time_ms),
      borderColor: color, backgroundColor: color.replace('0.8', '0.05'),
      borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4,
      pointBackgroundColor: color, pointBorderColor: '#0b0e14', pointBorderWidth: 2,
    };
  }).filter(Boolean);
  const maxLen = Math.max(...datasets.map(d => d.data.length), 0);
  const labels = Array.from({ length: maxLen }, (_, i) => 'Run ' + (i + 1));
  compareChart = new Chart(ctx, {
    type: 'line', data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'top', labels: { color: '#8b949e', usePointStyle: true, padding: 20, font: { family: 'Inter', size: 12, weight: '600' } } },
        tooltip: { backgroundColor: '#161b22', padding: 12, borderColor: '#30363d', borderWidth: 1 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8b949e' } },
        y: { grid: { color: 'rgba(48,54,61,0.2)', drawBorder: false }, ticks: { color: '#8b949e', callback: v => v + ' ms' }, beginAtZero: true }
      }
    }
  });
  let statsHtml = '<table><thead><tr><th>URL</th><th>Runs</th><th>Avg</th><th>Min</th><th>Max</th></tr></thead><tbody>';
  urls.forEach(url => {
    const d = data[url];
    if (!d || !d.stats) return;
    statsHtml += '<tr><td class="url-cell" title="' + esc(url) + '">' + esc(shortenUrl(url)) + '</td><td>' + (d.stats.total || 0) + '</td><td class="time-cell">' + (d.stats.avg_time || 0) + ' ms</td><td class="time-cell">' + (d.stats.min_time || 0) + ' ms</td><td class="time-cell">' + (d.stats.max_time || 0) + ' ms</td></tr>';
  });
  statsHtml += '</tbody></table>';
  document.getElementById('compare-stats-table').innerHTML = statsHtml;
}

// ─── Thresholds ──────────────────────────────────────────────────────────────
async function loadThresholds() {
  try {
    const resp = await authFetch('/api/thresholds');
    const thresholds = await resp.json();
    const container = document.getElementById('thresholds-list');
    if (thresholds.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px;">No custom thresholds set. Default threshold (1000 ms) applies to all APIs.</p>';
      return;
    }
    container.innerHTML = '<table><thead><tr><th>URL Pattern</th><th>Max Time</th><th></th></tr></thead><tbody>' +
      thresholds.map((t, i) => '<tr style="animation:fadeIn 0.4s ease-out ' + (i * 0.05) + 's backwards"><td style="font-family:\'JetBrains Mono\',monospace;font-size:13px;color:var(--accent)">' + esc(t.url_pattern) + '</td><td class="time-cell" style="font-weight:600">' + t.max_response_time_ms + ' ms</td><td><button class="action-btn danger" onclick="deleteThreshold(' + t.id + ')">Delete</button></td></tr>').join('') +
      '</tbody></table>';
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to load thresholds', 'error');
  }
}

async function addThreshold() {
  const pattern = document.getElementById('new-threshold-pattern').value.trim();
  const ms = parseFloat(document.getElementById('new-threshold-ms').value);
  if (!pattern || isNaN(ms)) { showToast('Provide both URL pattern and max response time', 'error'); return; }
  try {
    const resp = await authFetch('/api/thresholds', {
      method: 'POST',
      body: JSON.stringify({ url_pattern: pattern, max_response_time_ms: ms })
    });
    if (resp.ok) {
      showToast('Threshold added', 'success');
      document.getElementById('new-threshold-pattern').value = '';
      loadThresholds();
    }
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to add threshold', 'error');
  }
}

async function deleteThreshold(id) {
  try {
    const resp = await authFetch('/api/thresholds/' + id, { method: 'DELETE' });
    if (resp.ok) { showToast('Threshold deleted', 'info'); loadThresholds(); }
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Delete failed', 'error');
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

function shortenUrl(url) {
  try { const u = new URL(url); return u.host + u.pathname; }
  catch { return url.length > 50 ? url.substring(0, 50) + '...' : url; }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function formatJson(id) {
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const obj = JSON.parse(el.value);
    el.value = JSON.stringify(obj, null, 2);
    showToast('JSON formatted', 'success');
  } catch (e) {
    showToast('Invalid JSON', 'error');
  }
}

function clearRequest() {
  document.getElementById('req-url').value = '';
  document.getElementById('req-body').value = '';
  document.getElementById('req-headers').value = '{}';
  showToast('Request cleared', 'info');
}

function copyAsCurl() {
  const method = document.getElementById('req-method').value;
  const url = document.getElementById('req-url').value.trim();
  const headersText = document.getElementById('req-headers').value.trim();
  const bodyText = document.getElementById('req-body').value.trim();

  if (!url) { showToast('URL is required for cURL', 'error'); return; }

  let curl = `curl -X ${method} "${url}"`;
  
  if (headersText) {
    try {
      const headers = JSON.parse(headersText);
      for (const [k, v] of Object.entries(headers)) {
        curl += ` -H "${k}: ${v}"`;
      }
    } catch (e) { /* ignore invalid json for curl */ }
  }

  if (bodyText && method !== 'GET') {
    curl += ` -d '${bodyText.replace(/'/g, "'\\''")}'`;
  }

  navigator.clipboard.writeText(curl).then(() => {
    showToast('cURL command copied', 'success');
  });
}

async function copyResponse() {
  const body = document.getElementById('response-body').textContent;
  if (!body || body === '(empty response)') return;
  try {
    await navigator.clipboard.writeText(body);
    showToast('Copied to clipboard', 'success');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
}

// ─── Environment Helpers ─────────────────────────────────────────────────────
function getSelectedEnvId() {
  const sel = document.getElementById('req-env');
  const val = sel ? sel.value : '';
  return val ? parseInt(val, 10) : null;
}

async function loadEnvironments() {
  try {
    const resp = await authFetch('/api/environments');
    const envs = await resp.json();

    // Populate the request bar dropdown
    const reqEnv = document.getElementById('req-env');
    const currentVal = reqEnv.value;
    reqEnv.innerHTML = '<option value="">No Environment</option>';
    envs.forEach(env => {
      reqEnv.innerHTML += '<option value="' + env.id + '"' + (String(env.id) === currentVal ? ' selected' : '') + '>' + esc(env.name) + '</option>';
    });

    // Populate the environments page list
    const container = document.getElementById('environments-list');
    if (!container) return;
    if (envs.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px;">No environments created yet. Create one above to start using variables.</p>';
      return;
    }
    container.innerHTML = envs.map((env, i) => {
      const vars = typeof env.variables === 'string' ? JSON.parse(env.variables) : (env.variables || {});
      const varEntries = Object.entries(vars);
      return '<div class="card" style="margin-bottom:12px;animation:fadeIn 0.4s ease-out ' + (i * 0.05) + 's backwards">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
          '<h3 style="font-size:15px;font-weight:600;color:var(--accent);">' + esc(env.name) + '</h3>' +
          '<div style="display:flex;gap:8px;">' +
            '<button class="action-btn" onclick="editEnvironment(' + env.id + ')">Edit</button>' +
            '<button class="action-btn danger" onclick="deleteEnvironment(' + env.id + ')">Delete</button>' +
          '</div>' +
        '</div>' +
        (varEntries.length > 0
          ? '<table><thead><tr><th>Variable</th><th>Value</th></tr></thead><tbody>' +
            varEntries.map(([k, v]) =>
              '<tr><td style="font-family:\'JetBrains Mono\',monospace;font-size:13px;color:var(--accent);">{{' + esc(k) + '}}</td>' +
              '<td style="font-family:\'JetBrains Mono\',monospace;font-size:13px;">' + esc(v) + '</td></tr>'
            ).join('') + '</tbody></table>'
          : '<p style="color:var(--text-muted);font-size:13px;">No variables defined. Edit to add variables.</p>') +
      '</div>';
    }).join('');
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to load environments', 'error');
  }
}

async function createEnvironment() {
  const nameEl = document.getElementById('new-env-name');
  const name = nameEl.value.trim();
  if (!name) { showToast('Enter an environment name', 'error'); return; }
  try {
    const resp = await authFetch('/api/environments', {
      method: 'POST',
      body: JSON.stringify({ name, variables: {} })
    });
    if (resp.ok) {
      nameEl.value = '';
      showToast('Environment created', 'success');
      loadEnvironments();
    } else {
      const data = await resp.json();
      showToast(data.error || 'Failed to create environment', 'error');
    }
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to create environment', 'error');
  }
}

async function deleteEnvironment(id) {
  if (!confirm('Delete this environment?')) return;
  try {
    const resp = await authFetch('/api/environments/' + id, { method: 'DELETE' });
    if (resp.ok) { showToast('Environment deleted', 'info'); loadEnvironments(); }
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Delete failed', 'error');
  }
}

async function editEnvironment(id) {
  try {
    const resp = await authFetch('/api/environments');
    const envs = await resp.json();
    const env = envs.find(e => e.id === id);
    if (!env) { showToast('Environment not found', 'error'); return; }
    const vars = typeof env.variables === 'string' ? JSON.parse(env.variables) : (env.variables || {});
    const input = prompt('Enter variables as JSON:\n\nExample: {"base_url": "https://api.example.com", "api_key": "secret123"}',
      JSON.stringify(vars, null, 2));
    if (input === null) return;
    let parsed;
    try { parsed = JSON.parse(input); } catch (e) { showToast('Invalid JSON', 'error'); return; }
    const saveResp = await authFetch('/api/environments', {
      method: 'POST',
      body: JSON.stringify({ name: env.name, variables: parsed })
    });
    if (saveResp.ok) { showToast('Environment updated', 'success'); loadEnvironments(); }
  } catch (err) {
    if (err.message !== 'Session expired') showToast('Failed to update environment', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEXT-GEN UI — Living Interface System
// Particles, cursor glow, physics, microinteractions
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Particle System (subtle floating dots + connection lines) ───────────────
(function initParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let particles = [];
  let w, h;

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.size = Math.random() * 2.5 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.2;
      this.speedY = (Math.random() - 0.5) * 0.2;
      this.opacity = Math.random() * 0.5 + 0.15;
      this.pulse = Math.random() * Math.PI * 2;
      this.pulseSpeed = Math.random() * 0.012 + 0.005;
      this.hue = Math.random() > 0.7 ? 260 : (Math.random() > 0.5 ? 180 : 220);
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.pulse += this.pulseSpeed;
      if (this.x < -10 || this.x > w + 10 || this.y < -10 || this.y > h + 10) this.reset();
    }
    draw() {
      const a = this.opacity * (0.5 + 0.5 * Math.sin(this.pulse));
      // Glow effect
      ctx.save();
      ctx.shadowBlur = this.size * 8;
      ctx.shadowColor = `hsla(${this.hue},80%,65%,${a * 0.6})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue},80%,70%,${a})`;
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < 50; i++) particles.push(new Particle());

  function animate() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => { p.update(); p.draw(); });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(77,141,255,${0.06 * (1 - dist / 180)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();
})();

// ─── Cursor Glow Follower ────────────────────────────────────────────────────
(function initCursorGlow() {
  const glow = document.createElement('div');
  glow.id = 'cursor-glow';
  document.body.prepend(glow);
  let tx = 0, ty = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', e => {
    tx = e.clientX; ty = e.clientY; glow.style.opacity = '1';
    // Also update card glow positions
    document.querySelectorAll('.card:hover').forEach(card => {
      const r = card.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width * 100);
      const py = ((e.clientY - r.top) / r.height * 100);
      card.style.setProperty('--glow-x', px + '%');
      card.style.setProperty('--glow-y', py + '%');
    });
  });
  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  (function loop() {
    cx += (tx - cx) * 0.05;
    cy += (ty - cy) * 0.07;
    glow.style.left = cx + 'px';
    glow.style.top = cy + 'px';
    requestAnimationFrame(loop);
  })();
})();

// ─── 3D Card Tilt on Stat Cards ──────────────────────────────────────────────
(function initCardTilt() {
  function onMove(e) {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    const rx = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -2.5;
    const ry = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 2.5;
    c.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px) scale(1.01)`;
  }
  function onLeave(e) { e.currentTarget.style.transform = ''; }
  new MutationObserver(() => {
    document.querySelectorAll('.stat-card').forEach(c => {
      if (!c._tilt) { c.addEventListener('mousemove', onMove); c.addEventListener('mouseleave', onLeave); c._tilt = true; }
    });
  }).observe(document.body, { childList: true, subtree: true });
})();

// ─── Button Ripple Effect ────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.send-btn, .btn-sm, .action-btn, .nav-item');
  if (!btn) return;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  Object.assign(ripple.style, {
    width: size + 'px', height: size + 'px',
    left: (e.clientX - rect.left - size / 2) + 'px',
    top: (e.clientY - rect.top - size / 2) + 'px',
    position: 'absolute', borderRadius: '50%',
    background: 'rgba(77,141,255,0.2)', transform: 'scale(0)',
    animation: 'rippleEffect 0.6s ease-out', pointerEvents: 'none'
  });
  btn.style.position = btn.style.position || 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

// ─── Counter Animation for Stat Values ───────────────────────────────────────
(function initCounters() {
  function animateCounters() {
    document.querySelectorAll('.stat-card .value').forEach(el => {
      if (el._counted) return;
      el._counted = true;
      const text = el.textContent.trim();
      const match = text.match(/^([\d.]+)(.*)$/);
      if (!match) return;
      const target = parseFloat(match[1]);
      const suffix = match[2];
      const isFloat = text.includes('.');
      const start = performance.now();
      (function step(now) {
        const p = Math.min((now - start) / 800, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (isFloat ? (target * eased).toFixed(1) : Math.floor(target * eased)) + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(start);
    });
  }
  new MutationObserver(animateCounters).observe(document.body, { childList: true, subtree: true });
})();

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.altKey && !isNaN(e.key) && e.key >= '1' && e.key <= '6') {
    const items = document.querySelectorAll('.nav-item');
    const index = parseInt(e.key) - 1;
    if (items[index]) items[index].click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (document.querySelector('.page.active').id === 'page-tester') sendRequest();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
    e.preventDefault();
    const navItem = document.querySelector('[data-page="history"]');
    if (navItem) navItem.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    const navItem = document.querySelector('[data-page="dashboard"]');
    if (navItem) navItem.click();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    const urlInput = document.getElementById('req-url');
    urlInput.value = '';
    urlInput.focus();
  }
  if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    const hint = document.getElementById('shortcuts-hint');
    hint.style.display = hint.style.display === 'flex' ? 'none' : 'flex';
  }
  if (e.key === 'Escape') {
    const hint = document.getElementById('shortcuts-hint');
    if (hint.style.display === 'flex') { hint.style.display = 'none'; return; }
    const panel = document.getElementById('response-panel');
    if (panel && panel.style.display !== 'none') {
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(10px)';
      panel.style.transition = 'all 0.2s ease-in';
      setTimeout(() => { panel.style.display = 'none'; panel.style.opacity = ''; panel.style.transform = ''; }, 200);
    }
  }
});
