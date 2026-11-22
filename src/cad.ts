import * as compass from "libcompass";
import { glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 } from "gl-matrix";
import { Node } from "libcompass";
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { parse } from "acorn";
import { createScriptConsole, errorEntry, type ConsoleOutput, type ScriptLocation } from "./script-console.ts";
import { MAIN_FILE, projectSource, type ScriptFile } from "./script-files.ts";
import { mapProjectLocation, runProjectFiles, type ProjectSourceMaps } from "./project-runtime.ts";

export const DEFAULT_CODE = `// libcompass constructors, shorthands, and gl-matrix are available by name.
// Add nodes to scene, then press Render (Ctrl/Cmd + Enter).
// Reusable shape helpers live in primitives.js.

const width = 100;
const depth = 64;
const height = 12;

// start by creating a 2d sketch
const s = sketch();
s.add(rectangle({ center, width, height: depth }));
s.add(
  circle({ center: { x: -28, y: 0 }, radius: 10 }),
  circle({ center: { x: 28, y: 0 }, radius: 10 }),
);

// create a 3d solid by extruding the sketch
const part = extrude({ sketch: s, length: height })
  .chamfer({ boundaries: ({ boundary }) => boundary.isLoop() });

// part will not be rendered unless you call scene.add()
scene.add(part);
`;

export interface RenderedScene {
  scene: Node;
  positions: Float32Array;
  meshes: RenderedMesh[];
  source: string;
  projectSource?: string;
}

export interface RenderedMesh {
  positions: Float32Array;
  annotated: boolean;
  name: string;
  color: `#${string}`;
  alpha: number;
}

/** Partition the completed world-space triangulation, preserving all ancestor transforms. */
function collectMeshes(scene: Node, positions: Float32Array): RenderedMesh[] {
  if (!positions.length) return [];
  const annotated = (node: Node): boolean => node instanceof compass.AnnotatedNode || node.children.some(annotated);
  if (!annotated(scene)) return [{ positions: positions.slice(), annotated: false, name: '', color: compass.colors.default, alpha: 1 }];
  type Batch = { annotation?: compass.AnnotatedNode; ranges: { start: number; length: number }[] };
  const fallback: Batch = { ranges: [] }, batches = [fallback];
  const visit = (node: Node, start: number, length: number, batch: Batch) => {
    if (node instanceof compass.AnnotatedNode) {
      batch = { annotation: node, ranges: [] };
      batches.push(batch);
    }
    // Standard nodes keep own triangles first, then each child's triangles in order.
    // Slicing the final array also retains transforms whose geometry is memoized.
    const lengths = node.children.map(child => child.triangulate().length);
    const own = length - lengths.reduce((sum, size) => sum + size, 0);
    if (own < 0 || own % 9 || lengths.some(size => size % 9)) {
      throw new RangeError('Scene nodes must retain own triangles followed by child triangles; refresh affected memoized ancestors after edits');
    }
    if (own) batch.ranges.push({ start, length: own });
    let offset = start + own;
    node.children.forEach((child, i) => { visit(child, offset, lengths[i], batch); offset += lengths[i]; });
  };
  visit(scene, 0, positions.length, fallback);
  return batches.filter(batch => batch.ranges.length).map(({ annotation, ranges }) => {
    const mesh = new Float32Array(ranges.reduce((sum, range) => sum + range.length, 0));
    let offset = 0;
    for (const range of ranges) {
      mesh.set(positions.subarray(range.start, range.start + range.length), offset);
      offset += range.length;
    }
    return { positions: mesh, annotated: annotation !== undefined, name: annotation?.name ?? '', color: annotation?.color ?? compass.colors.default, alpha: annotation?.alpha ?? 1 };
  });
}

function scriptBindings(scriptConsole: Console) {
  return { ...compass,
    measure: (options: Parameters<typeof compass.measure>[0]) => compass.measure({ ...options, log: options.log === undefined ? result => scriptConsole.log(result) : options.log }),
    glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 };
}

function renderedScene(scene: unknown, source: string): RenderedScene {
  if (!(scene instanceof Node)) throw new TypeError("scene must be a libcompass Node.");
  const positions = scene.triangulate();
  if (!(positions instanceof Float32Array) || positions.length % 9 !== 0 || !positions.every(Number.isFinite)) {
    throw new TypeError("scene.triangulate() must return finite XYZ triangle positions in a Float32Array.");
  }
  return { scene, positions: positions.slice(), meshes: collectMeshes(scene, positions), source };
}

export async function evaluateProject(files: readonly ScriptFile[], output?: ConsoleOutput, resolution = compass.TRIANGULATION_RESOLUTION,
  options: { signal?: AbortSignal; onFileLoaded?: (file: ScriptFile) => void } = {}) {
  const maps: ProjectSourceMaps = new Map();
  const map = (location: ScriptLocation) => mapProjectLocation(location, maps);
  let runtime: Awaited<ReturnType<typeof runProjectFiles>> | undefined;
  try {
    compass.setTriangulationResolution(resolution);
    const scriptConsole = output ? createScriptConsole(output, map) : console;
    runtime = await runProjectFiles(files, { ...scriptBindings(scriptConsole), scene: new Node(), console: scriptConsole }, maps, { ...options, output });
    const rendered = renderedScene(runtime.scene, files.find(file => file.name === MAIN_FILE)!.source);
    rendered.projectSource = projectSource(runtime.files);
    return { rendered, dispose: runtime.dispose };
  } catch (error) {
    runtime?.dispose();
    if (options.signal?.aborted) throw error;
    const details = error as { message?: string; name?: string; stack?: string; scriptLocation?: ScriptLocation };
    const normalized = error instanceof Error ? error : Object.assign(new Error(details?.message ?? String(error)), { name: details?.name ?? "Error", stack: details?.stack });
    output?.(errorEntry(normalized, details?.scriptLocation, undefined, map));
    throw normalized;
  }
}

export function evaluateCode(source: string, output?: ConsoleOutput, resolution = compass.TRIANGULATION_RESOLUTION): RenderedScene {
  // ponytail: synchronous, trusted local code; a worker is needed for execution time limits.
  // Block scope lets local names shadow library bindings such as sketch and circle.
  const body = `"use strict";\n{\n${source}\n;return scene;\n}\n//# sourceURL=compass-script.js`;
  let syntaxLocation: ScriptLocation | undefined;
  try {
    compass.setTriangulationResolution(resolution);
    const scriptConsole = output ? createScriptConsole(output) : console;
    const bindings = scriptBindings(scriptConsole);
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
    const scene = evaluate(new Node(), scriptConsole, ...Object.values(bindings));
    return renderedScene(scene, source);
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
