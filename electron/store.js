import { mkdirSync, readFileSync, existsSync, writeFileSync, copyFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyTaskCommand, parseTasksBackup, mergeTasks } from '../shared/tasks.js';

export class TaskStore {
  constructor(filePath) {
    this.path = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    this.state = { version: 1, tasks: [], preferences: { floatingVisible: true } };
    if (existsSync(filePath)) {
      // 数据损坏时抛出错误并保留原文件，绝不覆盖成空清单。
      const saved = JSON.parse(readFileSync(filePath, 'utf8'));
      if (saved.version !== 1) throw new Error('数据版本不受支持。');
      this.state = { version: 1, tasks: parseTasksBackup(saved), preferences: { ...this.state.preferences, ...saved.preferences } };
    }
  }

  snapshot() { return structuredClone(this.state); }

  commit(next) {
    const tempPath = `${this.path}.tmp`;
    writeFileSync(tempPath, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
    if (existsSync(this.path)) copyFileSync(this.path, `${this.path}.bak`);
    renameSync(tempPath, this.path);
    this.state = next;
    return this.snapshot();
  }

  mutate(command) {
    return this.commit({ ...this.state, tasks: applyTaskCommand(this.state.tasks, command, randomUUID) });
  }

  importTasks(tasks) {
    const merged = mergeTasks(this.state.tasks, parseTasksBackup(tasks));
    this.commit({ ...this.state, tasks: merged.tasks });
    return { added: merged.added, skipped: merged.skipped };
  }

  setPreferences(patch) {
    return this.commit({ ...this.state, preferences: { ...this.state.preferences, ...patch } });
  }
}
