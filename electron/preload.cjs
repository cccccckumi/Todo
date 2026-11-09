const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// 仅暴露固定操作，不把 Node、文件路径读取或任意 IPC 能力交给网页。
contextBridge.exposeInMainWorld('desktopTodo', {
  getState: () => ipcRenderer.invoke('tasks:get'),
  mutate: (command) => ipcRenderer.invoke('tasks:mutate', command),
  onState: (callback) => subscribe('tasks:changed', callback),
  importTasks: () => ipcRenderer.invoke('tasks:import'),
  exportTasks: () => ipcRenderer.invoke('tasks:export'),
  getConfig: () => ipcRenderer.invoke('ai:config'),
  saveConfig: (config) => ipcRenderer.invoke('ai:save-config', config),
  extract: (text) => ipcRenderer.invoke('ai:extract', text),
  openMain: () => ipcRenderer.invoke('window:open-main'),
  showFloating: (visible) => ipcRenderer.invoke('floating:visible', visible),
  getLayout: () => ipcRenderer.invoke('floating:layout'),
  onLayout: (callback) => subscribe('floating:layout-changed', callback),
  hover: (inside) => ipcRenderer.send('floating:hover', inside),
  dragStart: (point) => ipcRenderer.send('floating:drag-start', point),
  dragMove: (point) => ipcRenderer.send('floating:drag-move', point),
  dragEnd: (cancelled = false) => ipcRenderer.invoke('floating:drag-end', cancelled),
  floatingMenu: () => ipcRenderer.send('floating:menu'),
});
