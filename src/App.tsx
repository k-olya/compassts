import { useRef, useState } from "react";
import { FiBookOpen, FiChevronDown, FiChevronUp, FiMaximize, FiMinimize } from "react-icons/fi";
import Docs from "./Docs.tsx";
import Console from "./Console.tsx";
import Editor, { type EditorHandle } from "./Editor.tsx";
import SideToolbar, { ToolbarSection } from "./SideToolbar.tsx";
import { AnnotateIcon, MeasureIcon, DisplacementArrayIcon, RotationArrayIcon, DisplaceIcon, PlaneIcon, RotateIcon, SpatialLineIcon, ArcIcon, ArraysIcon, CenterRectangleIcon, CircleIcon, EllipseIcon, SvgPathIcon, PolylineIcon, RoundPolylineIcon, RectangleIcon, HelpersIcon, SpatialCurveFromPlanarIcon, SpatialCurvesIcon, SpatialSurfacesIcon, ChamferIcon, RoundIcon, DifferenceIcon, ExtrudeCutIcon, ExtrudeIcon, IntersectIcon, LineSegmentIcon, PlanarCurveIcon, PlanarToolsIcon, SketchIcon, SolidToolsIcon, SweepIcon, TrimCurveIcon, TrimSurfaceIcon } from "./ToolIcons.tsx";
import Viewer from "./Viewer.tsx";
import { useCadStore } from "./store.ts";
import type { ScriptLocation } from "./script-console.ts";

const toolCategories = [
  { id: "planar", label: "2D tools", Icon: PlanarToolsIcon },
  { id: "solid", label: "Solid tools", Icon: SolidToolsIcon },
  { id: "spatialCurves", label: "Spatial curves", Icon: SpatialCurvesIcon },
  { id: "spatialSurfaces", label: "Spatial surfaces", Icon: SpatialSurfacesIcon },
  { id: "arrays", label: "Arrays", Icon: ArraysIcon },
  { id: "helpers", label: "Helpers", Icon: HelpersIcon },
] as const;

type ToolMode = typeof toolCategories[number]["id"];

const toolSections = {
  planar: [
    {
      label: "Sketch", Icon: SketchIcon,
      snippet: "sketch({\n  plane: ${1:XY},\n})$0",
    },
    {
      label: "Line segment", Icon: LineSegmentIcon,
      snippet: "lineSegment({\n  start: { x: ${1:0}, y: ${2:0} },\n  end: { x: ${3:10}, y: ${4:0} },\n})$0",
    },
    {
      label: "Polyline", Icon: PolylineIcon,
      snippet: "...polyline({\n  points: [\n    { x: ${1:0}, y: ${2:0} },\n    { x: ${3:10}, y: ${4:0} },\n    { x: ${5:10}, y: ${6:10} },\n  ],\n  loop: ${7|true,false|},\n})$0",
    },
    {
      label: "Round polyline", Icon: RoundPolylineIcon,
      snippet: "...roundPolyline({\n  segments: ${1:segments},\n  radius: ${2:0.5},\n})$0",
    },
    {
      label: "Rectangle", Icon: RectangleIcon,
      snippet: "...rectangle({\n  start: { x: ${1:0}, y: ${2:0} },\n  end: { x: ${3:20}, y: ${4:10} },\n})$0",
    },
    {
      label: "Center rectangle", Icon: CenterRectangleIcon,
      snippet: "...centerRectangle({\n  center: { x: ${1:0}, y: ${2:0} },\n  corner: { x: ${3:10}, y: ${4:5} },\n})$0",
    },
    {
      label: "Circle", Icon: CircleIcon,
      snippet: "circle({\n  center: { x: ${1:0}, y: ${2:0} },\n  radius: ${3:10},\n})$0",
    },
    {
      label: "Ellipse", Icon: EllipseIcon,
      snippet: "ellipse({\n  center: { x: ${1:0}, y: ${2:0} },\n  radiusX: ${3:10},\n  radiusY: ${4:5},\n  rotation: ${5:0},\n})$0",
    },
    {
      label: "Arc", Icon: ArcIcon,
      snippet: "arc({\n  start: { x: ${1:0}, y: ${2:0} },\n  ${3|end: { x: 10\\, y: 0 }\\, angle: 180,end: { x: 10\\, y: 0 }\\, center: { x: 5\\, y: 0 }\\, direction: \"counterclockwise\",end: { x: 10\\, y: 0 }\\, through: { x: 5\\, y: 5 },center: { x: 5\\, y: 0 }\\, angle: 180|},\n})$0",
    },
    {
      label: "Planar curve", Icon: PlanarCurveIcon,
      snippet: "planarCurve({\n  at: t => ({\n    x: ${1:10} * t,\n    y: ${2:10} * t * t,\n  }),\n})$0",
    },
    {
      label: "SVG path", Icon: SvgPathIcon,
      snippet: "svgPath({\n  d: \"${1:M 0 0 C 0 10 10 10 10 0 Z}\",\n  position: { x: ${2:0}, y: ${3:0} },\n  scale: { x: ${4:1}, y: ${5:1} },\n})$0",
    },
    {
      label: "Trim curve", Icon: TrimCurveIcon,
      snippet: "trimCurve({\n  curve: ${1:curve},\n  cutters: [line({ point: { x: ${2:0}, y: ${3:0} }, direction: [${4:0}, ${5:1}] })],\n  keep: ${6:0.5},\n})$0",
    },
  ],
  solid: [
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
      label: "Round", Icon: RoundIcon,
      snippet: "round({\n  solid: ${1:part},\n  radius: ${2:0.5},\n  boundaries: ${3:[]},\n})$0",
    },
    {
      label: "Intersect", Icon: IntersectIcon,
      snippet: "intersect({\n  solid: ${1:part},\n  tool: ${2:cutter},\n})$0",
    },
    {
      label: "Difference", Icon: DifferenceIcon,
      snippet: "difference({\n  solid: ${1:part},\n  tool: ${2:cutter},\n})$0",
    },
  ],
  spatialCurves: [
    {
      label: "Spatial curve from planar", Icon: SpatialCurveFromPlanarIcon,
      snippet: "spatialCurveFromPlanar({\n  curve: ${1:curve},\n  plane: ${2:XY},\n})$0",
    },
    {
      label: "Trim curve", Icon: TrimCurveIcon,
      snippet: "trimCurve({\n  curve: ${1:path},\n  cutters: [${2:XY}],\n  keep: ${3:0.5},\n})$0",
    },
  ],
  spatialSurfaces: [
    {
      label: "Trim surface", Icon: TrimSurfaceIcon,
      snippet: "trimSurface({\n  surface: ${1:part.surfaces[0]},\n  cutter: ${2:YZ},\n  keep: \"${3|positive,negative|}\",\n})$0",
    },
  ],
  arrays: [
    {
      label: "Displacement array", Icon: DisplacementArrayIcon,
      snippet: "displacementArray({\n  object: ${1:part},\n  vector: [${2:1}, ${3:0}, ${4:0}],\n  ${5|N: 4\\, offset: 10,N: 4\\, width: 40,offset: 10\\, width: 40|},\n})$0",
    },
    {
      label: "Rotation array", Icon: RotationArrayIcon,
      snippet: "rotationArray({\n  object: ${1:part},\n  axis: ${2:Z},\n  ${3|N: 8,offset: 45,N: 4\\, offset: 30,N: 4\\, width: 180,offset: 30\\, width: 180|},\n})$0",
    },
  ],
  helpers: [
    {
      label: "Measure", Icon: MeasureIcon,
      snippet: "measure({\n  object: ${1:part},\n})$0",
    },
    {
      label: "Annotate", Icon: AnnotateIcon,
      snippet: "annotate({\n  solid: ${1:part},\n  name: ${2:undefined},\n  color: \"${3|default,red,orange,amber,yellow,lime,green,teal,cyan,blue,indigo,violet,purple,pink,rose,gray|}\",\n  alpha: ${4:1},\n})$0",
    },
    {
      label: "Spatial line", Icon: SpatialLineIcon,
      snippet: "spatialLine({\n  direction: [${1:0}, ${2:0}, ${3:1}],\n  origin: [${4:0}, ${5:0}, ${6:0}],\n})$0",
    },
    {
      label: "Plane", Icon: PlaneIcon,
      snippet: "plane({\n  a: [${1:0}, ${2:0}, ${3:0}],\n  b: [${4:1}, ${5:0}, ${6:0}],\n  c: [${7:0}, ${8:1}, ${9:0}],\n})$0",
    },
    {
      label: "Rotate", Icon: RotateIcon,
      snippet: "rotate({\n  object: ${1:part},\n  axis: ${2:Z},\n  angle: ${3:45},\n})$0",
    },
    {
      label: "Displace", Icon: DisplaceIcon,
      snippet: "displace({\n  object: ${1:part},\n  vector: [${2:10}, ${3:0}, ${4:0}],\n})$0",
    },
  ],
};

export default function App() {
  const [toolMode, setToolMode] = useState<ToolMode>("solid");
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
          <button className="export-button" onClick={() => exportStl()} disabled={!triangles} title="Export the last successfully rendered model">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 1v9m-3-3 3 3 3-3M2 10v4h12v-4" /></svg>
            Export STL
          </button>
        </nav>
      </header>
      <div className="workspace-body">
        <SideToolbar label="Code tools">
          <ToolbarSection label="Tool categories">
            {toolCategories.map(({ id, label, Icon }) => (
              <button key={id} type="button" aria-label={label} title={label} aria-pressed={toolMode === id} onClick={() => setToolMode(id)}>
                <Icon />
              </button>
            ))}
          </ToolbarSection>
          <ToolbarSection key={toolMode} label={toolCategories.find(category => category.id === toolMode)!.label}>
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
            <button type="button" aria-label="Documentation" title={docsOpen ? "Show 3D view" : "Browse libcompass documentation"} aria-pressed={docsOpen} aria-controls="docs-pane" onClick={() => setDocsOpen(open => !open)}>
              <FiBookOpen aria-hidden="true" />
            </button>
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
