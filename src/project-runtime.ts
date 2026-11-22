import { parse, type Node as AstNode, type ImportDeclaration, type ImportExpression, type ExportNamedDeclaration, type ExportAllDeclaration } from 'acorn';
import { fetchScriptFile, MAIN_FILE, resolveScript, type ScriptFile } from './script-files.ts';
import { errorEntry, type ConsoleOutput, type ScriptLocation } from './script-console.ts';

interface Edit { start: number; end: number; text: string; line: number; column: number }
export type ProjectSourceMaps = Map<string, Edit[]>;

export function mapProjectLocation(location: ScriptLocation, maps: ProjectSourceMaps): ScriptLocation {
  let delta = 0;
  for (const edit of maps.get(location.file ?? MAIN_FILE) ?? []) {
    if (edit.line !== location.line) continue;
    const start = edit.column + 1 + delta;
    if (location.column < start) break;
    if (location.column < start + edit.text.length) return { ...location, column: edit.column + 1 };
    delta += edit.text.length - (edit.end - edit.start);
  }
  return { ...location, column: Math.max(1, location.column - delta) };
}

function located(error: unknown, file: string, node?: AstNode): Error & { scriptLocation?: ScriptLocation } {
  const original = error as { message?: string; stack?: string; name?: string; loc?: { line: number; column: number }; scriptLocation?: ScriptLocation };
  const result = error instanceof Error ? error : new Error(original?.message ?? String(error));
  if (original?.stack) result.stack = original.stack;
  result.name = original?.name ?? result.name;
  if (!original?.scriptLocation && !original?.loc && !node && original?.stack?.includes('compass-file:///')) return result;
  return Object.assign(result, { scriptLocation: original?.scriptLocation ?? {
    file, line: original?.loc?.line ?? node?.loc?.start.line ?? 1, column: (original?.loc?.column ?? node?.loc?.start.column ?? 0) + 1,
  } });
}

function walk(node: AstNode, visit: (node: AstNode) => void) {
  visit(node);
  for (const value of Object.values(node) as unknown[]) {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === 'object' && 'type' in child && typeof child.type === 'string') walk(child as AstNode, visit);
    }
  }
}

export function inspectScript(file: ScriptFile) {
  let ast;
  try { ast = parse(file.source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); }
  catch (error) {
    if (!file.url) throw located(error, file.name);
    try { return { ast: parse(file.source, { ecmaVersion: 'latest', sourceType: 'script', locations: true }), classic: true }; }
    catch { throw located(error, file.name); }
  }
  let classic = !!file.url && !ast.body.some(node => /^(?:ImportDeclaration|Export)/.test(node.type));
  if (classic) {
    try { parse(file.source, { ecmaVersion: 'latest', sourceType: 'script' }); }
    catch { classic = false; } // For example, a URL module using top-level await.
  }
  return { ast, classic };
}

/** Use native modules in a disposable browser realm; no module syntax is emulated. */
export async function runProjectFiles(files: readonly ScriptFile[], bindings: Record<string, unknown>, maps: ProjectSourceMaps,
  options: { output?: ConsoleOutput; signal?: AbortSignal; onFileLoaded?: (file: ScriptFile) => void } = {}) {
  const available = new Map(files.map(file => [file.name, file]));
  const records = new Map<string, { file: ScriptFile; classic: boolean; edits: Edit[] }>();
  const urls: string[] = [];
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.dataset.compassRuntime = '';
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; frame.remove(); urls.forEach(url => URL.revokeObjectURL(url)); };
  const aborted = () => { options.signal?.throwIfAborted(); if (disposed) throw new DOMException('Render cancelled', 'AbortError'); };
  options.signal?.addEventListener('abort', dispose, { once: true });
  const token = `compass-module-${crypto.randomUUID()}/`;
  const key = (name: string) => `${token}${encodeURIComponent(name)}`;
  const sourceURL = (name: string) => `\n//# sourceURL=compass-file:///${encodeURIComponent(name)}\n`;
  const blob = (source: string) => { const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' })); urls.push(url); return url; };
  try {
    async function visit(name: string) {
      aborted();
      if (name === 'libcompass' || name === 'gl-matrix' || records.has(name)) return;
      let file = available.get(name);
      if (!file && /^https?:\/\//.test(name)) {
        file = await fetchScriptFile(name, options.signal); aborted();
        available.set(name, file); options.onFileLoaded?.(file);
      }
      if (!file) throw new Error(`Script not found: ${name}`);
      const { ast, classic } = inspectScript(file);
      const record = { file, classic, edits: [] as Edit[] };
      records.set(name, record); // Register before descending so cycles can link normally.
      const imports: { source: AstNode & { value?: unknown } }[] = [];
      walk(ast, node => {
        if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
          const source = (node as ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration).source;
          if (source) imports.push({ source });
        } else if (node.type === 'ImportExpression') {
          const source = (node as ImportExpression).source;
          if (source.type !== 'Literal' || typeof source.value !== 'string') throw located(new Error('Dynamic imports require a string literal.'), file!.name, source);
          imports.push({ source });
        } else if (node.type === 'MetaProperty') {
          // Module source URLs remain useful for assets loaded relative to a URL module.
          const text = file!.source.slice(node.start, node.end);
          if (text === 'import.meta') record.edits.push({ start: node.start, end: node.end,
            text: `({url:${JSON.stringify(file!.url ?? `file:///${file!.name}`)}})`, line: node.loc!.start.line, column: node.loc!.start.column });
        }
      });
      for (const { source } of imports) {
        try {
          const target = resolveScript(String(source.value), file, available);
          record.edits.push({ start: source.start, end: source.end, text: JSON.stringify(key(target)), line: source.loc!.start.line, column: source.loc!.start.column });
          await visit(target);
        } catch (error) { throw located(error, file.name, source); }
      }
      record.edits.sort((a, b) => a.start - b.start);
      maps.set(file.name, record.edits);
    }
    await visit(MAIN_FILE);
    for (const file of files) if (file.url) await visit(file.name);
    aborted();
    const imports: Record<string, string> = {};
    for (const [name, { file, classic, edits }] of records) {
      let source = file.source;
      for (const edit of [...edits].reverse()) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
      imports[key(name)] = blob((classic ? 'export {};' : source) + sourceURL(name));
    }
    for (const name of ['libcompass', 'gl-matrix']) {
      const names = Object.keys(bindings).filter(key => name === 'gl-matrix'
        ? ['glMatrix','mat2','mat2d','mat3','mat4','quat','quat2','vec2','vec3','vec4'].includes(key)
        : !['scene','console','glMatrix','mat2','mat2d','mat3','mat4','quat','quat2','vec2','vec3','vec4'].includes(key));
      imports[key(name)] = blob(names.map(name => `export const ${name}=globalThis.__compassBindings[${JSON.stringify(name)}];`).join('\n'));
    }
    document.body.append(frame);
    const win = frame.contentWindow!, doc = frame.contentDocument!;
    for (const [name, value] of Object.entries({ ...bindings, __compassBindings: bindings })) {
      Object.defineProperty(win, name, { value, writable: true, configurable: true });
    }
    const importMap = doc.createElement('script');
    importMap.type = 'importmap'; importMap.textContent = JSON.stringify({ imports }); doc.head.append(importMap);
    const reportAsync = (error: unknown) => {
      console.error(error);
      options.output?.(errorEntry(error, undefined, undefined, location => mapProjectLocation(location, maps)));
    };
    let executing = false, classicError: unknown;
    win.addEventListener('error', event => {
      event.preventDefault();
      if (executing) classicError = event.error ?? new Error(event.message);
      else reportAsync(event.error ?? new Error(event.message));
    });
    win.addEventListener('unhandledrejection', event => { event.preventDefault(); reportAsync(event.reason); });
    // Added classic files retain dropdown order even when a module imports one of them.
    for (const file of available.values()) {
      const record = records.get(file.name);
      if (!record?.classic) continue;
      const { edits } = record;
      aborted(); executing = true; classicError = undefined;
      let source = file.source;
      for (const edit of [...edits].reverse()) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
      const script = doc.createElement('script'); script.textContent = source + sourceURL(file.name); doc.head.append(script);
      executing = false;
      if (classicError) throw located(classicError, file.name);
    }
    // This importer belongs to the fresh realm and therefore uses its import map and module cache.
    const nativeImport = (win as Window & { eval: typeof eval }).eval('(specifier) => import(specifier)') as (specifier: string) => Promise<unknown>;
    await Promise.race([
      nativeImport(key(MAIN_FILE)),
      new Promise((_, reject) => options.signal?.addEventListener('abort', () => reject(options.signal!.reason), { once: true })),
    ]);
    aborted();
    return { scene: (win as unknown as { scene: unknown }).scene, files: [...available.values()], dispose };
  } catch (error) { dispose(); throw error; }
}
