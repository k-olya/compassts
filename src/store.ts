import { create } from "zustand";
import { DEFAULT_CODE, evaluateCode, exportBinaryStl, type RenderedScene } from "./cad.ts";

interface CadState {
  code: string;
  rendered: RenderedScene;
  error: string | null;
  setCode: (code: string) => void;
  render: () => void;
  exportStl: () => void;
}

export const useCadStore = create<CadState>((set, get) => ({
  code: DEFAULT_CODE,
  rendered: evaluateCode(DEFAULT_CODE),
  error: null,
  setCode: (code) => set({ code }),
  render: () => {
    try {
      set({ rendered: evaluateCode(get().code), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
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
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
}));
