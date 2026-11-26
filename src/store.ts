import { create } from "zustand";
import { TRIANGULATION_RESOLUTION, setTriangulationResolution } from "libcompass";
import { DEFAULT_CODE, evaluateCode, exportBinaryStl, type RenderedMesh, type RenderedScene } from "./cad.ts";
import { renderAsync } from './render-async.ts';
import { errorEntry, type ConsoleEntry } from "./script-console.ts";
import { PRIMITIVES_CODE } from "./primitives-example.ts";
import { fetchScriptFile, MAIN_FILE, projectSource, scriptName, type ScriptFile } from "./script-files.ts";
import { readProject, readProjectFile, readWebProject } from "./project-archive.ts";
import { parameterValue, retainParameterValues, type ParametricControl, type ParametricValue } from "./parametric.ts";

interface CadState {
  projectName: string;
  setProjectName: (name: string) => void;
  loadProject: (data: Uint8Array | string | File, signal?: AbortSignal) => Promise<void>;
  code: string;
  files: ScriptFile[];
  activeFile: string;
  rendering: boolean;
  renderStartedAt: number | null;
  renderDuration: number | null;
  selectFile: (name: string) => void;
  addFile: (name: string) => Promise<void>;
  renameFile: (name: string, next: string) => void;
  deleteFile: (name: string) => void;
  resolution: number;
  setResolution: (resolution: number) => Promise<void> | undefined;
  rendered: RenderedScene;
  controls: ParametricControl[];
  setParameter: (name: string, value: ParametricValue) => void;
  error: string | null;
  evaluationError: ConsoleEntry | null;
  consoleEntries: ConsoleEntry[];
  consoleOpen: boolean;
  closeConsole: () => void;
  reportRendererError: (error: unknown) => void;
  setCode: (code: string) => void;
  formatActiveFile: (() => Promise<void>) | null;
  render: () => Promise<void>;
  exportStl: (mesh?: RenderedMesh) => void;
}

let activeRun = 0;
let pending: AbortController | undefined;
let disposeRuntime: (() => void) | undefined;
let projectVersion = 0;
let parameterEdits = new Map<string, ParametricControl>();

export function hasUnrenderedChanges(state: Pick<CadState, 'files' | 'controls' | 'rendered'>): boolean {
  return projectSource(state.files) !== state.rendered.projectSource || JSON.stringify(state.controls) !== JSON.stringify(state.rendered.controls);
}
const initialFiles = [
  { name: MAIN_FILE, source: DEFAULT_CODE },
  { name: "primitives.js", source: PRIMITIVES_CODE },
];
const initialRendered = evaluateCode(typeof Worker === 'undefined' ? DEFAULT_CODE : '');
initialRendered.projectSource = projectSource(initialFiles);

export const useCadStore = create<CadState>((set, get) => ({
  projectName: '',
  setProjectName: projectName => set({ projectName }),
  loadProject: async (data, signal) => {
    const project = await (typeof data === 'string' ? readWebProject(data, signal)
      : data instanceof Uint8Array ? readProject(data, signal) : readProjectFile(data, signal));
    signal?.throwIfAborted();
    projectVersion++; activeRun++;
    pending?.abort(); pending = undefined;
    disposeRuntime?.(); disposeRuntime = undefined;
    set({ projectName: project.name, files: project.files, activeFile: MAIN_FILE, code: project.files[0].source,
      rendered: evaluateCode(''), controls: [], rendering: false, renderStartedAt: null, renderDuration: null, error: null, evaluationError: null, consoleEntries: [], consoleOpen: false });
  },
  code: DEFAULT_CODE,
  files: initialFiles,
  activeFile: MAIN_FILE,
  rendering: false,
  renderStartedAt: null,
  renderDuration: null,
  selectFile: name => {
    const file = get().files.find(file => file.name === name);
    if (file) set({ activeFile: name, code: file.source });
  },
  addFile: async input => {
    const version = projectVersion;
    const name = scriptName(input);
    if (get().files.some(file => file.name === name)) throw new Error('A file with this name already exists.');
    const file = /^https?:\/\//i.test(name) ? await fetchScriptFile(name) : { name, source: '' };
    if (version !== projectVersion) return;
    if (get().files.some(file => file.name === name)) throw new Error('A file with this name already exists.');
    set(state => ({ files: [...state.files, file], activeFile: name, code: file.source }));
  },
  renameFile: (name, input) => {
    const file = get().files.find(file => file.name === name);
    if (!file || name === MAIN_FILE || file.url) throw new Error('This file cannot be renamed.');
    const next = scriptName(input);
    if (/^https?:\/\//i.test(next)) throw new Error('Use Add to load a URL.');
    if (next === name) return;
    if (get().files.some(file => file.name === next)) throw new Error('A file with this name already exists.');
    set(state => ({ files: state.files.map(file => file.name === name ? { ...file, name: next } : file),
      activeFile: state.activeFile === name ? next : state.activeFile, evaluationError: null }));
  },
  deleteFile: name => {
    if (name === MAIN_FILE) return;
    set(state => ({ files: state.files.filter(file => file.name !== name), evaluationError: null,
      ...(state.activeFile === name ? { activeFile: MAIN_FILE, code: state.files.find(file => file.name === MAIN_FILE)!.source } : {}) }));
  },
  resolution: TRIANGULATION_RESOLUTION,
  setResolution: (resolution) => {
    setTriangulationResolution(resolution);
    if (resolution === get().resolution) return;
    set({ resolution });
    return get().render();
  },
  rendered: initialRendered,
  controls: initialRendered.controls,
  setParameter: (name, value) => {
    const control = get().controls.find(control => control.name === name);
    if (!control) return;
    const next = parameterValue(control, value);
    if (next === control.value) return;
    parameterEdits.set(name, { ...control, value: next });
    set(state => ({ controls: state.controls.map(control => control.name === name ? { ...control, value: next } : control) }));
  },
  error: null,
  evaluationError: null,
  consoleEntries: [],
  consoleOpen: false,
  closeConsole: () => set({ consoleOpen: false }),
  reportRendererError: (error) => {
    console.error(error);
    set(state => ({ consoleEntries: [...state.consoleEntries, errorEntry(error, undefined, "Renderer")], consoleOpen: true }));
  },
  setCode: code => {
    if (get().files.find(file => file.name === get().activeFile)?.url) return;
    set(state => ({ code, evaluationError: null, files: state.files.map(file => file.name === state.activeFile ? { ...file, source: code } : file) }));
  },
  formatActiveFile: null,
  render: async () => {
    const startedAt = performance.now();
    const run = ++activeRun;
    pending?.abort();
    disposeRuntime?.(); disposeRuntime = undefined;
    const controller = new AbortController();
    pending = controller;
    const controls = get().controls, edits = parameterEdits = new Map<string, ParametricControl>();
    const currentControls = (controls: ParametricControl[]) => retainParameterValues(controls, [...edits.values()]);
    const onControls = (controls: ParametricControl[]) => {
      if (run === activeRun) set({ controls: currentControls(controls) });
    };
    set({ consoleEntries: [], consoleOpen: false, evaluationError: null, rendering: true, renderStartedAt: startedAt, renderDuration: null });
    const output = (entry: ConsoleEntry | null) => {
      if (run === activeRun) set(state => ({ consoleEntries: entry ? [...state.consoleEntries, entry] : [], consoleOpen: entry !== null }));
    };
    const failed = (error: unknown) => {
      if (run !== activeRun) return;
      console.error(error);
      if (!get().consoleEntries.some(entry => entry.level === 'error')) output(errorEntry(error));
      set({ error: error instanceof Error ? error.message || error.name : String(error), rendering: false,
        renderStartedAt: null, renderDuration: performance.now() - startedAt,
        evaluationError: [...get().consoleEntries].reverse().find(entry => entry.level === 'error') ?? null });
    };
    try {
      const format = get().formatActiveFile;
      if (format) await format();
      if (run !== activeRun) return;
      const files = get().files;
      const { rendered, dispose } = await renderAsync(files, output, get().resolution, { signal: controller.signal, controls, onControls,
        onFileLoaded: file => {
          if (run === activeRun && !get().files.some(existing => existing.name === file.name)) set(state => ({ files: [...state.files, file] }));
        },
      });
      if (run !== activeRun) { dispose(); return; }
      pending = undefined; disposeRuntime = dispose;
      set({ rendered, controls: currentControls(rendered.controls), error: null, rendering: false,
        renderStartedAt: null, renderDuration: performance.now() - startedAt });
    } catch (error) {
      if (error && typeof error === 'object' && 'dispose' in error && typeof error.dispose === 'function') {
        if (run === activeRun) disposeRuntime = error.dispose as () => void;
        else error.dispose();
      }
      failed(error);
    }
  },
  exportStl: (mesh) => {
    if (mesh?.primitive === "lines") return;
    try {
      const data = exportBinaryStl(mesh?.positions ?? get().rendered);
      const url = URL.createObjectURL(new Blob([data], { type: "model/stl" }));
      const link = document.createElement("a");
      link.href = url;
      const name = (mesh?.name.trim() || 'mesh').replace(/[\\/:*?"<>|]/g, '_').replace(/\.stl$/i, '');
      link.download = mesh ? `${name}.stl` : "compass.stl";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      set(state => ({ error: error instanceof Error ? error.message || error.name : String(error),
        consoleEntries: [...state.consoleEntries, errorEntry(error, undefined, "Export")], consoleOpen: true }));
    }
  },
}));
