import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, profileRoot, nativeState, trayAction } from './helpers.js';

function native(handle, command = 'inspect') {
  return JSON.parse(execFileSync('python', ['scripts/check-native-titlebar.py', handle, command], { encoding: 'utf8' }));
}
async function frameState(instance) {
  return instance.evaluate(({ BrowserWindow, nativeTheme }) => {
    const window = BrowserWindow.getAllWindows().find((entry) => entry.webContents.getURL().endsWith('#main'));
    return { handle: window.getNativeWindowHandle().readBigUInt64LE().toString(), theme: nativeTheme.themeSource,
      dark: nativeTheme.shouldUseDarkColors, accent: window.getAccentColor(), minimized: window.isMinimized(), maximized: window.isMaximized(),
      bounds: window.getBounds(), resizable: window.isResizable(), minimizable: window.isMinimizable(), maximizable: window.isMaximizable() };
  });
}

for (const forceDark of [false, true]) test(`原生浅色标题栏与窗口功能（${forceDark ? '深色启动覆盖' : '系统主题'}）`, async () => {
  test.skip(process.platform !== 'win32', 'Windows 标题栏专项');
  const profile = mkdtempSync(join(profileRoot, 'titlebar-'));
  const { instance, main } = await launch(profile, {}, forceDark ? ['--force-dark-mode'] : []);
  const name = forceDark ? 'forced-dark' : 'system';
  try {
    const initial = await frameState(instance);
    expect(initial).toMatchObject({ theme: 'light', dark: false, accent: false, resizable: true, minimizable: true, maximizable: true });
    const inspection = native(initial.handle);
    expect(inspection).toMatchObject({ title: 'AI Todo', caption: true, systemMenu: true, resizeBorder: true, minimizeButton: true, maximizeButton: true, hasIcon: true, dwmDarkMode: false, captionHit: 2, leftResizeHit: 10, bottomResizeHit: 15 });

    const captured = JSON.parse(execFileSync('python', ['scripts/check-native-titlebar.py', initial.handle, 'capture', `test-results/titlebar-${name}.png`], { encoding: 'utf8' }));
    expect(captured.rgb.every((value) => value >= 230)).toBe(true);
    writeFileSync(`test-results/titlebar-${name}.json`, JSON.stringify({ ...inspection, captionBackground: captured.rgb, captureMethod: captured.method }, null, 2));

    // 原生非客户区的双击消息，由 Windows 处理最大化/还原。
    native(initial.handle, 'caption-double-click');
    await expect.poll(async () => (await frameState(instance)).maximized).toBe(true);
    native(initial.handle, 'caption-double-click');
    await expect.poll(async () => (await frameState(instance)).maximized).toBe(false);
    native(initial.handle, 'minimize');
    await expect.poll(async () => (await frameState(instance)).minimized).toBe(true);
    await trayAction(instance, '打开 AI Todo');
    await expect.poll(async () => (await frameState(instance)).minimized).toBe(false);
    native(initial.handle, 'maximize');
    await expect.poll(async () => (await frameState(instance)).maximized).toBe(true);
    native(initial.handle, 'restore');
    await expect.poll(async () => (await frameState(instance)).maximized).toBe(false);
    // 验证普通原生移动/缩放，标题和边缘命中由上面的 Win32 检查确认。
    await instance.evaluate(({ BrowserWindow }, bounds) => {
      const window = BrowserWindow.getAllWindows().find((entry) => entry.webContents.getURL().endsWith('#main'));
      window.setBounds({ x: bounds.x + 20, y: bounds.y + 20, width: bounds.width - 80, height: bounds.height - 60 });
    }, initial.bounds);
    const moved = await frameState(instance);
    expect(Math.abs(moved.bounds.width - (initial.bounds.width - 80))).toBeLessThanOrEqual(2);
    expect(Math.abs(moved.bounds.x - (initial.bounds.x + 20))).toBeLessThanOrEqual(2);
    await expect(main.locator('#todo-title')).toBeVisible();
    native(initial.handle, 'close');
    await expect.poll(async () => (await nativeState(instance)).mainVisible).toBe(false);
    await expect.poll(async () => (await nativeState(instance)).floatVisible).toBe(true);
    expect((await nativeState(instance)).trayExists).toBe(true);
    await trayAction(instance, '打开 AI Todo');
    await expect.poll(async () => (await nativeState(instance)).mainVisible).toBe(true);
  } finally { await instance.close(); }
});
