/// <reference types="vite/client" />

declare module "virtual:libcompass-api" {
  const api: ReturnType<typeof import("../scripts/libcompass-api.ts").readLibcompassApi>;
  export default api;
}

// Monaco's ESM contribution ships an empty declaration; reuse its public types.
declare module "monaco-editor/esm/vs/language/typescript/monaco.contribution.js" {
  export const javascriptDefaults: typeof import("monaco-editor").m.typescript.javascriptDefaults;
  export const typescriptDefaults: typeof import("monaco-editor").m.typescript.typescriptDefaults;
  export const ScriptTarget: typeof import("monaco-editor").m.typescript.ScriptTarget;
  export const ModuleResolutionKind: typeof import("monaco-editor").m.typescript.ModuleResolutionKind;
}
