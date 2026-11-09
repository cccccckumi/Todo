import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskStore } from '../../electron/store.js';
import { applyTaskCommand, parseTasksBackup, mergeTasks, makeBackup } from '../../shared/tasks.js';

const task = { id: 'legacy-1', title: '提交论文', dueDate: '2026-11-15', category: '毕业设计', priority: 'high', completed: true, deleted: true };
test('旧版数组和新备份保留所有任务字段，包括已删除、自定义分类', () => {
  assert.deepEqual(parseTasksBackup([task]), [task]);
  assert.deepEqual(parseTasksBackup(makeBackup([task])), [task]);
  assert.throws(() => parseTasksBackup([task, task]), /重复/);
  assert.throws(() => parseTasksBackup([{ ...task, dueDate: '2026-02-30' }]), /日期/);
});
test('任务操作保留完成状态与分类，合并导入不覆盖现有相同 ID', () => {
  let tasks = applyTaskCommand([], { type: 'add', task: { title: '作业', category: '数学' } }, () => 'new-1');
  tasks = applyTaskCommand(tasks, { type: 'toggle', id: 'new-1' });
  tasks = applyTaskCommand(tasks, { type: 'delete', id: 'new-1' });
  assert.throws(() => applyTaskCommand(tasks, { type: 'toggle', id: 'new-1' }), /恢复/);
  tasks = applyTaskCommand(tasks, { type: 'restore', id: 'new-1' });
  assert.equal(tasks[0].completed, true); assert.equal(tasks[0].category, '数学');
  const merged = mergeTasks(tasks, [{ ...tasks[0], title: '旧数据' }, task]);
  assert.equal(merged.added, 1); assert.equal(merged.skipped, 1); assert.equal(merged.tasks[1].title, '作业');
});
test('持久化、备份和重启；损坏数据与失败操作不覆盖文件', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ai-todo-store-'));
  const path = join(directory, 'tasks.json');
  try {
    const store = new TaskStore(path);
    store.importTasks([task]);
    store.mutate({ type: 'restore', id: task.id });
    assert.deepEqual(new TaskStore(path).snapshot().tasks, store.snapshot().tasks);
    assert.equal(JSON.parse(readFileSync(`${path}.bak`, 'utf8')).tasks[0].deleted, true);
    const before = readFileSync(path, 'utf8');
    assert.throws(() => store.mutate({ type: 'update', id: task.id, task: { category: '' } }));
    assert.equal(readFileSync(path, 'utf8'), before);
    writeFileSync(path, '{broken'); assert.throws(() => new TaskStore(path));
    assert.equal(readFileSync(path, 'utf8'), '{broken');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
