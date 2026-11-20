import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readLibcompassApi } from "../scripts/libcompass-api.ts";

const api = readLibcompassApi();

test("the API browser contains public exports, member TSDoc, parameters, and examples", () => {
  const sketch = api.entries.find(entry => entry.name === "Sketch");
  assert.match(sketch.description, /Local 2D drawing geometry/);
  assert.ok(sketch.tags.some(tag => tag.name === "example" && tag.text.includes("new Sketch()")));
  assert.ok(sketch.members.some(member => member.name === "constructor" && member.tags.some(tag => tag.name === "param" && tag.text.startsWith("options"))));
  assert.match(sketch.members.find(member => member.name === "add").description, /Append entities/);
  assert.match(sketch.members.find(member => member.name === "fromFace").signature, /static fromFace/);
  assert.match(sketch.members.find(member => member.name === "fromFace").description, /empty sketch/);
  const extrude = api.entries.find(entry => entry.name === "extrude");
  assert.ok(extrude.tags.some(tag => tag.name === "throws" && tag.text.includes("RangeError")));
  assert.ok(extrude.tags.some(tag => tag.name === "param" && tag.text.startsWith("options.axis")));
  assert.ok(extrude.tags.some(tag => tag.name === "param" && tag.text.startsWith("options.length")));
  assert.match(extrude.signature, /axis\?: ReadonlyVec3/);
  assert.match(extrude.signature, /length: number/);
  assert.match(extrude.signature, /angle\?: number/);
  assert.ok(extrude.tags.some(tag => tag.name === "param" && tag.text.startsWith("options.angle") && tag.text.includes("degrees")));
  assert.doesNotMatch(extrude.signature, /direction/);
  assert.match(api.entries.find(entry => entry.name === "Transform").members.find(member => member.name === "rotation").description, /degrees/);
  assert.ok(!api.entries.some(entry => entry.name === "triangulatePolygon"));
  assert.ok(!api.entries.find(entry => entry.name === "Memo").members.some(member => member.name === "triangulateUncached"));
  const node = api.entries.find(entry => entry.name === "Node");
  assert.match(node.members.find(member => member.name === "add").signature, /add\(\.\.\.children: Node\[\]\): this/);
  assert.match(node.members.find(member => member.name === "remove").description, /object identity/);
  assert.match(api.entries.find(entry => entry.name === "Solid").signature, /extends Memo/);
  for (const name of ["Point", "Vertex", "SpatialBoundary", "PlanarLoop"]) {
    const entry = api.entries.find(entry => entry.name === name);
    assert.equal(entry.kind, "Interface");
    assert.equal(entry.signature, `interface ${name}`);
    assert.ok(entry.members.every(member => member.name !== "constructor"));
  }
  for (const name of ["node", "memo", "transform", "transformMat4Node", "line", "lineSegment", "circle", "plane", "sketch", "edge", "face", "solid", "planarCurve", "spatialCurve", "spatialSurface", "ruledSurface"]) {
    const entry = api.entries.find(entry => entry.name === name);
    assert.equal(entry.kind, "Function");
    assert.match(entry.description, /shorthand for/);
    const className = name === "transformMat4Node" ? "TransformMat4" : name[0].toUpperCase() + name.slice(1);
    const classEntry = api.entries.find(entry => entry.name === className);
    const constructor = classEntry.members.find(member => member.name === "constructor") ?? classEntry;
    assert.ok(entry.description.includes(constructor.description));
    assert.deepEqual(entry.tags, constructor.tags);
    assert.doesNotMatch(entry.signature, /ConstructorParameters/);
    assert.ok(entry.members.every(member => member.name.startsWith("options.") && member.description));
  }
  const circle = api.entries.find(entry => entry.name === "circle");
  assert.match(circle.signature, /center: Point/);
  assert.match(circle.signature, /radius: number/);
  assert.match(circle.members.find(member => member.name === "options.radius").description, /Positive radius/);
  const plane = api.entries.find(entry => entry.name === "plane");
  assert.match(plane.signature, /options\?/);
  assert.match(plane.members.find(member => member.name === "options.a").description, /defaults to \[0, 0, 0\]/);
  assert.match(api.entries.find(entry => entry.name === "extrudeAlongCurve").description, /smooth, regular spatial curve/);
  assert.match(api.entries.find(entry => entry.name === "RuledSurface").signature, /extends SpatialSurface/);
  const spatialCurve = api.entries.find(entry => entry.name === "SpatialCurve");
  assert.ok(spatialCurve.members.some(member => member.name === "isLoop"));
  assert.match(spatialCurve.members.find(member => member.name === "fromPlanarCurve").signature, /curve: Pick<PlanarCurve/);
  assert.ok(!spatialCurve.members.some(member => member.name === "fromCircle"));
  assert.ok(!spatialCurve.members.some(member => member.name === "circle"));
  assert.ok(spatialCurve.members.some(member => member.name === "sampleParameters"));
  assert.match(api.entries.find(entry => entry.name === "Circle").signature, /extends PlanarCurve/);
  assert.match(api.entries.find(entry => entry.name === "PlanarCurve").members.find(member => member.name === "at").tags.find(tag => tag.name === "param").text, /\[0, 1\]/);
  const planarCurve = api.entries.find(entry => entry.name === "PlanarCurve");
  for (const name of ["area", "contains", "sample", "sampleParameters"]) {
    assert.ok(planarCurve.members.some(member => member.name === name));
  }
  assert.ok(!planarCurve.members.some(member => member.name === "intersects"));
  assert.match(api.entries.find(entry => entry.name === "SpatialSurface").description, /general parametric spatial surface/);
  assert.match(api.entries.find(entry => entry.name === "Face").signature, /extends Surface/);
  assert.doesNotMatch(extrude.signature, /circleSegments/);
});

test("documentation folders distinguish constructors, shorthands, operations, defaults, and utilities", () => {
  const folder = name => api.entries.find(entry => entry.name === name)?.folder;
  for (const name of ["Sketch", "Circle", "PlanarCurve", "PlanarLoop", "Point", "SketchElement"]) assert.equal(folder(name), "classes");
  for (const name of ["sketch", "circle", "transformMat4Node"]) assert.equal(folder(name), "shorthands");
  assert.equal(folder("extrude"), "operations");
  assert.equal(folder("extrudeAlongCurve"), "operations");
  assert.equal(folder("chamfer"), "operations");
  for (const name of ["trimCurve", "trimSurface"]) {
    assert.equal(folder(name), "operations");
    const entry = api.entries.find(entry => entry.name === name);
    assert.ok(entry.members.some(member => member.name === "options.keep" && member.description));
    assert.ok(entry.tags.some(tag => tag.name === "example"));
    assert.ok(api.libraries[`file:///node_modules/libcompass/operations/${name}.d.ts`]);
  }
  assert.equal(folder("TrimmedSurface"), "classes");
  for (const name of ["intersect", "difference", "extrudeCut"]) {
    const entry = api.entries.find(entry => entry.name === name);
    assert.equal(entry.folder, "operations");
    assert.ok(entry.members.some(member => member.name === "options.solid" && member.description));
    assert.ok(entry.tags.some(tag => tag.name === "example"));
    assert.ok(api.entries.find(entry => entry.name === "Solid").members.some(member => member.name === name && member.description));
  }
  assert.equal(folder("trimmedSurface"), "shorthands");
  const chamfer = api.entries.find(entry => entry.name === "chamfer");
  assert.match(chamfer.description, /new solid/);
  assert.match(chamfer.signature, /boundaries\?: readonly number\[\]/);
  assert.ok(chamfer.tags.some(tag => tag.name === "param" && tag.text.includes("defaults to 0.5")));
  const solidChamfer = api.entries.find(entry => entry.name === "Solid").members.find(member => member.name === "chamfer");
  assert.match(solidChamfer.description, /new chamfered solid/);
  assert.match(solidChamfer.signature, /options\?/);
  for (const name of ["functionalize", "transformMat4", "PI", "radtodeg", "degtorad", "TRIANGULATION_RESOLUTION", "setTriangulationResolution"]) assert.equal(folder(name), "util");
  assert.equal(api.entries.find(entry => entry.name === "TRIANGULATION_RESOLUTION").kind, "Variable");
  assert.equal(api.entries.find(entry => entry.name === "PI").kind, "Constant");
  assert.match(api.entries.find(entry => entry.name === "radtodeg").description, /radians to degrees/);
  assert.match(api.entries.find(entry => entry.name === "degtorad").description, /degrees to radians/);
  for (const name of ["XY", "ZX", "YZ", "X", "Y", "Z"]) {
    const entry = api.entries.find(entry => entry.name === name);
    assert.equal(entry.folder, "defaults");
    assert.equal(entry.kind, "Constant");
    assert.match(entry.signature, new RegExp(`const ${name}:`));
    assert.match(entry.description, /Shared/);
  }
  assert.ok(api.entries.every(entry => ["classes", "shorthands", "operations", "defaults", "util"].includes(entry.folder)));
  assert.ok(api.libraries["file:///node_modules/libcompass/operations/extrude.d.ts"]);
});

test("editor globals resolve libcompass and gl-matrix types and documentation", () => {
  const code = `/** @type {Point} */
const center = { x: 0, y: 0 };
const angleDEG = radtodeg(PI / 4);
const angleRAD = degtorad(angleDEG);
setTriangulationResolution(0.1);
const resolution = TRIANGULATION_RESOLUTION;
/** @type {Vertex} */
const vertex = { position: [0, 0, 0] };
const s = new Sketch({ plane: new Plane({ a: vertex }) });
s.add(new Circle({ center, radius: 5 }));
const path = spatialCurve({ at: t => ({ position: [0, 0, t] }) });
const swept = extrudeAlongCurve({ sketch: s, curve: path });
s.extrudeAlongCurve({ curve: path });
const generalSurface = spatialSurface({ at: (u, v) => ({ position: [u, v, u * v] }) });
const solid = extrude({ sketch: s, length: 10, angle: 3 });
const beveled = chamfer({ solid, length: 0.5, angle: 45, boundaries: [0] });
const beveledByMethod = solid.chamfer({ length: 0.5, angle: 45, boundaries: [0] });
const defaultBeveled = solid.chamfer();
const common = intersect({ solid, tool: swept });
const removed = difference({ solid, tool: swept });
const cutExtrusion = extrudeCut({ solid, sketch: s, length: -3, axis: Z, angle: 2 });
const commonMethod = solid.intersect({ tool: swept });
const removedMethod = solid.difference({ tool: swept });
const cutMethod = solid.extrudeCut({ sketch: s, length: 3, axis: Z, angle: -2 });
const cutCurve = trimCurve({ curve: circle({ center, radius: 5 }), cutters: [line({ point: center, direction: [0, 1] })], keep: 0 });
const cutPath = trimCurve({ curve: path, cutters: [XY], keep: 0.5 });
const cutSurfaces = trimSurface({ surface: solid.surfaces[0], cutter: YZ, keep: "positive" });
const cutByCurve = trimSurface({ surface: solid.surfaces[0], cutter: circle({ center, radius: 2 }), keep: "outside" });
const trim = trimmedSurface({ surface: generalSurface, at: (u, v) => ({ x: u, y: v }), boundaryLoops: [], sides: {} });
const originalParameters = trim.parameters(0.5, 0.5);
scene.add(solid);
s.extrude({ length: 2, angle: -5 });
const draft = sketch({ plane: plane() }).add(circle({ center, radius: 2 }));
scene.add(draft.extrude({ length: 3 }));
scene.add(node(), memo(), transformMat4Node({ matrix: mat4.create() }));
sketch().add({ x: 1, y: 2 });
const transform = new Transform().add(solid);
transform.rotation.z = 90;
scene.add(transform);
solid.refresh();
scene.remove(new Node(), new Node());
const vector = vec3.fromValues(1, 2, 3);
const onXY = sketch({ plane: XY });
const onZX = sketch({ plane: ZX });
const onYZ = sketch({ plane: YZ });
onYZ.add(circle({ center, radius: 2 })).extrude({ axis: X, length: -3 });
const defaultAxes = vec3.cross([0, 0, 0], X, Y);
const extrusionDirection = vec3.scale([0, 0, 0], Z, 10);
const matrix = mat4.create();
const SketchClass = Sketch;
const rim = SpatialCurve.fromPlanarCurve({ curve: circle({ center, radius: 1 }) });
const topRim = SpatialCurve.fromPlanarCurve({ curve: circle({ center, radius: 1 }), plane: plane({ a: [0, 0, 3], b: [1, 0, 3], c: [0, 1, 3] }) });
const quarterCircle = circle({ center, radius: 1 }).at(0.25);
const localCurve = planarCurve({ at: t => ({ x: t, y: t * t }) });
const exactTangentCurve = planarCurve({ at: t => ({ x: t, y: t * t }), tangent: t => [1, 2 * t] });
const tangentDirection = exactTangentCurve.tangent(0.5);
/** @type {SketchElement} */
const sketchElement = localCurve;
sketch().add(sketchElement);
/** @type {PlanarCurve} */
const planar = localCurve;
/** @type {PlanarLoop} */
const planarLoop = circle({ center, radius: 3 });
const enclosedArea = planarLoop.area();
const inside = planarLoop.contains({ point: center });
const lifted = SpatialCurve.fromPlanarCurve({ curve: planar });
const liftedFunction = SpatialCurve.fromPlanarCurve({ curve: { at: t => ({ x: t, y: t * t }) } });
const parameters = liftedFunction.sampleParameters({ resolution: 0.001 });
const wall = ruledSurface({ start: rim, end: topRim });
const coneWall = ruledSurface({ start: rim, end: { position: [0, 0, 3] } });
const sampled = rim.sample();
const pointOnSurface = wall.at(0.25, 0.5);
const loop = rim.isLoop();
const precision = TRIANGULATION_RESOLUTION;
/** @type {SpatialBoundary} */
const boundary = rim;
const surfaces = solid.surfaces;
const boundaries = solid.boundaries;`;
  const files = new Map(Object.entries(api.libraries).map(([path, content]) => [path.replace("file://", ""), content]));
  files.set("/model.js", code);
  const readFile = path => files.get(path) ?? ts.sys.readFile(path);
  const service = ts.createLanguageService({
    getCompilationSettings: () => ({ allowJs: true, checkJs: true, target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Node10, lib: ["lib.es2022.d.ts"], types: [] }),
    getScriptFileNames: () => [...files.keys()],
    getScriptVersion: () => "0",
    getScriptSnapshot: path => { const content = readFile(path); return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content); },
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    fileExists: path => files.has(path) || ts.sys.fileExists(path),
    readFile,
  });
  try {
    const diagnostics = service.getSemanticDiagnostics("/model.js");
    assert.deepEqual(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")), []);
    const sketch = service.getQuickInfoAtPosition("/model.js", code.indexOf("Sketch") + 1);
    assert.match(ts.displayPartsToString(sketch.documentation), /Create an empty sketch/);
    const sketchClass = service.getQuickInfoAtPosition("/model.js", code.indexOf("Sketch;", code.indexOf("const SketchClass")) + 1);
    assert.match(ts.displayPartsToString(sketchClass.documentation), /Local 2D drawing geometry/);
    const add = service.getQuickInfoAtPosition("/model.js", code.indexOf(".add") + 2);
    assert.match(ts.displayPartsToString(add.documentation), /Append entities/);
    assert.match(ts.displayPartsToString(add.displayParts), /SketchElement/);
    const extrude = service.getQuickInfoAtPosition("/model.js", code.indexOf("extrude({") + 1);
    assert.match(ts.displayPartsToString(extrude.documentation), /Extrude all filled sketch regions/);
    assert.ok(extrude.tags.some(tag => tag.name === "param"));
    const sweep = service.getQuickInfoAtPosition("/model.js", code.indexOf("extrudeAlongCurve") + 1);
    assert.match(ts.displayPartsToString(sweep.documentation), /smooth, regular spatial curve/);
    const remove = service.getQuickInfoAtPosition("/model.js", code.indexOf(".remove") + 2);
    assert.match(ts.displayPartsToString(remove.displayParts), /\.remove\(\.\.\.children: Node\[\]\)/);
    assert.match(ts.displayPartsToString(remove.documentation), /object identity/);
    const point = service.getQuickInfoAtPosition("/model.js", code.indexOf("Point") + 1);
    assert.match(ts.displayPartsToString(point.displayParts), /Point/);
    assert.match(ts.displayPartsToString(point.documentation), /local XY coordinates/);
    const shorthand = service.getQuickInfoAtPosition("/model.js", code.indexOf("sketch({") + 1);
    assert.match(ts.displayPartsToString(shorthand.documentation), /shorthand for/);
    assert.match(ts.displayPartsToString(shorthand.documentation), /Create an empty sketch/);
    assert.match(ts.displayPartsToString(shorthand.displayParts), /Sketch/);
    const circle = service.getQuickInfoAtPosition("/model.js", code.indexOf("circle({") + 1);
    assert.match(ts.displayPartsToString(circle.documentation), /Create a circle with a positive radius/);
    assert.match(ts.displayPartsToString(circle.displayParts), /center: Point/);
    assert.match(ts.displayPartsToString(circle.displayParts), /radius: number/);
    assert.ok(circle.tags.some(tag => tag.name === "throws"));
    const radius = service.getQuickInfoAtPosition("/model.js", code.indexOf("radius: 2") + 1);
    assert.match(ts.displayPartsToString(radius.documentation), /Positive radius/);
    const at = service.getQuickInfoAtPosition("/model.js", code.indexOf(".at(0.25)") + 2);
    assert.match(ts.displayPartsToString(at.displayParts), /\(t: number\): Point/);
    assert.ok(at.tags.some(tag => tag.name === "param" && ts.displayPartsToString(tag.text).includes("[0, 1]")));
    const completionCode = "circle({ ";
    files.set("/completion.js", completionCode);
    const completions = service.getCompletionsAtPosition("/completion.js", completionCode.length, {});
    assert.ok(completions.entries.some(entry => entry.name === "center"));
    assert.ok(completions.entries.some(entry => entry.name === "radius"));
  } finally {
    service.dispose();
  }
});
