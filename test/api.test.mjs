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
  assert.match(node.members.find(member => member.name === "add").signature, /add\(\.\.\.children: \(Node \| readonly Node\[\]\)\[\]\): this/);
  assert.match(sketch.members.find(member => member.name === "add").signature, /readonly SketchElement\[\]/);
  assert.match(node.members.find(member => member.name === "remove").description, /object identity/);
  assert.match(api.entries.find(entry => entry.name === "Solid").signature, /extends Memo/);
  for (const name of ["Point", "Vertex", "SpatialBoundary", "PlanarLoop", "SurfaceTrim", "SurfaceRegionChart"]) {
    const entry = api.entries.find(entry => entry.name === name);
    assert.equal(entry.kind, "Interface");
    assert.equal(entry.signature, `interface ${name}`);
    assert.ok(entry.members.every(member => member.name !== "constructor"));
  }
  for (const name of ["node", "memo", "annotatedNode", "transform", "transformMat4Node", "line", "lineSegment", "circle", "plane", "sketch", "edge", "face", "solid", "planarCurve", "spatialCurve", "spatialLine", "spatialSurface", "ruledSurface", "surfaceRegion"]) {
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
  for (const className of ["Plane", "SpatialLine", "SpatialCurve", "Edge", "Surface", "Solid"]) {
    const entry = api.entries.find(entry => entry.name === className);
    for (const method of ["rotate", "displace"]) {
      const member = entry.members.find(member => member.name === method);
      assert.ok(member, `${className}.${method} is documented`);
      assert.match(member.signature, /: this/);
      assert.match(member.description, /new/);
    }
  }
  const circle = api.entries.find(entry => entry.name === "circle");
  assert.match(circle.signature, /center\?: Point/);
  assert.match(circle.signature, /radius: number/);
  assert.match(circle.members.find(member => member.name === "options.radius").description, /Positive radius/);
  const plane = api.entries.find(entry => entry.name === "plane");
  assert.match(plane.signature, /options\?/);
  assert.match(plane.members.find(member => member.name === "options.a").description, /defaults to \[0, 0, 0\]/);
  assert.match(api.entries.find(entry => entry.name === "extrudeAlongCurve").description, /smooth, regular spatial curve/);
  assert.match(api.entries.find(entry => entry.name === "RuledSurface").signature, /extends SpatialSurface/);
  const lift = api.entries.find(entry => entry.name === "spatialCurveFromPlanar");
  assert.equal(lift.folder, "operations");
  assert.match(lift.description, /SpatialCurve.fromPlanarCurve/);
  assert.match(lift.signature, /curve: Pick<PlanarCurve/);
  assert.deepEqual(lift.members.map(member => member.name), ["options.curve", "options.plane", "options.start", "options.end"]);
  assert.ok(lift.members.every(member => member.description));
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
  const annotation = api.entries.find(entry => entry.name === "AnnotatedNode");
  assert.match(annotation.signature, /extends Memo/);
  for (const name of ["name", "color", "alpha"]) assert.ok(annotation.members.some(member => member.name === name && member.description));
  const annotate = api.entries.find(entry => entry.name === "annotate");
  assert.equal(annotate.folder, "operations");
  assert.match(annotate.signature, /solid: Solid/);
  assert.match(annotate.signature, /AnnotatedNode/);
  assert.doesNotMatch(annotate.signature, /node: Node/);
  assert.ok(annotate.members.every(member => member.description));
  assert.match(annotate.signature, /color\?: AnnotationColor/);
  const palette = api.entries.find(entry => entry.name === "colors");
  assert.equal(palette.folder, "defaults");
  assert.equal(palette.kind, "Constant");
  assert.match(palette.signature, /default: "#d2a568"/);
  assert.match(api.entries.find(entry => entry.name === "AnnotationColor").signature, /keyof typeof colors/);
  assert.match(api.entries.find(entry => entry.name === "Solid").members.find(member => member.name === "annotate").signature, /: AnnotatedNode/);
});

test("documentation folders distinguish constructors, shorthands, operations, defaults, and utilities", () => {
  const folder = name => api.entries.find(entry => entry.name === name)?.folder;
  for (const name of ["Sketch", "Circle", "PlanarCurve", "PlanarLoop", "Point", "SketchElement"]) assert.equal(folder(name), "classes");
  for (const name of ["sketch", "circle", "transformMat4Node"]) assert.equal(folder(name), "shorthands");
  for (const name of ["polyline", "rectangle"]) {
    assert.equal(folder(name), "operations");
    const entry = api.entries.find(entry => entry.name === name);
    assert.match(entry.signature, /LineSegment\[\]/);
    assert.ok(entry.members.every(member => member.name.startsWith("options.") && member.description));
  }
  assert.equal(folder("centerRectangle"), undefined);
  const rectangleEntry = api.entries.find(entry => entry.name === "rectangle");
  assert.deepEqual(rectangleEntry.members.map(member => member.name),
    ["options.center", "options.corner1", "options.corner2", "options.width", "options.height", "options.rotation"]);
  assert.match(rectangleEntry.members.find(member => member.name === "options.width").description, /actual side length/);
  assert.equal(folder("roundPolyline"), "operations");
  const roundPolyline = api.entries.find(entry => entry.name === "roundPolyline");
  assert.match(roundPolyline.signature, /LineSegment \| PlanarCurve/);
  assert.ok(roundPolyline.members.some(member => member.name === "options.segments" && member.description));
  assert.ok(roundPolyline.members.some(member => member.name === "options.radius" && member.description));
  assert.ok(roundPolyline.tags.some(tag => tag.name === "example"));
  assert.ok(api.libraries["file:///node_modules/libcompass/operations/roundPolyline.d.ts"]);
  assert.equal(folder("ellipse"), "operations");
  const ellipseEntry = api.entries.find(entry => entry.name === "ellipse");
  assert.match(ellipseEntry.signature, /PlanarCurve/);
  assert.deepEqual(ellipseEntry.members.map(member => member.name), ["options.center", "options.radiusX", "options.radiusY", "options.rotation"]);
  assert.ok(ellipseEntry.members.every(member => member.description));
  const svgPath = api.entries.find(entry => entry.name === "svgPath");
  assert.equal(svgPath.folder, "operations");
  assert.match(svgPath.signature, /d: string/);
  assert.match(svgPath.signature, /PlanarCurve/);
  assert.match(svgPath.signature, /position\?: Point/);
  assert.match(svgPath.signature, /scale\?: Point/);
  assert.match(svgPath.signature, /PlanarCurve \| PlanarCurve\[\]/);
  assert.ok(svgPath.members.some(member => member.name === "options.d" && member.description));
  const measure = api.entries.find(entry => entry.name === "measure");
  assert.equal(measure.folder, "operations");
  assert.match(measure.signature, /Measurable \| readonly Measurable\[\]/);
  assert.match(measure.signature, /Measurement/);
  assert.ok(measure.members.some(member => member.name === "options.object" && member.description));
  assert.ok(measure.tags.some(tag => tag.name === "example"));
  for (const name of ["Measurement", "BoundingBox", "Measurable"]) assert.equal(folder(name), "classes");
  assert.ok(svgPath.tags.some(tag => tag.name === "example"));
  assert.ok(api.libraries["file:///node_modules/libcompass/operations/svgPath.d.ts"]);
  for (const name of ["rotate", "displace"]) {
    assert.equal(folder(name), "operations");
    const entry = api.entries.find(entry => entry.name === name);
    assert.ok(entry.members.some(member => member.name === "options.object" && member.description));
    assert.match(entry.description, /new object/);
  }
  for (const name of ["displacementArray", "rotationArray", "curveArray"]) {
    assert.equal(folder(name), "operations");
    const entry = api.entries.find(entry => entry.name === name);
    assert.match(entry.signature, /ArrayCopy<T>\[\]/);
    assert.deepEqual(entry.members.map(member => member.name), ["options.object", name === "displacementArray" ? "options.vector" : name === "rotationArray" ? "options.axis" : "options.curve", ...(name === "curveArray" ? ["options.follow"] : []), "options.N", "options.offset", "options.width"]);
    assert.ok(entry.members.every(member => member.description));
    assert.ok(entry.tags.some(tag => tag.name === "example"));
    assert.ok(api.libraries[`file:///node_modules/libcompass/operations/${name}.d.ts`]);
  }
  assert.match(api.entries.find(entry => entry.name === "SpatialLine").signature, /extends Array<number>/);
  for (const name of ["X", "Y", "Z", "negX", "negY", "negZ"]) assert.match(api.entries.find(entry => entry.name === name).signature, /SpatialLine/);
  assert.equal(folder("arc"), "operations");
  const arcEntry = api.entries.find(entry => entry.name === "arc");
  assert.match(arcEntry.signature, /PlanarCurve/);
  assert.ok(arcEntry.members.some(member => member.name === "options.angle" && member.description.includes("degrees")));
  assert.ok(arcEntry.members.some(member => member.name === "options.center" && member.description));
  assert.equal(folder("extrude"), "operations");
  assert.equal(folder("extrudeAlongCurve"), "operations");
  assert.equal(folder("extrudeRotate"), "operations");
  const revolve = api.entries.find(entry => entry.name === "extrudeRotate");
  assert.match(revolve.signature, /axis: SpatialLine/);
  assert.match(revolve.signature, /angle\?: number/);
  assert.deepEqual(revolve.members.map(member => member.name), ["options.sketch", "options.axis", "options.angle"]);
  assert.ok(revolve.members.every(member => member.description));
  assert.ok(revolve.tags.some(tag => tag.name === "example"));
  assert.match(revolve.members.find(member => member.name === "options.angle").description, /360/);
  assert.equal(folder("chamfer"), "operations");
  assert.equal(folder("round"), "operations");
  const round = api.entries.find(entry => entry.name === "round");
  assert.match(round.description, /constant-radius tangent rounds/);
  assert.match(round.signature, /radius\?: number/);
  assert.ok(round.members.some(member => member.name === "options.radius" && member.description.includes("0.5")));
  assert.ok(api.libraries["file:///node_modules/libcompass/operations/round.d.ts"]);
  const solidRound = api.entries.find(entry => entry.name === "Solid").members.find(member => member.name === "round");
  assert.match(solidRound.description, /new rounded solid/);
  assert.match(solidRound.signature, /options\?/);
  for (const name of ["trimCurve", "trimSurface"]) {
    assert.equal(folder(name), "operations");
    const entry = api.entries.find(entry => entry.name === name);
    assert.ok(entry.members.some(member => member.name === "options.keep" && member.description));
    assert.ok(entry.tags.some(tag => tag.name === "example"));
    assert.ok(api.libraries[`file:///node_modules/libcompass/operations/${name}.d.ts`]);
  }
  assert.equal(folder("TrimmedSurface"), "classes");
  assert.equal(folder("SurfaceRegion"), "classes");
  assert.equal(folder("surfaceRegion"), "shorthands");
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
  assert.match(chamfer.signature, /boundaries\?: BoundarySelector \| readonly BoundarySelector\[\]/);
  assert.match(round.signature, /boundaries\?: BoundarySelector \| readonly BoundarySelector\[\]/);
  const search = api.entries.find(entry => entry.name === "searchBoundaries");
  assert.equal(search.folder, "operations");
  assert.match(search.signature, /SpatialBoundary\[\]/);
  assert.ok(search.members.some(member => member.name === "options.boundaries" && member.description));
  assert.match(api.entries.find(entry => entry.name === "BoundarySelector").signature, /number \| SpatialBoundary \| Face \| BoundaryPredicate/);
  assert.match(api.entries.find(entry => entry.name === "BoundaryPredicate").signature, /face: Face \| undefined/);
  assert.ok(chamfer.tags.some(tag => tag.name === "param" && tag.text.includes("defaults to 0.5")));
  const solidChamfer = api.entries.find(entry => entry.name === "Solid").members.find(member => member.name === "chamfer");
  assert.match(solidChamfer.description, /new chamfered solid/);
  assert.match(solidChamfer.signature, /options\?/);
  for (const name of ["functionalize", "transformMat4", "PI", "radtodeg", "degtorad", "TRIANGULATION_RESOLUTION", "setTriangulationResolution"]) assert.equal(folder(name), "util");
  assert.equal(api.entries.find(entry => entry.name === "TRIANGULATION_RESOLUTION").kind, "Variable");
  assert.equal(api.entries.find(entry => entry.name === "PI").kind, "Constant");
  assert.match(api.entries.find(entry => entry.name === "radtodeg").description, /radians to degrees/);
  assert.match(api.entries.find(entry => entry.name === "degtorad").description, /degrees to radians/);
  for (const name of ["XY", "ZX", "YZ", "X", "Y", "Z", "negX", "negY", "negZ", "center", "origin"]) {
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
const localCenter = center;
const axisAtOrigin = spatialLine({ direction: Z, origin });
const negativeAxes = [negX, negY, negZ];
const rotatedNegativeAxis = negX.rotate({ axis: negY, angle: 90 });
const angleDEG = radtodeg(PI / 4);
const angleRAD = degtorad(angleDEG);
setTriangulationResolution(0.1);
const resolution = TRIANGULATION_RESOLUTION;
/** @type {Vertex} */
const vertex = { position: [0, 0, 0] };
const s = new Sketch({ plane: new Plane({ a: vertex }) });
s.add(new Circle({ radius: 5 }));
const defaultCircle = circle({ radius: 2 });
const directCircle = circle(2);
const constructedCircle = new Circle(2);
const directPlanar = planarCurve(t => ({ x: t, y: t * t }));
const constructedPlanar = new PlanarCurve(t => ({ x: t, y: t * t }));
const directSpatial = spatialCurve(t => ({ position: [0, 0, t] }));
const constructedSpatial = new SpatialCurve(t => ({ position: [0, 0, t] }));
const directSurface = spatialSurface((u, v) => ({ position: [u, v, 0] }));
const constructedSurface = new SpatialSurface((u, v) => ({ position: [u, v, 0] }));
const directPoints = polyline([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
const directSvg = svgPath("M0 0L1 1");
const directPart = sketch().add(directCircle).extrude(2);
const directSweep = sketch().add(directCircle).extrudeAlongCurve(directSpatial);
const directFace = face(directPart.surfaces[0].boundaries);
const constructedFace = new Face(directFace.outer);
const directSolid = solid(directPart.surfaces);
const constructedSolid = new Solid(directPart.surfaces);
const directMeasures = measure([directPart, directSolid]);
const directAnnotation = annotate(directPart);
const directChamfer = chamfer(directPart);
const directRound = round(directPart);
const directBoundaries = searchBoundaries(directPart);
const directIntersection = directPart.intersect(directSolid);
const directDifference = directPart.difference(directSolid);
const directDisplacement = directPart.displace([1, 2, 3]);
const planeDisplacement = XY.displace(new Float32Array([1, 2, 3]));
const directLift = SpatialCurve.fromPlanarCurve(directPlanar);
const plainLift = SpatialCurve.fromPlanarCurve({ at: t => ({ x: t, y: 0 }) });
const directContainment = directCircle.contains({ x: 0, y: 0 });
/** @type {PlanarLoop} */
const loopInterface = directCircle;
loopInterface.contains({ x: 0, y: 0 });
const oval = ellipse({ center, radiusX: 6, radiusY: 3, rotation: 30 });
const svgOutline = svgPath({ d: "M 0 0 C 0 10 10 10 10 0 Z", position: center, scale: { x: 1, y: -1 } });
const measurements = measure({ object: s });
const combinedLength = measure({ object: [oval, lineSegment({ start: center, end: { x: 1, y: 0 } })] });
sketch().add(svgOutline);
sketch().add(oval);
const arcByAngle = arc({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, angle: -180 });
const arcByCenter = arc({ center, start: { x: 2, y: 0 }, end: { x: 0, y: 2 }, direction: "clockwise" });
const arcThroughPoint = arc({ start: { x: 0, y: 0 }, through: { x: 5, y: 5 }, end: { x: 10, y: 0 } });
const arcByCenterAngle = arc({ start: { x: 5, y: 0 }, center, angle: -90 });
sketch().add(arcByAngle, arcByCenter, arcThroughPoint, arcByCenterAngle);
const polygon = polyline({ points: [center, { x: 5, y: 0 }, { x: 5, y: 5 }], loop: true });
const rect = rectangle({ corner1: center, corner2: { x: 10, y: 5 } });
const centeredRect = rectangle({ center, corner2: { x: 3, y: 2 } });
const roundedProfile = roundPolyline({ segments: rect, radius: 0.5 });
sketch().add(roundedProfile);
sketch().add(polygon, rect, centeredRect, center);
sketch().add(Object.freeze(rect));
const path = spatialCurve({ at: t => ({ position: [0, 0, t] }) });
const revolved = extrudeRotate({ sketch: s, axis: Y });
const partialRevolution = s.extrudeRotate({ axis: Y, angle: -90 });
const directRevolution = s.extrudeRotate(Y);
const revolvedAgain = revolved.chamfer();
const swept = extrudeAlongCurve({ sketch: s, curve: path });
s.extrudeAlongCurve({ curve: path });
const generalSurface = spatialSurface({ at: (u, v) => ({ position: [u, v, u * v] }) });
const partSolid = extrude({ sketch: s, length: 10, angle: 3 });
const beveled = chamfer({ solid: partSolid, length: 0.5, angle: 45, boundaries: [0] });
const beveledByMethod = partSolid.chamfer({ length: 0.5, angle: 45, boundaries: [0] });
const defaultBeveled = partSolid.chamfer();
const rounded = round({ solid: partSolid, radius: 0.5, boundaries: [0] });
const roundedByMethod = partSolid.round({ radius: 0.5, boundaries: [0] });
const defaultRounded = partSolid.round();
const annotatedByOperation = annotate({ solid: partSolid, name: "Part", color: "#33aaff", alpha: 0.5 });
const annotatedByMethod = partSolid.annotate({ name: "Part", color: "blue", alpha: 0.5 });
const paletteAnnotation = partSolid.annotate({ color: colors.green });
/** @type {AnnotationColor} */
const namedColor = "default";
const defaultPaletteAnnotation = partSolid.annotate({ color: namedColor });
const defaultAnnotation = partSolid.annotate();
const annotationGroup = new AnnotatedNode({ name: "Group", color: "red", alpha: 1 }).add(partSolid);
const annotationShorthand = annotatedNode({ name: "Group" }).add(partSolid, [partSolid]);
scene.add(annotatedByOperation, annotatedByMethod, defaultAnnotation, annotationGroup, annotationShorthand);
const cap = partSolid.surfaces.find(surface => surface instanceof Face);
if (cap) {
  const chosen = searchBoundaries({ solid: partSolid, boundaries: [0, partSolid.boundaries[0], cap,
    ({ solid: input, face, boundary }) => input === partSolid && face !== undefined && face.boundaries.includes(boundary),
  ] });
  const mixedBevel = partSolid.chamfer({ boundaries: [cap, ...chosen] });
  const mixedRound = round({ solid: partSolid, boundaries: [partSolid.boundaries[0], ({ face }) => face === cap] });
  partSolid.round({ boundaries: [cap] });
  chamfer({ solid: partSolid, boundaries: [cap, 0] });
}
const curvedJoins = searchBoundaries({ solid: partSolid, boundaries: [({ face }) => face === undefined] });
const directIndex = searchBoundaries({ solid: partSolid, boundaries: 0 });
const directBoundary = searchBoundaries({ solid: partSolid, boundaries: partSolid.boundaries[0] });
const directPredicate = searchBoundaries({ solid: partSolid, boundaries: ({ boundary }) => boundary.isLoop() });
const chamferLoops = partSolid.chamfer({ boundaries: ({ boundary }) => boundary.isLoop() });
const roundedBoundary = round({ solid: partSolid, boundaries: partSolid.boundaries[0] });
if (cap) {
  searchBoundaries({ solid: partSolid, boundaries: cap });
  chamfer({ solid: partSolid, boundaries: cap });
  partSolid.round({ boundaries: cap });
}
const common = intersect({ solid: partSolid, tool: swept });
const removed = difference({ solid: partSolid, tool: swept });
const cutExtrusion = extrudeCut({ solid: partSolid, sketch: s, length: -3, axis: Z, angle: 2 });
const commonMethod = partSolid.intersect({ tool: swept });
const removedMethod = partSolid.difference({ tool: swept });
const cutMethod = partSolid.extrudeCut({ sketch: s, length: 3, axis: Z, angle: -2 });
const cutCurve = trimCurve({ curve: circle({ center, radius: 5 }), cutters: [line({ point: center, direction: [0, 1] })], keep: 0 });
const cutPath = trimCurve({ curve: path, cutters: [XY], keep: 0.5 });
const cutSurfaces = trimSurface({ surface: partSolid.surfaces[0], cutter: YZ, keep: "positive" });
const cutByCurve = trimSurface({ surface: partSolid.surfaces[0], cutter: circle({ center, radius: 2 }), keep: "outside" });
const trim = trimmedSurface({ surface: generalSurface, at: (u, v) => ({ x: u, y: v }), boundaryLoops: [], sides: {} });
const originalParameters = trim.parameters(0.5, 0.5);
scene.add(partSolid);
s.extrude({ length: 2, angle: -5 });
const draft = sketch({ plane: plane() }).add(circle({ center, radius: 2 }));
scene.add(draft.extrude({ length: 3 }));
scene.add(node(), memo(), transformMat4Node({ matrix: mat4.create() }));
sketch().add({ x: 1, y: 2 });
const transform = new Transform().add(partSolid);
transform.rotation.z = 90;
scene.add(transform);
partSolid.refresh();
scene.remove(new Node(), new Node());
const vector = vec3.fromValues(1, 2, 3);
const axis = spatialLine({ direction: [0, 0, 2], origin: [1, 2, 3] });
const axisClass = new SpatialLine({ direction: [1, 0, 0] });
const axisVector = vec3.add([0, 0, 0], axis, X);
vec3.normalize(axisClass, axisClass);
const turnedPlane = rotate({ object: XY, axis: X, angle: 30 });
const movedAxis = displace({ object: Z, vector });
const turnedSolid = rotate({ object: partSolid, axis, angle: -45 });
const movedSolid = displace({ object: turnedSolid, vector });
const movedCurve = displace({ object: path, vector });
const turnedSurface = rotate({ object: generalSurface, axis, angle: 90 });
const chainedPlane = XY.rotate({ axis: X, angle: 30 }).displace({ vector });
const chainedLine = axis.rotate({ axis: Z, angle: 20 }).displace({ vector });
const chainedCurve = path.rotate({ axis: Z, angle: 90 }).displace({ vector });
const chainedSolid = partSolid.rotate({ axis, angle: 45 }).displace({ vector }).chamfer();
const chainedFace = face({ outer: [spatialCurveFromPlanar({ curve: circle({ center, radius: 2 }) })] }).rotate({ axis: X, angle: 30 }).displace({ vector });
const facePlane = chainedFace.plane;
const chainedSurface = generalSurface.rotate({ axis, angle: 90 }).displace({ vector });
const chainedTrim = trim.rotate({ axis: Z, angle: 10 }).displace({ vector });
const retainedUV = chainedTrim.parameters(0.5, 0.5);
const row = displacementArray({ object: partSolid, vector: X, N: 4, offset: 10 });
const grid = displacementArray({ object: row, vector: Y, N: 3, width: 30 });
scene.add(grid);
const alongPath = curveArray({ object: [partSolid, [partSolid]], curve: path, N: 4, follow: false });
const alongPathSolid = alongPath[0].chamfer();
const ring = rotationArray({ object: partSolid, axis: Z, N: 8 });
scene.add(Object.freeze(ring), node());
const turnedGrid = rotationArray({ object: grid, axis: Z, offset: 90 });
const repeatedSolid = turnedGrid[23].chamfer();
const deeplyNested = displacementArray({ object: [[partSolid], [[partSolid]]], vector: X, N: 2, offset: 10 });
const flattenedSolid = deeplyNested[3].chamfer();
/** @type {ArrayTarget} */
const dynamicTarget = [partSolid, [[partSolid]]];
const dynamicCopies = rotationArray({ object: dynamicTarget, axis: Z, N: 2 });
const dynamicMoved = dynamicCopies[0].displace({ vector: X });
const repeatedLines = displacementArray({ object: Z, vector: X, width: 10, offset: 5 });
const lineOrigin = repeatedLines[1].origin;
const faceArray = rotationArray({ object: chainedFace, axis: Z, N: 2, width: 180 });
const retainedPlane = faceArray[0].plane;
const readonlyPlanes = displacementArray({ object: Object.freeze([XY, ZX]), vector: Y, N: 2, offset: 10 });
const normalOfCopy = readonlyPlanes[1].normal;
const movedOrigin = movedAxis.origin;
const planeNormal = turnedPlane.normal;
scene.add(movedSolid);

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
const lifted = spatialCurveFromPlanar({ curve: planar, plane: ZX });
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
const surfaces = partSolid.surfaces;
const boundaries = partSolid.boundaries;`;
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
    const sweep = service.getQuickInfoAtPosition("/model.js", code.indexOf("extrudeAlongCurve({") + 1);
    assert.match(ts.displayPartsToString(sweep.documentation), /smooth, regular spatial curve/);
    const revolve = service.getQuickInfoAtPosition("/model.js", code.indexOf("extrudeRotate({") + 1);
    assert.match(ts.displayPartsToString(revolve.documentation), /rotating them about a coplanar spatial line/);
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
    assert.match(ts.displayPartsToString(circle.displayParts), /center\?: Point/);
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
