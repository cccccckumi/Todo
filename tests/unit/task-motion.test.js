import test from 'node:test';
import assert from 'node:assert/strict';
import { projectTaskRows, TASK_FEEDBACK_MS } from '../../src/utils/task-motion.js';

const initial = ['a', 'b', 'c'].map((id) => ({ id, title: id, completed: false, deleted: false }));
const groupForTask = (task) => task.completed ? 'completed' : 'today';
const project = (previous, tasks, now, options = {}) => projectTaskRows(previous, {
  tasks, visibleTasks: tasks.filter((task) => !task.completed && !task.deleted), scope: 'pending', groupForTask, now, ...options,
});

test('完成行使用真实新状态短暂退出，重复快照不延长动画，多任务不重复不乱序', () => {
  const before = structuredClone(initial);
  let view = project(null, initial, 0);
  const first = initial.map((task) => task.id === 'a' ? { ...task, completed: true } : task);
  view = project(view, first, 10);
  assert.deepEqual(view.rows.map((row) => row.task.id), ['a', 'b', 'c']);
  assert.equal(view.rows[0].task.completed, true);
  assert.equal(view.rows[0].leaving, true);
  assert.equal(view.rows[0].motion, 'completing');
  view = project(view, structuredClone(first), 20);
  assert.equal(view.transitions.get('a').until, 10 + TASK_FEEDBACK_MS);
  const second = first.map((task) => task.id === 'b' ? { ...task, completed: true } : task);
  view = project(view, second, 30);
  assert.deepEqual(view.rows.map((row) => row.task.id), ['a', 'b', 'c']);
  view = project(view, second, 10 + TASK_FEEDBACK_MS + 1);
  assert.deepEqual(view.rows.map((row) => row.task.id), ['b', 'c']);
  view = project(view, second, 30 + TASK_FEEDBACK_MS + 1);
  assert.deepEqual(view.rows.map((row) => row.task.id), ['c']);
  assert.deepEqual(initial, before, '显示层不能修改真实任务');
});

test('分类中从待办组到已完成组只渲染一份，反向切换按最新状态处理', () => {
  let tasks = [initial[0]];
  const category = (previous, now) => project(previous, tasks, now, { visibleTasks: tasks, scope: 'category' });
  let view = category(null, 0);
  tasks = [{ ...tasks[0], completed: true }];
  view = category(view, 5);
  assert.equal(view.rows.length, 1); assert.equal(view.rows[0].group, 'today');
  view = category(view, 5 + TASK_FEEDBACK_MS);
  assert.equal(view.rows.length, 1); assert.equal(view.rows[0].group, 'completed');
  tasks = [{ ...tasks[0], completed: false }];
  view = category(view, 300);
  assert.equal(view.rows[0].motion, 'reopening'); assert.equal(view.rows[0].task.completed, false);
  view = category(view, 300 + TASK_FEEDBACK_MS);
  assert.equal(view.rows[0].group, 'today'); assert.equal(view.rows.length, 1);
});

test('筛选切换或减少动态立即清理退出行；没有数据变化不伪造完成', () => {
  const start = project(null, initial, 0);
  assert.equal(project(start, initial, 10).transitions.size, 0);
  const done = initial.map((task) => ({ ...task, completed: true }));
  const moving = project(start, done, 10);
  assert.equal(moving.rows.length, 3);
  assert.equal(project(moving, done, 20, { reduced: true }).rows.length, 0);
  assert.equal(project(moving, done, 20, { scope: 'another-view' }).rows.length, 0);
  assert.equal(project(moving, [], 20).rows.length, 0);
});

test('从已删除恢复也只产生临时显示状态，不把动画字段写到任务里', () => {
  const deleted = [{ ...initial[0], deleted: true }];
  let view = project(null, deleted, 0, { visibleTasks: deleted, scope: 'deleted', groupForTask: () => 'deleted' });
  const restored = [{ ...initial[0] }];
  view = project(view, restored, 10, { visibleTasks: [], scope: 'deleted', groupForTask: () => 'deleted' });
  assert.equal(view.rows[0].motion, 'restoring');
  assert.equal(view.rows[0].task.deleted, false);
  assert.deepEqual(Object.keys(view.rows[0].task).sort(), Object.keys(initial[0]).sort());
});
