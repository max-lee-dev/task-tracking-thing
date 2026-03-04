const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const { options }                        = require('./src/options');
const { initGemini, checkOnTask }        = require('./src/gemini');
const { takeScreenshot }                 = require('./src/screenshot');
const { alertOffTask }                   = require('./src/notify');
const { initConfig, loadConfig, saveConfig, saveApiKey } = require('./src/config');

const W_DEFAULT   = 320;
const W_MIN       = 280;
const H_COLLAPSED = 52;
const H_EXPANDED  = 160; // fallback; renderer recalculates dynamically

let win            = null;
let intervalHandle = null;
let isChecking     = false;
let nextCheckAt    = null;
let taskStartedAt  = null;

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: W_DEFAULT, height: H_COLLAPSED,
    minWidth: W_MIN, minHeight: H_COLLAPSED,
    frame: false, transparent: true, alwaysOnTop: true, resizable: true,
    vibrancy: 'under-window', visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  const { screen } = require('electron');
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  win.setPosition(sw - W_DEFAULT - 20, 20);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ─── Check loop ───────────────────────────────────────────────────────────────

async function runCheck() {
  if (options.paused || isChecking || !options.task || !options.apiKey) return;
  isChecking = true;
  win.webContents.send('checking');

  try {
    const image = takeScreenshot(options.autoDelete);
    const { onTask, reason, insult, costUsd } = await checkOnTask(image, options.task, options.focusMode, options.exceptions);

    options.totalChecks++;
    options.lastCallCostUsd = costUsd;
    options.totalCostUsd   += costUsd;

    if (onTask) {
      options.offTaskCount = 0;
      options.onTaskStreak++;
    } else {
      options.offTaskCount++;
      options.onTaskStreak = 0;
      if (options.offTaskCount >= options.offTaskThreshold) {
        alertOffTask(insult, options.elevenlabsApiKey);
      }
    }

    nextCheckAt = Date.now() + options.intervalSeconds * 1000;
    win.webContents.send('check-result', {
      onTask, reason, insult,
      streak:          options.onTaskStreak,
      offTaskCount:    options.offTaskCount,
      offTaskThreshold: options.offTaskThreshold,
      totalChecks:     options.totalChecks,
      totalCostUsd:    options.totalCostUsd,
      nextCheckAt,
      taskStartedAt,
    });
  } catch (e) {
    win.webContents.send('error', e.message);
  }
  isChecking = false;
}

function startLoop() {
  clearInterval(intervalHandle);
  runCheck();
  intervalHandle = setInterval(runCheck, options.intervalSeconds * 1000);
}

function stopLoop() {
  clearInterval(intervalHandle);
  intervalHandle = null;
  nextCheckAt    = null;
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  initConfig(app.getPath('userData'));
  const config = loadConfig();

  if (config.apiKey)            { options.apiKey = config.apiKey; initGemini(options.apiKey); }
  if (config.elevenlabsApiKey)  options.elevenlabsApiKey = config.elevenlabsApiKey;
  if (config.task)              options.task            = config.task;
  if (config.intervalSeconds) options.intervalSeconds = config.intervalSeconds;
  if (config.focusMode)       options.focusMode       = config.focusMode;
  if (config.autoDelete !== undefined) options.autoDelete = config.autoDelete;
  if (config.task)            taskStartedAt = Date.now();

  createWindow();

  win.webContents.once('did-finish-load', () => {
    if (options.apiKey && options.task) startLoop();
  });

  // Cursor polling — expand only from bottom strip of bar; top bar stays drag-only
  const EXPAND_TRIGGER_PX = 16; // px from bottom of bar that trigger expansion
  let wasExpandActive = false;
  setInterval(() => {
    if (!win) return;
    const { screen: s }           = require('electron');
    const cursor                  = s.getCursorScreenPoint();
    const { x, y }                = win.getBounds();
    const [winW, winH]            = win.getSize();
    const isOverWindow = cursor.x >= x && cursor.x <= x + winW &&
                         cursor.y >= y && cursor.y <= y + winH;
    const isExpanded = winH > H_COLLAPSED;
    // When collapsed: only the bottom strip triggers expand.
    // When expanded: anywhere over the window keeps it open.
    const shouldExpand = isExpanded
      ? isOverWindow
      : isOverWindow && cursor.y >= y + H_COLLAPSED - EXPAND_TRIGGER_PX;
    if (shouldExpand !== wasExpandActive) {
      wasExpandActive = shouldExpand;
      win.webContents.send(shouldExpand ? 'mouse-enter' : 'mouse-leave');
    }
  }, 50);
});

app.on('window-all-closed', () => app.quit());

// ─── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.on('set-height', (_e, h) => {
  if (win) {
    const [currentW] = win.getSize();
    win.setSize(currentW, Math.max(h, H_COLLAPSED), true);
  }
});

ipcMain.handle('get-state', () => ({
  task:             options.task,
  apiKey:           options.apiKey,
  elevenlabsApiKey: options.elevenlabsApiKey,
  intervalSeconds:  options.intervalSeconds,
  focusMode:        options.focusMode,
  autoDelete:       options.autoDelete,
  paused:           options.paused,
  streak:           options.onTaskStreak,
  offTaskCount:     options.offTaskCount,
  offTaskThreshold: options.offTaskThreshold,
  totalChecks:      options.totalChecks,
  totalCostUsd:     options.totalCostUsd,
  nextCheckAt,
  taskStartedAt,
  H_COLLAPSED,
  H_EXPANDED,
}));

ipcMain.handle('set-task', (_e, task) => {
  options.task = task; options.onTaskStreak = 0; options.offTaskCount = 0;
  options.exceptions = [];
  taskStartedAt = Date.now();
  saveConfig({ ...loadConfig(), task });
  if (!options.paused && options.apiKey) startLoop();
});

ipcMain.handle('add-exception', (_e, reason) => {
  if (reason && !options.exceptions.includes(reason)) {
    options.exceptions.push(reason);
  }
  return options.exceptions;
});

ipcMain.handle('complete-task', () => {
  const cfg   = loadConfig();
  const queue = cfg.queue || [];
  const [nextTask, ...remaining] = queue;

  // Save to history
  if (options.task && taskStartedAt) {
    cfg.history = [{
      task:        options.task,
      startedAt:   taskStartedAt,
      completedAt: Date.now(),
      duration:    Date.now() - taskStartedAt,
    }, ...(cfg.history || [])].slice(0, 100);
  }

  stopLoop();
  options.task         = nextTask || '';
  options.onTaskStreak = 0;
  options.offTaskCount = 0;
  taskStartedAt        = nextTask ? Date.now() : null;
  nextCheckAt          = null;
  cfg.task             = options.task;
  cfg.queue            = remaining;
  saveConfig(cfg);

  if (nextTask && options.apiKey) {
    setTimeout(() => startLoop(), 2600);
  }

  win.webContents.send('task-complete', { nextTask: nextTask || null });
});

ipcMain.handle('save-settings', (_e, settings) => {
  if (settings.apiKey !== undefined) {
    options.apiKey = settings.apiKey;
    saveApiKey(settings.apiKey);
    if (options.apiKey) initGemini(options.apiKey);
  }
  if (settings.elevenlabsApiKey !== undefined) {
    options.elevenlabsApiKey = settings.elevenlabsApiKey;
    const cfg2 = loadConfig();
    saveConfig({ ...cfg2, elevenlabsApiKey: settings.elevenlabsApiKey });
  }
  const cfg = loadConfig();
  if (settings.intervalSeconds !== undefined) { options.intervalSeconds = settings.intervalSeconds; cfg.intervalSeconds = settings.intervalSeconds; }
  if (settings.focusMode       !== undefined) { options.focusMode       = settings.focusMode;       cfg.focusMode       = settings.focusMode; }
  if (settings.autoDelete      !== undefined) { options.autoDelete      = settings.autoDelete;      cfg.autoDelete      = settings.autoDelete; }
  saveConfig(cfg);
  if (!options.paused && options.apiKey && options.task) startLoop();
});

ipcMain.handle('toggle-pause', () => {
  options.paused = !options.paused;
  if (options.paused) stopLoop();
  else if (options.apiKey && options.task) startLoop();
  return options.paused;
});

ipcMain.handle('run-check-now', () => { if (options.apiKey && options.task) runCheck(); });

ipcMain.handle('get-queue',   ()          => loadConfig().queue   || []);
ipcMain.handle('save-queue',  (_e, items) => saveConfig({ ...loadConfig(), queue: items }));
ipcMain.handle('get-history', ()          => loadConfig().history || []);
ipcMain.handle('get-stats',   ()          => ({
  totalChecks:  options.totalChecks,
  totalCostUsd: options.totalCostUsd,
  streak:       options.onTaskStreak,
  intervalSeconds: options.intervalSeconds,
  history:      loadConfig().history || [],
}));

ipcMain.on('close-window', () => app.quit());
