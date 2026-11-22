import assert from 'node:assert/strict';
import test from 'node:test';
import { Solid, measure, setTriangulationResolution, TRIANGULATION_RESOLUTION } from 'libcompass';
import { PRIMITIVES_CODE } from '../src/primitives-example.ts';
import { useCadStore } from '../src/store.ts';

// Supply the app's library bindings when running the example module in Node.
const library = import.meta.resolve('libcompass');
const source = `import { circle, ellipse, rectangle, sketch, XY, center } from ${JSON.stringify(library)};\n${PRIMITIVES_CODE}`;
const primitives = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const near = (actual, expected, tolerance = 0.015) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);

test('the default project contains an editable, importable primitives.js with all five exports', () => {
  const file = useCadStore.getState().files.find(file => file.name === 'primitives.js');
  assert.equal(file.source, PRIMITIVES_CODE);
  assert.equal(file.url, undefined);
  assert.deepEqual(Object.keys(primitives).sort(), ['cuboid', 'cylinder', 'cylinderElliptic', 'sphere', 'torus'].sort());
});

test('primitives have centered bounds, expected volumes and mathematical surfaces', t => {
  const resolution = TRIANGULATION_RESOLUTION;
  t.after(() => setTriangulationResolution(resolution));
  setTriangulationResolution(0.01);
  const cases = [
    [primitives.cuboid({ width: 2, depth: 4, height: 6 }), [2, 4, 6], 48],
    [primitives.cylinder({ radius: 2, height: 6 }), [4, 4, 6], Math.PI * 4 * 6],
    [primitives.cylinderElliptic({ radiusX: 2, radiusY: 3, height: 6 }), [4, 6, 6], Math.PI * 2 * 3 * 6],
    [primitives.sphere({ radius: 2 }), [4, 4, 4], 4 / 3 * Math.PI * 8],
    [primitives.torus({ majorRadius: 3, minorRadius: 1 }), [8, 8, 2], 2 * Math.PI ** 2 * 3],
  ];
  for (const [part, sizes, volume] of cases) {
    assert.ok(part instanceof Solid);
    const result = measure({ object: part, log: () => {} });
    sizes.forEach((size, i) => {
      near(result.boundingBox.size[i], size);
      near(result.boundingBox.min[i], -size / 2);
      near(result.boundingBox.max[i], size / 2);
    });
    near(result.volume, volume);
    assert.ok(part.triangulate().length > 0);
    assert.equal(part.children.length, 0);
  }
  const sphere = cases[3][0], torus = cases[4][0];
  for (const [part, equation] of [
    [sphere, ([x,y,z]) => x*x+y*y+z*z-4],
    [torus, ([x,y,z]) => (Math.hypot(x,y)-3)**2+z*z-1],
  ]) for (const surface of part.surfaces) for (const u of [0.1, 0.35, 0.7]) for (const v of [0.1, 0.4, 0.8]) {
    near(equation(surface.at(u,v).position), 0, 1e-8);
  }
});

test('primitive defaults work', () => {
  for (const [name, create] of Object.entries(primitives)) assert.ok(create() instanceof Solid, name);
});
