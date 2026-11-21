import { create } from "zustand";
import { TRIANGULATION_RESOLUTION, setTriangulationResolution } from "libcompass";
import { DEFAULT_CODE, evaluateCode, exportBinaryStl, type RenderedMesh, type RenderedScene } from "./cad.ts";
import { errorEntry, type ConsoleEntry } from "./script-console.ts";

interface CadState {
  code: string;
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
  render: () => void;
  exportStl: (mesh?: RenderedMesh) => void;
}

let activeRun = 0;

export const useCadStore = create<CadState>((set, get) => ({
  code: DEFAULT_CODE,
  resolution: TRIANGULATION_RESOLUTION,
  setResolution: (resolution) => {
    setTriangulationResolution(resolution);
    if (resolution === get().resolution) return;
    set({ resolution });
    get().render();
  },
  rendered: evaluateCode(DEFAULT_CODE),
  error: null,
  evaluationError: null,
  consoleEntries: [],
  consoleOpen: false,
  closeConsole: () => set({ consoleOpen: false }),
  reportRendererError: (error) => {
    console.error(error);
    set(state => ({ consoleEntries: [...state.consoleEntries, errorEntry(error, undefined, "Renderer")], consoleOpen: true }));
  },
  setCode: (code) => set({ code, evaluationError: null }),
  render: () => {
    const run = ++activeRun;
    set({ consoleEntries: [], consoleOpen: false, evaluationError: null });
    try {
      const rendered = evaluateCode(get().code, entry => {
        // Ignore delayed console output from scripts superseded by a new Render.
        if (run === activeRun) set(state => ({ consoleEntries: entry ? [...state.consoleEntries, entry] : [], consoleOpen: entry !== null }));
      }, get().resolution);
      set({ rendered, error: null });
    } catch (error) {
      console.error(error);
      set({ error: error instanceof Error ? error.message || error.name : String(error),
        evaluationError: get().consoleEntries.at(-1) ?? null });
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
