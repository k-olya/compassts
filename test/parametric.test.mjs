import assert from 'node:assert/strict';
import test from 'node:test';
import { createParametricRuntime, parameterValue, parametric } from '../src/parametric.ts';
import { DEFAULT_CODE, evaluateCode } from '../src/cad.ts';
import { hasUnrenderedChanges, useCadStore } from '../src/store.ts';
import { writeProject } from '../src/project-archive.ts';
import * as compass from 'libcompass';

test('all four control types return primitive defaults with stable per-run automatic names', () => {
  assert.equal('parametric' in compass,false);
  const run = createParametricRuntime();
  assert.equal(run.parametric({ type:'number' }), 0.5);
  assert.equal(run.parametric({ type:'checkbox', name:'Enabled' }), true);
  assert.equal(run.parametric({ type:'text' }), '');
  assert.equal(run.parametric({ type:'select', options:['first','second'] }), 'first');
  assert.equal(run.parametric({ type:'select' }), '');
  assert.deepEqual(run.controls.map(control=>control.name), ['control1','Enabled','control2','control3','control4']);
  assert.deepEqual([run.controls[0].min,run.controls[0].max,run.controls[0].step], [0,1,0.001]);
  assert.equal(createParametricRuntime().parametric({type:'number'}),0.5);
  assert.equal(parametric({type:'text',value:'hello'}),'hello');
});

test('edited values survive compatible declarations and reconcile changed defaults, limits and choices', () => {
  const run=createParametricRuntime();
  run.parametric({type:'number',name:'r',min:0,max:10,value:2});
  run.controls[0]={...run.controls[0],value:8};
  const next=createParametricRuntime(run.controls);
  assert.equal(next.parametric({type:'number',name:'r',max:5,value:2}),5);
  assert.equal(createParametricRuntime(run.controls).parametric({type:'number',name:'r',max:10,value:3}),3);
  assert.equal(createParametricRuntime(run.controls).parametric({type:'text',name:'r'}),'');
  const choices=createParametricRuntime();
  choices.parametric({type:'select',name:'choice',options:['one','two']});
  choices.controls[0]={...choices.controls[0],value:'two'};
  assert.equal(createParametricRuntime(choices.controls).parametric({type:'select',name:'choice',options:['one','three']}),'one');
  assert.equal(parameterValue(run.controls[0],-2),0);
  assert.throws(()=>run.parametric({type:'text',name:'r'}),/Duplicate/);
  for(const input of [{type:'unknown'}, {type:'number',step:0}, {type:'number',min:3,max:2}, {type:'number',value:NaN},
    {type:'number',value:'bad'}, {type:'checkbox',value:1}, {type:'select',options:['one'],value:'two'}, {type:'text',options:[1]}]) {
    assert.throws(()=>createParametricRuntime().parametric(input));
  }
});

test('omitted types infer from value, with string options distinguishing selects from text', () => {
  const run=createParametricRuntime();
  assert.equal(run.parametric({value:0.25}),0.25);
  assert.equal(run.parametric({value:false}),false);
  assert.equal(run.parametric({value:'hello'}),'hello');
  assert.equal(run.parametric({value:'two',options:['one','two']}),'two');
  assert.equal(run.parametric({value:'',options:[]}),'');
  assert.deepEqual(run.controls.map(control=>control.type),['number','checkbox','text','select','select']);
  assert.equal(run.parametric({type:'text',value:'one',options:['one','two']}),'one');
  assert.equal(run.controls.at(-1).type,'text');
  assert.throws(()=>run.parametric({}),/type or/);
  assert.throws(()=>run.parametric({options:['one']}),/type or/);
  assert.throws(()=>run.parametric({type:'number',value:'text'}),/numeric/);
});

test('evaluations own their controls and expose declarations even when later code fails', () => {
  const source=`const r=parametric({type:'number',name:'radius',min:0.1,max:5,value:1});
scene.add(sketch().add(circle(r)).extrude(1));`;
  const first=evaluateCode(source), controls=[{...first.controls[0],value:3}];
  const second=evaluateCode(source,undefined,undefined,{controls});
  assert.equal(first.controls[0].value,1); assert.equal(second.controls[0].value,3);
  assert.equal(Math.max(...Array.from(second.positions).filter((_,i)=>i%3===0)),3);
  assert.deepEqual(evaluateCode('').controls,[]);
  const discovered=[];
  assert.throws(()=>evaluateCode(`parametric({type:'text'}); throw new Error('later');`,undefined,undefined,{onControls:controls=>discovered.push(controls)}),/later/);
  assert.equal(discovered[0][0].name,'control1');
});

test('the store defers geometry changes until Render, tracks code edits, removes stale controls and resets on project load', async t => {
  const original=useCadStore.getState();
  t.after(()=>useCadStore.setState(original));
  const source=`const r=parametric({type:'number',name:'Radius',min:0.1,max:5,value:1});
scene.add(sketch().add(circle(r)).extrude(1));`;
  original.setCode(source);
  await useCadStore.getState().render();
  const rendered=useCadStore.getState().rendered;
  assert.equal(hasUnrenderedChanges(useCadStore.getState()),false);
  useCadStore.getState().setParameter('Radius',3);
  assert.equal(useCadStore.getState().rendered,rendered);
  assert.equal(hasUnrenderedChanges(useCadStore.getState()),true);
  await useCadStore.getState().render();
  assert.equal(useCadStore.getState().rendered.controls[0].value,3);
  assert.equal(hasUnrenderedChanges(useCadStore.getState()),false);
  useCadStore.getState().setCode(source+'\n// changed');
  assert.equal(hasUnrenderedChanges(useCadStore.getState()),true);
  await useCadStore.getState().render();
  assert.equal(useCadStore.getState().controls[0].value,3);
  assert.equal(hasUnrenderedChanges(useCadStore.getState()),false);
  useCadStore.getState().setCode(''); await useCadStore.getState().render();
  assert.deepEqual(useCadStore.getState().controls,[]);
  await useCadStore.getState().loadProject(writeProject('Fresh',[{name:'model.js',source}]));
  assert.deepEqual(useCadStore.getState().controls,[]);
  await useCadStore.getState().render();
  assert.equal(useCadStore.getState().controls[0].value,1);
});

test('the default example declares its hole radius as a number parameter without changing its initial geometry', () => {
  const rendered=evaluateCode(DEFAULT_CODE);
  assert.equal(rendered.controls.length,1);
  assert.equal(rendered.controls[0].name,'Hole radius');
  assert.equal(rendered.controls[0].value,10);
  assert.ok(DEFAULT_CODE.includes('radius: holeRadius'));
});
