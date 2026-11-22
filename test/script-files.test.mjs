import assert from 'node:assert/strict';
import test from 'node:test';
import { scriptName, resolveScript, fetchScriptFile, projectSource } from '../src/script-files.ts';
import { inspectScript, mapProjectLocation } from '../src/project-runtime.ts';
import { errorEntry } from '../src/script-console.ts';

test('file naming, relative imports and remote scripts use consistent identities', async t => {
  assert.equal(scriptName(' parts '), 'parts.js');
  assert.equal(scriptName('parts.js'), 'parts.js');
  assert.equal(scriptName('https://example.com/library'), 'https://example.com/library');
  for (const name of ['', '../part', '/part', 'javascript:alert(1)', 'part?x']) assert.throws(() => scriptName(name));
  const main={name:'model.js',source:''}, nested={name:'parts/nested.js',source:''}, part={name:'part.js',source:''};
  const files=new Map([main,nested,part].map(file=>[file.name,file]));
  assert.equal(resolveScript('../part.js',nested,files),'part.js');
  assert.equal(resolveScript('./parts/nested',main,files),'parts/nested.js');
  assert.equal(resolveScript('./helper.js',{name:'remote',url:'https://example.com/lib/main.js',source:''},files),'https://example.com/lib/helper.js');
  assert.throws(()=>resolveScript('./missing.js',main,files),/Cannot resolve/);
  t.mock.method(globalThis,'fetch',async()=>({ok:true,url:'https://example.com/redirected.js',text:async()=> 'export const x = 1;'}));
  const remote=await fetchScriptFile('https://example.com/original.js');
  assert.equal(remote.name,'https://example.com/original.js');assert.equal(remote.url,'https://example.com/redirected.js');
  assert.notEqual(projectSource([main]),projectSource([{...main,source:'changed'}]));
});

test('module inspection distinguishes classic globals and preserves source errors and positions', () => {
  assert.equal(inspectScript({name:'model.js',source:'const x = 1;'}).classic,false);
  assert.equal(inspectScript({name:'remote',url:'https://example.com/x.js',source:'var x = 1;'}).classic,true);
  assert.equal(inspectScript({name:'remote',url:'https://example.com/x.js',source:'export const x = 1;'}).classic,false);
  assert.equal(inspectScript({name:'remote',url:'https://example.com/x.js',source:'await Promise.resolve();'}).classic,false);
  assert.throws(()=>inspectScript({name:'broken.js',source:'\nconst = ;'}),error=>error.scriptLocation.file==='broken.js'&&error.scriptLocation.line===2);
  const maps=new Map([['part.js',[{start:0,end:5,text:'a-long-import',line:1,column:0}]]]);
  assert.deepEqual(mapProjectLocation({file:'part.js',line:1,column:20},maps),{file:'part.js',line:1,column:12});
  const error=Object.assign(new Error('bad'),{stack:'Error: bad\n at build (compass-file:///part.js:2:4)\n at compass-file:///model.js:3:1'});
  const entry=errorEntry(error);
  assert.deepEqual(entry.location,{file:'part.js',line:2,column:4});
  assert.match(entry.stack,/model.js:3:1/);
});

test('project file actions protect the entry point and URL sources', async t => {
  const { useCadStore }=await import('../src/store.ts');
  const state=()=>useCadStore.getState();
  await state().addFile('part');assert.equal(state().activeFile,'part.js');
  state().setCode('export const n = 1;');state().selectFile('model.js');state().selectFile('part.js');
  assert.equal(state().code,'export const n = 1;');
  state().renameFile('part.js','piece');assert.equal(state().activeFile,'piece.js');
  assert.throws(()=>state().renameFile('model.js','main'),/cannot be renamed/);
  state().deleteFile('model.js');assert.ok(state().files.some(file=>file.name==='model.js'));
  await assert.rejects(()=>state().addFile('piece'),/already exists/);
  t.mock.method(globalThis,'fetch',async()=>({ok:true,url:'https://example.com/remote.js',text:async()=> 'var remote = 2;'}));
  await state().addFile('https://example.com/remote.js');state().setCode('replacement');
  assert.equal(state().code,'var remote = 2;');
  assert.throws(()=>state().renameFile(state().activeFile,'editable'),/cannot be renamed/);
  state().deleteFile(state().activeFile);assert.equal(state().activeFile,'model.js');
  state().deleteFile('piece.js');
});
