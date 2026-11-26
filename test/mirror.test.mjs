import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCode, exportBinaryStl } from "../src/cad.ts";

// Exercise the global operation and both method forms through the app's script runtime.
test("mirror is available to CAD scripts and exports outward-oriented reflected solids", () => {
  const result = evaluateCode(`
const part = sketch().add(rectangle({ corner1: { x: 1, y: 2 }, width: 3, height: 4 })).extrude(5);
scene.add(mirror({ solid: part, plane: YZ }).annotate({ name: "Mirror" }));
scene.add(part.mirror({ plane: YZ.displace([10, 0, 0]) }));
scene.add(part.mirror(YZ));
`);
  const part = result.meshes.find(part => part.name === "Mirror");
  const xs = Array.from(part.positions).filter((_, i) => i % 3 === 0);
  assert.equal(Math.min(...xs), -4);
  assert.equal(Math.max(...xs), -1);
  const stl = new DataView(exportBinaryStl(part.positions));
  let volume = 0;
  for (let i = 0; i < stl.getUint32(80, true); i++) {
    const at = (vertex, axis) => stl.getFloat32(84 + i * 50 + 12 + vertex * 12 + axis * 4, true);
    const a = [0, 1, 2].map(axis => at(0, axis)), b = [0, 1, 2].map(axis => at(1, axis)), c = [0, 1, 2].map(axis => at(2, axis));
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  assert.ok(Math.abs(volume - 60) < 1e-5);
});
