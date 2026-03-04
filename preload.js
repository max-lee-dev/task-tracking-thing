const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskAPI', {
  getState:      ()          => ipcRenderer.invoke('get-state'),
  setTask:       (task)      => ipcRenderer.invoke('set-task', task),
  completeTask:  ()          => ipcRenderer.invoke('complete-task'),
  saveSettings:  (settings)  => ipcRenderer.invoke('save-settings', settings),
  togglePause:   ()          => ipcRenderer.invoke('toggle-pause'),
  runCheckNow:   ()          => ipcRenderer.invoke('run-check-now'),
  closeWindow:   ()          => ipcRenderer.send('close-window'),
  setHeight:     (h)         => ipcRenderer.send('set-height', h),

  addException:  (reason)    => ipcRenderer.invoke('add-exception', reason),
  getQueue:      ()          => ipcRenderer.invoke('get-queue'),
  saveQueue:     (items)     => ipcRenderer.invoke('save-queue', items),
  getHistory:    ()          => ipcRenderer.invoke('get-history'),
  getStats:      ()          => ipcRenderer.invoke('get-stats'),

  onChecking:    (cb) => ipcRenderer.on('checking',     (_e)     => cb()),
  onCheckResult: (cb) => ipcRenderer.on('check-result', (_e, d)  => cb(d)),
  onError:       (cb) => ipcRenderer.on('error',        (_e, m)  => cb(m)),
  onTaskComplete:(cb) => ipcRenderer.on('task-complete', (_e, d)  => cb(d)),
  onMouseEnter:  (cb) => ipcRenderer.on('mouse-enter',  (_e)     => cb()),
  onMouseLeave:  (cb) => ipcRenderer.on('mouse-leave',  (_e)     => cb()),
});
