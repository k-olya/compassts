import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { MAX_PROJECT_BYTES, projectUrl, readProject, readWebProject, writeProject } from '../src/project-archive.ts';

const localFiles = [
  { name: 'model.js', source: 'import { size } from "./parts/尺寸.js";\nconsole.log(size);' },
  { name: 'parts/尺寸.js', source: 'export const size = 12; // ✓' },
];
const remote = { name: 'https://example.com/library.js', url: 'https://cdn.example.com/library.js', source: 'var external = 42;' };
const archive = (manifest, scripts = { 'model.js': '' }) => zipSync(Object.fromEntries([
  ['project.json', strToU8(JSON.stringify(manifest))],
  ...Object.entries(scripts).map(([name, source]) => [name, strToU8(source)]),
]));
const response = (body, url, init) => Object.defineProperty(new Response(body, init), 'url', { value: url });

test('web loading detects packed projects, preserves URL query strings and reloads external libraries', async t => {
  const url = 'https://example.com/download?file=test.cts&signature=a%2Bb';
  const requests = [];
  t.mock.method(globalThis, 'fetch', async input => {
    requests.push(input);
    if (input === url) return response(writeProject('Packed web project', [...localFiles, remote]), url);
    assert.equal(input, remote.name);
    return response('var external = 43;', remote.url);
  });
  const project = await readWebProject(url);
  assert.equal(project.name, 'Packed web project');
  assert.deepEqual(project.files, [...localFiles, { ...remote, source: 'var external = 43;' }]);
  assert.deepEqual(requests, [url, remote.name]);
});

test('unpacked projects resolve nested editable scripts beside the redirected manifest and can be saved as .cts', async t => {
  const url = 'https://example.com/project.json', base = 'https://cdn.example.com/models/demo/project.json';
  const manifest = { version: 1, name: 'Unpacked web project', files: [
    { name: localFiles[1].name }, { name: remote.name, url: remote.url }, { name: 'model.js' },
  ] };
  const requests = [];
  const routes = new Map([
    [url, () => response(JSON.stringify(manifest), base)],
    ['https://cdn.example.com/models/demo/model.js', () => response(localFiles[0].source, base)],
    ['https://cdn.example.com/models/demo/parts/%E5%B0%BA%E5%AF%B8.js', () => response(localFiles[1].source, base)],
    [remote.name, () => response(remote.source, remote.url)],
  ]);
  t.mock.method(globalThis, 'fetch', async input => { requests.push(input); assert.ok(routes.has(input), input); return routes.get(input)(); });
  const { useCadStore } = await import('../src/store.ts');
  await useCadStore.getState().loadProject(url);
  const project = useCadStore.getState();
  assert.equal(project.projectName, manifest.name);
  assert.deepEqual(project.files, [localFiles[0], localFiles[1], remote]);
  assert.equal(project.activeFile, 'model.js'); assert.equal(project.rendered.positions.length, 0);
  assert.equal(requests.length, 4);
  const saved = unzipSync(writeProject(project.projectName, project.files));
  assert.equal(strFromU8(saved['model.js']), localFiles[0].source);
  assert.equal(strFromU8(saved['parts/尺寸.js']), localFiles[1].source);
  assert.equal(Object.keys(saved).length, 3);
});

test('invalid URLs and unpacked projects fail without replacing the active project', async t => {
  const { useCadStore } = await import('../src/store.ts');
  const previous = useCadStore.getState(), requests = [];
  t.mock.method(globalThis, 'fetch', async input => {
    requests.push(input);
    if (input.endsWith('/http-error')) return response('', input, { status: 404 });
    if (input.endsWith('/oversized')) return response('', input, { headers: { 'content-length': String(MAX_PROJECT_BYTES + 1) } });
    if (input.endsWith('/invalid')) return response(JSON.stringify({ version: 1, name: 'Bad', files: [{ name: '../model.js' }] }), input);
    if (input.endsWith('/project.json')) return response(JSON.stringify({ version: 1, name: 'Missing', files: [{ name: 'model.js' }] }), input);
    return response('', input, { status: 404 });
  });
  for (const input of ['', 'javascript:alert(1)', 'data:text/plain,test', 'file:///project.json', '/project.json']) {
    assert.throws(() => projectUrl(input), /HTTP\(S\)/);
    await assert.rejects(() => previous.loadProject(input), /HTTP\(S\)/);
  }
  assert.equal(requests.length, 0);
  for (const path of ['http-error', 'oversized', 'invalid', 'project.json']) {
    await assert.rejects(() => previous.loadProject(`https://example.com/${path}`));
    assert.equal(useCadStore.getState(), previous);
  }
  assert.equal(requests.filter(url => url.endsWith('/model.js')).length, 1);
});

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
