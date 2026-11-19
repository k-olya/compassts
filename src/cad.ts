import * as compass from "libcompass";
import { glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 } from "gl-matrix";
import { Node } from "libcompass";
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";

export const DEFAULT_CODE = `// libcompass constructors, shorthands, and gl-matrix are available by name.
// Add nodes to scene, then press Render (Ctrl/Cmd + Enter).

const width = 100;
const depth = 64;
const height = 12;

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

// Curves remain exact; Render samples them at 0.001 resolution.
const part = extrude({ sketch: s, direction: [0, 0, height] });
scene.add(part);
`;

export interface RenderedScene {
  scene: Node;
  positions: Float32Array;
  source: string;
}

const bindings = { ...compass, glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 };

export function evaluateCode(source: string): RenderedScene {
  // ponytail: synchronous, trusted local code; a worker is needed for execution time limits.
  // Block scope lets local names shadow library bindings such as sketch and circle.
  const evaluate = new Function("scene", ...Object.keys(bindings), `"use strict";\n{\n${source}\n;return scene;\n}`);
  const scene: unknown = evaluate(new Node(), ...Object.values(bindings));
  if (!(scene instanceof Node)) throw new TypeError("scene must be a libcompass Node.");
  const positions = scene.triangulate();
  if (!(positions instanceof Float32Array) || positions.length % 9 !== 0 || !positions.every(Number.isFinite)) {
    throw new TypeError("scene.triangulate() must return finite XYZ triangle positions in a Float32Array.");
  }
  return { scene, positions: positions.slice(), source };
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
