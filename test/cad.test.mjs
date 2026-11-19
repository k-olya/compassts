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
    const first = extrude({ sketch, direction: [0, 0, 10] });
    const second = extrude({ sketch, direction: [0, 0, 20] });
    const third = extrude({ sketch, direction: [0, 0, 30] });
    scene.add(first, second, third).remove(first, third);
  `;
  const result = evaluateCode(source);
  assert.equal(result.scene.children.length, 1);
  assert.equal(result.positions.length / 9, 4 * new Circle({ center: { x: 0, y: 0 }, radius: 5 }).sample().length - 4);
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

test("Zustand retains the last successful model on error and replaces it on success", () => {
  const original = useCadStore.getState().rendered;
  useCadStore.getState().setCode("throw new Error('bad model')");
  useCadStore.getState().render();
  assert.equal(useCadStore.getState().error, "bad model");
  assert.equal(useCadStore.getState().rendered, original);
  useCadStore.getState().setCode("// empty scene");
  useCadStore.getState().render();
  assert.equal(useCadStore.getState().error, null);
  assert.equal(useCadStore.getState().rendered.positions.length, 0);
});
