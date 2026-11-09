import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivatePackagePath } from '../../scripts/package-policy.mjs';

test('打包检查拦截环境文件、任务备份、本机 AI 配置与运行缓存', () => {
  for (const path of [
    '.env', '.env.example', 'nested/.env.local',
    'todo-data.json', 'todo-data.json.bak', 'todo-data.json.tmp',
    'ai-config.json', 'ai-config.json.bak', 'ai-config.json.tmp',
    'nested/AI-Todo-2026-11-09.json', 'AI-Todo-old-tasks.json',
    '.git/config', '.agents/skills/example/SKILL.md',
    '.test-profiles/test/todo-data.json', 'test-results/report.json',
    'playwright-report/index.html', 'nested/__pycache__/module.pyc',
    'module.pyo', 'tests/unit/tasks.test.js', 'server/index.js',
    'nested\\todo-data.json.bak',
  ]) assert.equal(isPrivatePackagePath(path), true, path);
});

test('打包隐私规则保留任务/配置源码、许可证和文档', () => {
  for (const path of [
    'LICENSE', 'LICENSES.chromium.html', 'package.json',
    'electron/ai-config.js', 'electron/store.js', 'shared/tasks.js',
    'dist/index.html', 'dist/assets/index.js', 'build/icon.png',
    'docs/VERIFICATION.md', 'scripts/package-policy.mjs',
    'module.py', 'module.pyd',
  ]) assert.equal(isPrivatePackagePath(path), false, path);
});
