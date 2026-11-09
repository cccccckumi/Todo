export const STORAGE_KEY = 'ai-todo.tasks.v1';
export const FIXED_CATEGORIES = ['学习', '生活', '社团', '其他'];
export const PRIORITIES = ['high', 'medium', 'low'];

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

// 导入时校验全部任务；发现错误就中止，避免悄悄丢掉部分数据。
export function normalizeTask(task) {
  if (!task || typeof task.id !== 'string' || !task.id || task.id.length > 200) throw new Error('任务缺少有效 ID。');
  if (typeof task.title !== 'string' || !task.title.trim() || task.title.trim().length > 8000) throw new Error('任务名称不能为空，且不能超过 8000 字。');
  const category = typeof task.category === 'string' ? task.category.trim() : '其他';
  if (!category || category.length > 24) throw new Error('分类名称需要为 1 至 24 字。');
  const dueDate = task.dueDate ?? '';
  if (dueDate !== '' && !validDate(dueDate)) throw new Error('截止日期格式无效。');
  return {
    id: task.id, title: task.title.trim(), completed: Boolean(task.completed),
    deleted: Boolean(task.deleted), dueDate,
    priority: PRIORITIES.includes(task.priority) ? task.priority : 'medium', category,
  };
}

export function parseTasksBackup(value) {
  const tasks = Array.isArray(value) ? value : value?.tasks;
  if (!Array.isArray(tasks)) throw new Error('请选择 Todo 导出的 JSON 文件（或原版任务数组）。');
  if (tasks.length > 50000) throw new Error('单次导入不能超过 50000 项任务。');
  const result = tasks.map(normalizeTask);
  if (new Set(result.map((task) => task.id)).size !== result.length) throw new Error('备份内有重复任务 ID，请检查文件。');
  return result;
}

export function applyTaskCommand(tasks, command, createId = () => globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  if (!command || typeof command.type !== 'string') throw new Error('任务操作无效。');
  if (command.type === 'add') {
    const values = command.tasks ?? [command.task];
    if (!Array.isArray(values) || !values.length || values.length > 100) throw new Error('本次添加的任务数量无效。');
    const added = values.map((task) => normalizeTask({ ...task, id: createId(), completed: false, deleted: false }));
    return [...added, ...tasks];
  }
  const index = tasks.findIndex((task) => task.id === command.id);
  if (index < 0) throw new Error('任务不存在，可能已经在另一个窗口中更新。');
  const current = tasks[index];
  let next;
  switch (command.type) {
    case 'update': next = normalizeTask({ ...current, ...command.task, id: current.id }); break;
    case 'toggle':
      if (current.deleted) throw new Error('请先恢复已删除的任务。');
      next = { ...current, completed: !current.completed }; break;
    case 'delete': next = { ...current, deleted: true }; break;
    case 'restore': next = { ...current, deleted: false }; break;
    default: throw new Error('不支持这个任务操作。');
  }
  return tasks.map((task, taskIndex) => taskIndex === index ? next : task);
}

export function mergeTasks(current, incoming) {
  const ids = new Set(current.map((task) => task.id));
  const added = incoming.filter((task) => !ids.has(task.id));
  return { tasks: [...added, ...current], added: added.length, skipped: incoming.length - added.length };
}

export function makeBackup(tasks) {
  return { app: 'AI Todo', version: 1, exportedAt: new Date().toISOString(), tasks };
}
