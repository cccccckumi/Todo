import { expect, _electron as electron } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const profileRoot = resolve('.test-profiles');
mkdirSync(profileRoot, { recursive: true });

export async function launch(profile, extraEnv = {}, extraArgs = []) {
  const env = { ...process.env, NODE_ENV: 'test', TODO_TEST_DATA_DIR: profile, ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.TODO_PACKAGED_EXE;
  const instance = await electron.launch({ ...(executablePath ? { executablePath, args: extraArgs } : { args: [resolve('.'), ...extraArgs] }), env, timeout: 30000 });
  try {
    await expect.poll(async () => instance.windows().filter((page) => /#(main|floating)$/.test(page.url())).length).toBe(2);
    const main = instance.windows().find((page) => page.url().endsWith('#main'));
    const floating = instance.windows().find((page) => page.url().endsWith('#floating'));
    await expect(main.locator('#todo-title')).toBeVisible();
    return { instance, main, floating };
  } catch (error) { await instance.close(); throw error; }
}

export async function nativeState(instance) {
  return instance.evaluate(({ BrowserWindow, app }) => {
    const windows = BrowserWindow.getAllWindows();
    const main = windows.find((window) => window.webContents.getURL().endsWith('#main'));
    const floating = windows.find((window) => window.webContents.getURL().endsWith('#floating'));
    return { mainVisible: main.isVisible(), mainFocused: main.isFocused(), floatVisible: floating.isVisible(), topmost: floating.isAlwaysOnTop(), bounds: floating.getBounds(), layout: app.todoAutomation.getLayout(), trayExists: !app.todoAutomation.getTray().isDestroyed() };
  });
}
export async function closeMain(instance) {
  await instance.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().endsWith('#main')).close());
}
export async function trayAction(instance, label) {
  await instance.evaluate(({ app }, target) => {
    const item = app.todoAutomation.getTrayMenu().items.find((entry) => entry.label === target);
    if (!item) throw new Error('托盘项不存在');
    item.click(item);
  }, label);
}
