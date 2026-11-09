// 仅影响显示：这里不写任务、不改变筛选，也不保存动画状态。
export const TASK_FEEDBACK_MS = 240;

export function projectTaskRows(previous, { tasks, visibleTasks, scope, groupForTask, reduced = false, now }) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visibleIds = new Set(visibleTasks.map((task) => task.id));
  const transitions = new Map();
  const sameScope = previous && previous.scope === scope && !reduced;

  if (sameScope) {
    for (const [id, motion] of previous.transitions) {
      const task = byId.get(id);
      if (task && motion.until > now && task.completed === motion.completed && task.deleted === motion.deleted) transitions.set(id, motion);
    }
    const before = new Map(previous.tasks.map((task) => [task.id, task]));
    for (const row of previous.rows) {
      const task = byId.get(row.task.id), old = before.get(row.task.id);
      if (!task || !old) continue;
      const toggled = !task.deleted && !old.deleted && task.completed !== old.completed;
      const restored = old.deleted && !task.deleted;
      if (toggled || restored) {
        transitions.set(task.id, {
          kind: restored ? 'restoring' : task.completed ? 'completing' : 'reopening',
          group: row.group, until: now + TASK_FEEDBACK_MS,
          completed: task.completed, deleted: task.deleted,
        });
      }
    }
  }

  const ids = visibleTasks.map((task) => task.id);
  if (sameScope) {
    // 将刚离开筛选结果的任务短暂保留在原位置，多个并行完成也不会打乱顺序。
    previous.rows.forEach((row, index) => {
      const id = row.task.id;
      if (!transitions.has(id) || visibleIds.has(id)) return;
      const next = previous.rows.slice(index + 1).find((candidate) => ids.includes(candidate.task.id));
      ids.splice(next ? ids.indexOf(next.task.id) : ids.length, 0, id);
    });
  }
  const rows = ids.map((id) => {
    const task = byId.get(id), motion = transitions.get(id);
    return { task, group: motion?.group ?? groupForTask(task), motion: motion?.kind ?? '', leaving: Boolean(motion && (!visibleIds.has(id) || motion.group !== groupForTask(task))) };
  });
  return { tasks, visibleTasks, scope, transitions, rows };
}
