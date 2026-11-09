import { STORAGE_KEY, parseTasksBackup, applyTaskCommand, mergeTasks, makeBackup } from '../../shared/tasks.js';

export const isDesktop = Boolean(window.desktopTodo);
export async function unwrap(promise) {
  const result = await promise;
  if (!result?.ok) throw new Error(result?.error || '操作失败，请重试。');
  return result.value;
}
const listeners = new Set();
function browserState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return { tasks: raw ? parseTasksBackup(JSON.parse(raw)) : [], preferences: {} };
}
function writeBrowserTasks(tasks) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  const state = browserState();
  for (const listener of listeners) listener(state);
  return state;
}
export const taskClient = {
  getState: async () => isDesktop ? unwrap(window.desktopTodo.getState()) : browserState(),
  subscribe(callback, onError = () => {}) {
    if (isDesktop) return window.desktopTodo.onState(callback);
    listeners.add(callback);
    const onStorage = (event) => { if (event.key === STORAGE_KEY) { try { callback(browserState()); } catch (error) { onError(error); } } };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(callback); window.removeEventListener('storage', onStorage); };
  },
  async mutate(command) {
    if (isDesktop) return unwrap(window.desktopTodo.mutate(command));
    return writeBrowserTasks(applyTaskCommand(browserState().tasks, command));
  },
  async exportTasks() {
    if (isDesktop) return unwrap(window.desktopTodo.exportTasks());
    const blob = new Blob([JSON.stringify(makeBackup(browserState().tasks), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `AI-Todo-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
  },
  async importTasks() {
    if (isDesktop) return unwrap(window.desktopTodo.importTasks());
    return new Promise((resolveImport, rejectImport) => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
      input.addEventListener('cancel', () => resolveImport(null), { once: true });
      input.addEventListener('change', async () => {
        try {
          if (!input.files?.[0]) return resolveImport(null);
          const tasks = parseTasksBackup(JSON.parse(await input.files[0].text()));
          const result = mergeTasks(browserState().tasks, tasks); writeBrowserTasks(result.tasks);
          resolveImport({ added: result.added, skipped: result.skipped });
        } catch (error) { rejectImport(error); }
      }, { once: true }); input.click();
    });
  },
};
export async function extractNotification(text) {
  if (isDesktop) return unwrap(window.desktopTodo.extract(text));
  const response = await fetch('/api/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  let result;
  try { result = await response.json(); } catch { throw new Error('AI 服务未连接，请启动 npm run server。'); }
  if (!response.ok) throw new Error(result.error || 'AI 提取失败。');
  return result;
}
