# compassts

A code-based CAD app powered by libcompass: write JavaScript in Monaco on the
left, inspect the model or API documentation on the right, and export binary STL.
Render and Export STL stay in the top menu.

The left icon toolbar selects 3D or 2D code tools and opens the documentation
browser. Tool buttons are currently disabled placeholders. Toolbar sections have
visible separators, and the tool section changes with the selected mode. The
right toolbar's expand button hides or restores the editor without entering
browser fullscreen. Editor contents, the camera, and the selected documentation
page are preserved when switching views.

The book button in the left toolbar switches the right pane between the model
and searchable libcompass API documentation, preserving both views' state.
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
`Sketch`, `Point`, `Circle`, `extrude`, etc.), gl-matrix exports (`mat4`, `vec3`,
etc.) are available by name without imports. `scene` is a fresh
libcompass `Node` in each evaluation's global scope. Add child nodes with `add`:

```js
const sketch = new Sketch().add(new Circle(new Point(0, 0), 20));
const solid = extrude(sketch, [0, 0, 10]);
scene.add(solid);
```

Solids are memoized scene graph nodes and can be added directly to scenes,
`Transform`, and `TransformMat4` nodes. Call `refresh()` on affected memoized
nodes and cached ancestors after changing their children.
`add(...children)` and `remove(...children)` return the node for chaining;
removal takes child objects, not indices.
Removal deletes all occurrences of the supplied objects and ignores absent ones.

Render (or Ctrl/Cmd+Enter in the editor) evaluates the source and replaces the
preview. Syntax, runtime, and invalid triangle data errors appear below the two
panes and leave the previous model intact. Export STL downloads `compass.stl`
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
