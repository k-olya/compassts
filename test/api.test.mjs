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
  const extrude = api.entries.find(entry => entry.name === "extrude");
  assert.ok(extrude.tags.some(tag => tag.name === "throws" && tag.text.includes("RangeError")));
  assert.ok(extrude.tags.some(tag => tag.name === "param" && tag.text.startsWith("options.direction")));
  assert.ok(!api.entries.some(entry => entry.name === "triangulatePolygon"));
  assert.ok(!api.entries.find(entry => entry.name === "Memo").members.some(member => member.name === "triangulateUncached"));
  const node = api.entries.find(entry => entry.name === "Node");
  assert.match(node.members.find(member => member.name === "add").signature, /add\(\.\.\.children: Node\[\]\): this/);
  assert.match(node.members.find(member => member.name === "remove").description, /object identity/);
  assert.match(api.entries.find(entry => entry.name === "Solid").signature, /extends Memo/);
  for (const name of ["Point", "Vertex", "SpatialBoundary"]) {
    const entry = api.entries.find(entry => entry.name === name);
    assert.equal(entry.kind, "Interface");
    assert.equal(entry.signature, `interface ${name}`);
    assert.ok(entry.members.every(member => member.name !== "constructor"));
  }
  for (const name of ["node", "memo", "transform", "transformMat4Node", "line", "lineSegment", "circle", "plane", "sketch", "edge", "face", "solid", "planarCurve", "spatialCurve", "spatialSurface"]) {
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
  const spatialCurve = api.entries.find(entry => entry.name === "SpatialCurve");
  assert.ok(spatialCurve.members.some(member => member.name === "isLoop"));
  assert.match(spatialCurve.members.find(member => member.name === "fromPlanarCurve").signature, /curve: PlanarCurve/);
  assert.ok(!spatialCurve.members.some(member => member.name === "fromCircle"));
  assert.match(api.entries.find(entry => entry.name === "Circle").signature, /extends PlanarCurve/);
  assert.match(api.entries.find(entry => entry.name === "PlanarCurve").members.find(member => member.name === "at").tags.find(tag => tag.name === "param").text, /\[0, 1\]/);
  assert.match(api.entries.find(entry => entry.name === "SpatialSurface").description, /exact ruled surface/);
  assert.match(api.entries.find(entry => entry.name === "Face").signature, /extends Surface/);
  assert.doesNotMatch(extrude.signature, /circleSegments/);
});

test("editor globals resolve libcompass and gl-matrix types and documentation", () => {
  const code = `/** @type {Point} */
const center = { x: 0, y: 0 };
/** @type {Vertex} */
const vertex = { position: [0, 0, 0] };
const s = new Sketch({ plane: new Plane({ a: vertex }) });
s.add(new Circle({ center, radius: 5 }));
const solid = extrude({ sketch: s, direction: [0, 0, 10] });
scene.add(solid);
s.extrude({ direction: [0, 0, 2] });
const draft = sketch({ plane: plane() }).add(circle({ center, radius: 2 }));
scene.add(draft.extrude({ direction: [0, 0, 3] }));
scene.add(node(), memo(), transformMat4Node({ matrix: mat4.create() }));
sketch().add({ x: 1, y: 2 });
const transform = new Transform().add(solid);
scene.add(transform);
solid.refresh();
scene.remove(new Node(), new Node());
const vector = vec3.fromValues(1, 2, 3);
const matrix = mat4.create();
const SketchClass = Sketch;
const rim = SpatialCurve.fromPlanarCurve({ curve: circle({ center, radius: 1 }) });
const topRim = SpatialCurve.fromPlanarCurve({ curve: circle({ center, radius: 1 }), plane: plane({ a: [0, 0, 3], b: [1, 0, 3], c: [0, 1, 3] }) });
const quarterCircle = circle({ center, radius: 1 }).at(0.25);
const localCurve = planarCurve({ at: t => ({ x: t, y: t * t }) });
/** @type {SketchElement} */
const sketchElement = localCurve;
sketch().add(sketchElement);
/** @type {PlanarCurve} */
const planar = localCurve;
const lifted = SpatialCurve.fromPlanarCurve({ curve: planar });
const wall = spatialSurface({ start: rim, end: topRim });
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
    const extrude = service.getQuickInfoAtPosition("/model.js", code.indexOf("extrude") + 1);
    assert.match(ts.displayPartsToString(extrude.documentation), /Extrude all filled sketch regions/);
    assert.ok(extrude.tags.some(tag => tag.name === "param"));
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
