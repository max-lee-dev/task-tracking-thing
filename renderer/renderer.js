const api = window.taskAPI;

// ─── Heights ──────────────────────────────────────────────────────────────────
let H_COLLAPSED = 52;
let H_EXPANDED  = 160;

// ─── Elements ────────────────────────────────────────────────────────────────
const pip             = document.getElementById('pip');
const taskDisplay     = document.getElementById('task-display');
const taskInput       = document.getElementById('task-input');
const barTimer        = document.getElementById('bar-timer');
const doneBtn         = document.getElementById('done-btn');
const panel           = document.getElementById('panel');
const statusLabel     = document.getElementById('status-label');
const reasonRow       = document.getElementById('reason-row');
const timerLabel      = document.getElementById('timer-label');
const nextCheckLbl    = document.getElementById('next-check-label');
const pauseBtn        = document.getElementById('pause-btn');
const completeOverlay = document.getElementById('complete-overlay');
const completeCheck   = document.getElementById('complete-check-icon');
const completeDone    = document.getElementById('complete-done-label');
const completeUpnext  = document.getElementById('complete-upnext');
const ringFill        = document.getElementById('check-ring-fill');
const correctBtn      = document.getElementById('correct-btn');

// ─── State ───────────────────────────────────────────────────────────────────
let nextCheckAt      = null;
let taskStartedAt    = null;
let intervalSeconds  = 30;
let isPaused         = false;
let isExpanded       = false;
let overlayOpen      = false;
let ringAnimFrame    = null;

// ─── Check ring ───────────────────────────────────────────────────────────────
const CIRCUMFERENCE = 44; // 2π×7

function ringSetProgress(frac) {
  // frac 0→1: empty→full
  ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - frac);
}

function ringStartFill(durationMs) {
  cancelAnimationFrame(ringAnimFrame);
  const start = Date.now();
  function tick() {
    const elapsed = Date.now() - start;
    const frac = Math.min(elapsed / durationMs, 1);
    ringSetProgress(frac);
    if (frac < 1) ringAnimFrame = requestAnimationFrame(tick);
  }
  ringSetProgress(0);
  requestAnimationFrame(tick);
}

function ringChecking() {
  cancelAnimationFrame(ringAnimFrame);
  ringFill.classList.add('checking');
  ringSetProgress(1);
}

function ringDone() {
  ringFill.classList.remove('checking');
  ringSetProgress(0);
  // Restart fill for next interval
  ringStartFill(intervalSeconds * 1000);
}

// ─── Overlay helpers ──────────────────────────────────────────────────────────
function openOverlay(id, onOpen) {
  overlayOpen = true;
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('open'));
  const el = document.getElementById(id);
  el.classList.add('open');
  if (!isExpanded) { isExpanded = true; document.body.classList.add('expanded'); }
  if (onOpen) onOpen();
  // Measure natural content height after render
  requestAnimationFrame(() => {
    api.setHeight(el.offsetHeight);
  });
}

function closeOverlay() {
  overlayOpen = false;
  document.querySelectorAll('.overlay').forEach(el => el.classList.remove('open'));
  api.setHeight(isExpanded ? H_EXPANDED : H_COLLAPSED);
}

// ─── Window resize ────────────────────────────────────────────────────────────
function recalcExpandedHeight() {
  H_EXPANDED = H_COLLAPSED + panel.scrollHeight;
  if (isExpanded && !overlayOpen) api.setHeight(H_EXPANDED);
}

function expand() {
  if (isExpanded || overlayOpen) return;
  isExpanded = true;
  document.body.classList.add('expanded');
  api.setHeight(H_EXPANDED);
}

function collapse() {
  if (!isExpanded || overlayOpen) return;
  isExpanded = false;
  document.body.classList.remove('expanded');
  api.setHeight(H_COLLAPSED);
}

api.onMouseEnter(expand);
api.onMouseLeave(collapse);

// ─── Status ───────────────────────────────────────────────────────────────────
function setStatus(state, text) {
  pip.className           = `pip ${state}`;
  statusLabel.className   = `status-text ${state}`;
  statusLabel.textContent = text;
}

function updateIdleStatus() {
  const s       = window._state || {};
  const hasTask = document.body.classList.contains('has-task');
  if (!hasTask)      setStatus('', 'set a task to begin');
  else if (!s.apiKey) setStatus('', 'add api key in settings ⚙');
  else               setStatus('', isPaused ? 'paused' : 'waiting…');
  requestAnimationFrame(recalcExpandedHeight);
}

// ─── Task editing ─────────────────────────────────────────────────────────────
taskDisplay.addEventListener('click', () => {
  taskDisplay.style.display = 'none';
  taskInput.style.display   = 'block';
  taskInput.value = taskDisplay.classList.contains('placeholder') ? '' : taskDisplay.textContent;
  taskInput.focus();
});

async function commitTask() {
  const val = taskInput.value.trim();
  taskInput.style.display   = 'none';
  taskDisplay.style.display = '';
  if (val) {
    taskDisplay.textContent = val;
    taskDisplay.classList.remove('placeholder');
    document.body.classList.add('has-task');
    taskStartedAt = Date.now();
    ringStartFill(intervalSeconds * 1000);
    await api.setTask(val);
  } else {
    resetTaskUI();
    await api.setTask('');
  }
  updateIdleStatus();
}

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  commitTask();
  if (e.key === 'Escape') { taskInput.style.display = 'none'; taskDisplay.style.display = ''; }
});
taskInput.addEventListener('blur', commitTask);

// ─── Complete task ────────────────────────────────────────────────────────────
doneBtn.addEventListener('click', () => api.completeTask());

function resetTaskUI() {
  taskDisplay.textContent  = 'what are you working on?';
  taskDisplay.classList.add('placeholder');
  document.body.classList.remove('has-task');
  reasonRow.textContent    = '';
  statusLabel.textContent  = '';
  statusLabel.className    = 'status-text';
  document.body.classList.remove('off-task');
  correctBtn.classList.remove('noted');
  correctBtn.textContent   = 'actually this is fine';
  timerLabel.textContent   = '';
  barTimer.textContent     = '';
  nextCheckLbl.textContent = '';
  taskStartedAt = null;
  nextCheckAt   = null;
  pip.className = 'pip';
  cancelAnimationFrame(ringAnimFrame);
  ringSetProgress(0);
}

api.onTaskComplete((data) => {
  const nextTask = data?.nextTask || null;

  // If there's a next task, pre-load it in the bar immediately (hidden under overlay)
  if (nextTask) {
    taskDisplay.textContent = nextTask;
    taskDisplay.classList.remove('placeholder');
    document.body.classList.add('has-task');
    taskStartedAt = Date.now();
  } else {
    resetTaskUI();
  }

  // Show completion overlay
  completeOverlay.classList.add('show');
  // Trigger enter animations
  requestAnimationFrame(() => {
    completeCheck.classList.add('in');
    completeDone.classList.add('in');
  });

  if (nextTask) {
    // Slide in "up next" after ✓ settles
    setTimeout(() => {
      completeUpnext.textContent = `up next — ${nextTask}`;
      completeUpnext.classList.add('in');
    }, 700);

    // Fade out overlay — bar already shows correct next task
    setTimeout(() => {
      completeOverlay.style.opacity = '0';
      completeOverlay.style.transition = 'opacity 0.4s ease';
    }, 1800);

    setTimeout(() => {
      completeOverlay.classList.remove('show');
      completeOverlay.style.opacity = '';
      completeOverlay.style.transition = '';
      completeCheck.classList.remove('in');
      completeDone.classList.remove('in');
      completeUpnext.classList.remove('in');
      completeUpnext.textContent = '';
      updateIdleStatus();
      ringStartFill(intervalSeconds * 1000);
    }, 2200);
  } else {
    setTimeout(() => {
      completeOverlay.style.opacity = '0';
      completeOverlay.style.transition = 'opacity 0.4s ease';
    }, 1200);
    setTimeout(() => {
      completeOverlay.classList.remove('show');
      completeOverlay.style.opacity = '';
      completeOverlay.style.transition = '';
      completeCheck.classList.remove('in');
      completeDone.classList.remove('in');
      updateIdleStatus();
      setTimeout(() => taskDisplay.click(), 80);
    }, 1600);
  }
});

// ─── IPC: check events ────────────────────────────────────────────────────────
api.onChecking(() => {
  setStatus('checking', 'checking…');
  ringChecking();
});

api.onCheckResult((data) => {
  const { onTask, reason, offTaskCount, offTaskThreshold, nextCheckAt: nca, taskStartedAt: tsa } = data;

  if (onTask) {
    setStatus('on', 'on task');
    document.body.classList.remove('off-task');
    correctBtn.classList.remove('noted');
    correctBtn.textContent = 'actually this is fine';
  } else {
    const strike = `${offTaskCount}/${offTaskThreshold}`;
    setStatus('off', offTaskCount >= offTaskThreshold ? `off task ${strike} — alert sent` : `off task ${strike}`);
    document.body.classList.add('off-task');
    correctBtn.classList.remove('noted');
    correctBtn.textContent = 'actually this is fine';
  }

  reasonRow.textContent = reason || '';
  nextCheckAt = nca;
  if (tsa) taskStartedAt = tsa;
  ringDone();
  requestAnimationFrame(recalcExpandedHeight);
});

api.onError((msg) => {
  setStatus('off', 'error');
  reasonRow.textContent = msg;
  ringFill.classList.remove('checking');
  ringSetProgress(0);
  requestAnimationFrame(recalcExpandedHeight);
});

// ─── Tick ─────────────────────────────────────────────────────────────────────
function fmt(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
function fmtCost(n) { return n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`; }
function fmtNext(ms) {
  if (ms <= 0) return 'now';
  const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2,'0')}` : `${s}s`;
}

setInterval(() => {
  const elapsed = taskStartedAt ? fmt(Date.now() - taskStartedAt) : '';
  barTimer.textContent     = elapsed;
  timerLabel.textContent   = elapsed;
  nextCheckLbl.textContent = nextCheckAt ? fmtNext(nextCheckAt - Date.now()) : '';
}, 500);

// ─── Controls ─────────────────────────────────────────────────────────────────
pauseBtn.addEventListener('click', async () => {
  isPaused = await api.togglePause();
  pauseBtn.textContent = isPaused ? '▶' : '⏸';
  if (isPaused) { setStatus('', 'paused'); nextCheckAt = null; cancelAnimationFrame(ringAnimFrame); ringSetProgress(0); }
  else if (document.body.classList.contains('has-task')) ringStartFill(intervalSeconds * 1000);
});
document.getElementById('check-now-btn').addEventListener('click', () => api.runCheckNow());
correctBtn.addEventListener('click', async () => {
  const reason = reasonRow.textContent.trim();
  if (!reason) return;
  await api.addException(reason);
  correctBtn.textContent = 'noted ✓';
  correctBtn.classList.add('noted');
  document.body.classList.remove('off-task');
  setStatus('on', 'on task');
});
document.getElementById('close-btn').addEventListener('click',     () => api.closeWindow());

// ─── Settings ─────────────────────────────────────────────────────────────────
document.getElementById('settings-btn').addEventListener('click', () => openOverlay('settings-panel'));
document.getElementById('settings-close-btn').addEventListener('click', closeOverlay);
document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const rawKey  = document.getElementById('s-apikey').value.trim();
  const rawEl   = document.getElementById('s-elevenlabs').value.trim();
  const settings = {
    intervalSeconds: parseInt(document.getElementById('s-interval').value, 10),
    focusMode:       document.getElementById('s-strict').checked ? 'all' : 'any',
    autoDelete:      document.getElementById('s-autodelete').checked,
  };
  if (rawKey) settings.apiKey = rawKey;
  if (rawEl)  settings.elevenlabsApiKey = rawEl;
  await api.saveSettings(settings);
  if (rawKey && window._state) window._state.apiKey = rawKey;
  if (settings.intervalSeconds) intervalSeconds = settings.intervalSeconds;
  const btn = document.getElementById('settings-save-btn');
  btn.textContent = 'saved ✓';
  setTimeout(() => { btn.textContent = 'save'; closeOverlay(); updateIdleStatus(); }, 700);
});

// ─── Queue ────────────────────────────────────────────────────────────────────
let queueItems = [];

function renderQueue(currentTask) {
  const list = document.getElementById('queue-list');
  let html = '';

  // Current task at top
  if (currentTask) {
    html += `<div class="list-item list-current">
      <span class="list-text">${currentTask}</span>
      <span class="list-badge">now</span>
    </div>`;
  }

  if (!queueItems.length) {
    html += '<div class="list-empty">queue is empty</div>';
  } else {
    html += queueItems.map((t, i) => `
      <div class="list-item">
        <span class="list-num">${i + 1}</span>
        <span class="list-text">${t}</span>
        <button class="list-remove ctrl-btn" data-i="${i}">✕</button>
      </div>
    `).join('');
  }

  list.innerHTML = html;
  list.querySelectorAll('.list-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      queueItems.splice(parseInt(btn.dataset.i), 1);
      await api.saveQueue(queueItems);
      renderQueue(currentTask);
      // Re-measure overlay height
      requestAnimationFrame(() => {
        api.setHeight(document.getElementById('queue-panel').offsetHeight);
      });
    });
  });
}

async function addToQueue() {
  const input = document.getElementById('queue-input');
  const val = input.value.trim();
  if (!val) return;
  queueItems.push(val);
  await api.saveQueue(queueItems);
  input.value = '';
  const currentTask = taskDisplay.classList.contains('placeholder') ? null : taskDisplay.textContent;
  renderQueue(currentTask);
  requestAnimationFrame(() => {
    api.setHeight(document.getElementById('queue-panel').offsetHeight);
  });
}

document.getElementById('queue-btn').addEventListener('click', async () => {
  queueItems = await api.getQueue();
  const currentTask = taskDisplay.classList.contains('placeholder') ? null : taskDisplay.textContent;
  openOverlay('queue-panel', () => renderQueue(currentTask));
});
document.getElementById('queue-close-btn').addEventListener('click', closeOverlay);
document.getElementById('queue-add-btn').addEventListener('click', addToQueue);
document.getElementById('queue-input').addEventListener('keydown', e => { if (e.key === 'Enter') addToQueue(); });

// ─── History ──────────────────────────────────────────────────────────────────
document.getElementById('history-btn').addEventListener('click', async () => {
  const entries = await api.getHistory();
  openOverlay('history-panel', () => {
    const list = document.getElementById('history-list');
    if (!entries.length) {
      list.innerHTML = '<div class="list-empty">no completed tasks yet</div>';
      return;
    }
    list.innerHTML = entries.map(e => `
      <div class="list-item">
        <span class="list-text">${e.task}</span>
        <span class="list-meta">${fmt(e.duration)}</span>
      </div>
    `).join('');
  });
});
document.getElementById('history-close-btn').addEventListener('click', closeOverlay);

// ─── Stats ────────────────────────────────────────────────────────────────────
document.getElementById('info-btn').addEventListener('click', async () => {
  const stats = await api.getStats();
  openOverlay('info-panel', () => {
    const history  = stats.history || [];
    const total    = history.reduce((s, e) => s + e.duration, 0);
    const avg      = history.length ? total / history.length : 0;
    const longest  = history.reduce((b, e) => e.duration > (b?.duration || 0) ? e : b, null);
    document.getElementById('info-content').innerHTML = `
      <div class="info-grid">
        <div class="info-stat"><div class="info-val">${stats.totalChecks || 0}</div><div class="info-key">checks run</div></div>
        <div class="info-stat"><div class="info-val">${fmtCost(stats.totalCostUsd || 0)}</div><div class="info-key">api cost</div></div>
        <div class="info-stat"><div class="info-val">${history.length}</div><div class="info-key">tasks done</div></div>
        <div class="info-stat"><div class="info-val">${total ? fmt(total) : '—'}</div><div class="info-key">focus time</div></div>
        <div class="info-stat"><div class="info-val">${avg ? fmt(avg) : '—'}</div><div class="info-key">avg duration</div></div>
        <div class="info-stat"><div class="info-val">${stats.streak || 0}</div><div class="info-key">streak</div></div>
      </div>
      ${longest ? `<div class="info-longest">
        <div class="info-key">longest session</div>
        <div class="info-longest-task">${longest.task}</div>
        <div class="info-longest-dur">${fmt(longest.duration)}</div>
      </div>` : ''}
    `;
  });
});
document.getElementById('info-close-btn').addEventListener('click', closeOverlay);

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const s = await api.getState();
  window._state = s;

  H_COLLAPSED     = s.H_COLLAPSED;
  H_EXPANDED      = s.H_EXPANDED;
  intervalSeconds = s.intervalSeconds || 30;

  if (s.task) {
    taskDisplay.textContent = s.task;
    taskDisplay.classList.remove('placeholder');
    document.body.classList.add('has-task');
  }

  isPaused      = s.paused;
  taskStartedAt = s.taskStartedAt || null;
  nextCheckAt   = s.nextCheckAt   || null;
  pauseBtn.textContent = isPaused ? '▶' : '⏸';

  // Start ring fill if active
  if (taskStartedAt && !isPaused && nextCheckAt) {
    const remaining = nextCheckAt - Date.now();
    if (remaining > 0) ringStartFill(remaining);
  }

  if (s.apiKey)           document.getElementById('s-apikey').value      = s.apiKey;
  if (s.elevenlabsApiKey) document.getElementById('s-elevenlabs').value  = s.elevenlabsApiKey;
  document.getElementById('s-interval').value     = s.intervalSeconds || 30;
  document.getElementById('s-strict').checked     = s.focusMode === 'all';
  document.getElementById('s-autodelete').checked = s.autoDelete !== false;

  updateIdleStatus();
}

init();
