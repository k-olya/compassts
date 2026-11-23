# compassts

A code-based CAD app powered by libcompass: write JavaScript in Monaco on the
left, inspect the model or API documentation on the right, and export binary STL.
Render and Export STL stay in the top menu.

The left icon toolbar selects 2D tools, Solid tools, Spatial curves, Spatial
surfaces, Arrays, or Helpers. 2D tools insert `sketch`, `lineSegment`,
`polyline`, `roundPolyline`, `rectangle`, `circle`, `ellipse`, `arc`, `planarCurve`, and planar
`trimCurve` calls. Solid tools insert `extrude`,
`extrudeAlongCurve`, `extrudeCut`, `chamfer`, `round`, `intersect`, and `difference` calls.
Spatial curves contains `spatialCurveFromPlanar` and spatial `trimCurve`; Spatial surfaces contains
`trimSurface`. Helpers contains Annotate, Spatial line, Plane, Rotate, and Displace; Arrays
contains Displacement array and Rotation array. Each tool inserts an options
template at the editor cursor, replacing the current selection. Tab / Shift+Tab
move between editable values; Undo removes the insertion. Tools restore the
editor when it is hidden and leave rendering to the Render button. Toolbar
sections have visible separators, and the tool section changes with the selected
category. The right toolbar has the documentation toggle and an expand button
that hides or restores the editor without entering browser fullscreen. Editor
contents, the camera, and the selected documentation page are preserved when
switching views.

Polyline and Rectangle return arrays of connected line
segments. Their toolbar templates insert `...polyline({ ... })` (or the
corresponding rectangle function), ready to use inside a sketch’s `add(...)` call. `polyline`
takes `points` and an optional `loop` boolean (default false). The single Rectangle
tool offers opposite `corner1`/`corner2`, `center` plus either corner, or `width`/`height`
with at most one anchor (`center`, `corner1`, or `corner2`). Sizes alone default to
a center at (0, 0). With sizes, corner1 is the rotated local upper-left anchor and
corner2 the lower-right anchor. Optional `rotation` is counterclockwise in degrees
about the center. Width/height are actual side lengths; supplied corners stay at
their final coordinates. Redundant defining sets and incomplete inputs throw.
These are generators, without separate classes.
`Sketch.add` also accepts the returned arrays directly: `s.add(rectangle({ center, corner2: corner }))`.
Both `Sketch.add` and `Node.add` accept a mix of individual objects and readonly
arrays, flattening array arguments one level in order without modifying inputs.
Passing arrays directly avoids function argument limits when adding many objects.

The Helpers category inserts `spatialLine({ direction, origin })`, `plane({ a, b, c })`,
`rotate({ object, axis, angle })`, `displace({ object, vector })`, and
`annotate({ solid, name, color, alpha })` option templates.
SpatialLine is a vec3-compatible direction array with a copied origin (default
zero); X/Y/Z are zero-origin unit lines. Extrusion uses the direction only.
Rotate uses signed degrees around a spatial line, including its origin. Displace
uses the supplied XYZ vector without normalizing it. Both return new planes,
spatial curves/lines, edges, solids, or surfaces, preserving their mathematical
geometry and shared topology. Solid child geometry moves under new lazy transform
nodes without changing source nodes or memo caches.

Annotate wraps the original solid in a new `AnnotatedNode`, a `Memo` group with
display properties. The method form is `part.annotate({ name, color, alpha })`.
For general groups, use `new AnnotatedNode(options).add(...)` or
`annotatedNode(options).add(...)`. Names default to `mesh1`, `mesh2`, ... via a
hidden counter that increments only for successful unnamed constructions.
Explicit names leave the counter unchanged. Color defaults to `'default'`
(the original gold, `#d2a568`), and alpha defaults to `1`, ranging from `0`
(invisible) to `1` (opaque).

```js
scene.add(part.annotate({ name: 'Housing', color: '#5599dd', alpha: 0.6 }));
scene.add(part.annotate({ color: 'blue' })); // Automatic name, opaque theme blue.
```

The immutable `colors` palette contains 16 named constants: `default`, `red`,
`orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`,
`violet`, `purple`, `pink`, `rose`, and `gray`. Use either `color: 'blue'` or
`color: colors.blue`. Custom colors must be `#RGB` or `#RRGGBB` strings;
arbitrary CSS names/functions, numbers, and alpha-bearing hex strings throw.
`node.color` returns the resolved hex string. The Annotate tool offers palette
choices and inserts `name: undefined` to use the automatic name.

The viewer traverses the scene and creates a separate named Three.js mesh for
each nonempty annotated subtree. Nested annotations use their own settings and
are excluded from the ancestor mesh; plain descendants use the nearest annotation.
Other geometry retains the default material. Transforms and repeated node
occurrences keep their placements, and edge outlines follow the mesh opacity.
The full triangulation remains available for triangle counts and STL export,
including alpha-zero geometry, with unchanged coordinates. Geometry cache edits
still require refreshing affected memo nodes and ancestors; changing annotations
alone does not require rebuilding geometry.

Hover a visible annotated mesh to highlight it and its edges. Right-click it to open
a menu showing its name and an Export STL action. Exporting there downloads only
that mesh's last-rendered triangles, with its name as the filename and its
world-space coordinates preserved. Nested annotated meshes remain separate.
Unannotated geometry shares the default mesh and has no hover effect or context menu.
Fully transparent meshes, edge overlays, and the grid are excluded from picking.
Right-drag continues to pan. Escape, an outside click, navigation, or a new render
closes the menu. The top Export STL button still exports the entire scene.

The same transformations are available as `.rotate({ axis, angle })` and
`.displace({ vector })` on each supported class, including inherited surface types.
For example, `part.rotate({ axis: Z, angle: 45 }).displace({ vector: [10, 0, 0] })`
returns a new solid and supports further modeling operations. These methods and
their parameter docs are available to Monaco.

The Helpers category includes Measure, inserting `measure({ object: part })`.
It returns an object and automatically prints it to the app console with a link
to the calling line. Every result contains `boundingBox: { min, max, size }`
using XYZ arrays; curves/segments also have `length`, surfaces have
`surfaceArea`, and solids have `volume`. Sketches and finite points return bounds
only. A flat nonempty array combines bounds and sums quantities, provided all
entries share one measurement type. Overlapping objects are counted independently.
Curved bounds and other quantities use the current resolution. Standalone planar
objects use XY at Z = 0; sketches use their world-space plane and ignore infinite
construction lines. Infinite objects and arbitrary nodes are rejected, and solid
children are excluded. Empty geometry has null bounds and zero area/volume.

The Arrays category inserts `displacementArray({ object, vector, N, offset, width })`
or `rotationArray({ object, axis, N, offset, width })`, or
`curveArray({ object, curve, follow, N, offset, width })`. The final snippet choice
selects which parameters to supply: exactly two of `N`, `offset`, `width`, with
rotation also accepting only `N` or only `offset` for a full circle, and curve
arrays for the full path length. Spacing is
in model units along a normalized vector for displacement, or signed degrees
around a spatial line for rotation. `width = N * offset`; width 10 and offset 5
make two copies, at 0 and 5. Computed counts round down for non-divisible widths.
Each result includes a fresh zero-offset copy and excludes the width endpoint.
Nested array targets are flattened into one output array, allowing grids and
repeated groups to be added directly to the scene. Spatial lines remain intact:

```js
const row = displacementArray({ object: part, vector: X, N: 4, offset: 10 });
const grid = displacementArray({ object: row, vector: Y, N: 3, offset: 10 });
scene.add(grid);
```

Array along curve uses arc-length spacing in model units along a smooth spatial
curve. Supplying only `N` or `offset` uses the whole sampled path length; explicit
width must fit on the path. Negative spacing starts at the end and travels
backward. Each copy's world origin lies on the curve. The API defaults to
`follow: false`, preserving orientation; the toolbar inserts `follow: true`
explicitly, with local Z following the tangent and X/Y transported with minimal
twist, as in `extrudeAlongCurve`.
Positions use the original curve equations; length estimates respect its
`sample()` method at the current resolution. Corners, cusps and unresolved frames
throw with `follow: true`. The default mode accepts corners without evaluating tangents.
Closed paths exclude a duplicate at the endpoint.

The Ellipse tool inserts `ellipse({ center, radiusX, radiusY, rotation })`.
The radii are positive semi-axis lengths, and rotation is counterclockwise in
degrees (default zero). The result is an exact closed `PlanarCurve`, ready to add
to a sketch; it uses the same sampling and extrusion paths as other curves.

The SVG path tool inserts `svgPath({ d, position, scale })`, using the browser's
native path geometry. It returns one `PlanarCurve`, or an array when gaps
separate subpaths; connected sections stay together. Pass either result directly
to `s.add(...)`. `position: { x: 0, y: 0 }` and `scale: { x: 1, y: 1 }` are
the defaults. `at(t)` follows normalized native path length, then scales and
translates the points; negative scales mirror axes. Y is not flipped by default.
Stroke, caps, joins, and other SVG primitives are ignored. Open paths remain open;
use closed outlines to extrude filled profiles, including holes and islands.
Sampling uses the ordinary curve resolution and midpoint rule. The operation
requires a browser; paths without any positive-length geometry throw.

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

The 2D Round polyline tool inserts `...roundPolyline({ segments, radius: 0.5 })`.
It returns trimmed line segments and tangent circular arcs without changing the
source segments. Endpoints connect by exact XY coordinates, so segment order and
direction may vary. Open ends and missing segments are allowed; unshared endpoints
stay unchanged. A point shared by more than two segments or a segment too short
for its incident rounds produces an error. Straight joins stay straight. At the
radius limit, fully consumed segments disappear and adjoining arcs share the same
point. Pass the array directly to `s.add(...)`, or spread it into an element list.
During extrusion, smoothly connected open planar curves and line segments join into exact piecewise
curves, removing unnecessary wall seams without changing the sketch. Joined runs
may stay open or form loops; existing closed curves stay separate. Four quarter
arcs forming a circle therefore extrude as a single cylindrical wall and can be
rounded into a sphere. This can change boundary indices for affected profiles.

The Round tool inserts `round({ solid: part, radius: 0.5, boundaries: [] })`.
It creates a new solid with tangent constant-radius rounds; `part.round(options)`
is the method form. An omitted or empty boundary list selects every original boundary.
Smooth closed rims can combine tangent straight and curved sections, such as a
rounded rectangle. Convex rims remove material, while concave rims add material
at pocket floors; a top-face selector can round both the lip and the floor of a blind pocket.
Rounds remain mathematical surfaces, including spherical corners. At the radius
limit, consumed faces disappear so cylinders can become spheres, hollow cylinders
can become tori, and four parallel cube rounds can become a cylinder. Unresolved
or unsupported intersections report errors instead of returning an invalid solid.

The Chamfer tool inserts `chamfer({ solid: part, length: 0.5, angle: 45,
boundaries: [] })`. Boundary indices refer to the original solid's `boundaries`
array; an omitted or empty list selects all. The result is a new solid, so add
it to the scene instead of the original. The instance form is
`part.chamfer({ length: 0.5, angle: 45, boundaries: [] })`; `part.chamfer()` uses
all defaults. Both forms return a new solid. Length is the setback on the first
adjoining surface in `solid.surfaces` order, and angle is in degrees. Convex
planar edges and smooth closed rims combining tangent lines and curves are supported,
including holes. Convex bevels remove material, while concave bevels add material
around pocket floors. A top-face selector can bevel both the lips and the floor;
unsupported corner or surface intersections report errors in the console.

Chamfer and Round accept one boundary selector or a mixed list of original indices, boundary objects,
planar `Face` objects from the solid (selecting their outer and hole boundaries),
and predicates `({ solid, face, boundary }) => boolean`. Predicates test each
adjoining planar face; any match includes the boundary. They run once with
`face: undefined` for a boundary adjoining only curved surfaces. Matches are
deduplicated by identity. The shared `searchBoundaries({ solid, boundaries })`
helper accepts the same selections and is available in scripts and the docs browser. A selector or nonempty list with
no matches leaves the geometry unchanged in a new solid; omitted or empty
lists still select all. Objects from other solids are rejected.

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
origin planes `XY`, `ZX`, `YZ`, unit spatial lines `X`, `Y`, `Z` and their negative
directions `negX`, `negY`, `negZ` (all with zero origins), `center` (the Point
`{ x: 0, y: 0 }`), and `origin` (the vec3 `[0, 0, 0]`), available directly in scripts
and Monaco tooltips. Plane letters give local axis order; the normals
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
if the profile reaches a point before length 20. Curves use `tangent(t)` with a numerical default and an
optional exact evaluator or method override. Sharp curved joins, intersecting
offsets, and collapses to a line currently report that offset trimming is needed.
The default example extrudes a centered rectangle with two circular holes, then
chamfers its four hole rims using
`.chamfer({ boundaries: ({ boundary }) => boundary.isLoop() })` with the default
length and angle.

Constructors accept named options objects, such as `new Circle({ center, radius })`
and `new TransformMat4({ matrix })`. Their lowercase shorthands use the same
options, for example `circle({ center, radius })` and `sketch()`. Use
`transformMat4Node({ matrix })` for the matrix-node shorthand; `transformMat4`
remains the array utility. `Point` and `Vertex` are interfaces: use
`{ x, y }` and `{ position: [x, y, z] }` literals. Their types and documentation
are available to Monaco, including through JavaScript JSDoc annotations.

`PI` is available globally as an alias for `Math.PI`. The Util helpers
`radtodeg(angleRAD)` and `degtorad(angleDEG)` convert angles without wrapping them:
`radtodeg(PI / 2)` is `90`, and `degtorad(45)` is `PI / 4`.
`Transform.rotation` also uses degrees. All three also have Monaco tooltips and
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
The console and both tool panels use theme-matched OverlayScrollbars, with
draggable handles that hide when you leave the panel. The console follows new
output while at the bottom and preserves your position when you scroll up.
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
tool for code you trust; module loading is asynchronous, and script execution does not impose time limits.

The filename dropdown manages multiple JavaScript files. Add a filename (the
`.js` extension is appended automatically) or an HTTP(S) URL using the input
inside the dropdown. `model.js` is always the entry point and cannot be renamed
or deleted. Other local files can be renamed or deleted; update their import
paths after renaming. File contents and per-file editor history remain available
when switching files. URL sources are fetched and shown read-only; their server
must permit browser requests through CORS.

Local files are ES modules and run when imported from the entry point:

```js
// parts.js
export function makePart(radius) {
  return sketch().add(circle({ center, radius })).extrude({ length: 10 });
}

// model.js
import { makePart } from './parts.js';
scene.add(makePart(5));
```

Library globals remain available in every file. Explicit imports from
`'libcompass'` and `'gl-matrix'` also work. HTTP(S) module imports and their relative
dependencies load into the file list read-only. URL scripts without module syntax
run as classic scripts before the main module and may define shared globals,
including top-level `var`, `let`, `const`, and functions. Add classic dependencies
in execution order. Module exports remain module-scoped. Each Render uses a
fresh module context; top-level await and literal dynamic imports are supported.
Computed dynamic imports currently report an explicit error. Console links and
evaluation markers identify the originating file and open it in the editor.
Project changes take effect when Render runs, regardless of which file is selected.

Edit the project name beside the compass branding. The save icon downloads
`<project name>.cts`; the folder icon opens a saved project. You can also drop a
`.cts` file anywhere in the app. Loading opens `model.js` and clears the old preview
and console; press Render to run the loaded project. Invalid archives or failed
URL requests leave the current project intact.

A `.cts` file is a standard ZIP containing every editable JavaScript file at its
relative path and a `project.json` manifest:

```json
{
  "version": 1,
  "name": "My project",
  "files": [
    { "name": "model.js" },
    { "name": "primitives.js" },
    { "name": "https://example.com/library.js", "url": "https://example.com/library.js" }
  ]
}
```

File order is preserved for classic external scripts. URL entries retain their
original name and effective URL after redirects; their code is excluded from the
archive and fetched again from the original URL when loading. Archives and their
expanded script contents are limited to 64 MiB.

Open a hosted project with `?url=` followed by its URL encoded with
`encodeURIComponent`, for example:

```text
https://your-compassts-host/?url=https%3A%2F%2Fexample.com%2Fmodels%2Fproject.json
```

The app first shows a trust-confirmation dialog with a clickable source URL.
Cancel or Escape leaves the current project intact and makes no project requests.
After **Trust and load**, it fetches either a `.cts` ZIP or an unpacked
`project.json` in the same format above. Unpacked local filenames are resolved
relative to the manifest's directory, including after redirects; they stay
editable. External URL libraries are fetched read-only. The servers must permit
browser requests through CORS. Loading does not execute project scripts; press
Render when ready.

The default project also includes an editable `primitives.js` module, built with
sketches, extrusion, and rounding. Its five named exports take options objects:

- `cuboid({ width = 10, depth = 10, height = 10 })`
- `cylinder({ radius = 5, height = 10 })`
- `cylinderElliptic({ radiusX = 5, radiusY = 3, height = 10 })`
- `sphere({ radius = 5 })`
- `torus({ majorRadius = 10, minorRadius = 2 })`

All are centered at the world origin. Cylinders run along Z, and the torus's
central axis is Z. This simple example uses the app's libcompass globals and
delegates geometry handling to the library operations. Returned objects are ordinary
mathematical solids, with the usual modeling, annotation, and placement methods. They use the current
triangulation resolution. The module is loaded only when used by the main script:

```js
import { cuboid, cylinder, cylinderElliptic, sphere, torus } from './primitives.js';

scene.add(cuboid({ width: 20, depth: 12, height: 8 }));
scene.add(sphere({ radius: 5 }).displace({ vector: [25, 0, 0] }));
```

Selected libcompass APIs also accept their required argument directly:
`circle(5)`, `svgPath(d)`, `polyline(points)`, `planarCurve(at)`, `spatialCurve(at)`,
`spatialSurface(at)`, `face(boundaries)`, `solid(surfaces)`, `measure(part)`,
`annotate(part)`, `chamfer(part)`, `round(part)`, and `searchBoundaries(part)`.
Their options forms remain available for additional settings. Matching constructors
accept the same values, for example `new Circle(5)` and `new Solid(surfaces)`.

Sketch methods support `s.extrude(10)` and `s.extrudeAlongCurve(path)`. Solids
support `part.intersect(tool)` and `part.difference(tool)`. Planar curves support
`curve.contains(point)`, and lifting supports `SpatialCurve.fromPlanarCurve(curve)`.
Every supported spatial object's `.displace(vector)` accepts an ordinary or typed
XYZ vector. Standalone extrusion still takes both a sketch and length in options.
The default example and primitives module use these direct forms where applicable;
tool templates continue to expose options for customization.
