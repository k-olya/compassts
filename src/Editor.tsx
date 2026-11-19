import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/editor/editor.all.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { javascriptDefaults, typescriptDefaults, ScriptTarget, ModuleResolutionKind } from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import api from "virtual:libcompass-api";
import { useCadStore } from "./store.ts";
import type { ScriptLocation } from "./script-console.ts";

self.MonacoEnvironment = {
  getWorker(_id, label) {
    return label === "typescript" || label === "javascript" ? new TypeScriptWorker() : new EditorWorker();
  },
};

export default function Editor({ location }: { location: ScriptLocation | null }) {
  const container = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

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
    editorRef.current = editor;
    const updateErrorMarker = () => {
      const error = useCadStore.getState().evaluationError;
      const position = error?.location && model.validatePosition({ lineNumber: error.location.line, column: error.location.column });
      const word = position && model.getWordAtPosition(position);
      monaco.editor.setModelMarkers(model, "compass-evaluation", error && position ? [{
        severity: monaco.MarkerSeverity.Error,
        source: "Render",
        message: error.stack ? `${error.text}\n${error.stack}` : error.text,
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word?.startColumn ?? position.column,
        endColumn: word?.endColumn ?? position.column + 1,
      }] : []);
    };
    updateErrorMarker();
    const unsubscribe = useCadStore.subscribe((state, previous) => {
      if (state.evaluationError !== previous.evaluationError) updateErrorMarker();
    });
    const subscription = editor.onDidChangeModelContent(() => useCadStore.getState().setCode(editor.getValue()));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => useCadStore.getState().render());
    return () => {
      unsubscribe();
      subscription.dispose();
      editorRef.current = null;
      editor.dispose();
      model.dispose();
      libraries.forEach(library => library.dispose());
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!location || !editor || !model) return;
    const position = model.validatePosition({ lineNumber: location.line, column: location.column });
    editor.layout();
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
  }, [location]);

  return <div className="editor-container" ref={container} />;
}
