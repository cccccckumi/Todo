import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage, nativeTheme, screen, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { TaskStore } from './store.js';
import { AIConfig } from './ai-config.js';
import { floatingLayout, clampAnchor, roundedRegion, containsPoint } from './geometry.js';
import { makeBackup, parseTasksBackup } from '../shared/tasks.js';
import { extractTasks } from '../shared/ai.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const devUrl = !app.isPackaged ? process.env.TODO_DEV_URL : null;
// 测试只能在非打包运行时使用独立数据目录，绝不触碰真实清单。
const automation = process.env.NODE_ENV === 'test' && Boolean(process.env.TODO_TEST_DATA_DIR);
if (automation) app.setPath('userData', resolve(process.env.TODO_TEST_DATA_DIR));
app.setName('AI Todo');
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();

let mainWindow, floatingWindow, tray, trayMenu, store, aiConfig;
let quitting = false;
let layout, anchor, expanded = false, collapseTimer, fallbackTimer, dragging;
let outsideSince = 0, automationCursor = null;
let nativeDialogOpen = false;

function reportError(error) {
  dialog.showErrorBox('AI Todo', error instanceof Error ? error.message : String(error));
}

function trusted(event, role = 'either') {
  const sender = event.sender;
  const allowed = role === 'main' ? [mainWindow] : role === 'floating' ? [floatingWindow] : [mainWindow, floatingWindow];
  if (!allowed.some((window) => window && !window.isDestroyed() && window.webContents === sender)) throw new Error('该窗口无权执行此操作。');
  const url = event.senderFrame?.url ?? '';
  if (devUrl ? new URL(url).origin !== new URL(devUrl).origin : url.split('#')[0] !== pathToFileURL(join(root, 'dist/index.html')).href) {
    throw new Error('不受信任的页面来源。');
  }
}

function handle(channel, callback, role = 'either') {
  ipcMain.handle(channel, async (event, ...args) => {
    try { trusted(event, role); return { ok: true, value: await callback(...args) }; }
    catch (error) { return { ok: false, error: error.message || '操作失败，请重试。' }; }
  });
}

function broadcast() {
  const state = store.snapshot();
  for (const window of [mainWindow, floatingWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('tasks:changed', state);
  }
}

function windowOptions() {
  return {
    icon: join(root, 'build/icon.png'),
    webPreferences: { preload: join(root, 'electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  };
}

function loadWindow(window, hash) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting && details.reason !== 'clean-exit') reportError(new Error('窗口进程意外退出。请从托盘退出后重新启动，已保存的任务仍在本机。'));
  });
  if (devUrl) return window.loadURL(`${devUrl}#${hash}`);
  return window.loadFile(join(root, 'dist/index.html'), { hash });
}

function applyFloatingLayout() {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  const work = screen.getDisplayNearestPoint({ x: anchor.x + 34, y: anchor.y + 34 }).workArea;
  anchor = clampAnchor(anchor, work);
  layout = floatingLayout(anchor, work, expanded);
  floatingWindow.setBounds(layout.bounds, false);
  if (process.platform === 'win32' || process.platform === 'linux') {
    const regions = roundedRegion(layout.ball, 26);
    if (layout.panel) regions.push(...roundedRegion(layout.panel, 15), layout.bridge);
    floatingWindow.setShape(regions);
  }
  floatingWindow.webContents.send('floating:layout-changed', layout);
}

function setExpanded(value) {
  clearTimeout(collapseTimer);
  if (dragging) return;
  expanded = Boolean(value);
  outsideSince = 0;
  applyFloatingLayout();
}

function updateFloatingVisibility() {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  const visible = store.snapshot().preferences.floatingVisible && !mainWindow?.isFocused() && !nativeDialogOpen;
  if (visible) floatingWindow.showInactive();
  else { setExpanded(false); floatingWindow.hide(); }
}

function openMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  setExpanded(false);
  floatingWindow?.hide();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function persistAnchor() {
  store.setPreferences({ floatingPosition: anchor });
}

function setFloatingVisible(visible) {
  if (typeof visible !== 'boolean') throw new Error('悬浮球状态无效。');
  store.setPreferences({ floatingVisible: visible });
  updateTray();
  updateFloatingVisibility();
  broadcast();
}

function quitApplication() {
  quitting = true;
  clearTimeout(collapseTimer);
  clearInterval(fallbackTimer);
  tray?.destroy();
  tray = null;
  app.quit();
}

function updateTray() {
  trayMenu = Menu.buildFromTemplate([
    { label: '打开 AI Todo', click: openMain },
    { label: '显示悬浮球', type: 'checkbox', checked: store.snapshot().preferences.floatingVisible, click: (item) => { try { setFloatingVisible(item.checked); } catch (error) { reportError(error); } } },
    { label: '重置悬浮球位置', click: () => {
      try {
        const work = screen.getPrimaryDisplay().workArea;
        anchor = { x: work.x + work.width - 84, y: work.y + Math.round(work.height * 0.35) };
        setExpanded(false); persistAnchor();
      } catch (error) { reportError(error); }
    } },
    { type: 'separator' },
    { label: '打开数据文件夹', click: () => { shell.openPath(app.getPath('userData')).then((error) => { if (error) reportError(new Error(error)); }); } },
    { type: 'separator' },
    { label: '完全退出', click: quitApplication },
  ]);
  tray?.setContextMenu(trayMenu);
}

function registerIPC() {
  handle('tasks:get', () => store.snapshot());
  handle('tasks:mutate', (command) => {
    const state = store.mutate(command); broadcast(); return state;
  });
  handle('tasks:export', async () => {
    let result;
    nativeDialogOpen = true; updateFloatingVisibility();
    try { result = await dialog.showSaveDialog(mainWindow, { title: '导出全部任务', defaultPath: `AI-Todo-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'Todo 备份', extensions: ['json'] }] }); }
    finally { nativeDialogOpen = false; updateFloatingVisibility(); }
    if (result.canceled) return null;
    writeFileSync(result.filePath, JSON.stringify(makeBackup(store.snapshot().tasks), null, 2), 'utf8');
    return true;
  }, 'main');
  handle('tasks:import', async () => {
    let result;
    nativeDialogOpen = true; updateFloatingVisibility();
    try { result = await dialog.showOpenDialog(mainWindow, { title: '合并导入任务（现有相同 ID 的任务保留）', properties: ['openFile'], filters: [{ name: 'Todo 备份', extensions: ['json'] }] }); }
    finally { nativeDialogOpen = false; updateFloatingVisibility(); }
    if (result.canceled) return null;
    const incoming = parseTasksBackup(JSON.parse(readFileSync(result.filePaths[0], 'utf8')));
    const imported = store.importTasks(incoming); broadcast(); return imported;
  }, 'main');
  handle('ai:config', () => aiConfig.publicConfig(), 'main');
  handle('ai:save-config', (config) => aiConfig.save(config), 'main');
  handle('ai:extract', (text) => extractTasks({ ...aiConfig.credentials(), text }), 'main');
  handle('window:open-main', openMain);
  handle('floating:visible', setFloatingVisible, 'main');
  handle('floating:layout', () => layout, 'floating');
  handle('floating:drag-end', (cancelled = false) => {
    if (!dragging) return false;
    const moved = dragging?.moved ?? false;
    dragging = null;
    if (moved) { persistAnchor(); setExpanded(false); }
    else if (!cancelled) openMain();
    return moved;
  }, 'floating');

  ipcMain.on('floating:hover', (event, inside) => {
    trusted(event, 'floating');
    if (inside) setExpanded(true);
    else { clearTimeout(collapseTimer); collapseTimer = setTimeout(() => setExpanded(false), 280); }
  });
  ipcMain.on('floating:drag-start', (event, point) => {
    trusted(event, 'floating');
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    clearTimeout(collapseTimer);
    dragging = { point, anchor: { ...anchor }, moved: false };
  });
  ipcMain.on('floating:drag-move', (event, point) => {
    trusted(event, 'floating');
    if (!dragging || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const dx = point.x - dragging.point.x, dy = point.y - dragging.point.y;
    if (Math.hypot(dx, dy) > 5) dragging.moved = true;
    if (dragging.moved) { anchor = { x: dragging.anchor.x + dx, y: dragging.anchor.y + dy }; applyFloatingLayout(); }
  });
  ipcMain.on('floating:menu', (event) => { trusted(event, 'floating'); tray?.popUpContextMenu(trayMenu); });
}

async function initialize() {
  if (!ownsInstance) return;
  // 界面始终为浅色：在创建窗口前固定原生主题，避免 Windows 深色标题栏。
  if (process.platform === 'win32') nativeTheme.themeSource = 'light';
  app.setAppUserModelId('com.aitodo.desktop');
  try {
    store = new TaskStore(join(app.getPath('userData'), 'todo-data.json'));
    aiConfig = new AIConfig(join(app.getPath('userData'), 'ai-config.json'), app.isPackaged || automation ? null : join(root, '.env'));
  } catch (error) {
    dialog.showErrorBox('无法加载本地数据', `${error.message}\n\n原数据没有被覆盖。请在 ${app.getPath('userData')} 检查 todo-data.json 及 .bak 备份。`);
    return quitApplication();
  }
  mainWindow = new BrowserWindow({
    ...windowOptions(), width: 1080, height: 760, minWidth: 780, minHeight: 560,
    show: false, backgroundColor: '#ffffff', title: 'AI Todo', autoHideMenuBar: true,
    frame: true, titleBarStyle: 'default',
    ...(process.platform === 'win32' ? { accentColor: false } : {}),
  });
  mainWindow.setMenu(null);
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault(); mainWindow.hide(); updateFloatingVisibility();
  });
  mainWindow.on('focus', updateFloatingVisibility);
  mainWindow.on('blur', () => setTimeout(updateFloatingVisibility, 80));
  mainWindow.on('minimize', () => setTimeout(updateFloatingVisibility, 80));
  const work = screen.getPrimaryDisplay().workArea;
  anchor = store.snapshot().preferences.floatingPosition ?? { x: work.x + work.width - 84, y: work.y + Math.round(work.height * 0.35) };
  floatingWindow = new BrowserWindow({ ...windowOptions(), width: 68, height: 68, show: false, frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, hasShadow: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#00000000', title: 'AI Todo 悬浮球' });
  floatingWindow.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWindow.on('close', (event) => { if (!quitting) { event.preventDefault(); setFloatingVisible(false); } });
  tray = new Tray(nativeImage.createFromPath(join(root, 'build/icon.png')).resize({ width: 20, height: 20 }));
  tray.setToolTip('AI Todo · 点击打开清单');
  tray.on('click', openMain);
  tray.on('double-click', openMain);
  updateTray();
  if (automation) app.todoAutomation = {
    getTray: () => tray, getTrayMenu: () => trayMenu, getLayout: () => layout,
    // CDP 鼠标输入不移动系统指针；桌面测试为同一套命中判断提供独立坐标。
    setCursor: (point) => { automationCursor = point; },
  };
  registerIPC();
  await Promise.all([loadWindow(mainWindow, 'main'), loadWindow(floatingWindow, 'floating')]);
  applyFloatingLayout();
  updateFloatingVisibility();
  // 原生指针检查弥补透明窗口 mouseleave 丢失；不会在球到面板的移动通道内收起。
  fallbackTimer = setInterval(() => {
    if (!floatingWindow?.isVisible() || !layout || dragging) { outsideSince = 0; return; }
    const cursor = (automation && automationCursor) || screen.getCursorScreenPoint();
    const x = cursor.x - layout.bounds.x, y = cursor.y - layout.bounds.y;
    const active = [layout.ball, layout.panel, layout.bridge].some((rect) => containsPoint(rect, x, y));
    if (process.platform === 'darwin') floatingWindow.setIgnoreMouseEvents(!active, { forward: true });
    if (!expanded || active) outsideSince = 0;
    else if (!outsideSince) outsideSince = Date.now();
    else if (Date.now() - outsideSince >= 280) setExpanded(false);
  }, 70);
  const reposition = () => { setExpanded(false); updateFloatingVisibility(); };
  screen.on('display-metrics-changed', reposition);
  screen.on('display-removed', reposition);
  // 首次启动让用户看见迁移入口；之后启动直接保留悬浮球。
  if (!store.snapshot().preferences.hasLaunched) {
    store.setPreferences({ hasLaunched: true });
    openMain();
  }
}

app.on('second-instance', openMain);
app.on('activate', openMain);
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; clearTimeout(collapseTimer); clearInterval(fallbackTimer); tray?.destroy(); tray = null; });
app.whenReady().then(initialize).catch((error) => { reportError(error); quitApplication(); });
