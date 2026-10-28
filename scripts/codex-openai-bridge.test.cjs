'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer, RequestGate } = require('../runtime/bridge.cjs');

async function fixture(t, behavior = 'text', options = {}) {
  const instances = [];
  const server = createServer({ key: 'test-key', maxBody: 4096, maxConcurrent: 2, timeout: 80, ...options,
    rpcFactory() {
      const rpc = { onEvent() {}, closed: false, async initialize() {},
        async call(method, params) {
          if (method === 'config/read') return { config: { mcp_servers: { private_service: {} } } };
          if (method === 'model/list') return { data: [{ id: 'available-model', supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'high' }] }] };
          if (method === 'thread/start') { this.thread = params; return { thread: { id: 'isolated-' + instances.length } }; }
          if (method === 'turn/start') {
            this.input = params;
            setImmediate(() => {
              if (behavior === 'hang') return;
              if (behavior === 'crash') return this.onEvent({ method: 'bridge/error', error: new Error('child died') });
              if (behavior === 'tool') return this.onEvent({ id: 100, method: 'item/tool/call', params: { tool: 'lookup', callId: 'call-1', arguments: { q: '中文' } } });
              if (behavior === 'retry') this.onEvent({ method: 'error', params: { willRetry: true, error: { message: 'Reconnecting' } } });
              if (behavior === 'capacity_always' || (behavior === 'capacity_once' && instances.indexOf(rpc) === 0)) return this.onEvent({ method: 'error', params: { willRetry: false, error: { message: 'Selected model is at capacity. Please try a different model.' } } });
              if (behavior === 'partial_capacity') {
                this.onEvent({ method: 'item/agentMessage/delta', params: { delta: 'partial' } });
                return this.onEvent({ method: 'error', params: { willRetry: false, error: { message: 'Selected model is at capacity.' } } });
              }
              this.onEvent({ method: 'item/agentMessage/delta', params: { delta: behavior === 'json' ? '{"ok":true}' : '你好' } });
              this.onEvent({ method: 'turn/completed', params: { turn: { status: behavior === 'failed' ? 'failed' : 'completed' } } });
            });
          }
        }, close() { this.closed = true; }, send() {},
      };
      instances.push(rpc); return rpc;
    } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const url = 'http://127.0.0.1:' + server.address().port;
  const post = (body, signal) => fetch(url + '/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer test-key' }, body: JSON.stringify(body), signal });
  return { server, url, post, instances };
}
const body = { model: 'available-model', messages: [{ role: 'system', content: 'be concise' }, { role: 'user', content: 'hello' }] };

test('auth, routing, models catalog', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.url + '/v1/models')).status, 401);
  const models = await fetch(f.url + '/v1/models', { headers: { Authorization: 'Bearer test-key' } });
  assert.equal((await models.json()).data[0].id, 'available-model');
  assert.equal(f.instances[0].closed, true);
});
test('text completion, isolated requests and tool history replay', async t => {
  const f = await fixture(t);
  assert.equal((await (await f.post(body)).json()).choices[0].message.content, '你好');
  const next = { ...body, messages: [...body.messages, { role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'lookup', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'c', content: 'result' }] };
  await f.post(next);
  assert.equal(f.instances.length, 2);
  assert.match(f.instances[1].input.input[0].text, /tool_call_id/);
  assert.equal(f.instances[0].thread.sandbox, 'read-only');
  assert.equal(f.instances[0].thread.developerInstructions, 'be concise');
  assert.equal(f.instances[0].thread.config['mcp_servers.private_service.enabled'], false);
});
test('SSE emits chunks, terminal reason and DONE', async t => {
  const f = await fixture(t);
  const response = await f.post({ ...body, stream: true });
  const stream = await response.text();
  assert.match(stream, /你好/); assert.match(stream, /"finish_reason":"stop"/); assert.match(stream, /data: \[DONE\]/);
});
test('dynamic tools are returned for aide execution in JSON and SSE', async t => {
  const f = await fixture(t, 'tool');
  const request = { ...body, tools: [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object' } } }] };
  const output = await (await f.post(request)).json();
  assert.equal(output.choices[0].finish_reason, 'tool_calls');
  assert.deepEqual(JSON.parse(output.choices[0].message.tool_calls[0].function.arguments), { q: '中文' });
  assert.equal(f.instances[0].closed, true);
  const stream = await (await f.post({ ...request, stream: true })).text();
  assert.match(stream, /"index":0,"id":"call-1"/);
});
test('unsupported inputs and size limits fail before spawning', async t => {
  const f = await fixture(t);
  for (const invalid of [null, {}, { ...body, messages: [{ role: 'user', content: [] }] }, { ...body, tools: {} }, { ...body, n: 2 }]) assert.equal((await f.post(invalid)).status, 400);
  assert.equal((await f.post({ ...body, extra: 'x'.repeat(5000) })).status, 413);
  assert.equal(f.instances.length, 0);
});
for (const behavior of ['crash', 'failed', 'hang']) test('cleans child on ' + behavior, async t => {
  const f = await fixture(t, behavior);
  assert.equal((await f.post(body)).status, behavior === 'hang' ? 504 : 502);
  assert.equal(f.instances[0].closed, true);
});
test('client disconnect kills child', async t => {
  const f = await fixture(t, 'hang');
  const response = await f.post({ ...body, stream: true });
  await response.body.cancel();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.instances[0].closed, true);
});
test('transient upstream retry can recover', async t => {
  const f = await fixture(t, 'retry');
  assert.equal((await (await f.post(body)).json()).choices[0].message.content, '你好');
});
test('aide default text response format works in JSON and SSE', async t => {
  const f = await fixture(t);
  const request = { ...body, response_format: { type: 'text' }, temperature: 1, top_p: 1, max_tokens: 8192 };
  assert.equal((await (await f.post(request)).json()).choices[0].message.content, '你好');
  assert.match(await (await f.post({ ...request, stream: true })).text(), /data: \[DONE\]/);
});
test('JSON object output is instructed and validated', async t => {
  const f = await fixture(t, 'json');
  const output = await (await f.post({ ...body, response_format: { type: 'json_object' } })).json();
  assert.deepEqual(JSON.parse(output.choices[0].message.content), { ok: true });
  assert.match(f.instances[0].thread.developerInstructions, /valid JSON object/);
});
test('invalid JSON object output fails instead of claiming success', async t => {
  const f = await fixture(t);
  assert.equal((await f.post({ ...body, response_format: { type: 'json_object' } })).status, 502);
});
test('JSON schema maps to native outputSchema; bad formats fail before inference', async t => {
  const f = await fixture(t, 'json');
  const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
  assert.equal((await f.post({ ...body, response_format: { type: 'json_schema', json_schema: { name: 'test', schema } } })).status, 200);
  assert.deepEqual(f.instances[0].input.outputSchema, schema);
  for (const response_format of [{ type: 'unknown' }, { type: 'json_schema' }, { type: 'json_schema', json_schema: { schema: [] } }]) assert.equal((await f.post({ ...body, response_format })).status, 400);
});

test('aide parallel planner off uses minimum supported effort; auto inherits', async t => {
  const f = await fixture(t, 'json');
  await f.post({ ...body, reasoning_effort: 'off', response_format: { type: 'json_object' } });
  assert.equal(f.instances[0].input.effort, 'low');
  await f.post({ ...body, reasoning_effort: 'auto' });
  assert.equal('effort' in f.instances[1].input, false);
});

test('FIFO queue, bounded overflow, queued cancellation, timeout and idempotent release', async () => {
  const gate = new RequestGate(1, 2, 30);
  const active = await gate.acquire(new AbortController().signal);
  const cancel = new AbortController();
  const pending = gate.acquire(cancel.signal);
  const timed = gate.acquire(new AbortController().signal);
  const timeoutCheck = assert.rejects(timed, e => e.status === 504);
  await assert.rejects(gate.acquire(new AbortController().signal), e => e.status === 429);
  const cancelCheck = assert.rejects(pending, /Client disconnected/);
  cancel.abort(); await cancelCheck; await timeoutCheck;
  assert.equal(gate.queue.length, 0);
  const order = [];
  const a = gate.acquire(new AbortController().signal).then(release => { order.push('a'); return release; });
  const b = gate.acquire(new AbortController().signal).then(release => { order.push('b'); return release; });
  active(); active(); const releaseA = await a;
  assert.deepEqual(order, ['a']); releaseA(); (await b)();
  assert.deepEqual(order, ['a', 'b']); assert.equal(gate.active, 0);
});

const until = async predicate => {
  const deadline = Date.now() + 2000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Condition timed out'); await new Promise(resolve => setTimeout(resolve, 5)); }
};
const finish = (rpc, text) => {
  rpc.onEvent({ method: 'item/agentMessage/delta', params: { delta: text } });
  rpc.onEvent({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
};
test('10 active HTTP requests plus FIFO overflow preserve isolated results', async t => {
  const f = await fixture(t, 'hang', { maxConcurrent: 10, maxQueue: 2, timeout: 5000 });
  const requests = Array.from({ length: 12 }, (_, i) => f.post({ ...body, messages: [{ role: 'user', content: String(i) }] }).then(r => r.json()));
  await until(() => f.instances.length === 10 && f.instances.every(r => r.input));
  assert.equal(f.instances.filter(r => !r.closed).length, 10);
  for (const rpc of f.instances.slice()) finish(rpc, JSON.parse(rpc.input.input[0].text.split('\n')[1])[0].content);
  await until(() => f.instances.length === 12 && f.instances.slice(10).every(r => r.input));
  for (const rpc of f.instances.slice(10)) finish(rpc, JSON.parse(rpc.input.input[0].text.split('\n')[1])[0].content);
  const outputs = await Promise.all(requests);
  assert.deepEqual(outputs.map(x => x.choices[0].message.content), Array.from({ length: 12 }, (_, i) => String(i)));
  assert.ok(f.instances.every(r => r.closed));
});
test('queued HTTP client cancellation never starts a child', async t => {
  const f = await fixture(t, 'hang', { maxConcurrent: 1, timeout: 5000 });
  const active = f.post(body);
  await until(() => f.instances[0]?.input);
  const controller = new AbortController();
  const queued = f.post(body, controller.signal);
  const check = assert.rejects(queued, /abort/i);
  await new Promise(resolve => setTimeout(resolve, 20)); controller.abort(); await check;
  await new Promise(resolve => setTimeout(resolve, 20));
  finish(f.instances[0], 'done'); await active;
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(f.instances.length, 1);
});
test('pre-output capacity error retries with fresh child inside the same request', async t => {
  const f = await fixture(t, 'capacity_once', { capacityRetryDelay: 1, timeout: 1000 });
  const result = await (await f.post(body)).json();
  assert.equal(result.choices[0].message.content, '你好');
  assert.equal(f.instances.length, 2); assert.ok(f.instances.every(r => r.closed));
});
test('capacity retries are bounded and never repeat partial output', async t => {
  const f = await fixture(t, 'capacity_always', { capacityRetryDelay: 1, timeout: 1000 });
  assert.equal((await f.post(body)).status, 502); assert.equal(f.instances.length, 3);
  const partial = await fixture(t, 'partial_capacity', { capacityRetryDelay: 1, timeout: 1000 });
  assert.equal((await partial.post(body)).status, 502); assert.equal(partial.instances.length, 1);
});
test('deadline cancels capacity backoff without starting another child', async t => {
  const f = await fixture(t, 'capacity_always', { capacityRetryDelay: 100, timeout: 30 });
  assert.equal((await f.post(body)).status, 504);
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(f.instances.length, 1);
});
