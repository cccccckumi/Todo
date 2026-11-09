import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';

import { profileRoot, launch, nativeState, closeMain, trayAction } from './helpers.js';

test('Windows 桌面任务、浮层、托盘与重启持久化', async () => {
  const profile = mkdtempSync(join(profileRoot, 'lifecycle-'));
  let { instance, main, floating } = await launch(profile);
  try {
    await expect.poll(async () => (await nativeState(instance)).mainVisible).toBe(true);
    await expect.poll(async () => (await nativeState(instance)).floatVisible).toBe(false);
    await main.getByRole('button', { name: '新建任务', exact: true }).click();
    await main.getByLabel('任务名称', { exact: true }).fill('完成桌面版设计');
    await main.getByLabel('截止日期', { exact: true }).fill('2026-12-20');
    await main.getByLabel('优先级', { exact: true }).selectOption('high');
    await main.getByLabel('分类', { exact: true }).selectOption('__create_custom_category__');
    await main.getByLabel('新分类名称').fill('个人项目');
    await main.getByRole('button', { name: '添加任务', exact: true }).click();
    await expect(main.getByText('完成桌面版设计', { exact: true })).toBeVisible();
    await main.locator('#quick-task').fill('整理周报');
    await main.getByRole('button', { name: '添加', exact: true }).click();
    await expect(main.locator('.task-row')).toHaveCount(2);
    const saved = JSON.parse(readFileSync(join(profile, 'todo-data.json'), 'utf8'));
    expect(saved.tasks.find((task) => task.title === '完成桌面版设计')).toMatchObject({ category: '个人项目', dueDate: '2026-12-20', priority: 'high' });
    await main.screenshot({ path: 'test-results/main-window.png' });

    // 用另一个普通原生窗口切换前台，检查主界面仍显示时悬浮球能恢复。
    await instance.evaluate(async ({ BrowserWindow, app }) => {
      const other = new BrowserWindow({ width: 500, height: 300, title: '前台切换检查' });
      await other.loadURL('data:text/html,<title>Focus check</title><p>Window focus test</p>');
      app.todoAutomation.other = other; other.show(); other.focus();
    });
    await expect.poll(async () => (await nativeState(instance)).mainFocused).toBe(false);
    await expect.poll(async () => (await nativeState(instance)).floatVisible).toBe(true);
    expect((await nativeState(instance)).mainVisible).toBe(true);
    await instance.evaluate(({ app, BrowserWindow }) => {
      app.todoAutomation.other.destroy();
      BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().endsWith('#main')).focus();
    });

    await closeMain(instance);
    await expect.poll(async () => (await nativeState(instance)).floatVisible).toBe(true);
    expect((await nativeState(instance)).topmost).toBe(true);
    expect((await nativeState(instance)).trayExists).toBe(true);
    await instance.evaluate(({ app }) => { const view = app.todoAutomation.getLayout(); app.todoAutomation.setCursor({ x: view.bounds.x + view.ball.x + 26, y: view.bounds.y + view.ball.y + 26 }); });
    await floating.getByRole('button', { name: /^打开 AI Todo/ }).hover();
    await expect(floating.getByRole('region', { name: '悬浮待办预览' })).toBeVisible();
    await floating.getByRole('heading', { name: '待办', exact: true }).hover();
    await instance.evaluate(({ app }) => { const view = app.todoAutomation.getLayout(); app.todoAutomation.setCursor({ x: view.bounds.x + view.panel.x + 80, y: view.bounds.y + view.panel.y + 25 }); });
    await floating.waitForTimeout(400);
    await expect(floating.locator('.floating-tasks li')).toHaveCount(2);
    await floating.screenshot({ path: 'test-results/floating-preview.png' });
    if (process.platform === 'win32') {
      const native = await instance.evaluate(({ BrowserWindow, app }) => {
        const window = BrowserWindow.getAllWindows().find((entry) => entry.webContents.getURL().endsWith('#floating'));
        const layout = app.todoAutomation.getLayout();
        return { handle: window.getNativeWindowHandle().readBigUInt64LE().toString(), x: layout.ball.x + 26, y: layout.ball.y + 26 };
      });
      const result = JSON.parse(execFileSync('python', ['scripts/check-native-window.py', native.handle, String(native.x), String(native.y)], { encoding: 'utf8' }));
      expect(result).toMatchObject({ topmost: true, hasNativeRegion: true, ballInRegion: true, transparentCornerExcluded: true, ballHitsWindow: true, transparentCornerPassesThrough: true });
      writeFileSync('test-results/native-window.json', JSON.stringify(result, null, 2));
    }
    await floating.getByRole('button', { name: '完成：整理周报', exact: true }).click();
    await expect(floating.locator('.floating-tasks li')).toHaveCount(1);
    await instance.evaluate(({ app }) => { const view = app.todoAutomation.getLayout(); app.todoAutomation.setCursor({ x: view.bounds.x - 20, y: view.bounds.y - 20 }); });
    await expect.poll(async () => (await nativeState(instance)).layout.expanded).toBe(false);
    await floating.getByRole('button', { name: /^打开 AI Todo/ }).click();
    await expect.poll(async () => (await nativeState(instance)).mainVisible).toBe(true);
    await expect.poll(async () => (await nativeState(instance)).floatVisible).toBe(false);

    await main.getByRole('button', { name: '编辑任务：完成桌面版设计', exact: true }).click();
    await main.getByLabel('任务名称', { exact: true }).fill('完成桌面版设计与检查');
    await main.getByRole('button', { name: '保存修改' }).click();
    await main.getByRole('button', { name: '删除任务：完成桌面版设计与检查', exact: true }).click();
    await main.getByRole('button', { name: /已删除/ }).first().click();
    await expect(main.getByText('完成桌面版设计与检查', { exact: true })).toBeVisible();
    await main.getByRole('button', { name: '恢复', exact: true }).click();
    await main.getByRole('button', { name: /未完成/ }).first().click();
    await expect(main.getByText('完成桌面版设计与检查', { exact: true })).toBeVisible();
    await closeMain(instance);
    await trayAction(instance, '显示悬浮球');
    await expect.poll(async () => (await nativeState(instance)).floatVisible).toBe(false);
    await trayAction(instance, '显示悬浮球');
    await expect.poll(async () => (await nativeState(instance)).floatVisible).toBe(true);
    await trayAction(instance, '打开 AI Todo');
    await expect.poll(async () => (await nativeState(instance)).mainVisible).toBe(true);

    // 真正执行托盘退出回调，等待 Electron 进程退出。
    const processHandle = instance.process();
    const closed = instance.waitForEvent('close');
    await trayAction(instance, '完全退出').catch(() => {});
    await closed;
    await expect.poll(() => processHandle.exitCode).toBe(0);
    ({ instance, main, floating } = await launch(profile));
    await trayAction(instance, '打开 AI Todo');
    await expect(main.getByText('完成桌面版设计与检查', { exact: true })).toBeVisible();
    await main.getByRole('button', { name: /已完成/ }).first().click();
    await expect(main.getByText('整理周报', { exact: true })).toBeVisible();
  } finally { await instance.close(); }
});

test('开发模式通过 Vite 启动复用前端，IPC 可以保存任务', async () => {
  test.skip(Boolean(process.env.TODO_PACKAGED_EXE), '打包程序只加载本地资源，开发模式另行检查');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  let instance;
  try {
    const launched = await launch(mkdtempSync(join(profileRoot, 'development-')), { TODO_DEV_URL: server.resolvedUrls.local[0] });
    instance = launched.instance;
    await launched.main.locator('#quick-task').fill('开发模式保存检查');
    await launched.main.getByRole('button', { name: '添加', exact: true }).click();
    await expect(launched.main.getByText('开发模式保存检查', { exact: true })).toBeVisible();
  } finally { await instance?.close(); await server.close(); }
});

test('备份迁移、错误反馈和加密配置不向 renderer 返回 Key', async () => {
  const profile = mkdtempSync(join(profileRoot, 'migration-'));
  const { instance, main } = await launch(profile);
  try {
    const source = join(profile, 'old-browser.json'), target = join(profile, 'export.json');
    writeFileSync(source, JSON.stringify([{ id: 'old-1', title: '浏览器迁移任务', category: '学习', priority: 'low', dueDate: '', completed: false, deleted: false }]));
    await instance.evaluate(({ dialog }, files) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [files.source] });
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: files.target });
    }, { source, target });
    await main.getByRole('button', { name: '导入', exact: true }).click();
    await expect(main.getByText('浏览器迁移任务', { exact: true })).toBeVisible();
    await main.getByRole('button', { name: '导入', exact: true }).click();
    await expect(main.locator('.task-row')).toHaveCount(1);
    await main.getByRole('button', { name: '导出', exact: true }).click();
    await expect.poll(() => existsSync(target)).toBe(true);
    expect(JSON.parse(readFileSync(target, 'utf8')).tasks[0].id).toBe('old-1');
    const invalid = await main.evaluate(() => window.desktopTodo.mutate({ type: 'update', id: 'old-1', task: { title: '' } }));
    expect(invalid.ok).toBe(false);
    await main.getByRole('button', { name: 'AI 设置', exact: true }).click();
    await main.getByLabel('模型 / 接入点 ID').fill('test-model');
    await main.getByLabel('API Key', { exact: true }).fill('test-key-never-use-on-network');
    await main.getByRole('button', { name: '保存', exact: true }).click();
    await expect(main.locator('.settings-dialog')).toHaveCount(0);
    const publicConfig = await main.evaluate(() => window.desktopTodo.getConfig());
    expect(publicConfig.value.hasKey).toBe(true);
    expect(JSON.stringify(publicConfig)).not.toContain('test-key-never');
    expect(readFileSync(join(profile, 'ai-config.json'), 'utf8')).not.toContain('test-key-never');
    // 不请求外部模型：验证缺少任务文本的错误可见。
    await main.getByRole('button', { name: 'AI 提取任务', exact: true }).click();
    await expect(main.getByRole('alert')).toContainText('先粘贴');
    await instance.evaluate(() => {
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ tasks: [
        { title: '选择添加的 AI 任务', dueDate: '', category: '学习', priority: 'high' },
        { title: '不添加的 AI 任务', dueDate: '', category: '其他', priority: 'low' },
      ] }) } }] }) });
    });
    await main.locator('#quick-task').fill('测试用通知，模型请求已替换为本地响应');
    await main.getByRole('button', { name: 'AI 提取任务', exact: true }).click();
    await expect(main.locator('.ai-draft-item')).toHaveCount(2);
    await main.locator('.ai-draft-item').first().getByLabel('任务名称').fill('确认并修改的 AI 任务');
    await main.locator('.ai-draft-item').nth(1).getByRole('checkbox').uncheck();
    await main.getByRole('button', { name: '添加已选（1）', exact: true }).click();
    await expect(main.locator('.ai-draft-item')).toHaveCount(0);
    await expect(main.getByText('确认并修改的 AI 任务', { exact: true })).toBeVisible();
    const finalTasks = JSON.parse(readFileSync(join(profile, 'todo-data.json'), 'utf8')).tasks;
    expect(finalTasks).toHaveLength(2);
    expect(finalTasks.some((task) => task.title === '不添加的 AI 任务')).toBe(false);
    expect(finalTasks.some((task) => 'selected' in task || 'draftId' in task)).toBe(false);
  } finally { await instance.close(); }
});
