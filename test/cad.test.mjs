import assert from "node:assert/strict";
import { test } from "node:test";
import { Circle, Node, Solid } from "libcompass";
import { DEFAULT_CODE, evaluateCode, exportBinaryStl } from "../src/cad.ts";
import { useCadStore } from "../src/store.ts";

test("the example evaluates into a Node scene using real libcompass geometry", () => {
  const result = evaluateCode(DEFAULT_CODE);
  assert.ok(result.scene instanceof Node);
  assert.equal(result.scene.children.length, 1);
  assert.ok(result.scene.children[0] instanceof Solid);
  assert.equal(result.scene.children[0].surfaces.length, 8);
  assert.equal(result.scene.children[0].boundaries.length, 16);
  assert.ok(!DEFAULT_CODE.includes("circleSegments"));
  assert.ok(result.positions.length > 0);
  assert.equal(result.positions.length % 9, 0);
  assert.ok(result.positions.every(Number.isFinite));
  assert.notEqual(evaluateCode(DEFAULT_CODE).scene, result.scene);
});

test("render scopes isolate repeated declarations and expose gl-matrix", () => {
  const source = "const m = mat4.create(); scene.add(new TransformMat4({ matrix: m }));";
  assert.deepEqual(evaluateCode(source).positions, new Float32Array());
  assert.deepEqual(evaluateCode(source).positions, new Float32Array());
});

test("editor scripts can add and remove multiple child objects", () => {
  const source = `
    const sketch = new Sketch().add(new Circle({ center: { x: 0, y: 0 }, radius: 5 }));
    const first = extrude({ sketch, length: 10 });
    const second = extrude({ sketch, length: 20 });
    const third = extrude({ sketch, length: 30 });
    scene.add(first, second, third).remove(first, third);
  `;
  const result = evaluateCode(source);
  assert.equal(result.scene.children.length, 1);
  assert.equal(result.positions.length / 9, 4 * (new Circle({ center: { x: 0, y: 0 }, radius: 5 }).sample().length - 1) - 4);
  assert.equal(Math.max(...result.positions), 20);
});

test("invalid code, invalid scenes, and invalid geometry report errors", () => {
  assert.throws(() => evaluateCode("const = ;"), SyntaxError);
  assert.throws(() => evaluateCode("throw new Error('broken model')"), /broken model/);
  assert.throws(() => evaluateCode("scene = {};"), /must be a libcompass Node/);
  assert.throws(() => evaluateCode("scene.triangulate = () => new Float32Array([1, 2, 3]);"), /XYZ triangle/);
  assert.throws(() => evaluateCode("scene.triangulate = () => new Float32Array(9).fill(NaN);"), /finite/);
});

test("binary STL exports exactly the triangles and coordinates in the preview", () => {
  const { positions } = evaluateCode(DEFAULT_CODE);
  const binary = exportBinaryStl(positions);
  const data = new DataView(binary);
  const triangles = positions.length / 9;
  assert.equal(data.getUint32(80, true), triangles);
  assert.equal(binary.byteLength, 84 + triangles * 50);
  for (let triangle = 0; triangle < triangles; triangle++) {
    for (let coordinate = 0; coordinate < 9; coordinate++) {
      assert.equal(data.getFloat32(84 + triangle * 50 + 12 + coordinate * 4, true), positions[triangle * 9 + coordinate]);
    }
  }
});

test("Zustand reports render errors, retains the last model, and recovers on success", (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const original = useCadStore.getState().rendered;
  useCadStore.getState().setCode(DEFAULT_CODE.replace("scene.add(part);", "..error...\nscene.add(part);"));
  useCadStore.getState().render();
  assert.match(useCadStore.getState().error, /Unexpected token/);
  assert.equal(useCadStore.getState().rendered, original);
  assert.equal(logged.mock.callCount(), 1);
  assert.ok(logged.mock.calls[0].arguments[0] instanceof SyntaxError);
  const syntaxEntry = useCadStore.getState().consoleEntries[0];
  assert.deepEqual(syntaxEntry.location, { line: 26, column: 1 });
  assert.equal(syntaxEntry.stack, "at model.js:26:1");
  assert.equal(useCadStore.getState().evaluationError, syntaxEntry);
  useCadStore.getState().setCode("throw new Error('bad model')");
  assert.equal(useCadStore.getState().evaluationError, null);
  useCadStore.getState().render();
  assert.equal(useCadStore.getState().error, "bad model");
  assert.equal(useCadStore.getState().rendered, original);
  assert.equal(logged.mock.callCount(), 2);
  assert.equal(logged.mock.calls[1].arguments[0].message, "bad model");
  assert.equal(useCadStore.getState().evaluationError.text, "Error: bad model");
  useCadStore.getState().closeConsole();
  assert.equal(useCadStore.getState().consoleOpen, false);
  assert.equal(useCadStore.getState().evaluationError.text, "Error: bad model");
  useCadStore.getState().setCode("// empty scene");
  useCadStore.getState().render();
  assert.equal(useCadStore.getState().error, null);
  assert.equal(useCadStore.getState().evaluationError, null);
  assert.equal(useCadStore.getState().rendered.positions.length, 0);
  assert.deepEqual(useCadStore.getState().consoleEntries, []);
  assert.equal(useCadStore.getState().consoleOpen, false);
});

test("script console captures output, objects, assertions, and script-only stack frames", (t) => {
  for (const method of ["log", "info", "warn", "error", "debug", "trace", "assert", "dir", "table", "count", "countReset", "time", "timeLog", "timeEnd", "clear"]) {
    t.mock.method(console, method, () => {});
  }
  const entries = [];
  evaluateCode(`console.log("value %d", 42, { radius: 10 });
console.info("ready");
console.warn("warning");
console.error(new Error("reported"));
console.debug("details");
console.assert(true, "not shown");
console.assert(false, "bad assertion");
const cyclic = { value: 2n }; cyclic.self = cyclic;
console.dir(cyclic);
console.table([{ radius: 10 }]);
console.count("runs"); console.count("runs");
console.countReset("runs"); console.count("runs");
console.time("build"); console.timeLog("build"); console.timeEnd("build");
function nested() { console.trace("trace"); }
nested();`, entry => entries.push(entry));
  assert.equal(entries[0].text, 'value 42 {\n  "radius": 10\n}');
  assert.deepEqual(entries.slice(0, 5).map(entry => entry.level), ["log", "info", "warn", "error", "debug"]);
  assert.deepEqual(entries[0].location, { line: 1, column: 9 });
  assert.ok(entries[3].stack.includes("model.js:4:"));
  assert.equal(entries[5].text, "Assertion failed: bad assertion");
  assert.match(entries[6].text, /2n/);
  assert.match(entries[6].text, /\[Circular\]/);
  assert.deepEqual(entries.slice(8, 11).map(entry => entry.text), ["runs: 1", "runs: 2", "runs: 1"]);
  assert.match(entries[11].text, /^build: [\d.]+ ms$/);
  assert.match(entries[12].text, /^build: [\d.]+ ms$/);
  assert.match(entries[13].stack, /nested .*model.js:14:/);
  assert.match(entries[13].stack, /model.js:15:/);
  assert.ok(!entries[13].stack.includes("cad.ts"));
  evaluateCode("console.clear()", entry => entries.push(entry));
  assert.equal(entries.at(-1), null);

  const errors = [];
  assert.throws(() => evaluateCode(`function inner() {
  throw new Error("broken");
}
function outer() { inner(); }
outer();`, entry => errors.push(entry)), /broken/);
  assert.deepEqual(errors[0].location, { line: 2, column: 9 });
  assert.match(errors[0].stack, /inner .*model.js:2:9/);
  assert.match(errors[0].stack, /outer .*model.js:4:/);
  assert.ok(!errors[0].stack.includes("cad.ts"));
});

test("console belongs to the current run and includes renderer errors without changing the scene", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  const store = () => useCadStore.getState();
  store().setCode('console.log("before"); Promise.resolve().then(() => console.log("delayed"));');
  store().render();
  await Promise.resolve();
  assert.deepEqual(store().consoleEntries.map(entry => entry.text), ["before", "delayed"]);
  store().setCode('Promise.resolve().then(() => console.log("superseded"));');
  store().render();
  store().setCode('console.log("current");');
  store().render();
  await Promise.resolve();
  assert.deepEqual(store().consoleEntries.map(entry => entry.text), ["current"]);
  const rendered = store().rendered;
  store().reportRendererError(new Error("GPU failed"));
  assert.equal(store().consoleEntries.at(-1).text, "Renderer: Error: GPU failed");
  assert.match(store().consoleEntries.at(-1).stack, /GPU failed/);
  assert.equal(store().rendered, rendered);
  store().closeConsole();
  assert.equal(store().consoleOpen, false);
  assert.equal(store().consoleEntries.at(-1).text, "Renderer: Error: GPU failed");
});

test("console retains all entries, closes manually, and follows output across runs", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "clear", () => {});
  const store = () => useCadStore.getState();
  store().setCode('for (let i = 0; i < 1205; i++) console.log("row", i);');
  store().render();
  assert.equal(store().consoleOpen, true);
  assert.equal(store().consoleEntries.length, 1205);
  assert.equal(store().consoleEntries[0].text, "row 0");
  assert.equal(store().consoleEntries.at(-1).text, "row 1204");
  store().closeConsole();
  assert.equal(store().consoleOpen, false);
  assert.equal(store().consoleEntries.length, 1205);
  store().setCode('// no output');
  store().render();
  assert.equal(store().consoleOpen, false);
  assert.deepEqual(store().consoleEntries, []);
  store().setCode('console.log("sync"); Promise.resolve().then(() => console.log("async"));');
  store().render();
  store().closeConsole();
  await Promise.resolve();
  assert.equal(store().consoleOpen, true);
  assert.deepEqual(store().consoleEntries.map(entry => entry.text), ["sync", "async"]);
  store().setCode('console.log("cleared"); console.clear();');
  store().render();
  assert.equal(store().consoleOpen, false);
  assert.deepEqual(store().consoleEntries, []);
});
