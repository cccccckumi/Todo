import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTasks } from '../../shared/ai.js';
test('AI 结构化返回经过校验，无效日期不会混入任务', async () => {
  const result = await extractTasks({ apiKey: 'test-only', modelId: 'model-test', text: '明天提交作业', fetchImpl: async (_url, options) => {
    assert.equal(options.headers.authorization, 'Bearer test-only');
    assert.equal(JSON.parse(options.body).response_format.type, 'json_object');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ tasks: [{ title: '提交作业', dueDate: '2026-02-30', category: '学习', priority: 'high' }] }) } }] }) };
  } });
  assert.equal(result.tasks[0].dueDate, ''); assert.equal(result.tasks[0].priority, 'high');
});
test('缺少配置、无效模型和非 JSON 内容返回清晰错误', async () => {
  await assert.rejects(extractTasks({ text: '通知' }), /设置/);
  await assert.rejects(extractTasks({ apiKey: 'test', modelId: 'test', text: '通知', fetchImpl: async () => ({ ok: false, status: 404 }) }), /模型/);
  await assert.rejects(extractTasks({ apiKey: 'test', modelId: 'test', text: '通知', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /解析/);
});
