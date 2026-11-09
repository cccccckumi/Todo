// 仅为旧浏览器数据迁移/前端开发保留；Electron 主程序直接在主进程调用 AI。
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractTasks } from '../shared/ai.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(resolve(root, '.env'))) {
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(ARK_API_KEY|ARK_MODEL_ID)\s*=\s*(.*?)\s*$/);
    if (match) process.env[match[1]] ??= match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
function respond(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}
const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/api/health') return respond(response, 200, { configured: Boolean(process.env.ARK_API_KEY && process.env.ARK_MODEL_ID) });
  if (request.method !== 'POST' || request.url !== '/api/extract') return respond(response, 404, { error: '找不到这个接口。' });
  try {
    let body = '';
    request.setEncoding('utf8');
    for await (const chunk of request) {
      body += chunk;
      if (Buffer.byteLength(body) > 40000) return respond(response, 413, { error: '通知内容太长。' });
    }
    let input;
    try { input = JSON.parse(body); } catch { return respond(response, 400, { error: '请求 JSON 无效。' }); }
    const result = await extractTasks({ text: input.text, apiKey: process.env.ARK_API_KEY, modelId: process.env.ARK_MODEL_ID });
    respond(response, 200, result);
  } catch (error) { respond(response, 502, { error: error.message }); }
});
server.listen(3001, '127.0.0.1', () => console.log('迁移开发 API：http://127.0.0.1:3001'));
