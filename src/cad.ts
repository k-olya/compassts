import * as compass from "libcompass";
import { glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 } from "gl-matrix";
import { Node } from "libcompass";
import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { parse } from "acorn";
import { createScriptConsole, errorEntry, type ConsoleOutput, type ScriptLocation } from "./script-console.ts";
import { createParametricRuntime, type ParametricControl } from "./parametric.ts";
import { annotationLines } from "./annotation-lines.ts";
import { MAIN_FILE, projectSource, type ScriptFile } from "./script-files.ts";
import { mapProjectLocation, runProjectFiles, type ProjectSourceMaps } from "./project-runtime.ts";

export const DEFAULT_CODE = `// libcompass constructors, shorthands, and gl-matrix are available by name.
// Add nodes to scene, then press Render (Ctrl/Cmd + Enter).
// Reusable shape helpers live in primitives.js.

const width = 100;
const depth = 64;
const height = 12;
const holeRadius = parametric({ name: "Hole radius", min: 1, max: 18, value: 10 });

// start by creating a 2d sketch
const s = sketch();
s.add(rectangle({ center, width, height: depth }));
s.add(
  circle({ center: { x: -28, y: 0 }, radius: holeRadius }),
  circle({ center: { x: 28, y: 0 }, radius: holeRadius }),
);

// create a 3d solid by extruding the sketch
const part = s.extrude(height)
  .chamfer({ boundaries: ({ boundary }) => boundary.isLoop() });

// part will not be rendered unless you call scene.add()
scene.add(part);
`;

export interface RenderedScene {
  controls: ParametricControl[];
  scene?: Node;
  positions: Float32Array;
  meshes: RenderedMesh[];
  /** World-space position ranges omitted only from the overall export. */
  excludedRanges: { start: number; length: number }[];
  source: string;
  projectSource?: string;
}

export interface RenderedMesh {
  /** Line segments are display-only and never contribute to STL output. */
  primitive?: "lines";
  positions: Float32Array;
  annotated: boolean;
  /** Effective export exclusion, including excluded ancestors. */
  exclude: boolean;
  name: string;
  color: `#${string}`;
  alpha: number;
}

/** Partition the completed world-space triangulation, preserving all ancestor transforms. */
function collectMeshes(scene: Node, positions: Float32Array, excludedRanges: RenderedScene["excludedRanges"]): RenderedMesh[] {
  const annotated = (node: Node): boolean => node instanceof compass.AnnotatedNode || node.children.some(annotated);
  if (!annotated(scene)) return positions.length ? [{ positions: positions.slice(), annotated: false, exclude: false, name: '', color: compass.colors.default, alpha: 1 }] : [];
  type Batch = { annotation?: compass.AnnotatedNode; exclude: boolean; ranges: { start: number; length: number }[]; lines: RenderedMesh[] };
  const fallback: Batch = { exclude: false, ranges: [], lines: [] }, batches = [fallback];
  const visit = (node: Node, start: number, length: number, batch: Batch, exclude = false, matrix = mat4.create()) => {
    if (node instanceof compass.TransformMat4) matrix = mat4.multiply(mat4.create(), matrix, node.matrix);
    if (node instanceof compass.AnnotatedNode) {
      exclude ||= node.exclude;
      batch = { annotation: node, exclude, ranges: [], lines: [] };
      if (node.geometry !== undefined) batch.lines = annotationLines(node.geometry, node.color).map(line => ({
        positions: compass.transformMat4(line.positions, matrix), primitive: "lines", annotated: true, exclude,
        name: node.name, color: line.color, alpha: node.alpha,
      }));
      batches.push(batch);
    }
    // Standard nodes keep own triangles first, then each child's triangles in order.
    // Slicing the final array also retains transforms whose geometry is memoized.
    const lengths = node.children.map(child => child.triangulate().length);
    const own = length - lengths.reduce((sum, size) => sum + size, 0);
    if (own < 0 || own % 9 || lengths.some(size => size % 9)) {
      throw new RangeError('Scene nodes must retain own triangles followed by child triangles; refresh affected memoized ancestors after edits');
    }
    if (own) {
      batch.ranges.push({ start, length: own });
      if (exclude) excludedRanges.push({ start, length: own });
    }
    let offset = start + own;
    node.children.forEach((child, i) => { visit(child, offset, lengths[i], batch, exclude, matrix); offset += lengths[i]; });
  };
  visit(scene, 0, positions.length, fallback);
  return batches.flatMap(({ annotation, exclude, ranges, lines }): RenderedMesh[] => {
    if (!ranges.length) return lines;
    const mesh = new Float32Array(ranges.reduce((sum, range) => sum + range.length, 0));
    let offset = 0;
    for (const range of ranges) {
      mesh.set(positions.subarray(range.start, range.start + range.length), offset);
      offset += range.length;
    }
    return [{ positions: mesh, annotated: annotation !== undefined, exclude, name: annotation?.name ?? '', color: annotation?.color ?? compass.colors.default, alpha: annotation?.alpha ?? 1 }, ...lines];
  });
}

export type Visualizable = Node | compass.AnnotationGeometry | readonly Visualizable[];

/** Add an inspection annotation and retain the exact input value and type. */
function visualize<T extends Visualizable>(value: T, scene: Node): T {
  const group = new compass.AnnotatedNode({ exclude: true });
  const add = (object: Visualizable) => {
    if (object instanceof Node) group.add(compass.annotate({ node: object, color: "red", alpha: 0.35 }));
    else if (!(object instanceof compass.SpatialLine) && Array.isArray(object)) for (const item of object) add(item);
    else group.add(compass.annotate({ geometry: object as compass.AnnotationGeometry, color: "blue" }));
  };
  add(value);
  scene.add(group);
  return value;
}

export function scriptBindings(scriptConsole: Console, parameters: ReturnType<typeof createParametricRuntime>, scene: Node) {
  const vi = <T extends Visualizable>(value: T): T => visualize(value, scene);
  return { ...compass, parametric: parameters.parametric,
    log: <T>(value: T): T => { scriptConsole.log(value); return value; },
    visualize: vi, vi,
    measure: (input: Parameters<typeof compass.measure>[0]) => {
      const options = "object" in input ? input : { object: input };
      return compass.measure({ ...options, log: options.log === undefined ? result => scriptConsole.log(result) : options.log });
    },
    glMatrix, mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 };
}

export function renderedScene(scene: unknown, source: string, controls: ParametricControl[]): RenderedScene {
  if (!(scene instanceof Node)) throw new TypeError("scene must be a libcompass Node.");
  const positions = scene.triangulate();
  if (!(positions instanceof Float32Array) || positions.length % 9 !== 0 || !positions.every(Number.isFinite)) {
    throw new TypeError("scene.triangulate() must return finite XYZ triangle positions in a Float32Array.");
  }
  const excludedRanges: RenderedScene["excludedRanges"] = [];
  return { scene, positions: positions.slice(), meshes: collectMeshes(scene, positions, excludedRanges), excludedRanges, source, controls: [...controls] };
}

export async function evaluateProject(files: readonly ScriptFile[], output?: ConsoleOutput, resolution = compass.TRIANGULATION_RESOLUTION,
  options: { signal?: AbortSignal; onFileLoaded?: (file: ScriptFile) => void; controls?: readonly ParametricControl[]; onControls?: (controls: ParametricControl[]) => void } = {}) {
  const parameters = createParametricRuntime(options.controls, options.onControls);
  const maps: ProjectSourceMaps = new Map();
  const map = (location: ScriptLocation) => mapProjectLocation(location, maps);
  let runtime: Awaited<ReturnType<typeof runProjectFiles>> | undefined;
  try {
    compass.setTriangulationResolution(resolution);
    const scriptConsole = output ? createScriptConsole(output, map) : console;
    const scene = new Node();
    runtime = await runProjectFiles(files, { ...scriptBindings(scriptConsole, parameters, scene), scene, console: scriptConsole }, maps, { ...options, output });
    const rendered = renderedScene(runtime.scene, files.find(file => file.name === MAIN_FILE)!.source, parameters.controls);
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

export function evaluateCode(source: string, output?: ConsoleOutput, resolution = compass.TRIANGULATION_RESOLUTION,
  options: { controls?: readonly ParametricControl[]; onControls?: (controls: ParametricControl[]) => void } = {}): RenderedScene {
  const parameters = createParametricRuntime(options.controls, options.onControls);
  // Synchronous evaluation is also used inside the background render worker.
  // Block scope lets local names shadow library bindings such as sketch and circle.
  const body = `"use strict";\n{\n${source}\n;return scene;\n}\n//# sourceURL=compass-script.js`;
  let syntaxLocation: ScriptLocation | undefined;
  try {
    compass.setTriangulationResolution(resolution);
    const scriptConsole = output ? createScriptConsole(output) : console;
    const root = new Node();
    const bindings = scriptBindings(scriptConsole, parameters, root);
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
    const scene = evaluate(root, scriptConsole, ...Object.values(bindings));
    return renderedScene(scene, source, parameters.controls);
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

export function exportBinaryStl(source: Float32Array | Pick<RenderedScene, "positions" | "excludedRanges">): ArrayBuffer {
  let positions = source instanceof Float32Array ? source : source.positions;
  if (!(source instanceof Float32Array) && source.excludedRanges.length) {
    const retained = new Float32Array(positions.length - source.excludedRanges.reduce((sum, range) => sum + range.length, 0));
    let start = 0, offset = 0;
    for (const range of source.excludedRanges) {
      retained.set(positions.subarray(start, range.start), offset);
      offset += range.start - start;
      start = range.start + range.length;
    }
    retained.set(positions.subarray(start), offset);
    positions = retained;
  }
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
