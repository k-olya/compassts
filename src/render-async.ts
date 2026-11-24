import { evaluateCode, evaluateProject, type RenderedScene } from './cad.ts';
import { inspectScript } from './project-runtime.ts';
import type { ParametricControl } from './parametric.ts';
import { consoleEntryId, type ConsoleEntry, type ConsoleOutput } from './script-console.ts';
import type { ScriptFile } from './script-files.ts';
import { projectSource } from './script-files.ts';
import { RemoteConsoleValue, type ConsoleReference } from './remote-console.ts';
import type { ConsoleProperty } from './console-values.ts';

export type RenderRequest = { type: 'render'; files: readonly ScriptFile[]; resolution: number; controls: readonly ParametricControl[] }
  | { type: 'inspect'; id: number; request: number };
export type WorkerReply = { type: 'output'; entry: ConsoleEntry | null }
  | { type: 'controls'; controls: ParametricControl[] }
  | { type: 'file'; file: ScriptFile }
  | { type: 'properties'; request: number; properties: ConsoleProperty[] }
  | { type: 'rendered'; rendered: RenderedScene }
  | { type: 'failed'; error: { name: string; message: string; stack?: string } }
  | { type: 'needs-dom' };

interface RenderOptions {
  signal: AbortSignal;
  controls: readonly ParametricControl[];
  onControls: (controls: ParametricControl[]) => void;
  onFileLoaded: (file: ScriptFile) => void;
}

export async function renderAsync(files: readonly ScriptFile[], output: ConsoleOutput, resolution: number, options: RenderOptions) {
  // Yield even on the DOM compatibility path so React can paint the pending state.
  await new Promise(resolve => setTimeout(resolve, 0));
  options.signal.throwIfAborted();
  const needsDom = files.some(file => /\b(?:svgPath|document|window)\b/.test(file.source) || (file.url && inspectScript(file).classic));
  if (typeof Worker === 'undefined' || needsDom) {
    if (files.some(file => file.url) || /\b(?:import|export|await)\b/.test(files[0].source)) return evaluateProject(files, output, resolution, options);
    const rendered = evaluateCode(files[0].source, output, resolution, options);
    rendered.projectSource = projectSource(files);
    return { rendered, dispose: () => {} };
  }
  return new Promise<{ rendered: RenderedScene; dispose: () => void }>((resolve, reject) => {
    const worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
    const objects = new Map<number, RemoteConsoleValue>();
    const inspections = new Map<number, (properties: ConsoleProperty[]) => void>();
    let request = 0, disposed = false, completed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true; worker.terminate(); options.signal.removeEventListener('abort', abort);
      inspections.forEach(resolve => resolve([{ key: '', text: '[Previous render has ended]' }])); inspections.clear();
    };
    const abort = () => { dispose(); if (!completed) reject(options.signal.reason); };
    const value = (input: unknown): unknown => {
      if (!input || typeof input !== 'object' || !('remoteId' in input)) return input;
      const reference = input as ConsoleReference;
      if (!objects.has(reference.remoteId)) objects.set(reference.remoteId, new RemoteConsoleValue(reference.label, () => new Promise(resolve => {
        if (disposed) { resolve([{ key: '', text: '[Previous render has ended]' }]); return; }
        const id = request++; inspections.set(id, resolve); worker.postMessage({ type: 'inspect', id: reference.remoteId, request: id } satisfies RenderRequest);
      })));
      return objects.get(reference.remoteId);
    };
    options.signal.addEventListener('abort', abort, { once: true });
    worker.onerror = event => { dispose(); reject(new Error(event.message || 'Render worker failed to start.')); };
    worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      if (disposed) return;
      switch (data.type) {
        case 'output': output(data.entry && { ...data.entry, id: consoleEntryId(), parts: data.entry.parts?.map(part => 'value' in part ? { value: value(part.value) } : part) }); break;
        case 'controls': options.onControls(data.controls); break;
        case 'file': options.onFileLoaded(data.file); break;
        case 'properties': inspections.get(data.request)?.(data.properties.map(property => 'value' in property ? { ...property, value: value(property.value) } : property)); inspections.delete(data.request); break;
        case 'rendered': completed = true; resolve({ rendered: data.rendered, dispose }); break;
        case 'failed': completed = true; reject(Object.assign(new Error(data.error.message), data.error, { dispose })); break;
        case 'needs-dom':
          dispose(); output(null);
          evaluateProject(files, output, resolution, options).then(resolve, reject);
          break;
      }
    };
    worker.postMessage({ type: 'render', files, resolution, controls: options.controls } satisfies RenderRequest);
  });
}
