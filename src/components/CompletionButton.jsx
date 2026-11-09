import { useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useTaskMotion.js';
import { TASK_FEEDBACK_MS } from '../utils/task-motion.js';

export default function CompletionButton({ task, onToggle, motion = '', className = 'task-check', label, disabled = false }) {
  const reduced = useReducedMotion();
  const pending = useRef(false);
  const lockedUntil = useRef(0);
  const [busy, setBusy] = useState(false);
  const locked = busy || Boolean(motion);
  async function toggle(event) {
    if (disabled || pending.current || motion || event.detail > 1 || performance.now() < lockedUntil.current) return;
    pending.current = true; setBusy(true);
    try {
      // 立即发出保存请求。反馈只在主进程确认的数据变化后播放，不乐观翻转状态。
      const saved = await onToggle(task.id);
      if (saved !== false && !reduced) lockedUntil.current = performance.now() + TASK_FEEDBACK_MS;
    } finally { pending.current = false; setBusy(false); }
  }
  return (
    <button type="button" className={`${className} completion-button${motion === 'completing' ? ' is-drawing' : ''}`}
      data-row-action={disabled ? undefined : true} aria-label={label ?? (task.completed ? `标记为未完成：${task.title}` : `标记为已完成：${task.title}`)}
      aria-pressed={task.completed} aria-busy={busy || undefined} aria-disabled={locked || disabled || undefined}
      disabled={disabled} onClick={toggle}>
      {task.completed && <svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path className="completion-tick" pathLength="1" d="m4.5 10.3 3.6 3.5 7.4-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}
