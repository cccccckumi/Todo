import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { projectTaskRows } from '../utils/task-motion.js';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function useTaskMotion(tasks, visibleTasks, scope, groupForTask) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => !document.hidden);
  const previous = useRef(null);
  const [, refresh] = useState(0);
  // 在 React 比较 DOM 之前保留退出行，避免先消失再重新插入造成闪动。
  const presentation = projectTaskRows(previous.current, { tasks, visibleTasks, scope, groupForTask, reduced: reduced || !visible, now: performance.now() });
  useLayoutEffect(() => {
    previous.current = presentation;
    const expiry = Math.min(...[...presentation.transitions.values()].map((motion) => motion.until));
    if (!Number.isFinite(expiry)) return;
    const timer = window.setTimeout(() => refresh((value) => value + 1), Math.max(0, expiry - performance.now()));
    return () => window.clearTimeout(timer);
  }, [presentation]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return presentation.rows;
}

// 完成中的行即将移除时，把键盘焦点交给下一条可操作任务，不抢走已移到别处的焦点。
export function useTaskRowFocus(rowRef, leaving) {
  function successor(node) {
    const scope = node?.closest('[data-task-scope]');
    if (!scope) return null;
    const rows = [...scope.querySelectorAll('[data-task-row]')];
    const index = rows.indexOf(node);
    const candidates = [...rows.slice(index + 1), ...rows.slice(0, index).reverse()];
    return candidates.find((row) => row.dataset.leaving !== 'true')?.querySelector('[data-row-action]')
      ?? scope.querySelector('#quick-task, .preview-open') ?? scope.querySelector('[data-focus-fallback]');
  }
  useLayoutEffect(() => {
    const node = rowRef.current;
    if (leaving && document.hasFocus() && node?.contains(document.activeElement)) successor(node)?.focus({ preventScroll: true });
  }, [leaving]);
  useLayoutEffect(() => {
    const node = rowRef.current;
    return () => {
      if (!document.hasFocus() || !node?.contains(document.activeElement)) return;
      const target = successor(node);
      requestAnimationFrame(() => {
        if (target?.isConnected && (document.activeElement === document.body || node.contains(document.activeElement))) target.focus({ preventScroll: true });
      });
    };
  }, []);
}
