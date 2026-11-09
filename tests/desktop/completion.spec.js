import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, profileRoot, closeMain, trayAction } from './helpers.js';

async function seed(main, values) {
  const result = await main.evaluate((tasks) => window.desktopTodo.mutate({ type: 'add', tasks }), values);
  expect(result.ok).toBe(true);
  await expect(main.locator('.task-row')).toHaveCount(values.length);
  return result.value.tasks;
}
function persisted(profile) { return JSON.parse(readFileSync(join(profile, 'todo-data.json'), 'utf8')).tasks; }
async function freeze(page) {
  await page.clock.install({ time: new Date('2026-11-08T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z'));
}
const value = (title, category = '学习') => ({ title, category, dueDate: '', priority: 'medium' });

test('保存不等动画：同帧连点去重，多条快速完成，计数立即变化且键盘焦点连续', async () => {
  const profile = mkdtempSync(join(profileRoot, 'motion-fast-'));
  const { instance, main } = await launch(profile);
  try {
    const tasks = await seed(main, [value('键盘第一项'), value('键盘第二项'), value('键盘第三项')]);
    await freeze(main);
    const first = main.locator(`[data-task-id="${tasks[0].id}"]`);
    const second = main.locator(`[data-task-id="${tasks[1].id}"]`);
    await first.locator('.completion-button').focus();
    await first.locator('.completion-button').press('Enter');
    await expect.poll(() => persisted(profile).filter((task) => task.completed).length).toBe(1);
    // 时钟没有前进，任务已持久化；退出行是新状态，数量不等待动画。
    await expect(first).toHaveAttribute('data-leaving', 'true');
    await expect(first.locator('button.completion-button')).toHaveAttribute('aria-pressed', 'true');
    await expect(second.locator('.completion-button')).toBeFocused();
    await expect(main.locator('.task-count')).toHaveAttribute('data-count', '2');
    await expect(main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^已完成/ }).locator('.sidebar-count')).toHaveAttribute('data-count', '1');
    expect(await first.locator('.completion-tick').evaluate((path) => getComputedStyle(path).animationName)).toBe('tick-draw');
    // 同一帧重复点击同一项，同时完成其他项，只应各保存一次。
    await main.evaluate(() => {
      const buttons = [...document.querySelectorAll('.task-row:not([data-leaving="true"]) .completion-button')];
      for (const button of buttons) { button.click(); button.click(); }
    });
    await expect.poll(() => persisted(profile).filter((task) => task.completed).length).toBe(3);
    await expect(main.locator('.task-count')).toHaveAttribute('data-count', '0');
    await expect(main.locator('.task-row')).toHaveCount(3);
    expect(new Set(await main.locator('.task-row').evaluateAll((rows) => rows.map((row) => row.dataset.taskId))).size).toBe(3);
    await main.clock.runFor(300);
    await expect(main.locator('.task-row')).toHaveCount(0);
    await expect(main.locator('#quick-task')).toBeFocused();
    await main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^已完成/ }).click();
    await expect(main.locator('.task-row')).toHaveCount(3);
    await main.locator('.task-row .completion-button').first().press('Space');
    await expect.poll(() => persisted(profile).filter((task) => task.completed).length).toBe(2);
    await main.clock.runFor(300);
    await expect(main.locator('.task-row')).toHaveCount(2);
  } finally { await instance.close(); }
});

test('分类内移动无重复、恢复与计数同步，减少动态立即生效，保存失败不伪造完成', async () => {
  const profile = mkdtempSync(join(profileRoot, 'motion-reduce-'));
  const { instance, main } = await launch(profile);
  try {
    const [task] = await seed(main, [value('分类联动')]);
    await main.getByRole('navigation', { name: '分类清单' }).getByRole('button', { name: /^学习/ }).click();
    await freeze(main);
    await main.locator('.completion-button').evaluate((button) => button.click());
    await expect.poll(() => persisted(profile)[0].completed).toBe(true);
    await expect(main.locator(`[data-task-id="${task.id}"]`)).toHaveCount(1);
    await expect(main.locator('.task-count')).toHaveAttribute('data-count', '0');
    await main.clock.runFor(300);
    await expect(main.getByRole('region', { name: '已完成，1 项' }).locator('.task-row')).toHaveCount(1);
    await expect(main.locator('.task-row')).toHaveCount(1);
    await main.locator('.completion-button').evaluate((button) => button.click());
    await expect.poll(() => persisted(profile)[0].completed).toBe(false);
    await main.clock.runFor(300);
    await main.getByRole('button', { name: '删除任务：分类联动', exact: true }).click();
    await main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^已删除/ }).click();
    await main.getByRole('button', { name: '恢复', exact: true }).evaluate((button) => button.click());
    await expect.poll(() => persisted(profile)[0].deleted).toBe(false);
    await expect(main.locator('.task-count')).toHaveAttribute('data-count', '0');
    await main.clock.runFor(300);
    await expect(main.locator('.task-row')).toHaveCount(0);
    await main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^未完成/ }).click();
    await main.emulateMedia({ reducedMotion: 'reduce' });
    await main.locator('.completion-button').evaluate((button) => button.click());
    await expect.poll(() => persisted(profile)[0].completed).toBe(true);
    // 没有推进时钟，减少动态模式也应直接移除行。
    await expect(main.locator('.task-row')).toHaveCount(0);
    expect(await main.locator('.count-value').evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).animationName === 'none'))).toBe(true);
    await main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^已完成/ }).click();
    await main.locator('.completion-button').evaluate((button) => button.click());
    await expect.poll(() => persisted(profile)[0].completed).toBe(false);
    await main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^未完成/ }).click();
    const before = readFileSync(join(profile, 'todo-data.json'), 'utf8');
    await instance.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('tasks:mutate');
      ipcMain.handle('tasks:mutate', () => ({ ok: false, error: '测试写入失败' }));
    });
    await main.locator('.completion-button').evaluate((button) => button.click());
    await expect(main.getByRole('alert')).toContainText('测试写入失败');
    await expect(main.locator('.completion-button')).toHaveAttribute('aria-pressed', 'false');
    await expect(main.locator('.task-row')).toHaveAttribute('data-leaving', 'false');
    expect(readFileSync(join(profile, 'todo-data.json'), 'utf8')).toBe(before);
  } finally { await instance.close(); }
});

test('主窗口和悬浮预览完成反馈使用同一数据，快速操作后重启不回滚', async () => {
  const profile = mkdtempSync(join(profileRoot, 'motion-sync-'));
  let { instance, main, floating } = await launch(profile);
  try {
    await seed(main, [value('主窗口完成'), value('悬浮完成'), value('仍待完成', '生活')]);
    await main.getByRole('button', { name: '标记为已完成：主窗口完成', exact: true }).click();
    await expect(floating.locator('.floating-count')).toHaveAttribute('data-count', '2');
    await closeMain(instance);
    await instance.evaluate(({ app }) => { const view = app.todoAutomation.getLayout(); app.todoAutomation.setCursor({ x: view.bounds.x + view.ball.x + 26, y: view.bounds.y + view.ball.y + 26 }); });
    await floating.getByRole('button', { name: /^打开 AI Todo/ }).hover();
    await expect(floating.locator('.floating-panel')).toBeVisible();
    await instance.evaluate(({ app }) => { const view = app.todoAutomation.getLayout(); app.todoAutomation.setCursor({ x: view.bounds.x + view.panel.x + 80, y: view.bounds.y + view.panel.y + 25 }); });
    await expect(floating.locator('.floating-tasks li')).toHaveCount(2);
    await freeze(floating);
    await floating.getByRole('button', { name: '完成：悬浮完成', exact: true }).evaluate((button) => { button.click(); button.click(); });
    await expect.poll(() => persisted(profile).filter((task) => task.completed).length).toBe(2);
    await expect(floating.locator('.preview-count')).toHaveAttribute('data-count', '1');
    await expect(floating.locator('.floating-count')).toHaveAttribute('data-count', '1');
    await expect(main.locator('.task-count')).toHaveAttribute('data-count', '1');
    await expect(main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^已完成/ }).locator('.sidebar-count')).toHaveAttribute('data-count', '2');
    await expect(main.getByRole('navigation', { name: '分类清单' }).getByRole('button', { name: /^学习/ }).locator('.sidebar-count')).toHaveAttribute('data-count', '0');
    await floating.clock.runFor(300);
    await expect(floating.locator('.floating-tasks li')).toHaveCount(1);
    await floating.emulateMedia({ reducedMotion: 'reduce' });
    await floating.getByRole('button', { name: '完成：仍待完成', exact: true }).evaluate((button) => button.click());
    await expect.poll(() => persisted(profile).every((task) => task.completed)).toBe(true);
    await expect(floating.locator('.floating-tasks li')).toHaveCount(0);
    await expect(main.locator('.task-count')).toHaveAttribute('data-count', '0');
    await instance.close();
    ({ instance, main, floating } = await launch(profile));
    await trayAction(instance, '打开 AI Todo');
    await main.getByRole('navigation', { name: '智能清单' }).getByRole('button', { name: /^已完成/ }).click();
    await expect(main.locator('.task-row')).toHaveCount(3);
    expect(persisted(profile).every((task) => task.completed)).toBe(true);
    expect(persisted(profile).some((task) => 'motion' in task || 'leaving' in task)).toBe(false);
  } finally { await instance.close(); }
});
