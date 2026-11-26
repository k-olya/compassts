import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import type { rollup as build, OutputChunk } from '@rollup/browser';
import { parse, type Node } from 'acorn';
import { inspectScript, mapProjectLocation, type Edit, type ProjectSourceMaps } from './project-runtime.ts';
import { fetchScriptFile, MAIN_FILE, resolveScript, type ScriptFile } from './script-files.ts';
import type { ScriptLocation } from './script-console.ts';

/** Bundle the user's modules, leaving CAD bindings in the worker's global scope. */
export async function bundleProject(files: readonly ScriptFile[], bindings: Record<string, unknown>,
  onFileLoaded: (file: ScriptFile) => void, rollup: typeof build) {
  const available = new Map(files.map(file => [file.name, file]));
  const bundle = await rollup({
    input: MAIN_FILE, treeshake: false, onwarn: () => {},
    plugins: [{
      name: 'compassts-project',
      resolveId(specifier, importer) {
        return importer ? resolveScript(specifier, available.get(importer)!, available) : specifier;
      },
      async load(id) {
        if (id === 'libcompass' || id === 'gl-matrix') {
          const math = ['glMatrix','mat2','mat2d','mat3','mat4','quat','quat2','vec2','vec3','vec4'];
          return Object.keys(bindings).filter(name => id === 'gl-matrix' ? math.includes(name) : !math.includes(name) && !['parametric', 'log', 'visualize', 'vi'].includes(name))
            .map(name => `export const ${name} = globalThis.__compassBindings[${JSON.stringify(name)}];`).join('\n');
        }
        let file = available.get(id);
        if (!file && /^https?:\/\//.test(id)) {
          file = await fetchScriptFile(id); available.set(id, file); onFileLoaded(file);
        }
        if (!file) throw new Error(`Script not found: ${id}`);
        if (inspectScript(file).classic || /\b(?:svgPath|document|window)\b/.test(file.source)) throw new NeedsDomError();
        return file.source;
      },
      resolveImportMeta(property, { moduleId }) {
        const url = available.get(moduleId)?.url ?? `file:///${moduleId}`;
        return property === 'url' ? JSON.stringify(url) : property === null ? `({url:${JSON.stringify(url)}})` : 'undefined';
      },
    }],
  });
  try {
    const { output } = await bundle.generate({ format: 'es', sourcemap: true });
    const chunks = new Map(output.filter((item): item is OutputChunk => item.type === 'chunk').map(chunk => [chunk.fileName, chunk]));
    const urls = new Map<string, string>(), visiting = new Set<string>();
    const maps = new Map<string, TraceMap>(), edits: ProjectSourceMaps = new Map();
    const dispose = () => urls.forEach(url => URL.revokeObjectURL(url));
    const link = (name: string): string => {
      if (urls.has(name)) return urls.get(name)!;
      // A cyclic chunk graph cannot be linked using immutable blob URLs; keep native import-map behavior.
      if (visiting.has(name)) throw new NeedsDomError();
      visiting.add(name);
      const chunk = chunks.get(name)!;
      const source = `__bundle__/${name}`;
      const changes: Edit[] = [];
      const visit = (node: Node) => {
        const sourceNode = ['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)
          ? (node as Node & { source?: Node & { value?: unknown } }).source : undefined;
        if (sourceNode && typeof sourceNode.value === 'string' && /^\.\//.test(sourceNode.value) && chunks.has(sourceNode.value.slice(2))) {
          changes.push({ start: sourceNode.start, end: sourceNode.end, text: JSON.stringify(link(sourceNode.value.slice(2))), line: sourceNode.loc!.start.line, column: sourceNode.loc!.start.column });
        }
        for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
          if (child && typeof child === 'object' && 'type' in child) visit(child);
        }
      };
      visit(parse(chunk.code, { ecmaVersion: 'latest', sourceType: 'module', locations: true }));
      changes.sort((a, b) => a.start - b.start); edits.set(source, changes);
      if (chunk.map) maps.set(source, new TraceMap(chunk.map.toString()));
      let code = chunk.code;
      for (const change of [...changes].reverse()) code = code.slice(0, change.start) + change.text + code.slice(change.end);
      const url = URL.createObjectURL(new Blob([code + `\n//# sourceURL=compass-file:///${source}`], { type: 'text/javascript' }));
      visiting.delete(name); urls.set(name, url); return url;
    };
    const location = (position: ScriptLocation): ScriptLocation => {
      const map = maps.get(position.file ?? '');
      if (!map) return position;
      position = mapProjectLocation(position, edits);
      const original = originalPositionFor(map, { line: position.line, column: position.column - 1 });
      return original.source && original.line !== null && original.column !== null
        ? { file: original.source, line: original.line, column: original.column + 1 } : position;
    };
    try {
      const entry = [...chunks.values()].find(chunk => chunk.isEntry)!;
      return { url: link(entry.fileName), files: [...available.values()], location, dispose };
    } catch (error) { dispose(); throw error; }
  } finally { await bundle.close(); }
}

/** SVG's native geometry APIs and DOM-dependent classic libraries require a browser realm. */
export class NeedsDomError extends Error {
  constructor() { super('This script requires browser DOM APIs.'); this.name = 'NeedsDomError'; }
}
