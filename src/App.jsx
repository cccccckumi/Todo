import { useEffect, useRef, useState } from 'react';
import ReminderSidebar from './components/ReminderSidebar.jsx';
import TodoList from './components/TodoList.jsx';
import AISettings from './components/AISettings.jsx';
import { taskClient, isDesktop, unwrap } from './services/client.js';
import { FIXED_CATEGORIES } from '../shared/tasks.js';

export default function App() {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeList, setActiveList] = useState({ type: 'incomplete', category: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timer = useRef(null);
  const tasks = state?.tasks ?? [];
  const customCategories = [...new Set(tasks.map((task) => task.category))].filter((name) => !FIXED_CATEGORIES.includes(name));

  useEffect(() => {
    const unsubscribe = taskClient.subscribe(setState, (problem) => setError(`同步任务失败：${problem.message}`));
    taskClient.getState().then(setState).catch((problem) => setError(`读取任务失败：${problem.message}。原数据未被覆盖。`));
    return () => { unsubscribe(); clearTimeout(timer.current); };
  }, []);
  function notify(text) {
    clearTimeout(timer.current); setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 2600);
  }
  async function mutate(command, text) {
    try { setState(await taskClient.mutate(command)); setError(''); notify(text); return true; }
    catch (problem) { setError(`未保存：${problem.message}`); return false; }
  }
  const saveTask = (task) => mutate(task.id ? { type: 'update', id: task.id, task } : { type: 'add', task }, task.id ? '已更新' : '已添加');
  const addMany = (values) => mutate({ type: 'add', tasks: values }, `已添加 ${values.length} 项任务`);
  async function importTasks() {
    try { const result = await taskClient.importTasks(); if (result) { setState(await taskClient.getState()); setError(''); notify(`已导入 ${result.added} 项，跳过 ${result.skipped} 项相同 ID 的任务`); } }
    catch (problem) { setError(`导入失败：${problem.message}`); }
  }
  async function exportTasks() {
    try { if (await taskClient.exportTasks()) { setError(''); notify('已导出全部任务（含已完成和已删除）'); } }
    catch (problem) { setError(`导出失败：${problem.message}`); }
  }
  async function toggleFloating() {
    try { await unwrap(window.desktopTodo.showFloating(!state?.preferences.floatingVisible)); }
    catch (problem) { setError(problem.message); }
  }
  return (
    <main className="app-shell">
      <div className="sidebar-shell">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✓</span><span>AI Todo</span></div>
        <ReminderSidebar tasks={tasks} activeList={activeList} onSelect={setActiveList} />
        <div className="sidebar-bottom"><span className="local-indicator" />本地保存<span className="version">桌面清单</span></div>
      </div>
      <section className="workspace">
        <header className="app-toolbar">
          <span className="toolbar-date">{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())}</span>
          <div className="toolbar-actions">
            <button type="button" onClick={importTasks}>导入</button>
            <button type="button" onClick={exportTasks} disabled={!state}>导出</button>
            {isDesktop && <><button type="button" onClick={toggleFloating} aria-pressed={state?.preferences.floatingVisible}>悬浮球</button><button type="button" onClick={() => setSettingsOpen(true)}>AI 设置</button></>}
          </div>
        </header>
        <div className="workspace-content">
          {error && <div className="error-banner" role="alert"><p>{error}</p><button type="button" onClick={() => setError('')}>关闭提示</button></div>}
          {state && !tasks.length && <div className="migration-note">已有网页版任务？在原浏览器打开旧地址并导出 JSON，再到这里导入。<button type="button" onClick={importTasks}>导入备份</button></div>}
          {!state ? <p role="status">{error ? '请先处理数据读取问题后重新启动。' : '正在读取任务…'}</p> : <TodoList
            tasks={tasks} activeList={activeList} onSave={saveTask} onAddMany={addMany}
            onToggle={(id) => {
              const task = tasks.find((item) => item.id === id);
              return mutate({ type: 'toggle', id }, `${task?.completed ? '已设为未完成' : '已完成'}：${task?.title.slice(0, 80) ?? '任务'}`);
            }}
            onDelete={(task) => mutate({ type: 'delete', id: task.id }, '已移到已删除')}
            onRestore={(id) => mutate({ type: 'restore', id }, '已恢复')}
            customCategories={customCategories} message={message}
          />}
        </div>
      </section>
      {settingsOpen && <AISettings onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}
