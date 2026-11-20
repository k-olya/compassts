# compassts

A code-based CAD app powered by libcompass: write JavaScript in Monaco on the
left, inspect the model or API documentation on the right, and export binary STL.
Render and Export STL stay in the top menu.

The left icon toolbar selects 3D or 2D code tools and opens the documentation
browser. 3D tools insert `extrude` and `extrudeAlongCurve` calls; 2D tools insert
`sketch`, `lineSegment`, and `planarCurve` calls. Each inserts an options template
at the editor cursor, replacing the current selection. Tab / Shift+Tab move
between editable values; Undo removes the insertion. Tools restore the editor
when it is hidden and leave rendering to the Render button. Toolbar sections have
visible separators, and the tool section changes with the selected mode. The
right toolbar's expand button hides or restores the editor without entering
browser fullscreen. Editor contents, the camera, and the selected documentation
page are preserved when switching views.

The book button in the left toolbar switches the right pane between the model
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
The default example also places a torus beside the plate using `extrudeAlongCurve`.

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
(`Face` or `SpatialSurface`) and shared `boundaries` (`Edge` or `SpatialCurve`).
Sweeps also use a temporary mesh to check for invalid geometry. The library-wide
`TRIANGULATION_RESOLUTION` is a configurable model-unit target for midpoint-to-chord
deviation, defaulting to `0.1`. The Resolution field above the preview replaces
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
plane })` lifts any planar curve into world space without sampling, replacing
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
opens when there is output and stays closed after a run with no output. Its X
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
