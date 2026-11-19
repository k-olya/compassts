import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/editor/editor.all.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { javascriptDefaults, typescriptDefaults, ScriptTarget, ModuleResolutionKind } from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import api from "virtual:libcompass-api";
import { useCadStore } from "./store.ts";

self.MonacoEnvironment = {
  getWorker(_id, label) {
    return label === "typescript" || label === "javascript" ? new TypeScriptWorker() : new EditorWorker();
  },
};

export default function Editor() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const libraries = [javascriptDefaults, typescriptDefaults].flatMap(defaults => {
      defaults.setCompilerOptions({
        allowJs: true,
        allowNonTsExtensions: true,
        target: ScriptTarget.ESNext,
        moduleResolution: ModuleResolutionKind.NodeJs,
        lib: ["es2022"],
      });
      return Object.entries(api.libraries).map(([path, content]) => defaults.addExtraLib(content, path));
    });
    const model = monaco.editor.createModel(useCadStore.getState().code, "javascript", monaco.Uri.parse("file:///model.js"));
    const editor = monaco.editor.create(container.current!, {
      model,
      theme: "vs-dark",
      automaticLayout: true,
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
      fontSize: 14,
      lineHeight: 23,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 18, bottom: 18 },
      tabSize: 2,
      ariaLabel: "CAD JavaScript editor",
    });
    const subscription = editor.onDidChangeModelContent(() => useCadStore.getState().setCode(editor.getValue()));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => useCadStore.getState().render());
    return () => {
      subscription.dispose();
      editor.dispose();
      model.dispose();
      libraries.forEach(library => library.dispose());
    };
  }, []);

  return <div className="editor-container" ref={container} />;
}
