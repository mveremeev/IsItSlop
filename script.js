const app = document.getElementById('app');
let items = [];
let current = 0;
let frontier = 0;
const verdicts = {};
let busy = false;
var privateCode = localStorage.getItem('privateCode') || '';
var codeVisible = false;
var triageData = JSON.parse(localStorage.getItem('triageData') || '{}');
var receivedVerdicts = [];
var sendEndpoints = JSON.parse(localStorage.getItem('sendEndpoints') || '[]');
var receiveItemEndpoints = JSON.parse(localStorage.getItem('receiveItemEndpoints') || '[]');
var receiveVerdictEndpoints = JSON.parse(localStorage.getItem('receiveVerdictEndpoints') || '[]');
var dismissedNums = JSON.parse(localStorage.getItem('dismissedNums') || '[]');
const BATCH_SIZE = 10;
const openSections = {};


function refreshIcons() {
  if (self.lucide) lucide.createIcons();
}

function applyTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
    return;
  }
  document.documentElement.dataset.theme =
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  render();
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function diffHTML(line) {
  if (line.type === 'file') return '<div class="diff-file">' + esc(line.text) + '</div>';
  const cls = line.type === 'add' ? ' diff-add' : line.type === 'rem' ? ' diff-rem' : '';
  return '<div class="diff-line' + cls + '">' + esc(line.text) + '</div>';
}


function topbarHTML() {
  const icon = document.documentElement.dataset.theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
  const n = Math.min(current + 1, items.length);
  return '<div class="topbar">' +
    '<div class="logo">IsItSlop</div>' +
    '<div class="topbar-right">' +
      '<span class="counter">' + n + ' / ' + items.length + '</span>' +
      '<button class="theme-toggle" onclick="toggleTheme()">' + icon + '</button>' +
    '</div>' +
  '</div>';
}

function progressHTML() {
  let html = '<div class="progress">';
  for (let i = 0; i < items.length; i++) {
    const v = verdicts[i];
    let cls = 'seg';
    if (v) cls += ' seg-' + v;
    if (i === current && current < items.length) cls += ' seg-current';
    html += '<button class="' + cls + '" onclick="goTo(' + i + ')"></button>';
  }
  return html + '</div>';
}


function codeButtonHTML() {
  if (!privateCode) {
    return '<div class="code-row">' +
      '<button class="code-btn" onclick="promptCode()"><i data-lucide="key-round"></i> Enter private code</button>' +
      '<button class="code-action" onclick="generateCode()"><i data-lucide="shuffle"></i></button>' +
    '</div>';
  }
  const display = codeVisible ? esc(privateCode) : '\u2022'.repeat(Math.min(privateCode.length, 20));
  return '<div class="code-row">' +
    '<button class="code-action" onclick="editCode()"><i data-lucide="pencil"></i></button>' +
    '<button class="code-action code-action-danger" onclick="deleteCode()"><i data-lucide="trash-2"></i></button>' +
    '<button class="code-btn code-btn-set" onclick="copyCode()">' +
      '<span class="code-preview" id="code-preview">' + display + '</span>' +
    '</button>' +
    '<button class="code-action" onclick="toggleCodeVisibility()"><i data-lucide="' + (codeVisible ? 'eye-off' : 'eye') + '"></i></button>' +
    '<button class="code-action" onclick="generateCode()"><i data-lucide="shuffle"></i></button>' +
  '</div>';
}

function epSectionHTML(id, label, list) {
  const open = openSections[id];
  let html = '<div class="ep-section">' +
    '<button class="ep-toggle" onclick="toggleSection(\'' + id + '\')">' +
      esc(label) + ' <span class="ep-count">(' + list.length + ')</span> ' +
      '<i data-lucide="' + (open ? 'chevron-up' : 'chevron-down') + '"></i>' +
    '</button>';
  if (open) {
    html += '<div class="ep-body">';
    list.forEach((url, i) => {
      html += '<div class="ep-item">' +
        '<span class="ep-url">' + esc(url) + '</span>' +
        '<button class="ep-remove" onclick="removeEndpoint(\'' + id + '\',' + i + ')"><i data-lucide="x"></i></button>' +
      '</div>';
    });
    html += '<div class="ep-add">' +
      '<input class="ep-input" id="' + id + '-input" placeholder="https://...">' +
      '<button class="code-action" onclick="addEndpoint(\'' + id + '\')"><i data-lucide="plus"></i></button>' +
    '</div></div>';
  }
  return html + '</div>';
}

function footerHTML() {
  let html = codeButtonHTML();
  if (self.enableSend) {
    html += epSectionHTML('send', 'Send endpoints', sendEndpoints);
  }
  if (self.enableReceive) {
    html += epSectionHTML('recv-items', 'Receive: Items', receiveItemEndpoints);
    html += epSectionHTML('recv-verdicts', 'Receive: Verdicts', receiveVerdictEndpoints);
  }
  html += infoSectionHTML();
  return '<div id="footer">' + html + '</div>';
}

function infoSectionHTML() {
  const open = openSections['info'];
  let html = '<div class="ep-section info-section">' +
    '<button class="ep-toggle info-toggle" onclick="toggleSection(\'info\')">' +
      '<i data-lucide="info"></i> AI Usage details, about this tool, &amp; data schema ' +
      '<i data-lucide="' + (open ? 'chevron-up' : 'chevron-down') + '"></i>' +
    '</button>';
  if (open) {
    html +=
      '<div class="ep-body info-body">' +
        '<p class="info-heading">AI Usage</p>' +
        '<p class="info-text">This code is (ironically) partially generated by AI, and partially made by me. I wasnt ready to spend all that much effort and time on a silly little tool like this, so anyone can feel free to make this actually good if they find it useful.</p>' +

        '<p class="info-heading">Private code</p>' +
        '<p class="info-text">An optional string stored in your browser. It is included in every payload sent to your endpoints under the key <code>privateCode</code>. On the receiving end you can use it to authenticate submissions, or ignore it entirely - the field is always present but never required.</p>' +

        '<p class="info-heading">Sent data schema</p>' +
        '<p class="info-text">Each submission posts a JSON body to every configured send endpoint:</p>' +
        '<pre class="info-pre">{\n  "privateCode": "...",   // your private code, or ""\n  "verdicts": {\n    "42": "slop",          // PR num → verdict\n    "17": "genuine",\n    "9":  "skip"\n  },\n  "items": [ ... ]        // full item objects for context\n}</pre>' +

        '<p class="info-heading">Received items schema</p>' +
        '<p class="info-text">Your item source endpoints should return a JSON array of PR objects:</p>' +
        '<pre class="info-pre">[\n  {\n    "num": 42,\n    "title": "...",\n    "user": "...",\n    "lines": "+12 -3",\n    "desc": "...",\n    "diff": [\n      { "type": "file", "text": "src/foo.js" },\n      { "type": "add",  "text": "+ added line" },\n      { "type": "rem",  "text": "- removed line" },\n      { "type": "ctx",  "text": "  context line" }\n    ]\n  }\n]</pre>' +

        '<p class="info-heading">Received verdicts schema</p>' +
        '<p class="info-text">Verdict source endpoints should return an array of verdict objects from other reviewers. These are stored locally and accessible via <code>receivedVerdicts</code> in your custom hook files:</p>' +
        '<pre class="info-pre">[\n  { "num": 42, "verdict": "slop" },\n  { "num": 17, "verdict": "genuine" }\n]</pre>' +
      '</div>';
  }
  return html + '</div>';
}


function render() {
  if (!items.length) {
    renderEmpty();
  } else if (current >= items.length) {
    renderDone();
  } else {
    renderCard();
  }
  refreshIcons();
}

function renderLoading() {
  app.innerHTML = '<div class="container">' + topbarHTML() + '<div class="empty-state"><div class="empty-icon"><i data-lucide="loader"></i></div><p class="empty-msg">Loading\u2026</p></div></div>';
  refreshIcons();
}

function renderEmpty() {
  app.innerHTML =
    '<div class="container">' +
      topbarHTML() +
      '<div class="empty-state">' +
        '<div class="empty-icon"><i data-lucide="inbox"></i></div>' +
        '<p class="empty-msg">Nothing left to review.</p>' +
        '<p class="empty-sub">All items have been rated and submitted.</p>' +
        '<button class="btn-reset" onclick="resetAndReload()"><i data-lucide="trash-2"></i> Reset everything</button>' +
      '</div>' +
      footerHTML() +
    '</div>';
}

function renderCard() {
  if (!items.length) {
    renderEmpty();
    return;
  }
  const item = items[current];
  const existing = verdicts[current];
  const canResume = current !== frontier && frontier < items.length;
  const canReturn = existing !== undefined && frontier >= items.length;

  app.innerHTML =
    '<div class="container">' +
      topbarHTML() +
      progressHTML() +
      '<div class="card" id="card">' +
        '<span class="hint hint-slop">SLOP</span>' +
        '<span class="hint hint-genuine">GENUINE</span>' +
        '<span class="hint hint-skip">SKIP</span>' +
        '<div class="card-header">' +
          '<span class="tag">' + esc(item.num) + '</span>' +
          (item.isNew ? '<span class="tag tag-new">new</span>' : '') +
          (existing ? '<span class="verdict-badge verdict-' + existing + '">' + existing + '</span>' : '') +
          '<div class="kb-hint">' +
            '<span><span class="kbd">\u2190</span> slop</span>' +
            '<span><span class="kbd">\u2192</span> genuine</span>' +
            '<span><span class="kbd">\u2191</span> <span class="kbd">Space</span> skip</span>' +
          '</div>' +
        '</div>' +
        '<h3 class="card-title">' + esc(item.title) + '</h3>' +
        '<div class="card-meta">' +
          '<span class="tag tag-user">' + esc(item.user) + '</span>' +
          '<span class="tag tag-lines">' + esc(item.lines).replace(/(\+\d+)/, '<span class="lines-add">$1</span>').replace(/(-\d+)/, '<span class="lines-rem">$1</span>') + '</span>' +
          (item.hasIssue ? '<span class="tag tag-issue">fixes ' + esc(item.issueNum) + '</span>' : '') +
        '</div>' +
        '<div class="actions-wrap">' +
          '<div class="actions">' +
            '<button class="btn btn-slop" onclick="rate(\'slop\')"><i data-lucide="thumbs-down"></i> Slop</button>' +
            '<button class="btn btn-genuine" onclick="rate(\'genuine\')"><i data-lucide="thumbs-up"></i> Genuine</button>' +
          '</div>' +
          '<button class="btn-skip" onclick="rate(\'skip\')"><i data-lucide="arrow-up"></i> Skip</button>' +
          (canResume ? '<button class="resume" onclick="goTo(' + frontier + ')"><i data-lucide="skip-forward"></i> resume</button>' : '') +
          (canReturn ? '<button class="resume" onclick="goTo(' + items.length + ')"><i data-lucide="bar-chart-2"></i> results</button>' : '') +
        '</div>' +
        '<p class="card-desc">' + esc(item.desc) + '</p>' +
        '<div class="diff">' + item.diff.map(diffHTML).join('') + '</div>' +
      '</div>' +
      footerHTML() +
    '</div>';

  setupTouch(document.getElementById('card'));
}

function renderDone() {
  const counts = { slop: 0, genuine: 0, skip: 0 };
  for (const v of Object.values(verdicts)) counts[v]++;

  const showSubmit = self.enableSubmit;

  app.innerHTML =
    '<div class="container">' +
      topbarHTML() +
      progressHTML() +
      '<div class="done">' +
        '<h2>All rated</h2>' +
        '<p>Click a segment above to revisit.</p>' +
        '<div class="stats">' +
          '<div class="stat stat-slop"><span class="stat-num">' + counts.slop + '</span><span class="stat-label">slop</span></div>' +
          '<div class="stat stat-genuine"><span class="stat-num">' + counts.genuine + '</span><span class="stat-label">genuine</span></div>' +
          '<div class="stat stat-skip"><span class="stat-num">' + counts.skip + '</span><span class="stat-label">skip</span></div>' +
        '</div>' +
        '<div class="done-actions">' +
          '<button class="btn done-btn" onclick="submitAndReload()"><i data-lucide="refresh-cw"></i> Submit &amp; reload</button>' +
          (showSubmit ? '<button class="btn btn-genuine" onclick="submitResults()"><i data-lucide="send"></i> Submit</button>' : '') +
        '</div>' +
        '<button class="btn-reset" onclick="resetAndReload()"><i data-lucide="trash-2"></i> Reset everything</button>' +
      '</div>' +
      footerHTML() +
    '</div>';
}


function submitAndReload() {
  submitResults();
  location.reload();
}

function resetAndReload() {
  if (!confirm('Reset everything? This clears all verdicts, dismissed items, and progress (Stored locally, if relevant, anything already sent off cant be touched). This does not clear your private key.')) return;
  localStorage.removeItem('triageData');
  localStorage.removeItem('dismissedNums');
  location.reload();
}

function updateFooter() {
  const el = document.getElementById('footer');
  if (el) { el.outerHTML = footerHTML(); refreshIcons(); }
  else render();
}

function updateCodeRow() {
  const el = document.querySelector('.code-row');
  if (el) { el.outerHTML = codeButtonHTML(); refreshIcons(); }
  else render();
}


function submitResults() {
  const filteredVerdicts = self.excludeSkipped
    ? Object.fromEntries(Object.entries(verdicts).filter(([, v]) => v !== 'skip'))
    : Object.assign({}, verdicts);
  if (self.onSubmit) self.onSubmit({ verdicts: filteredVerdicts, items: items }, privateCode);
  if (self.enableSend && self.sendOn !== 'action') sendAllVerdicts();

  const btn = document.querySelector('.done-actions .btn-genuine');
  if (btn) {
    btn.innerHTML = '<i data-lucide="check"></i> Submitted';
    btn.disabled = true;
    btn.classList.add('btn-submitted');
    refreshIcons();
  }

  if (self.excludeSkipped) {
    for (let i = 0; i < items.length; i++) {
      if (verdicts[i] && verdicts[i] !== 'skip') {
        dismissedNums.push(items[i].num);
      }
    }
    localStorage.setItem('dismissedNums', JSON.stringify(dismissedNums));
  }
}


function copyCode() {
  navigator.clipboard.writeText(privateCode).then(() => showToast('Copied to clipboard'));
}

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-visible'), 10);
  setTimeout(() => {
    t.classList.remove('toast-visible');
    setTimeout(() => t.remove(), 200);
  }, 1500);
}

function editCode() {
  if (!confirm('Edit private code?')) return;
  const input = prompt('Private code:', privateCode);
  if (input === null) return;
  privateCode = input;
  localStorage.setItem('privateCode', privateCode);
  updateCodeRow();
}

function deleteCode() {
  if (!confirm('Delete private code? This cannot be undone.')) return;
  privateCode = '';
  codeVisible = false;
  localStorage.removeItem('privateCode');
  updateCodeRow();
}

function promptCode() {
  const input = prompt('Enter private code (if needed):', privateCode);
  if (input === null) return;
  privateCode = input;
  localStorage.setItem('privateCode', privateCode);
  render();
}

function toggleCodeVisibility() {
  if (!codeVisible && !confirm('Reveal code?')) return;
  codeVisible = !codeVisible;
  updateCodeRow();
}

function generateCode() {
  if (privateCode && !confirm('Generate a new code? This replaces the current one.')) return;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) code += chars[Math.random() * chars.length | 0];
  codeVisible = false;
  localStorage.setItem('privateCode', code);

  const preview = document.getElementById('code-preview');
  if (preview) {
    const len = Math.min((privateCode || code).length, 20);
    preview.style.setProperty('--code-len', len);
    preview.classList.remove('code-typing', 'code-untyping');
    // Force reflow so the class removal is registered before we re-add
    void preview.offsetWidth;
    preview.classList.add('code-untyping');

    setTimeout(() => {
      privateCode = code;
      preview.textContent = '\u2022'.repeat(Math.min(code.length, 20));
      preview.style.setProperty('--code-len', Math.min(code.length, 20));
      preview.classList.remove('code-untyping');
      void preview.offsetWidth;
      preview.classList.add('code-typing');
      setTimeout(() => preview.classList.remove('code-typing'), 220);
    }, 200);
  } else {
    privateCode = code;
    updateCodeRow();
  }
}


function toggleSection(id) {
  openSections[id] = !openSections[id];
  updateFooter();
}

function epStorageFor(id) {
  if (id === 'send') return { key: 'sendEndpoints', list: sendEndpoints };
  if (id === 'recv-items') return { key: 'receiveItemEndpoints', list: receiveItemEndpoints };
  return { key: 'receiveVerdictEndpoints', list: receiveVerdictEndpoints };
}

function addEndpoint(id) {
  const input = document.getElementById(id + '-input');
  if (!input || !input.value.trim()) return;
  const store = epStorageFor(id);
  store.list.push(input.value.trim());
  localStorage.setItem(store.key, JSON.stringify(store.list));
  updateFooter();
}

function removeEndpoint(id, idx) {
  const store = epStorageFor(id);
  store.list.splice(idx, 1);
  localStorage.setItem(store.key, JSON.stringify(store.list));
  updateFooter();
}


function sendToEndpoints(payload) {
  sendEndpoints.forEach(url => {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  });
}

function sendCurrentAction(verdict, item) {
  if (!self.enableSend || self.sendOn !== 'action' || !sendEndpoints.length) return;
  sendToEndpoints({ code: privateCode, num: item.num, verdict: verdict });
}

function buildVerdictChain() {
  const chain = [];
  for (const i in verdicts) {
    if (self.excludeSkipped && verdicts[i] === 'skip') continue;
    chain.push({ num: items[i].num, verdict: verdicts[i] });
  }
  return chain;
}

function sendAllVerdicts() {
  if (!sendEndpoints.length) return;
  sendToEndpoints({ code: privateCode, verdicts: buildVerdictChain() });
}


function rate(verdict) {
  if (busy || current >= items.length) return;
  busy = true;
  verdicts[current] = verdict;

  triageData[current] = verdict;
  localStorage.setItem('triageData', JSON.stringify(triageData));

  const hook = { slop: self.onSlop, genuine: self.onGenuine, skip: self.onSkip }[verdict];
  if (hook) hook(items[current], current);

  sendCurrentAction(verdict, items[current]);

  if (current === frontier) frontier++;

  const card = document.querySelector('.card');
  if (!card) { afterRate(); return; }

  const transforms = {
    slop: 'translateX(-130%) rotate(-10deg)',
    genuine: 'translateX(130%) rotate(10deg)',
    skip: 'translateY(-130%) rotate(-3deg)'
  };
  card.style.transition = 'transform 0.3s, opacity 0.3s';
  card.style.transform = transforms[verdict];
  card.style.opacity = '0';

  setTimeout(afterRate, 320);
}

function afterRate() {
  current = frontier >= items.length ? items.length : frontier;
  busy = false;
  render();
}

function goTo(idx) {
  if (busy || idx === current) return;
  current = idx;
  render();
}


function setupTouch(card) {
  if (!card) return;
  let sx, sy, dx, dy, dragging;

  card.addEventListener('pointerdown', e => {
    if (busy || e.target.closest('button')) return;
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    dx = dy = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
  });

  card.addEventListener('pointermove', e => {
    if (!dragging) return;
    dx = e.clientX - sx;
    dy = e.clientY - sy;
    card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + dx * 0.05 + 'deg)';

    const t = 80;
    card.querySelector('.hint-slop').style.opacity = Math.max(0, Math.min(1, -dx / t));
    card.querySelector('.hint-genuine').style.opacity = Math.max(0, Math.min(1, dx / t));
    card.querySelector('.hint-skip').style.opacity = Math.max(0, Math.min(1, -dy / t));
  });

  card.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (dx < -80) return rate('slop');
    if (dx > 80) return rate('genuine');
    if (dy < -80) return rate('skip');
    snapBack(card);
  });

  card.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    snapBack(card);
  });
}

function snapBack(el) {
  el.style.transition = 'transform 0.3s';
  el.style.transform = '';
  el.querySelectorAll('.hint').forEach(h => { h.style.opacity = '0'; });
}


document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') rate('slop');
  else if (e.key === 'ArrowRight') rate('genuine');
  else if (e.key === ' ' || e.key === 'ArrowUp') {
    e.preventDefault();
    rate('skip');
  }
});


applyTheme();

function loadItems() {
  renderLoading();
  const fetches = [fetch('data.json').then(r => r.json()).catch(() => [])];

  if (self.enableReceive) {
    receiveItemEndpoints.forEach(url => {
      fetches.push(fetch(url).then(r => r.json()).catch(() => []));
    });
  }

  Promise.all(fetches).then(results => {
    const all = results.flat();
    const seen = new Set(dismissedNums);
    const pool = all.filter(item => {
      if (!item.num || seen.has(item.num)) return false;
      seen.add(item.num);
      return true;
    });
    items = pool.slice(0, BATCH_SIZE);
    if (self.onLoad) self.onLoad(items);
    render();
  });

  if (self.enableReceive) {
    receiveVerdictEndpoints.forEach(url => {
      fetch(url).then(r => r.json()).then(vv => {
        receivedVerdicts = receivedVerdicts.concat(vv);
      }).catch(() => {});
    });
  }
}

loadItems();
