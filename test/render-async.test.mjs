import assert from 'node:assert/strict';
import test from 'node:test';
import { rollup } from 'rollup';
import { bundleProject } from '../src/worker-project.ts';
import { renderAsync } from '../src/render-async.ts';
import { errorEntry } from '../src/script-console.ts';
import { useCadStore } from '../src/store.ts';
import { writeProject } from '../src/project-archive.ts';

test('render yields before evaluating, records elapsed time, and discards superseded or unloaded runs', async t => {
  const original = useCadStore.getState();
  t.after(() => useCadStore.setState(original));
  t.mock.method(console, 'log', () => {});
  let clock = 100;
  t.mock.method(performance, 'now', () => clock);
  const state = () => useCadStore.getState();
  state().setCode('console.log("first");');
  const first = state().render();
  assert.equal(state().rendering, true);
  assert.equal(state().rendered, original.rendered);
  assert.equal(state().renderStartedAt, 100);
  assert.deepEqual(state().consoleEntries, []);
  clock = 1500;
  await first;
  assert.equal(state().rendering, false);
  assert.equal(state().renderStartedAt, null);
  assert.equal(state().renderDuration, 1400);
  assert.deepEqual(state().consoleEntries.map(entry => entry.text), ['first']);
  state().setCode('console.log("superseded");');
  const stale = state().render();
  state().setCode('console.log("current");');
  await state().render(); await stale;
  assert.deepEqual(state().consoleEntries.map(entry => entry.text), ['current']);
  const pending = state().render();
  await state().loadProject(writeProject('New', [{ name: 'model.js', source: '' }]));
  await pending;
  assert.equal(state().renderDuration, null);
  assert.equal(state().rendering, false);
  assert.deepEqual(state().consoleEntries, []);
});

test('worker console references stay lazy, preserve shared identities, and dispose pending inspections on abort', async t => {
  let worker;
  class FakeWorker {
    messages = []; terminated = false;
    constructor() { worker = this; }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    reply(data) { this.onmessage({ data }); }
  }
  const originalWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  t.after(() => { if (originalWorker === undefined) delete globalThis.Worker; else globalThis.Worker = originalWorker; });
  const controller = new AbortController(), output = [], controls = [];
  const pending = renderAsync([{ name: 'model.js', source: '' }], entry => output.push(entry), 0.0128, {
    signal: controller.signal, controls: [], onControls: value => controls.push(value), onFileLoaded: () => {},
  });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(worker.messages[0].type, 'render');
  worker.reply({ type: 'controls', controls: [{ name: 'Radius' }] });
  worker.reply({ type: 'output', entry: { id: 0, text: 'Object', level: 'log', parts: [{ value: { remoteId: 0, label: 'Solid {…}' } }] } });
  assert.equal(controls[0][0].name, 'Radius');
  const value = output[0].parts[0].value;
  assert.equal(value.label, 'Solid {…}');
  assert.equal(worker.messages.length, 1);
  const properties = value.properties();
  const request = worker.messages.at(-1).request;
  worker.reply({ type: 'properties', request, properties: [{ key: 'self', value: { remoteId: 0, label: 'Solid {…}' } }] });
  assert.equal((await properties)[0].value, value);
  worker.reply({ type: 'rendered', rendered: { positions: new Float32Array(), meshes: [], controls: [] } });
  const result = await pending;
  assert.equal(worker.terminated, false);
  const unfinished = value.properties();
  controller.abort();
  assert.equal(worker.terminated, true);
  assert.match((await unfinished)[0].text, /ended/);
  result.dispose();
});

test('bundled modules preserve live bindings, static cycles and user-script error locations', async () => {
  const files = [
    { name: 'model.js', source: 'import { value, increment } from "./a.js";\nincrement();\nexport const answer = value;\nexport function fail() { throw new Error("mapped"); }' },
    { name: 'a.js', source: 'import { one } from "./b.js"; export let value = 1; export function increment() { value += one(); }' },
    { name: 'b.js', source: 'import { value } from "./a.js"; export function one() { return value; }' },
  ];
  const project = await bundleProject(files, {}, () => {}, rollup);
  try {
    const code = await (await fetch(project.url)).text();
    const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    assert.equal(module.answer, 2);
    try { module.fail(); assert.fail('Expected user error'); }
    catch (error) {
      const entry = errorEntry(error, undefined, undefined, project.location);
      assert.equal(entry.location.file, 'model.js');
      assert.equal(entry.location.line, 4);
      assert.match(entry.stack, /model.js:4:/);
    }
  } finally { project.dispose(); }
});
