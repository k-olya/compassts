import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/editor/editor.all.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { javascriptDefaults, typescriptDefaults, ScriptTarget, ModuleResolutionKind } from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";
import api from "virtual:libcompass-api";
import { useCadStore } from "./store.ts";
import { MAIN_FILE } from "./script-files.ts";
import type { ScriptLocation } from "./script-console.ts";

self.MonacoEnvironment = {
  getWorker(_id, label) {
    return label === "typescript" || label === "javascript" ? new TypeScriptWorker() : new EditorWorker();
  },
};

export interface EditorHandle {
  insertSnippet: (snippet: string) => void;
}

export default function Editor({ location, ref }: { location: ScriptLocation | null; ref: Ref<EditorHandle> }) {
  const container = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useImperativeHandle(ref, () => ({
    insertSnippet(snippet) {
      const editor = editorRef.current;
      if (!editor || useCadStore.getState().files.find(file => file.name === useCadStore.getState().activeFile)?.url) return;
      editor.layout();
      editor.focus();
      editor.getContribution<monaco.editor.IEditorContribution & { insert: (template: string) => void }>("snippetController2")?.insert(snippet);
      const position = editor.getPosition();
      if (position) editor.revealPositionInCenterIfOutsideViewport(position);
    },
  }), []);

  useEffect(() => {
    const libraries = [javascriptDefaults, typescriptDefaults].flatMap(defaults => {
      defaults.setCompilerOptions({
        allowJs: true,
        allowNonTsExtensions: true,
        target: ScriptTarget.ESNext,
        moduleResolution: ModuleResolutionKind.NodeJs,
        lib: ["es2022", "dom"],
        module: 99,
        moduleDetection: 3,
      });
      defaults.setEagerModelSync(true);
      return Object.entries(api.libraries).map(([path, content]) => defaults.addExtraLib(content, path));
    });
    const models = new Map<string, monaco.editor.ITextModel>();
    const views = new Map<string, monaco.editor.ICodeEditorViewState | null>();
    let syncing = false;
    const uri = (name: string) => monaco.Uri.parse(/^https?:\/\//i.test(name) ? name : `file:///${name.split('/').map(encodeURIComponent).join('/')}`);
    for (const file of useCadStore.getState().files) models.set(file.name, monaco.editor.createModel(file.source, 'javascript', uri(file.name)));
    let active = useCadStore.getState().activeFile;
    const editor = monaco.editor.create(container.current!, {
      model: models.get(active),
      readOnly: !!useCadStore.getState().files.find(file => file.name === active)?.url,
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
    const prepareModelSwitch = () => {
      // Monaco 0.55 leaves its word-highlighter delay rejection unhandled when a model detaches.
      const pending = editor.getContribution<monaco.editor.IEditorContribution & {
        wordHighlighter?: { runDelayer?: { completionPromise?: Promise<unknown> } };
      }>('editor.contrib.wordHighlighter')?.wordHighlighter?.runDelayer?.completionPromise;
      void pending?.catch(error => { if (error?.name !== 'Canceled') console.error(error); });
    };
    const updateErrorMarker = () => {
      const error = useCadStore.getState().evaluationError;
      for (const [name, model] of models) {
        const location = error?.location;
        const position = location && (location.file ?? MAIN_FILE) === name
          ? model.validatePosition({ lineNumber: location.line, column: location.column }) : undefined;
        const word = position && model.getWordAtPosition(position);
        monaco.editor.setModelMarkers(model, "compass-evaluation", error && position ? [{
          severity: monaco.MarkerSeverity.Error, source: "Render",
          message: error.stack ? `${error.text}\n${error.stack}` : error.text,
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word?.startColumn ?? position.column, endColumn: word?.endColumn ?? position.column + 1,
        }] : []);
      }
    };
    updateErrorMarker();
    const unsubscribe = useCadStore.subscribe((state, previous) => {
      syncing = true;
      try {
        if (state.files !== previous.files) for (const file of state.files) {
          let model = models.get(file.name);
          if (!model) { model = monaco.editor.createModel(file.source, 'javascript', uri(file.name)); models.set(file.name, model); }
          else if (model.getValue() !== file.source) model.setValue(file.source);
        }
        if (state.activeFile !== active) {
          views.set(active, editor.saveViewState());
          active = state.activeFile;
          prepareModelSwitch();
          editor.setModel(models.get(active)!);
          editor.updateOptions({ readOnly: !!state.files.find(file => file.name === active)?.url });
          const view = views.get(active);
          if (view) editor.restoreViewState(view);
        }
        for (const [name, model] of models) if (!state.files.some(file => file.name === name)) {
          model.dispose(); models.delete(name); views.delete(name);
        }
        if (state.files !== previous.files || state.evaluationError !== previous.evaluationError) updateErrorMarker();
      } finally { syncing = false; }
    });
    const subscription = editor.onDidChangeModelContent(() => { if (!syncing) useCadStore.getState().setCode(editor.getValue()); });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => useCadStore.getState().render());
    const formatActiveFile = async () => {
      if (useCadStore.getState().files.find(file => file.name === active)?.url) return;
      await editor.getAction("editor.action.formatDocument")?.run();
    };
    useCadStore.setState({ formatActiveFile });
    return () => {
      if (useCadStore.getState().formatActiveFile === formatActiveFile) useCadStore.setState({ formatActiveFile: null });
      unsubscribe();
      subscription.dispose();
      editorRef.current = null;
      prepareModelSwitch();
      editor.dispose();
      models.forEach(model => model.dispose());
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
