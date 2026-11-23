import { create } from "zustand";
import { TRIANGULATION_RESOLUTION, setTriangulationResolution } from "libcompass";
import { DEFAULT_CODE, evaluateCode, evaluateProject, exportBinaryStl, type RenderedMesh, type RenderedScene } from "./cad.ts";
import { errorEntry, type ConsoleEntry } from "./script-console.ts";
import { PRIMITIVES_CODE } from "./primitives-example.ts";
import { fetchScriptFile, MAIN_FILE, projectSource, scriptName, type ScriptFile } from "./script-files.ts";
import { readProject, readWebProject } from "./project-archive.ts";

interface CadState {
  projectName: string;
  setProjectName: (name: string) => void;
  loadProject: (data: Uint8Array | string, signal?: AbortSignal) => Promise<void>;
  code: string;
  files: ScriptFile[];
  activeFile: string;
  rendering: boolean;
  selectFile: (name: string) => void;
  addFile: (name: string) => Promise<void>;
  renameFile: (name: string, next: string) => void;
  deleteFile: (name: string) => void;
  resolution: number;
  setResolution: (resolution: number) => void;
  rendered: RenderedScene;
  error: string | null;
  evaluationError: ConsoleEntry | null;
  consoleEntries: ConsoleEntry[];
  consoleOpen: boolean;
  closeConsole: () => void;
  reportRendererError: (error: unknown) => void;
  setCode: (code: string) => void;
  render: () => void | Promise<void>;
  exportStl: (mesh?: RenderedMesh) => void;
}

let activeRun = 0;
let pending: AbortController | undefined;
let disposeRuntime: (() => void) | undefined;
let projectVersion = 0;
const initialFiles = [
  { name: MAIN_FILE, source: DEFAULT_CODE },
  { name: "primitives.js", source: PRIMITIVES_CODE },
];
const initialRendered = evaluateCode(DEFAULT_CODE);
initialRendered.projectSource = projectSource(initialFiles);

export const useCadStore = create<CadState>((set, get) => ({
  projectName: '',
  setProjectName: projectName => set({ projectName }),
  loadProject: async (data, signal) => {
    const project = await (typeof data === 'string' ? readWebProject(data, signal) : readProject(data, signal));
    signal?.throwIfAborted();
    projectVersion++; activeRun++;
    pending?.abort(); pending = undefined;
    disposeRuntime?.(); disposeRuntime = undefined;
    set({ projectName: project.name, files: project.files, activeFile: MAIN_FILE, code: project.files[0].source,
      rendered: evaluateCode(''), rendering: false, error: null, evaluationError: null, consoleEntries: [], consoleOpen: false });
  },
  code: DEFAULT_CODE,
  files: initialFiles,
  activeFile: MAIN_FILE,
  rendering: false,
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
    get().render();
  },
  rendered: initialRendered,
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
  render: () => {
    const run = ++activeRun;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    const files = get().files;
    set({ consoleEntries: [], consoleOpen: false, evaluationError: null, rendering: true });
    const output = (entry: ConsoleEntry | null) => {
      if (run === activeRun) set(state => ({ consoleEntries: entry ? [...state.consoleEntries, entry] : [], consoleOpen: entry !== null }));
    };
    const failed = (error: unknown) => {
      if (run !== activeRun) return;
      console.error(error);
      set({ error: error instanceof Error ? error.message || error.name : String(error), rendering: false,
        evaluationError: [...get().consoleEntries].reverse().find(entry => entry.level === 'error') ?? null });
    };
    // Preserve immediate renders for standalone scripts; modules use the browser's native loader.
    if (files.some(file => file.url) || /\b(?:import|export|await)\b/.test(files[0].source)) {
      return evaluateProject(files, output, get().resolution, { signal: controller.signal,
        onFileLoaded: file => {
          if (run === activeRun && !get().files.some(existing => existing.name === file.name)) set(state => ({ files: [...state.files, file] }));
        },
      }).then(({ rendered, dispose }) => {
        if (run !== activeRun) { dispose(); return; }
        pending = undefined; disposeRuntime?.(); disposeRuntime = dispose;
        set({ rendered, error: null, rendering: false });
      }, failed);
    }
    try {
      const rendered = evaluateCode(files[0].source, output, get().resolution);
      rendered.projectSource = projectSource(files);
      pending = undefined; disposeRuntime?.(); disposeRuntime = undefined;
      set({ rendered, error: null, rendering: false });
    } catch (error) {
      failed(error);
    }
  },
  exportStl: (mesh) => {
    try {
      const data = exportBinaryStl(mesh?.positions ?? get().rendered.positions);
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
