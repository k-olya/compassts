import { Node, setTriangulationResolution } from 'libcompass';
import { evaluateCode, renderedScene, scriptBindings } from './cad.ts';
import { consoleProperties, consoleValueText, isInspectable } from './console-values.ts';
import { createParametricRuntime } from './parametric.ts';
import { createScriptConsole, errorEntry, type ConsoleEntry, type ScriptLocation } from './script-console.ts';
import { MAIN_FILE, projectSource } from './script-files.ts';
import { bundleProject, NeedsDomError } from './worker-project.ts';
import type { RenderRequest, WorkerReply } from './render-async.ts';

const values: object[] = [];
const references = new Map<object, number>();
function snapshot(value: unknown): unknown {
  if (!isInspectable(value)) return value;
  let id = references.get(value);
  if (id === undefined) { id = values.length; references.set(value, id); values.push(value); }
  return { remoteId: id, label: consoleValueText(value) };
}
const send = (message: WorkerReply, transfer: Transferable[] = []) => postMessage(message, { transfer });
const output = (entry: ConsoleEntry | null) => send({ type: 'output', entry: entry && {
  ...entry, parts: entry.parts?.map(part => 'value' in part ? { value: snapshot(part.value) } : part),
} });

let map = (location: ScriptLocation) => location;
addEventListener('unhandledrejection', event => { event.preventDefault(); output(errorEntry(event.reason, undefined, undefined, map)); });
addEventListener('error', event => { event.preventDefault(); output(errorEntry(event.error ?? new Error(event.message), undefined, undefined, map)); });
addEventListener('message', async ({ data }: MessageEvent<RenderRequest>) => {
  if (data.type === 'inspect') {
    send({ type: 'properties', request: data.request, properties: consoleProperties(values[data.id]).map(property =>
      'value' in property ? { ...property, value: snapshot(property.value) } : property) });
    return;
  }
  let standalone = false;
  try {
    const { files, resolution, controls } = data;
    setTriangulationResolution(resolution);
    let rendered;
    if (!files.some(file => file.url) && !/\b(?:import|export|await)\b/.test(files[0].source)) {
      standalone = true;
      rendered = evaluateCode(files[0].source, output, resolution, {
        controls, onControls: controls => send({ type: 'controls', controls }),
      });
      rendered.projectSource = projectSource(files);
    } else {
      const parameters = createParametricRuntime(controls, controls => send({ type: 'controls', controls }));
      const scene = new Node();
      const bindings = scriptBindings(createScriptConsole(output, location => map(location)), parameters, scene);
      const { rollup } = await import('@rollup/browser');
      const project = await bundleProject(files, bindings, file => send({ type: 'file', file }), rollup);
      map = project.location;
      Object.assign(globalThis, bindings, { __compassBindings: bindings, scene, console: createScriptConsole(output, location => map(location)) });
      await import(/* @vite-ignore */ project.url);
      rendered = renderedScene((globalThis as unknown as { scene: Node }).scene, files.find(file => file.name === MAIN_FILE)!.source, parameters.controls);
      rendered.projectSource = projectSource(project.files);
    }
    const { scene: _scene, ...result } = rendered;
    send({ type: 'rendered', rendered: result }, [result.positions.buffer, ...result.meshes.map(mesh => mesh.positions.buffer)]);
  } catch (error) {
    const details = error as Error & { loc?: { file: string; line: number; column: number }; scriptLocation?: ScriptLocation; cause?: unknown };
    if (error instanceof NeedsDomError || details.name === 'NeedsDomError' || details.cause instanceof NeedsDomError || /svgPath requires browser/.test(details.message)) {
      send({ type: 'needs-dom' }); return;
    }
    const location = details.scriptLocation ?? (details.loc ? { file: details.loc.file, line: details.loc.line, column: details.loc.column + 1 } : undefined);
    if (!standalone) output(errorEntry(error, location, undefined, map));
    send({ type: 'failed', error: { name: details.name, message: details.message, stack: details.stack } });
  }
});
