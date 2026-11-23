import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { readProject, writeProject } from '../src/project-archive.ts';

const localFiles = [
  { name: 'model.js', source: 'import { size } from "./parts/尺寸.js";\nconsole.log(size);' },
  { name: 'parts/尺寸.js', source: 'export const size = 12; // ✓' },
];
const remote = { name: 'https://example.com/library.js', url: 'https://cdn.example.com/library.js', source: 'var external = 42;' };
const archive = (manifest, scripts = { 'model.js': '' }) => zipSync(Object.fromEntries([
  ['project.json', strToU8(JSON.stringify(manifest))],
  ...Object.entries(scripts).map(([name, source]) => [name, strToU8(source)]),
]));

test('.cts stores local sources and ordered URL references, and reloads external libraries', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async url => ({ ok: true, url: remote.url, text: async () => {
    assert.equal(url, remote.name); return 'var external = 43;';
  } }));
  const bytes = writeProject('  My project  ', [...localFiles, remote]);
  assert.deepEqual([...bytes.slice(0, 2)], [0x50, 0x4b]);
  assert.equal(fetch.mock.callCount(), 0);
  const entries = unzipSync(bytes);
  assert.deepEqual(Object.keys(entries).sort(), ['model.js', 'parts/尺寸.js', 'project.json']);
  assert.equal(strFromU8(entries['parts/尺寸.js']), localFiles[1].source);
  assert.deepEqual(JSON.parse(strFromU8(entries['project.json'])), {
    version: 1, name: 'My project', files: [{ name: 'model.js' }, { name: 'parts/尺寸.js' }, { name: remote.name, url: remote.url }],
  });
  const loaded = await readProject(bytes);
  assert.equal(loaded.name, 'My project');
  assert.deepEqual(loaded.files, [...localFiles, { ...remote, source: 'var external = 43;' }]);
  assert.equal(fetch.mock.callCount(), 1);
  const reordered = await readProject(writeProject('', [...localFiles].reverse()));
  assert.equal(reordered.name, 'Untitled');
  assert.deepEqual(reordered.files, localFiles);
});

test('malformed archives fail before loading URLs or changing the current project', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Offline'); });
  const manifest = { version: 1, name: 'Example', files: [{ name: 'model.js' }] };
  const bad = [
    strToU8('not a ZIP'), zipSync({}), zipSync({ 'project.json': strToU8('{broken') }),
    archive(null), archive({ ...manifest, version: 2 }), archive({ ...manifest, name: '' }),
    archive({ ...manifest, files: [] }), archive({ ...manifest, files: [{ name: 'missing.js' }] }),
    archive({ ...manifest, files: [{ name: '../model.js' }] }),
    archive({ ...manifest, files: [{ name: 'model.js' }, { name: 'model.js' }] }),
    archive({ ...manifest, files: [{ name: remote.name, url: 'javascript:bad' }, { name: 'model.js' }] }),
    archive({ ...manifest, files: [{ name: remote.name, url: remote.url }, { name: 'missing.js' }] }),
  ];
  const { useCadStore } = await import('../src/store.ts');
  const previous = useCadStore.getState();
  for (const bytes of bad) {
    await assert.rejects(() => previous.loadProject(bytes));
    assert.equal(useCadStore.getState(), previous);
  }
  assert.equal(fetch.mock.callCount(), 0);
  await assert.rejects(() => previous.loadProject(writeProject('Unavailable', [...localFiles, remote])), /Offline/);
  assert.equal(useCadStore.getState(), previous);
});

test('loading replaces the project atomically, resets editor and console, and waits for Render', async t => {
  const { useCadStore } = await import('../src/store.ts');
  const state = () => useCadStore.getState();
  await state().addFile('old');
  let finishFetch;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finishFetch = resolve; }));
  const pendingAdd = state().addFile('https://example.com/old-project.js');
  state().setProjectName('Old project');
  useCadStore.setState({ error: 'Old error', consoleOpen: true, evaluationError: { text: 'old' }, consoleEntries: [{ text: 'old' }] });
  await state().loadProject(writeProject('New project', localFiles));
  finishFetch({ ok: true, url: 'https://example.com/old-project.js', text: async () => 'var stale = 1;' });
  await pendingAdd;
  assert.equal(state().projectName, 'New project');
  assert.deepEqual(state().files, localFiles);
  assert.equal(state().activeFile, 'model.js'); assert.equal(state().code, localFiles[0].source);
  assert.equal(state().rendered.positions.length, 0);
  assert.equal(state().rendering, false); assert.equal(state().error, null); assert.equal(state().evaluationError, null);
  assert.deepEqual(state().consoleEntries, []); assert.equal(state().consoleOpen, false);
  assert.throws(() => state().renameFile('model.js', 'main'), /cannot be renamed/);
});
