import { useRef, useState } from "react";
import { FiBookOpen, FiChevronDown, FiChevronUp, FiMaximize, FiMinimize } from "react-icons/fi";
import Docs from "./Docs.tsx";
import Console from "./Console.tsx";
import Editor, { type EditorHandle } from "./Editor.tsx";
import SideToolbar, { ToolbarSection } from "./SideToolbar.tsx";
import { ChamferIcon, DifferenceIcon, ExtrudeCutIcon, ExtrudeIcon, IntersectIcon, LineSegmentIcon, PlanarCurveIcon, PlanarToolsIcon, SketchIcon, SolidToolsIcon, SweepIcon, TrimCurveIcon, TrimSurfaceIcon } from "./ToolIcons.tsx";
import Viewer from "./Viewer.tsx";
import { useCadStore } from "./store.ts";
import type { ScriptLocation } from "./script-console.ts";

const toolSections = {
  "3d": [
    {
      label: "Extrude", Icon: ExtrudeIcon,
      snippet: "extrude({\n  sketch: ${1:s},\n  length: ${2:10},\n  axis: ${3:Z},\n  angle: ${4:0},\n})$0",
    },
    {
      label: "Extrude cut", Icon: ExtrudeCutIcon,
      snippet: "extrudeCut({\n  solid: ${1:part},\n  sketch: ${2:s},\n  length: ${3:10},\n  axis: ${4:Z},\n  angle: ${5:0},\n})$0",
    },
    {
      label: "Extrude along curve", Icon: SweepIcon,
      snippet: "extrudeAlongCurve({\n  sketch: ${1:s},\n  curve: ${2:path},\n})$0",
    },
    {
      label: "Chamfer", Icon: ChamferIcon,
      snippet: "chamfer({\n  solid: ${1:part},\n  length: ${2:0.5},\n  angle: ${3:45},\n  boundaries: ${4:[]},\n})$0",
    },
    {
      label: "Intersect", Icon: IntersectIcon,
      snippet: "intersect({\n  solid: ${1:part},\n  tool: ${2:cutter},\n})$0",
    },
    {
      label: "Difference", Icon: DifferenceIcon,
      snippet: "difference({\n  solid: ${1:part},\n  tool: ${2:cutter},\n})$0",
    },
    {
      label: "Trim curve", Icon: TrimCurveIcon,
      snippet: "trimCurve({\n  curve: ${1:path},\n  cutters: [${2:XY}],\n  keep: ${3:0.5},\n})$0",
    },
    {
      label: "Trim surface", Icon: TrimSurfaceIcon,
      snippet: "trimSurface({\n  surface: ${1:part.surfaces[0]},\n  cutter: ${2:YZ},\n  keep: \"${3|positive,negative|}\",\n})$0",
    },
  ],
  "2d": [
    {
      label: "Sketch", Icon: SketchIcon,
      snippet: "sketch({\n  plane: ${1:XY},\n})$0",
    },
    {
      label: "Line segment", Icon: LineSegmentIcon,
      snippet: "lineSegment({\n  start: { x: ${1:0}, y: ${2:0} },\n  end: { x: ${3:10}, y: ${4:0} },\n})$0",
    },
    {
      label: "Planar curve", Icon: PlanarCurveIcon,
      snippet: "planarCurve({\n  at: t => ({\n    x: ${1:10} * t,\n    y: ${2:10} * t * t,\n  }),\n})$0",
    },
    {
      label: "Trim curve", Icon: TrimCurveIcon,
      snippet: "trimCurve({\n  curve: ${1:curve},\n  cutters: [line({ point: { x: ${2:0}, y: ${3:0} }, direction: [${4:0}, ${5:1}] })],\n  keep: ${6:0.5},\n})$0",
    },
  ],
};

export default function App() {
  const [toolMode, setToolMode] = useState<"3d" | "2d">("3d");
  const [viewExpanded, setViewExpanded] = useState(false);
  const [editorLocation, setEditorLocation] = useState<ScriptLocation | null>(null);
  const [orthographic, setOrthographic] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const { code, rendered, error, render, exportStl, resolution, setResolution } = useCadStore();
  const editor = useRef<EditorHandle>(null);
  const resolutionInput = useRef<HTMLInputElement>(null);
  const triangles = rendered.positions.length / 9;
  const changed = code !== rendered.source;
  const stepResolution = (factor: number) => {
    const input = resolutionInput.current;
    if (!input) return;
    const current = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : resolution;
    const next = Math.min(1, Math.max(0.001, current * factor));
    input.value = String(next);
    setResolution(next);
  };

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
              <SolidToolsIcon />
            </button>
            <button type="button" aria-label="2D tools" title="2D tools" aria-pressed={toolMode === "2d"} onClick={() => setToolMode("2d")}>
              <PlanarToolsIcon />
            </button>
            <button type="button" aria-label="Documentation" title={docsOpen ? "Show 3D view" : "Browse libcompass documentation"} aria-pressed={docsOpen} aria-controls="docs-pane" onClick={() => setDocsOpen(open => !open)}>
              <FiBookOpen aria-hidden="true" />
            </button>
          </ToolbarSection>
          <ToolbarSection key={toolMode} label={`${toolMode.toUpperCase()} tools`}>
            {toolSections[toolMode].map(({ label, Icon, snippet }) => (
              <button key={label} type="button" aria-label={label} title={`Insert ${label.toLowerCase()} call`} onClick={() => {
                setViewExpanded(false);
                requestAnimationFrame(() => editor.current?.insertSnippet(snippet));
              }}>
                <Icon aria-hidden="true" />
              </button>
            ))}
          </ToolbarSection>
        </SideToolbar>
        <div className={`panes${viewExpanded ? " panes-expanded" : ""}`}>
          <section id="code-pane" className="pane editor-pane" aria-label="Code editor" hidden={viewExpanded}>
            <div className="pane-header"><span><span className="js-label">JS</span> model.js</span><span className="pane-note">Ctrl / ⌘ + Enter</span></div>
            <Editor ref={editor} location={editorLocation} />
          </section>
          <section className="pane viewer-pane" aria-label="3D model preview" hidden={docsOpen}>
            <div className="pane-header">
              <button type="button" className="projection-button" onClick={() => setOrthographic(value => !value)} title={`Switch to ${orthographic ? "perspective" : "orthographic"} camera`}>
                {orthographic ? "Orthographic" : "Perspective"}
              </button>
              <div className="resolution-control">
                <label htmlFor="triangulation-resolution">Resolution</label>
                <div className="resolution-input">
                  <input ref={resolutionInput} id="triangulation-resolution" type="number" aria-label="Triangulation resolution"
                    min="0.001" max="1" step="any" defaultValue={resolution}
                    title="Maximum curve deviation (0.001–1). Up doubles; Down halves and applies immediately. Apply typed values with Enter or blur."
                    onBlur={event => {
                      const input = event.currentTarget;
                      const next = Number.isFinite(input.valueAsNumber) ? Math.min(1, Math.max(0.001, input.valueAsNumber)) : resolution;
                      input.value = String(next);
                      setResolution(next);
                    }}
                    onKeyDown={event => {
                      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                        event.preventDefault();
                        stepResolution(event.key === "ArrowUp" ? 2 : 0.5);
                      }
                      if (event.key === "Escape") event.currentTarget.value = String(resolution);
                      if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
                    }} />
                  <div className="resolution-arrows" onPointerDown={event => event.preventDefault()}>
                    <button type="button" aria-label="Double resolution" title="Double resolution" onClick={() => stepResolution(2)}><FiChevronUp aria-hidden="true" /></button>
                    <button type="button" aria-label="Halve resolution" title="Halve resolution" onClick={() => stepResolution(0.5)}><FiChevronDown aria-hidden="true" /></button>
                  </div>
                </div>
              </div>
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
