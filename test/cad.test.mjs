import assert from "node:assert/strict";
import { test } from "node:test";
import { Circle, Node, Solid, setTriangulationResolution } from "libcompass";
import { DEFAULT_CODE, evaluateCode, exportBinaryStl } from "../src/cad.ts";
import { useCadStore } from "../src/store.ts";

test("the example evaluates into a Node scene using real libcompass geometry", () => {
  const result = evaluateCode(DEFAULT_CODE);
  assert.ok(result.scene instanceof Node);
  assert.equal(result.scene.children.length, 1);
  assert.ok(result.scene.children[0] instanceof Solid);
  assert.equal(result.scene.children[0].surfaces.length, 12);
  assert.equal(result.scene.children[0].boundaries.length, 20);
  assert.ok(!DEFAULT_CODE.includes("circleSegments"));
  assert.ok(result.positions.length > 0);
  assert.equal(result.positions.length % 9, 0);
  assert.ok(result.positions.every(Number.isFinite));
  assert.notEqual(evaluateCode(DEFAULT_CODE).scene, result.scene);
});

test("render scopes isolate repeated declarations and expose math globals", () => {
  const source = `const m = mat4.create(); scene.add(new TransformMat4({ matrix: m }));
    const path = spatialCurveFromPlanar({ curve: { at: t => ({ x: t, y: 0 }) }, plane: ZX });
    if (!(path instanceof SpatialCurve) || path.at(0.5).position[2] !== 0.5) {
      throw new Error("Incorrect planar curve lift global");
    }
    if (PI !== Math.PI || radtodeg(PI) !== 180 || degtorad(-90) !== -PI / 2) {
      throw new Error("Incorrect angle globals");
    }
    if (center.x !== 0 || center.y !== 0 || !vec3.exactEquals(origin, [0, 0, 0])) {
      throw new Error("Incorrect center/origin globals");
    }
    for (const [axis, expected] of [[negX, [-1, 0, 0]], [negY, [0, -1, 0]], [negZ, [0, 0, -1]]]) {
      if (!(axis instanceof SpatialLine) || !vec3.exactEquals(axis, expected) || !vec3.exactEquals(axis.origin, origin)) {
        throw new Error("Incorrect negative axis globals");
      }
    }
    circle({ center, radius: 1 });
    spatialLine({ direction: Z, origin });`;
  assert.deepEqual(evaluateCode(source).positions, new Float32Array());
  assert.deepEqual(evaluateCode(source).positions, new Float32Array());
});

test("planar segment generators are script globals that produce extrudable profiles", () => {
  const result = evaluateCode(`
    scene.add(sketch().add(...polyline({ points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }], loop: true })).extrude({ length: 2 }));
    scene.add(sketch().add(...rectangle({ start: { x: 10, y: 0 }, end: { x: 14, y: 3 } })).extrude({ length: 2 }));
    scene.add(sketch().add(centerRectangle({ center: { x: 0, y: 0 }, corner: { x: 1, y: 2 } })).extrude({ length: 2 }));
  `);
  assert.equal(result.scene.children.length, 3);
  assert.deepEqual(result.scene.children.map(part => part.surfaces.length), [5, 6, 6]);
  assert.ok(result.positions.every(Number.isFinite));
});

test("roundPolyline is a script global producing extrudable tangent arcs without changing its input", () => {
  const result = evaluateCode(`
const segments = rectangle({ start: { x: -1, y: -1 }, end: { x: 1, y: 1 } });
const before = JSON.stringify(segments);
const rounded = roundPolyline({ segments, radius: 1 });
if (JSON.stringify(segments) !== before) throw new Error('Source polyline was modified');
if (rounded.length !== 4 || !rounded.every(element => element instanceof PlanarCurve)) throw new Error('Not a circular profile');
scene.add(sketch().add(rounded).extrude({ length: 2 }));`);
  assert.equal(result.scene.children.length, 1);
  assert.equal(result.scene.children[0].surfaces.length, 6);
  assert.ok(result.positions.length > 0);
});

test("spatial lines and nonmutating rigid transforms are script globals", () => {
  const result = evaluateCode(`
    if (!(X instanceof SpatialLine) || Z.origin.some(value => value !== 0)) throw new Error("Invalid default axes");
    const axis = spatialLine({ direction: [0, 0, 2], origin: [1, 0, 0] });
    const frame = XY.rotate({ axis: X, angle: 30 });
    const source = sketch({ plane: frame }).add(circle({ center: { x: 0, y: 0 }, radius: 2 })).extrude({ axis: Z, length: 3 });
    const turned = source.rotate({ axis, angle: 90 });
    const moved = turned.displace({ vector: [4, 0, 1] });
    if (source === moved || moved.surfaces.some(surface => source.surfaces.includes(surface))) throw new Error("Mutated solid");
    scene.add(source, moved);
  `);
  assert.equal(result.scene.children.length, 2);
  assert.ok(result.positions.length > 0);
  assert.ok(result.positions.every(Number.isFinite));
});

test("geometry arrays flatten nested solid groups for direct scene insertion", () => {
  const result = evaluateCode(`
    const part = sketch().add(circle({ center: { x: 4, y: 0 }, radius: 1 })).extrude({ length: 2 });
    const row = displacementArray({ object: part, vector: [10, 0, 0], width: 10, offset: 5 });
    const grid = displacementArray({ object: row, vector: Y, N: 3, offset: 5 });
    scene.add(grid);
    const rings = rotationArray({ object: row, axis: Z, N: 4 });
    scene.add(rings[0], rings.slice(1));
    if (grid.length !== 6 || rings.length !== 8) throw new Error("Invalid flat array size");
    if (grid[0] === part || rings[0] === row[0]) throw new Error("Array reused source objects");
  `);
  assert.equal(result.scene.children.length, 14);
  assert.ok(result.positions.length > 0);
  assert.ok(result.positions.every(Number.isFinite));
});

test("ellipse is a script global that renders an exact rotated loop", () => {
  const result = evaluateCode(`
    const oval = ellipse({ center: { x: 3, y: -2 }, radiusX: 6, radiusY: 3, rotation: 30 });
    if (!(oval instanceof PlanarCurve) || oval.start !== oval.end) throw new Error("Invalid ellipse loop");
    scene.add(sketch().add(oval).extrude({ length: 4 }));
  `);
  assert.equal(result.scene.children.length, 1);
  assert.equal(result.scene.children[0].surfaces.length, 3);
  assert.ok(result.positions.length > 0);
  assert.ok(result.positions.every(Number.isFinite));
});

test("arc is a script global for all four arc constructions", () => {
  const result = evaluateCode(`
    const arcs = [
      arc({ start: { x: -2, y: 0 }, end: { x: 2, y: 0 }, angle: 180 }),
      arc({ center: { x: 10, y: 0 }, start: { x: 8, y: 0 }, end: { x: 12, y: 0 }, direction: "clockwise" }),
      arc({ start: { x: 20, y: 0 }, through: { x: 22, y: 2 }, end: { x: 24, y: 0 } }),
      arc({ start: { x: 32, y: 0 }, center: { x: 30, y: 0 }, angle: -270 }),
    ];
    for (const a of arcs) scene.add(sketch().add(a, lineSegment({ start: a.end, end: a.start })).extrude({ length: 2 }));
  `);
  assert.equal(result.scene.children.length, 4);
  assert.ok(result.positions.length > 0);
  assert.ok(result.positions.every(Number.isFinite));
});

test("trimming operations are script globals and render retained exact surfaces", () => {
  const result = evaluateCode(`const arc = trimCurve({
    curve: circle({ center: { x: 0, y: 0 }, radius: 5 }),
    cutters: [line({ point: { x: 0, y: 0 }, direction: [0, 1] })], keep: 0,
  });
  const part = sketch().add(arc, lineSegment({ start: arc.end, end: arc.start })).extrude({ length: 3 });
  const patches = trimSurface({ surface: part.surfaces[0],
    cutter: plane({ a: [2, 0, 0], b: [2, 1, 0], c: [2, 0, 1] }), keep: "positive" });
  scene.add(solid({ surfaces: patches }));`);
  assert.equal(result.scene.children.length, 1);
  assert.ok(result.positions.length > 0);
  for (let i = 0; i < result.positions.length; i += 3) assert.ok(result.positions[i] >= 2 - 1e-6);
});

test("boolean operations and Solid methods are script globals and render their exact results", () => {
  const result = evaluateCode(`const corners = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const base = sketch().add(...corners.map((start, i) => lineSegment({ start, end: corners[(i + 1) % 4] })));
  const part = base.extrude({ length: 5 });
  const hole = sketch().add(circle({ center: { x: 5, y: 5 }, radius: 1 }));
  const cutter = hole.extrude({ length: 7 });
  const common = intersect({ solid: part, tool: cutter });
  const cut = part.difference({ tool: cutter });
  const drilled = extrudeCut({ solid: part, sketch: hole, length: 7 });
  const cutByMethod = part.extrudeCut({ sketch: hole, length: 7 });
  const commonByMethod = part.intersect({ tool: cutter });
  const cutByFunction = difference({ solid: part, tool: cutter });
  scene.add(common, cut, drilled, cutByMethod, commonByMethod, cutByFunction);`);
  assert.equal(result.scene.children.length, 6);
  assert.ok(result.positions.length > 0);
  assert.ok(result.positions.every(Number.isFinite));
});

test("general curved booleans render through script globals and retain mathematical regions", () => {
  const result = evaluateCode(`const a = sketch().add(circle({ center: { x: 0, y: 0 }, radius: 2 })).extrude({ length: 5 });
const b = sketch().add(circle({ center: { x: 2, y: 0 }, radius: 2 })).extrude({ length: 5 });
const cut = a.difference({ tool: b });
if (!cut.surfaces.some(surface => surface instanceof SurfaceRegion)) throw new Error("Missing parametric trims");
scene.add(cut, intersect({ solid: a, tool: b }));`);
  assert.equal(result.scene.children.length, 2);
  assert.ok(result.positions.length > 0);
  assert.ok(result.positions.every(Number.isFinite));
});

test("a radial extrude cut through walls on a chamfered base renders without seam errors", () => {
  const result = evaluateCode(`const baseSketch = sketch();
const center = { x: 0, y: 0 };
baseSketch.add(circle({ center, radius: 6 }));
const base = baseSketch.extrude({ length: 2 }).chamfer({ boundaries: [0] });
scene.add(base);
const wallSketch = sketch({ plane: base.surfaces[1] });
wallSketch.add(circle({ center, radius: 6 }), circle({ center, radius: 5 }));
const walls = wallSketch.extrude({ length: 3 });
const cutterSketch = sketch({ plane: ZX });
cutterSketch.add(circle({ center: { x: 3.5, y: 0 }, radius: 1 }));
const cutWalls = walls.extrudeCut({ sketch: cutterSketch, length: 10 });
scene.add(cutWalls);`);
  assert.equal(result.scene.children.length, 2);
  assert.equal(result.scene.children[1].boundaries.length, 6);
  assert.ok(result.positions.length > 0);
  assert.ok(result.positions.every(Number.isFinite));
});

test("resolution changes rerun the model, update script globals, and enforce bounds", () => {
  const original = useCadStore.getState();
  try {
    useCadStore.getState().setCode(`console.log(TRIANGULATION_RESOLUTION);
scene.add(sketch().add(circle({ center: { x: 0, y: 0 }, radius: 10 })).extrude({ length: 3 }));`);
    useCadStore.getState().render();
    const coarse = useCadStore.getState().rendered.positions.length;
    assert.equal(useCadStore.getState().resolution, 0.0128);
    assert.equal(useCadStore.getState().consoleEntries[0].text, "0.0128");
    useCadStore.getState().setResolution(0.001);
    assert.equal(useCadStore.getState().error, null);
    assert.equal(useCadStore.getState().consoleEntries[0].text, "0.001");
    assert.ok(useCadStore.getState().rendered.positions.length > coarse);
    useCadStore.getState().setResolution(1);
    assert.equal(useCadStore.getState().error, null);
    assert.equal(useCadStore.getState().consoleEntries[0].text, "1");
    assert.ok(useCadStore.getState().rendered.positions.length < coarse);
    for (const invalid of [0.0009, 1.01, NaN, Infinity]) {
      const previous = useCadStore.getState().rendered;
      assert.throws(() => useCadStore.getState().setResolution(invalid), RangeError);
      assert.equal(useCadStore.getState().resolution, 1);
      assert.equal(useCadStore.getState().rendered, previous);
    }
  } finally {
    setTriangulationResolution(original.resolution);
    useCadStore.setState(original);
  }
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

test("chamfer is a script global that returns a new solid while preserving its input", () => {
  const rendered = evaluateCode(`
const source = extrude({ sketch: sketch().add(circle({ center: { x: 0, y: 0 }, radius: 5 })), length: 10 });
const before = source.triangulate();
const part = chamfer({ solid: source, length: 0.5, angle: 45, boundaries: [] });
if (part === source || source.triangulate() !== before || source.surfaces.length !== 3) throw new Error('Input was changed');
if (!part.surfaces.some(surface => surface instanceof TrimmedSurface)) throw new Error('Surface was not trimmed');
scene.add(part);`);
  assert.equal(rendered.scene.children.length, 1);
  assert.equal(rendered.scene.children[0].surfaces.length, 5);
  assert.ok(rendered.positions.length > 0);
});

test("round is a script global and Solid.round renders a sphere while preserving its source", () => {
  const rendered = evaluateCode(`
const source = sketch().add(circle({ center, radius: 1 })).extrude({ length: 2 });
const before = source.triangulate();
const sphere = round({ solid: source, radius: 1, boundaries: [] });
const otherSphere = source.round({ radius: 1 });
if (sphere === source || source.triangulate() !== before || source.surfaces.length !== 3) throw new Error('Input was changed');
if (sphere.surfaces.length !== 2 || otherSphere.surfaces.length !== 2) throw new Error('Not a sphere');
scene.add(sphere);`);
  assert.equal(rendered.scene.children.length, 1);
  assert.ok(rendered.positions.length > 0);
});

test("opposite cube rounds render at the limiting radius for bottom and wall boundary selections", () => {
  for (const [radius, boundaries, surfaces] of [[10, [0, 2], 7], [9.9, [0, 2], 8], [10, [8, 9], 7]]) {
    const result = evaluateCode(`
const rect = centerRectangle({ center, corner: { x: 10, y: 10 } });
const part3 = sketch().add(rect).extrude({ length: 20 });
scene.add(part3.round({ radius: ${radius}, boundaries: ${JSON.stringify(boundaries)} }));`);
    assert.equal(result.scene.children[0].surfaces.length, surfaces);
    assert.ok(result.positions.length > 0);
  }
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
  const errorLine = DEFAULT_CODE.split("\n").findIndex(line => line === "scene.add(part);") + 1;
  assert.deepEqual(syntaxEntry.location, { line: errorLine, column: 1 });
  assert.equal(syntaxEntry.stack, `at model.js:${errorLine}:1`);
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
  assert.equal(entries[0].text, 'value 42 Object {…}');
  assert.deepEqual(entries[0].parts.find(part => "value" in part).value, { radius: 10 });
  assert.deepEqual(entries.slice(0, 5).map(entry => entry.level), ["log", "info", "warn", "error", "debug"]);
  assert.deepEqual(entries[0].location, { line: 1, column: 9 });
  assert.ok(entries[3].stack.includes("model.js:4:"));
  assert.equal(entries[5].text, "Assertion failed: bad assertion");
  const cyclic = entries[6].parts.find(part => "value" in part).value;
  assert.equal(cyclic.value, 2n);
  assert.equal(cyclic.self, cyclic);
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
