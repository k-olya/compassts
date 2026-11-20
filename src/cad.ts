import * as compass from "libcompass";
import { glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 } from "gl-matrix";
import { Node } from "libcompass";
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { parse } from "acorn";
import { createScriptConsole, errorEntry, type ConsoleOutput, type ScriptLocation } from "./script-console.ts";

export const DEFAULT_CODE = `// libcompass constructors, shorthands, and gl-matrix are available by name.
// Add nodes to scene, then press Render (Ctrl/Cmd + Enter).

const width = 100;
const depth = 64;
const height = 12;
const angleDEG = 3; // Positive draft expands, negative contracts.

const corners = [
  { x: -width / 2, y: -depth / 2 },
  { x: width / 2, y: -depth / 2 },
  { x: width / 2, y: depth / 2 },
  { x: -width / 2, y: depth / 2 },
];

const s = sketch();
s.add(...corners.map((point, i) =>
  lineSegment({ start: point, end: corners[(i + 1) % corners.length] })
));
s.add(
  circle({ center: { x: -28, y: 0 }, radius: 10 }),
  circle({ center: { x: 28, y: 0 }, radius: 10 }),
);

// Profile analysis uses polylines; the solid retains exact curves.
const part = extrude({ sketch: s, length: height, angle: angleDEG });
scene.add(part);

// Sweep a circular section around a closed path to make a torus beside the plate.
const section = sketch().add(circle({ center: { x: 0, y: 0 }, radius: 1 }));
const path = SpatialCurve.fromPlanarCurve({
  curve: circle({ center: { x: 0, y: -46 }, radius: 8 }),
  plane: plane({ a: [0, 0, 1], b: [1, 0, 1], c: [0, 1, 1] }),
});
const torus = extrudeAlongCurve({ sketch: section, curve: path });
scene.add(torus);
`;

export interface RenderedScene {
  scene: Node;
  positions: Float32Array;
  source: string;
}

export function evaluateCode(source: string, output?: ConsoleOutput, resolution = compass.TRIANGULATION_RESOLUTION): RenderedScene {
  // ponytail: synchronous, trusted local code; a worker is needed for execution time limits.
  // Block scope lets local names shadow library bindings such as sketch and circle.
  const body = `"use strict";\n{\n${source}\n;return scene;\n}\n//# sourceURL=compass-script.js`;
  let syntaxLocation: ScriptLocation | undefined;
  try {
    compass.setTriangulationResolution(resolution);
    const bindings = { ...compass, glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 };
    let evaluate: (...args: unknown[]) => unknown;
    try {
      evaluate = new Function("scene", "console", ...Object.keys(bindings), body) as typeof evaluate;
    } catch (error) {
      // Browsers omit source locations for Function compilation errors.
      try {
        parse(body, { ecmaVersion: "latest", allowReturnOutsideFunction: true });
      } catch (diagnostic) {
        if (diagnostic instanceof SyntaxError && "loc" in diagnostic) {
          const loc = diagnostic.loc as { line: number; column: number };
          syntaxLocation = { line: Math.min(source.split("\n").length, Math.max(1, loc.line - 2)), column: loc.column + 1 };
        }
      }
      throw error;
    }
    const scene = evaluate(new Node(), output ? createScriptConsole(output) : console, ...Object.values(bindings));
    if (!(scene instanceof Node)) throw new TypeError("scene must be a libcompass Node.");
    const positions = scene.triangulate();
    if (!(positions instanceof Float32Array) || positions.length % 9 !== 0 || !positions.every(Number.isFinite)) {
      throw new TypeError("scene.triangulate() must return finite XYZ triangle positions in a Float32Array.");
    }
    return { scene, positions: positions.slice(), source };
  } catch (error) {
    output?.(errorEntry(error, syntaxLocation));
    throw error;
  }
}

export function createGeometry(positions: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function exportBinaryStl(positions: Float32Array): ArrayBuffer {
  const geometry = createGeometry(positions);
  const material = new MeshBasicMaterial();
  try {
    const mesh = new Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    const data = new STLExporter().parse(mesh, { binary: true });
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice().buffer;
  } finally {
    geometry.dispose();
    material.dispose();
  }
}
