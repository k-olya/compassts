import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readLibcompassApi } from "../scripts/libcompass-api.ts";

const api = readLibcompassApi();

test("the API browser contains public exports, member TSDoc, parameters, and examples", () => {
  const sketch = api.entries.find(entry => entry.name === "Sketch");
  assert.match(sketch.description, /Local 2D drawing geometry/);
  assert.ok(sketch.tags.some(tag => tag.name === "example" && tag.text.includes("new Sketch()")));
  assert.ok(sketch.members.some(member => member.name === "constructor" && member.tags.some(tag => tag.name === "param" && tag.text.startsWith("plane"))));
  assert.match(sketch.members.find(member => member.name === "add").description, /Append entities/);
  assert.match(sketch.members.find(member => member.name === "fromFace").signature, /static fromFace/);
  const extrude = api.entries.find(entry => entry.name === "extrude");
  assert.ok(extrude.tags.some(tag => tag.name === "throws" && tag.text.includes("RangeError")));
  assert.ok(extrude.tags.some(tag => tag.name === "param" && tag.text.startsWith("circleSegments")));
  assert.ok(!api.entries.some(entry => entry.name === "triangulatePolygon"));
  assert.ok(!api.entries.find(entry => entry.name === "Memo").members.some(member => member.name === "triangulateUncached"));
  const node = api.entries.find(entry => entry.name === "Node");
  assert.match(node.members.find(member => member.name === "add").signature, /add\(\.\.\.children: Node\[\]\): this/);
  assert.match(node.members.find(member => member.name === "remove").description, /object identity/);
  assert.match(api.entries.find(entry => entry.name === "Solid").signature, /extends Memo/);
});

test("editor globals resolve libcompass and gl-matrix types and documentation", () => {
  const code = `const sketch = new Sketch();
sketch.add(new Circle(new Point(0, 0), 5));
const solid = extrude(sketch, [0, 0, 10]);
scene.add(solid);
const transform = new Transform().add(solid);
scene.add(transform);
solid.refresh();
scene.remove(new Node(), new Node());
const vector = vec3.fromValues(1, 2, 3);
const matrix = mat4.create();
const SketchClass = Sketch;`;
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
    const sketchClass = service.getQuickInfoAtPosition("/model.js", code.lastIndexOf("Sketch") + 1);
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
  } finally {
    service.dispose();
  }
});
