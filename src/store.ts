import { create } from "zustand";
import { DEFAULT_CODE, evaluateCode, exportBinaryStl, type RenderedScene } from "./cad.ts";
import { errorEntry, type ConsoleEntry } from "./script-console.ts";

interface CadState {
  code: string;
  rendered: RenderedScene;
  error: string | null;
  evaluationError: ConsoleEntry | null;
  consoleEntries: ConsoleEntry[];
  consoleOpen: boolean;
  closeConsole: () => void;
  reportRendererError: (error: unknown) => void;
  setCode: (code: string) => void;
  render: () => void;
  exportStl: () => void;
}

let activeRun = 0;

export const useCadStore = create<CadState>((set, get) => ({
  code: DEFAULT_CODE,
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
      });
      set({ rendered, error: null });
    } catch (error) {
      console.error(error);
      set({ error: error instanceof Error ? error.message || error.name : String(error),
        evaluationError: get().consoleEntries.at(-1) ?? null });
    }
  },
  exportStl: () => {
    try {
      const data = exportBinaryStl(get().rendered.positions);
      const url = URL.createObjectURL(new Blob([data], { type: "model/stl" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "compass.stl";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      set(state => ({ error: error instanceof Error ? error.message || error.name : String(error),
        consoleEntries: [...state.consoleEntries, errorEntry(error, undefined, "Export")], consoleOpen: true }));
    }
  },
}));
