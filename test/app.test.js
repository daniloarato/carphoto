import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { createApp } from '../src/app.js';
import { createImageEditor, ImageServiceError } from '../src/openai.js';
import { presets } from '../src/presets.js';

const photo = PNG.sync.write({ width: 32, height: 24, data: Buffer.alloc(32 * 24 * 4, 255) });

async function start(t, options = {}) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

function payload(preset = 'proshot', image = photo, mime = 'image/png') {
  const form = new FormData();
  form.set('preset', preset);
  if (image) form.set('image', new Blob([image], { type: mime }), 'car.png');
  return form;
}

test('serves the application and reports missing configuration honestly', async (t) => {
  const base = await start(t, { apiKey: '' });
  assert.match(await (await fetch(base)).text(), /O mesmo carro/);
  assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { ok: true, generationConfigured: false });
  assert.equal((await fetch(`${base}/api/edit`, { method: 'POST', body: payload() })).status, 503);
});

for (const preset of Object.keys(presets)) test(`edits ${preset} with decoded photo and matching prompt`, async (t) => {
  const base = await start(t, { editImage: async ({ image, prompt, signal }) => {
    assert.equal(prompt, presets[preset].prompt);
    assert.equal(jpeg.decode(image).width, 32);
    assert.ok(signal instanceof AbortSignal);
    return photo;
  } });
  const response = await fetch(`${base}/api/edit`, { method: 'POST', body: payload(preset) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), photo);
});

test('rejects invalid styles, missing image, spoofed image, and SVG', async (t) => {
  let called = false;
  const base = await start(t, { editImage: async () => { called = true; return photo; } });
  for (const body of [payload('__proto__'), payload('proshot', null), payload('proshot', 'not an image'), payload('proshot', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>')]) {
    const response = await fetch(`${base}/api/edit`, { method: 'POST', body });
    assert.equal(response.status, 400);
  }
  assert.equal(called, false);
});

test('rejects files larger than 15 MB before calling the editor', async (t) => {
  const base = await start(t, { editImage: () => { assert.fail('must not call editor'); } });
  const response = await fetch(`${base}/api/edit`, { method: 'POST', body: payload('proshot', Buffer.alloc(15 * 1024 * 1024 + 1)) });
  assert.equal(response.status, 413);
});

test('rejects cross-origin requests', async (t) => {
  const base = await start(t, { editImage: () => { assert.fail('must not call editor'); } });
  assert.equal((await fetch(`${base}/api/edit`, { method: 'POST', headers: { origin: 'https://other.example' }, body: payload() })).status, 403);
});

test('does not leak internal errors or credentials', async (t) => {
  const base = await start(t, { editImage: () => { throw new Error('secret-value-private'); } });
  const response = await fetch(`${base}/api/edit`, { method: 'POST', body: payload() });
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /secret-value-private/);
});

test('prevents simultaneous paid requests and releases the slot after completion', async (t) => {
  let release;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const base = await start(t, { editImage: async () => { started(); await new Promise((resolve) => { release = resolve; }); return photo; } });
  const first = fetch(`${base}/api/edit`, { method: 'POST', body: payload() });
  await ready;
  assert.equal((await fetch(`${base}/api/edit`, { method: 'POST', body: payload() })).status, 429);
  release();
  assert.equal((await first).status, 200);
});

test('OpenAI adapter sends multipart image edit with server-side authentication', async () => {
  const edit = createImageEditor({ apiKey: 'test-only-key', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(options.headers.Authorization, 'Bearer test-only-key');
    assert.equal(options.body.get('model'), 'gpt-image-1.5');
    assert.equal(options.body.get('input_fidelity'), 'high');
    assert.equal(options.body.get('prompt'), 'test prompt');
    assert.equal(options.body.get('image').type, 'image/jpeg');
    return Response.json({ data: [{ b64_json: photo.toString('base64') }] });
  } });
  assert.deepEqual(await edit({ image: photo, prompt: 'test prompt' }), photo);
});

test('OpenAI errors are mapped to safe, actionable responses', async () => {
  for (const [upstream, expected] of [[401, 503], [403, 503], [429, 429], [400, 422], [500, 502]]) {
    const edit = createImageEditor({ apiKey: 'test-only-key', fetchImpl: async () => new Response('private upstream response', { status: upstream }) });
    await assert.rejects(() => edit({ image: photo, prompt: 'test' }), (error) => error instanceof ImageServiceError && error.status === expected && !error.message.includes('private'));
  }
});
