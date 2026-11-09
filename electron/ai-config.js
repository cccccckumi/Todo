import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { safeStorage } from 'electron';

export class AIConfig {
  constructor(path, developmentEnv) {
    this.path = path;
    this.fallback = {};
    // 只在开发环境读取项目 .env；该文件绝不会加入安装包。
    if (developmentEnv && existsSync(developmentEnv)) {
      for (const line of readFileSync(developmentEnv, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*(ARK_API_KEY|ARK_MODEL_ID)\s*=\s*(.*?)\s*$/);
        if (match) this.fallback[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
    this.saved = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  }

  credentials() {
    if (!this.saved) return { apiKey: this.fallback.ARK_API_KEY ?? '', modelId: this.fallback.ARK_MODEL_ID ?? '' };
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统凭据加密当前不可用，无法读取 AI 配置。');
    return { apiKey: safeStorage.decryptString(Buffer.from(this.saved.key, 'base64')), modelId: this.saved.modelId };
  }

  publicConfig() {
    const { apiKey, modelId } = this.credentials();
    return { hasKey: Boolean(apiKey), modelId, configured: Boolean(apiKey && modelId), source: this.saved ? 'encrypted' : 'development' };
  }

  save({ apiKey, modelId }) {
    if (typeof modelId !== 'string' || !modelId.trim() || modelId.length > 160) throw new Error('请填写有效模型 ID。');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统凭据加密不可用，未保存 API Key。');
    const key = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : this.credentials().apiKey;
    if (!key || key.length > 1000) throw new Error('请填写有效 API Key。');
    const next = { version: 1, modelId: modelId.trim(), key: safeStorage.encryptString(key).toString('base64') };
    writeFileSync(`${this.path}.tmp`, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${this.path}.tmp`, this.path);
    this.saved = next;
    return this.publicConfig();
  }
}
