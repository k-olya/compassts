import { useState } from "react";
import { FiArrowUp, FiBookOpen, FiBox, FiCircle, FiLayers, FiMaximize, FiMinimize, FiMinus, FiMove, FiRotateCw, FiSquare } from "react-icons/fi";
import Docs from "./Docs.tsx";
import Console from "./Console.tsx";
import Editor from "./Editor.tsx";
import SideToolbar, { ToolbarSection } from "./SideToolbar.tsx";
import Viewer from "./Viewer.tsx";
import { useCadStore } from "./store.ts";
import type { ScriptLocation } from "./script-console.ts";

const toolSections = {
  "3d": [
    { label: "Extrude", Icon: FiArrowUp },
    { label: "Revolve", Icon: FiRotateCw },
    { label: "Move", Icon: FiMove },
  ],
  "2d": [
    { label: "Line", Icon: FiMinus },
    { label: "Rectangle", Icon: FiSquare },
    { label: "Circle", Icon: FiCircle },
  ],
};

export default function App() {
  const [toolMode, setToolMode] = useState<"3d" | "2d">("3d");
  const [viewExpanded, setViewExpanded] = useState(false);
  const [editorLocation, setEditorLocation] = useState<ScriptLocation | null>(null);
  const [orthographic, setOrthographic] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const { code, rendered, error, render, exportStl } = useCadStore();
  const triangles = rendered.positions.length / 9;
  const changed = code !== rendered.source;

  return (
    <main className="workspace">
      <header className="toolbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">⌖</span>compass<span className="brand-suffix">ts</span></div>
        <span className="toolbar-caption">Code-based CAD</span>
        <nav className="toolbar-actions" aria-label="Model actions">
          <button className="render-button" onClick={render} title="Render (Ctrl/Cmd + Enter)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11L13 8z" /></svg>
            Render
          </button>
          <button className="export-button" onClick={exportStl} disabled={!triangles} title="Export the last successfully rendered model">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 1v9m-3-3 3 3 3-3M2 10v4h12v-4" /></svg>
            Export STL
          </button>
        </nav>
      </header>
      <div className="workspace-body">
        <SideToolbar label="Code tools">
          <ToolbarSection label="Code commands">
            <button type="button" aria-label="3D tools" title="3D tools" aria-pressed={toolMode === "3d"} onClick={() => setToolMode("3d")}>
              <FiBox aria-hidden="true" />
            </button>
            <button type="button" aria-label="2D tools" title="2D tools" aria-pressed={toolMode === "2d"} onClick={() => setToolMode("2d")}>
              <FiLayers aria-hidden="true" />
            </button>
            <button type="button" aria-label="Documentation" title={docsOpen ? "Show 3D view" : "Browse libcompass documentation"} aria-pressed={docsOpen} aria-controls="docs-pane" onClick={() => setDocsOpen(open => !open)}>
              <FiBookOpen aria-hidden="true" />
            </button>
          </ToolbarSection>
          <ToolbarSection key={toolMode} label={`${toolMode.toUpperCase()} tools`}>
            {toolSections[toolMode].map(({ label, Icon }) => (
              <button key={label} type="button" aria-label={`${label} (coming soon)`} title={`${label} (coming soon)`} disabled>
                <Icon aria-hidden="true" />
              </button>
            ))}
          </ToolbarSection>
        </SideToolbar>
        <div className={`panes${viewExpanded ? " panes-expanded" : ""}`}>
          <section id="code-pane" className="pane editor-pane" aria-label="Code editor" hidden={viewExpanded}>
            <div className="pane-header"><span><span className="js-label">JS</span> model.js</span><span className="pane-note">Ctrl / ⌘ + Enter</span></div>
            <Editor location={editorLocation} />
          </section>
          <section className="pane viewer-pane" aria-label="3D model preview" hidden={docsOpen}>
            <div className="pane-header">
              <button type="button" className="projection-button" onClick={() => setOrthographic(value => !value)} title={`Switch to ${orthographic ? "perspective" : "orthographic"} camera`}>
                {orthographic ? "Orthographic" : "Perspective"}
              </button>
              <span className="pane-note">Z up</span>
            </div>
            <div className="viewer-body"><Viewer orthographic={orthographic} /><span className="viewer-hint">Drag / Alt + move to orbit · Scroll to zoom · Right-drag / Shift + move to pan</span></div>
          </section>
          <section id="docs-pane" className="pane docs-pane" aria-label="libcompass documentation" hidden={!docsOpen}>
            <div className="pane-header"><span>libcompass docs</span><span className="pane-note">API reference</span></div>
            <Docs />
          </section>
        </div>
        <SideToolbar label="Rendered view tools">
          <ToolbarSection label="View">
            <button type="button" onClick={() => setViewExpanded(expanded => !expanded)} aria-label={viewExpanded ? "Restore code view" : docsOpen ? "Expand documentation" : "Expand rendered view"} title={viewExpanded ? "Restore code view" : docsOpen ? "Expand documentation" : "Expand rendered view"} aria-pressed={viewExpanded} aria-controls="code-pane">
              {viewExpanded ? <FiMinimize aria-hidden="true" /> : <FiMaximize aria-hidden="true" />}
            </button>
          </ToolbarSection>
        </SideToolbar>
      </div>
      <Console onNavigate={location => { setViewExpanded(false); setEditorLocation({ ...location }); }} />
      <footer className="statusbar" aria-live="polite">
        <span>{error ? "Render failed · Previous model retained" : changed ? "Changes not rendered" : "Rendered"}</span>
        <span>{triangles.toLocaleString()} triangles</span>
      </footer>
    </main>
  );
}
