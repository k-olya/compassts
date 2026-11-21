# compassts

A code-based CAD app powered by libcompass: write JavaScript in Monaco on the
left, inspect the model or API documentation on the right, and export binary STL.
Render and Export STL stay in the top menu.

The left icon toolbar selects 2D tools, Solid tools, Spatial curves, Spatial
surfaces, Arrays, or Helpers. 2D tools insert `sketch`, `lineSegment`,
`polyline`, `rectangle`, `centerRectangle`, `circle`, `arc`, `planarCurve`, and planar
`trimCurve` calls. Solid tools insert `extrude`,
`extrudeAlongCurve`, `extrudeCut`, `chamfer`, `intersect`, and `difference` calls.
Spatial curves contains `spatialCurveFromPlanar` and spatial `trimCurve`; Spatial surfaces contains
`trimSurface`. Arrays and Helpers are currently empty. Each tool inserts an options
template at the editor cursor, replacing the current selection. Tab / Shift+Tab
move between editable values; Undo removes the insertion. Tools restore the
editor when it is hidden and leave rendering to the Render button. Toolbar
sections have visible separators, and the tool section changes with the selected
category. The right toolbar has the documentation toggle and an expand button
that hides or restores the editor without entering browser fullscreen. Editor
contents, the camera, and the selected documentation page are preserved when
switching views.

Polyline, Rectangle, and Center rectangle return arrays of connected line
segments. Their toolbar templates insert `...polyline({ ... })` (or the
corresponding rectangle function), ready to use inside a sketch’s `add(...)` call. `polyline`
takes `points` and an optional `loop` boolean (default false); `rectangle` takes
opposite `start`/`end` corners; `centerRectangle` takes `center`/`corner`. Rectangles
align to the sketch's local axes. These are generators, without separate classes.

The Arc tool inserts `arc({ start, end, angle })`. Tab through the coordinates to
its final snippet choice to switch to `center` plus `direction`, or a `through`
point, instead of `angle`. A fourth choice uses `start`, `center`, and signed
`angle`, calculating the endpoint automatically.
The three-point form uses center/start/end on one circle, with `clockwise` or
`counterclockwise` travel (default counterclockwise). The two-point form uses a
signed sweep in degrees: positive counterclockwise, negative clockwise, nonzero
and strictly between -360 and 360. The start/through/end form fits the circle
through those three points and chooses the arc passing through the middle point;
collinear points or a conflicting explicit direction throw. Major arcs are
supported in all forms. It returns an exact
`PlanarCurve`; use a closing line or other curves when building a filled profile.

The Chamfer tool inserts `chamfer({ solid: part, length: 0.5, angle: 45,
boundaries: [] })`. Boundary indices refer to the original solid's `boundaries`
array; an omitted or empty list selects all. The result is a new solid, so add
it to the scene instead of the original. The instance form is
`part.chamfer({ length: 0.5, angle: 45, boundaries: [] })`; `part.chamfer()` uses
all defaults. Both forms return a new solid. Length is the setback on the first
adjoining surface in `solid.surfaces` order, and angle is in degrees. Convex
planar edges and smooth closed curved rims (including holes) are supported;
unsupported corner or surface intersections report errors in the console.

Trim curve inserts `trimCurve({ curve, cutters: [...], keep: 0.5 })`: retain the
piece containing the original normalized `keep` parameter. Its 2D template uses
a cutting line, and its 3D template uses a world-space plane. Trim surface inserts
`trimSurface({ surface: part.surfaces[0], cutter: YZ, keep: "positive" })`;
Tab lets you choose positive/negative. It returns retained surface patches, which
can be displayed with `scene.add(solid({ surfaces: patches }))`. Closed curve
cutters on planar faces use that face's local XY coordinates and inside/outside
selection. Curved surfaces currently support plane cuts forming one continuous
transverse rail, as on an obliquely cut cylinder wall. Cuts requiring several
charts and curved cutters on spatial surfaces throw; surface trimming does not
cap or cut a whole solid. Full options and limitations appear under Operations
in the docs and in Monaco tooltips.

Intersect inserts `intersect({ solid: part, tool: cutter })`; Difference inserts
`difference({ solid: part, tool: cutter })`. Their Solid methods are
`part.intersect({ tool: cutter })` and `part.difference({ tool: cutter })`.
Extrude cut inserts `extrudeCut({ solid: part, sketch: s, length: 10, axis: Z,
angle: 0 })`, also available as `part.extrudeCut({ sketch, length, axis, angle })`.
It extrudes the sketch normally, then subtracts that solid; choose placement,
signed length, and degree draft angle for a blind or through cut. All return new
solids and preserve the inputs. Only own surfaces participate; child nodes from
the first operand are retained unchanged. Empty intersections have no surfaces.
Planar and regular parametric surface intersections support open cuts, closed
loops, holes and multiple charts across periodic seams. `SurfaceRegion` retains
curved patches through later booleans, with reversed tool walls lining cuts.
Singular, branching/tangent or unresolved arrangements report console errors.
Outputs retain exact surface equations and shared topology; mesh checks are used
only for analysis and validation. These details appear in the generated docs
and Monaco tooltips for the existing boolean tools.

The book button in the right toolbar switches the right pane between the model
and searchable libcompass API documentation, preserving both views' state.
The docs index has collapsible Classes (including interfaces and types),
Shorthands, Operations, Defaults, and Util folders. Search shows matches across all folders, and
documentation links open the folder containing their target. Operations such as
`extrude` work on CAD math objects; Util contains general helpers such as
`functionalize` and the packed-coordinate `transformMat4`. Folder assignment
follows libcompass's `src/operations/`, `src/defaults/`, and `src/util/` structure;
internal geometry helpers are not part of the public docs. Defaults include
origin planes `XY`, `ZX`, `YZ` and unit vectors `X`, `Y`, `Z`, available directly
in scripts and Monaco tooltips. Plane letters give local axis order; the normals
are +Z, +Y, and +X respectively. Treat shared defaults as immutable.
Signatures, TSDoc, parameters, and examples are generated from libcompass source
when Vite starts or builds, and update during development when that source changes.
The same declarations power Monaco's hover tooltips, completions, and signature
help for the globally available CAD and gl-matrix names, plus `scene`.

Keep this checkout next to `libcompass`; the dependency is `file:../libcompass`.
Use Node.js 22.18+ (or 24+).

```sh
npm --prefix ../libcompass ci
npm --prefix ../libcompass run build
npm ci
npm run dev
```

`npm run build` creates `build/`; `npm run preview` serves that production build.
`npm test` checks evaluation, direct solid composition, scene isolation, error
recovery, binary STL data, generated API documentation, and editor type resolution.
Monaco and its workers are bundled locally; no editor CDN is required.
After changing libcompass source, rebuild it with
`npm --prefix ../libcompass run build` so its runtime matches the generated
documentation and editor declarations.

The editor runs synchronous JavaScript. All libcompass exports (`Node`, `Memo`,
`Sketch`, `Circle`, `sketch`, `circle`, `extrude`, etc.), gl-matrix exports (`mat4`, `vec3`,
etc.) are available by name without imports. `scene` is a fresh
libcompass `Node` in each evaluation's global scope. Add child nodes with `add`:

```js
const s = sketch().add(circle({ center: { x: 0, y: 0 }, radius: 20 }));
const part = extrude({ sketch: s, length: 10 });
scene.add(part);
```

Extrusion takes a signed `length` and an optional nonzero `axis`, normalized
internally without modifying it, which defaults to the sketch plane normal.
Use a negative length to extrude in the opposite
direction, or pass an axis explicitly: `extrude({ sketch: s, axis: Z, length: -10 })`.

Optional `angle` sets a constant wall draft in degrees: positive expands material
and shrinks holes; negative contracts material and grows holes. It defaults to
zero and keeps the same meaning for negative lengths. For example,
`s.extrude({ length: 20, angle: -45 })` stops automatically at a cone tip
if the profile reaches a point before length 20. The built-in plate example uses
a small positive draft. Curves use `tangent(t)` with a numerical default and an
optional exact evaluator or method override. Sharp curved joins, intersecting
offsets, and collapses to a line currently report that offset trimming is needed.
The default example chamfers the plate's four hole rims (boundaries `4`, `5`,
`10`, and `11`) using `.chamfer()` with its default length and angle.

Constructors take named options objects, such as `new Circle({ center, radius })`
and `new TransformMat4({ matrix })`. Their lowercase shorthands use the same
options, for example `circle({ center, radius })` and `sketch()`. Use
`transformMat4Node({ matrix })` for the matrix-node shorthand; `transformMat4`
remains the array utility. `Point` and `Vertex` are interfaces: use
`{ x, y }` and `{ position: [x, y, z] }` literals. Their types and documentation
are available to Monaco, including through JavaScript JSDoc annotations.

`PI` is available globally as an alias for `Math.PI`. The Util helpers
`radtodeg(angleRAD)` and `degtorad(angleDEG)` convert angles without wrapping them:
`radtodeg(PI / 2)` is `90`, and `degtorad(45)` is `PI / 4`. The built-in example
uses `angleDEG = 3` for its draft angle. `Transform.rotation` also uses degrees. All three also have Monaco tooltips and
entries in the docs browser's Util folder.

Extrusion keeps circles and curved walls analytic. Solids expose `surfaces`
(`Face`, `SpatialSurface` or `SurfaceRegion`) and shared `boundaries` (`Edge` or `SpatialCurve`).
Sweeps also use a temporary mesh to check for invalid geometry. The library-wide
`TRIANGULATION_RESOLUTION` is a configurable model-unit target for midpoint-to-chord
deviation, defaulting to `0.0128`. The Resolution field above the preview replaces
the Z-up label: enter a value from `0.001` to `1`, then press Enter or leave the
field to rebuild the model. The field's arrow buttons and keyboard Up/Down
double/halve the value and rebuild immediately. Out-of-range values are clamped;
Escape cancels a typed edit. Smaller values produce more triangles. STL export uses the last rendered
mesh at its chosen resolution. The library also exports
`setTriangulationResolution(value)` for direct use. Closed curves keep at least
four segments at coarse settings. Every curve uses the same adaptive midpoint sampling algorithm. `extrude` no longer takes
`circleSegments`. `Circle` extends `PlanarCurve`, and every curve's `at(t)` uses
[0, 1]. Use `circle.at(angleDEG / 360)` for degrees or
`circle.at(angleRAD / (2 * PI))` for radians. All loop
samples include the repeated closing point. `SpatialCurve.fromPlanarCurve({ curve,
plane })` (also `spatialCurveFromPlanar({ curve, plane })`) lifts any planar curve
into world space without sampling, replacing
`fromCircle`. `PlanarCurve`, `SpatialCurve`, `SpatialSurface`, `RuledSurface`, their shorthands, and `SpatialBoundary` types
are included in the editor and documentation browser.

`extrudeAlongCurve({ sketch: s, curve })` (also `s.extrudeAlongCurve({ curve })`)
sweeps profiles along a smooth spatial curve. Local (0, 0) follows the path;
its tangent sets the sketch normal, and the frame transports with minimal twist.
Open paths have caps; smoothly closed paths have no caps or seam edges. Corners,
cusps, folds, and detected self-intersections throw and appear in the console.
Checks use the library resolution and cannot certify hidden oscillations.

`SpatialSurface({ at, ... })` now supports general and periodic parametric
surfaces. Use `RuledSurface({ start, end, ... })` or `ruledSurface(...)` for the
previous rim/apex constructor. Surfaces expose physical `boundaryLoops`;
`Face` retains `outer` and `holes`. Both new classes and `extrudeAlongCurve`
appear automatically in Monaco and their respective docs folders.

Curve lifting also accepts plain `at(t)` evaluators. The default `sample()` uses
`sampleParameters({ resolution })`, starting with `[0, 0.5, 1]` and halving
intervals until midpoint deviation is at most the resolution. Oscillatory curves
can override `sample()` directly; analysis, lifting, and tessellation honor that
override. `Sketch.fromFace(face)` creates an
empty sketch on that face's plane, without copying its boundary geometry.
Extrusion supports general closed planar curves and mixed profiles assembled from
open curves and line segments. `PlanarLoop` exposes `area()` and
`contains({ point })`; these types and curve sampling methods are available in
Monaco and the docs browser. Profiles analyze temporary sampled polylines, while
solids retain the original curves and shared topology. Profile checks and
tessellation have no circle-specific rules. Analysis can lose features smaller
than the sampling resolution, and midpoint probes can miss oscillations between
probes.

Solids are memoized scene graph nodes and can be added directly to scenes,
`Transform`, and `TransformMat4` nodes. Call `refresh()` on affected memoized
nodes and cached ancestors after changing their children.
`add(...children)` and `remove(...children)` return the node for chaining;
removal takes child objects, not indices.
Removal deletes all occurrences of the supplied objects and ignores absent ones.

Render (or Ctrl/Cmd+Enter in the editor) evaluates the source and replaces the
preview. Syntax, runtime, and invalid triangle data errors appear in the
scrollable console below the panes and leave the previous model intact.
Errors include editor line/column locations and user-script stack frames when
available. Click a console location or a script stack frame to reveal and focus
that position in the editor, restoring the code pane if it was hidden.
Evaluation failures also appear as Monaco error squiggles with the error and
stack in their hover tooltip. These markers clear on edit or the next Render;
ordinary `console.error()` output does not create editor diagnostics.
The console also captures script `console.*` output (including objects,
warnings, assertions, traces, counters, and timers), while forwarding it to the
browser console. Output starts fresh on Render with no entry limit. The console
displays objects and arrays as collapsible trees, initially collapsed at every
level. Expanding a value reads its current properties; getters are labeled without
being invoked, and circular references are marked instead of expanded endlessly.
The console opens when there is output and stays closed after a run with no output. Its X
button closes it without clearing the current run's entries or editor markers;
new output opens it again. `console.clear()` clears and closes it. Delayed output from a
superseded run is ignored. Preview renderer errors use the same console, labeled
Renderer, with their internal stack if no script frame is available. A failed
preview animation stops to avoid repeating the error on every frame; another
Render retries the preview.

Export STL downloads `compass.stl`
using Three's binary STL exporter, with exactly the last successful preview's
geometry. Edits take effect after Render.

| Preview control | Action |
| --- | --- |
| Left-drag | Orbit with inertia. |
| Right-drag | Pan with inertia. |
| Scroll | Zoom. |
| Hold Shift and move the pointer | Pan immediately, without a mouse button or inertia. |
| Hold Alt and move the pointer | Orbit immediately, without a mouse button or inertia. |
| Perspective / Orthographic button above the preview | Switch projection while keeping viewing angle and scale. |

Shift/Alt movement works while the pointer is over the preview, including
one-finger trackpad movement. The app uses React, Three.js, Monaco, Zustand,
React Icons, and Vite. `ToolbarSection` groups can be swapped according to UI state.

Editor scripts run directly in the browser with page access. This is a local
tool for code you trust; evaluation is synchronous and does not impose time limits.
