import { useEffect, useRef, useState } from 'react';
import { taskClient, unwrap } from '../services/client.js';
import { formatDueDate } from '../utils/dates.js';
import { useTaskMotion, useTaskRowFocus } from '../hooks/useTaskMotion.js';
import CompletionButton from './CompletionButton.jsx';
import AnimatedCount from './AnimatedCount.jsx';

function PreviewRow({ row, onToggle }) {
  const { task, motion, leaving } = row;
  const ref = useRef(null);
  useTaskRowFocus(ref, leaving);
  return (
    <li ref={ref} data-task-row data-task-id={task.id} data-leaving={leaving} className={`preview-row${task.completed ? ' is-complete' : ''}${leaving ? ' is-leaving' : ''}${motion ? ` motion-${motion}` : ''}`}>
      <div className="row-clip"><div className="preview-row-content">
        <CompletionButton className="preview-check" task={task} motion={motion} label={`${task.completed ? '已完成' : '完成'}：${task.title}`} onToggle={onToggle} />
        <div className="preview-copy"><p>{task.title}</p><span>{task.dueDate ? formatDueDate(task.dueDate) : task.category}</span></div>
        <span className={`priority-dot priority-${task.priority}`} aria-label={{ high: '高优先级', medium: '中优先级', low: '低优先级' }[task.priority]} role="img" />
      </div></div>
    </li>
  );
}

export default function FloatingApp() {
  const [tasks, setTasks] = useState([]);
  const [layout, setLayout] = useState({ ball: { x: 8, y: 8, width: 52, height: 52 }, expanded: false });
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const pointerDown = useRef(false);
  useEffect(() => {
    const fail = (problem) => setError(problem.message);
    const unsubscribe = taskClient.subscribe((state) => setTasks(state.tasks));
    const unsubscribeLayout = window.desktopTodo.onLayout(setLayout);
    taskClient.getState().then((state) => setTasks(state.tasks)).catch(fail);
    unwrap(window.desktopTodo.getLayout()).then((value) => { if (value) setLayout(value); }).catch(fail);
    return () => { unsubscribe(); unsubscribeLayout(); };
  }, []);
  const pending = tasks.filter((task) => !task.completed && !task.deleted).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const rows = useTaskMotion(tasks, pending.slice(0, 30), 'floating-preview', () => 'preview');
  const openMain = () => unwrap(window.desktopTodo.openMain()).catch((problem) => setError(problem.message));
  async function toggle(id) {
    try {
      const state = await taskClient.mutate({ type: 'toggle', id });
      const task = state.tasks.find((item) => item.id === id);
      setError(''); setAnnouncement(`已完成：${task?.title.slice(0, 80) ?? '任务'}`); return true;
    } catch (problem) { setError(problem.message); return false; }
  }
  return (
    <main className="floating-root" onMouseEnter={() => window.desktopTodo.hover(true)} onMouseLeave={() => window.desktopTodo.hover(false)}>
      <button className="floating-ball" style={{ left: layout.ball.x, top: layout.ball.y }} aria-label={`打开 AI Todo，${pending.length} 项待办`} title="拖动移动 · 点击打开清单"
        onContextMenu={(event) => { event.preventDefault(); window.desktopTodo.floatingMenu(); }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointerDown.current = true; event.currentTarget.setPointerCapture(event.pointerId);
          window.desktopTodo.dragStart({ x: event.screenX, y: event.screenY });
        }}
        onPointerMove={(event) => { if (pointerDown.current) window.desktopTodo.dragMove({ x: event.screenX, y: event.screenY }); }}
        onPointerUp={async (event) => {
          if (!pointerDown.current) return;
          pointerDown.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          try { await unwrap(window.desktopTodo.dragEnd()); } catch (problem) { setError(problem.message); }
        }}
        onLostPointerCapture={() => {
          if (!pointerDown.current) return;
          pointerDown.current = false;
          unwrap(window.desktopTodo.dragEnd(true)).catch((problem) => setError(problem.message));
        }}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMain(); } }}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6.5 12.4 3.7 3.7 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {pending.length > 0 && <AnimatedCount className="floating-count" value={pending.length} displayValue={pending.length > 99 ? '99+' : pending.length} suffix="项待办" />}
      </button>
      {layout.expanded && layout.panel && (
        <section className="floating-panel" data-task-scope style={{ left: layout.panel.x, top: layout.panel.y, width: layout.panel.width, height: layout.panel.height }} aria-label="悬浮待办预览">
          <header><h1>待办</h1><AnimatedCount className="preview-count" value={pending.length} suffix="项待办" /></header>
          {error && <p className="error-message" role="alert">{error}</p>}
          <ul className="floating-tasks">{rows.map((row) => <PreviewRow key={row.task.id} row={row} onToggle={toggle} />)}</ul>
          {!rows.length && <p className="preview-empty">暂时没有待办</p>}
          <p className="sr-only" role="status">{announcement}</p>
          <button className="preview-open" onClick={openMain}>打开完整清单 <span aria-hidden="true">↗</span></button>
        </section>
      )}
    </main>
  );
}
