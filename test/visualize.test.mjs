import assert from "node:assert/strict";
import { test } from "node:test";
import { rollup } from "rollup";
import { Color, LineSegments, OrthographicCamera, Raycaster, Vector2 } from "three";
import { Node, colors } from "libcompass";
import { evaluateCode, exportBinaryStl, renderedScene, scriptBindings } from "../src/cad.ts";
import { createParametricRuntime } from "../src/parametric.ts";
import { createPreviewMeshes, disposePreviewMeshes, pickPreviewMesh, setPreviewMeshHovered } from "../src/preview-meshes.ts";
import { bundleProject } from "../src/worker-project.ts";

const coordinates = part => Array.from(part.positions);

test("plane previews draw local X, Y and normal from the same displaced origin", () => {
  const result = evaluateCode(`scene.add(annotate({ geometry: ZX.displace([2, 3, 4]), name: "Frame" }));`);
  assert.equal(result.positions.length, 0);
  assert.deepEqual(result.meshes.map(part => part.color), [colors.red, colors.green, colors.blue]);
  assert.deepEqual(result.meshes.map(coordinates), [
    [2, 3, 4, 2, 3, 14], [2, 3, 4, 12, 3, 4], [2, 3, 4, 2, 13, 4],
  ]);
  assert.ok(result.meshes.every(part => part.primitive === "lines" && part.name === "Frame"));
  assert.equal(new DataView(exportBinaryStl(result)).getUint32(80, true), 0);
});

test("sketches retain placement, curves use sampling overrides, and nested planar arrays remain line geometry", () => {
  const result = evaluateCode(`
const planar = planarCurve(t => ({ x: t * 4, y: t * t * 4 }));
planar.sample = () => [planar.at(0), planar.at(0.25), planar.at(1)];
const spatial = spatialCurve(t => ({ position: [t, t * t, 5] }));
spatial.sample = () => [spatial.at(0), spatial.at(0.75), spatial.at(1)];
scene.add(annotate({ name: "Drawing", geometry: [
  sketch(ZX.displace([2, 3, 4])).add(planar),
  spatial,
  [rectangle({ center, width: 4, height: 2 }), circle(2)],
  line({ point: center, direction: [2, 0] }),
  spatialLine({ origin: [1, 2, 3], direction: [0, 0, 2] }),
  center,
], color: "blue", alpha: 0.6 }));
`);
  assert.deepEqual(coordinates(result.meshes[0]), [2, 3, 4, 2.25, 3, 5, 2.25, 3, 5, 6, 3, 8]);
  assert.deepEqual(coordinates(result.meshes[1]), [0, 0, 5, 0.75, 0.5625, 5, 0.75, 0.5625, 5, 1, 1, 5]);
  assert.equal(result.meshes.length, 11);
  assert.deepEqual(coordinates(result.meshes[7]), [-50, 0, 0, 50, 0, 0]);
  assert.deepEqual(coordinates(result.meshes[8]), [1, 2, -47, 1, 2, 53]);
  assert.ok(result.meshes.every(part => part.primitive === "lines" && part.color === colors.blue && part.alpha === 0.6));
  assert.equal(result.positions.length, 0);
  assert.throws(() => evaluateCode(`scene.add(annotate({ geometry: { bad: true } }));`), /Unsupported annotation geometry/);
});

test("shared line annotations retain each occurrence's transforms without changing the source", () => {
  const result = evaluateCode(`
const segment = lineSegment({ start: center, end: { x: 2, y: 0 } });
const shared = annotate({ geometry: segment, color: "blue", name: "Shared" });
const inner = new Transform(); inner.position.y = 3; inner.add(shared);
const outer = new Transform(); outer.position.x = 10; outer.rotation.z = 90; outer.scale.x = 2; outer.add(inner);
scene.add(outer, shared);
if (segment.start !== center || segment.end.x !== 2) throw new Error("Source changed");
`);
  coordinates(result.meshes[0]).forEach((value, i) => assert.ok(Math.abs(value - [7, 0, 0, 7, 4, 0][i]) < 1e-6));
  assert.deepEqual(coordinates(result.meshes[1]), [0, 0, 0, 2, 0, 0]);
});

test("visualize returns exact inputs, adds blue lines and translucent red solids, and excludes inspection exports", () => {
  const result = evaluateCode(`
const drawing = sketch().add(rectangle({ center, width: 4, height: 2 }));
if (vi !== visualize) throw new Error("Expected the same helper");
if (vi(drawing) !== drawing) throw new Error("Sketch identity changed");
const solid = drawing.extrude(3);
const items = [solid, [Z, circle(2)], XY];
if (visualize(items) !== items) throw new Error("Array identity changed");
scene.add(solid);
`);
  const solids = result.meshes.filter(part => part.primitive !== "lines");
  assert.equal(solids.length, 2);
  assert.equal(solids[1].color, colors.red);
  assert.equal(solids[1].alpha, 0.35);
  assert.equal(solids[1].exclude, true);
  const lineParts = result.meshes.filter(part => part.primitive === "lines");
  assert.ok(lineParts.every(part => part.exclude));
  assert.deepEqual(lineParts.slice(-3).map(part => part.color), [colors.red, colors.green, colors.blue]);
  assert.ok(lineParts.slice(0, -3).every(part => part.color === colors.blue));
  const exported = new DataView(exportBinaryStl(result));
  assert.equal(exported.getUint32(80, true), solids[0].positions.length / 9);
  assert.equal(result.scene.children.length, 3);
});

test("line previews survive worker transfer, support picking and hover, and dispose their resources", () => {
  const { scene: _scene, ...result } = evaluateCode(`visualize(lineSegment({ start: { x: -1, y: 0 }, end: { x: 1, y: 0 } }));`);
  const copy = structuredClone(result, { transfer: [result.positions.buffer, ...result.meshes.map(part => part.positions.buffer)] });
  const model = createPreviewMeshes(copy.meshes), line = model.children[0];
  const resources = [line.geometry, line.material], disposed = new Set();
  resources.forEach(resource => resource.addEventListener("dispose", () => disposed.add(resource)));
  try {
    assert.ok(line instanceof LineSegments);
    assert.equal(line.children.length, 0);
    assert.equal(line.geometry.getAttribute("normal"), undefined);
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100), raycaster = new Raycaster();
    camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    raycaster.setFromCamera(new Vector2(0, 0), camera);
    assert.equal(pickPreviewMesh(model, raycaster), line);
    setPreviewMeshHovered(line, true);
    assert.equal(line.material.color.getHex(), 0xf0c486);
    setPreviewMeshHovered(line, false);
    assert.equal(line.material.color.getHex(), new Color(colors.blue).getHex());
    line.visible = false;
    assert.equal(pickPreviewMesh(model, raycaster), undefined);
  } finally { disposePreviewMeshes(model); }
  assert.equal(disposed.size, 2);
});

test("visualize works across bundled modules and remains a host helper rather than a libcompass export", async t => {
  const scene = new Node(), bindings = scriptBindings(console, createParametricRuntime(), scene);
  const previous = new Map(["__compassBindings", "visualize", "vi"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  Object.assign(globalThis, { __compassBindings: bindings, visualize: bindings.visualize, vi: bindings.vi });
  const files = [
    { name: "model.js", source: `import { drawing } from "./drawing.js"; export const original = vi(drawing);` },
    { name: "drawing.js", source: `import { sketch, circle } from "libcompass"; export const drawing = sketch().add(circle(2));` },
  ];
  const project = await bundleProject(files, bindings, () => {}, rollup);
  try {
    const code = await (await fetch(project.url)).text();
    const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    assert.equal(scene.children[0].children[0].geometry, module.original);
    assert.ok(renderedScene(scene, "", []).meshes.length > 0);
  } finally { project.dispose(); }
  for (const name of ["visualize", "vi"]) await assert.rejects(bundleProject([{ name: "model.js", source: `import { ${name} } from "libcompass"; ${name}(null);` }], bindings, () => {}, rollup), /not exported/);
});
