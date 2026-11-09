import { useEffect, useRef, useState } from 'react';
import { unwrap } from '../services/client.js';

export default function AISettings({ onClose }) {
  const [modelId, setModelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current.showModal();
    unwrap(window.desktopTodo.getConfig()).then((config) => { setModelId(config.modelId); setHasKey(config.hasKey); })
      .catch((problem) => setError(problem.message)).finally(() => setBusy(false));
  }, []);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await unwrap(window.desktopTodo.saveConfig({ modelId, apiKey })); setApiKey(''); onClose(); }
    catch (problem) { setError(problem.message); } finally { setBusy(false); }
  }
  return (
    <dialog className="settings-dialog" ref={dialogRef} onCancel={onClose} aria-labelledby="settings-title">
      <form onSubmit={save}>
        <div className="settings-heading"><h2 id="settings-title">豆包 AI</h2><button className="text-button" type="button" onClick={onClose} aria-label="关闭 AI 设置">关闭</button></div>
        <div className="field"><label htmlFor="model-id">模型 / 接入点 ID</label><input autoFocus id="model-id" value={modelId} maxLength={160} required placeholder="从方舟模型页面复制" onChange={(event) => setModelId(event.target.value)} /></div>
        <div className="field"><label htmlFor="api-key">API Key {hasKey && <span className="muted">· 已配置</span>}</label><input id="api-key" type="password" autoComplete="off" value={apiKey} maxLength={1000} required={!hasKey} placeholder={hasKey ? '留空则继续使用现有 Key' : '输入你自己的方舟 API Key'} onChange={(event) => setApiKey(event.target.value)} /></div>
        <p className="settings-note">Key 通过系统凭据加密后保存在本机。点击 AI 提取时，通知内容会发送给豆包。</p>
        {error && <p role="alert" className="error-message">{error}</p>}
        <div className="task-form-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="save-button" disabled={busy}>保存</button></div>
      </form>
    </dialog>
  );
}
