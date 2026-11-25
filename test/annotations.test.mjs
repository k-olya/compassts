import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Color, Mesh } from 'three';
import { colors } from 'libcompass';
import { evaluateCode, exportBinaryStl } from '../src/cad.ts';
import { createPreviewMeshes, disposePreviewMeshes } from '../src/preview-meshes.ts';

const triangleClass = `class Triangle extends Memo {
  calls = 0;
  constructor(z = 0) { super(); this.z = z; }
  triangulateUncached() { this.calls++; return new Float32Array([0, 0, this.z, 1, 0, this.z, 0, 1, this.z]); }
}`;
const triangles = positions => Array.from({ length: positions.length / 9 }, (_, i) => Array.from(positions.subarray(i * 9, i * 9 + 9)).join(',')).sort();
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);

test('script annotations become separate preview meshes while plain geometry retains its default material', () => {
  const result = evaluateCode(`
const part = sketch().add(rectangle({ center, corner2: { x: 1, y: 1 } })).extrude({ length: 2 });
scene.add(part.displace({ vector: [-5, 0, 0] }));
scene.add(annotate({ node: part, name: 'Blue', color: '#2288ee', alpha: 0.4 }));
scene.add(part.displace({ vector: [5, 0, 0] }).annotate({ name: 'Red', color: 'red', alpha: 1 }));
`);
  assert.deepEqual(result.meshes.map(({ name, color, alpha }) => [name, color, alpha]), [
    ['', colors.default, 1], ['Blue', '#2288ee', 0.4], ['Red', colors.red, 1],
  ]);
  assert.deepEqual(result.meshes.map(mesh => mesh.annotated), [false, true, true]);
  assert.deepEqual(triangles(new Float32Array(result.meshes.flatMap(mesh => [...mesh.positions]))), triangles(result.positions));
  const preview = createPreviewMeshes(result.meshes);
  try {
    assert.equal(preview.children.length, 3);
    preview.children.forEach((mesh, i) => {
      const part = result.meshes[i];
      assert.ok(mesh instanceof Mesh);
      assert.equal(mesh.name, part.name);
      assert.deepEqual(mesh.geometry.attributes.position.array, part.positions);
      assert.equal(mesh.material.color.getHex(), new Color(part.color).getHex());
      assert.equal(mesh.material.opacity, part.alpha);
      assert.equal(mesh.material.transparent, part.alpha < 1);
      assert.equal(mesh.material.depthWrite, part.alpha === 1);
      assert.equal(mesh.children[0].material.opacity, 0.55 * part.alpha);
    });
  } finally { disposePreviewMeshes(preview); }
});

test('nested annotations and repeated references preserve transformed coordinates without duplicate triangles', () => {
  const result = evaluateCode(`${triangleClass}
const child = new Triangle();
const shared = annotatedNode({ name: 'Shared', color: 'blue' }).add(child);
const shifted = new Transform(); shifted.position.x = 3; shifted.add(shared);
const outer = new AnnotatedNode({ name: 'Outer', color: 'red', alpha: 0.3 }).add(
  new Triangle(1), shifted, new Triangle(2), shared,
  annotatedNode({ name: 'Invisible', color: '#00ff00', alpha: 0 }).add(new Triangle(3)),
);
const transform = new Transform();
transform.position.x = 10; transform.rotation.z = 90; transform.scale = { x: 2, y: 2, z: 2 };
transform.add(outer);
scene.add(transform);
`);
  const [outer, first, second, invisible] = result.meshes;
  assert.deepEqual(result.meshes.map(mesh => mesh.name), ['Outer', 'Shared', 'Shared', 'Invisible']);
  assert.deepEqual(result.meshes.map(mesh => mesh.alpha), [0.3, 1, 1, 0]);
  assert.equal(outer.positions.length, 18);
  close(first.positions[0], 10); close(first.positions[1], 6);
  close(second.positions[0], 10); close(second.positions[1], 0);
  close(invisible.positions[2], 6);
  assert.equal(result.positions.length, 45);
  assert.deepEqual(triangles(new Float32Array(result.meshes.flatMap(mesh => [...mesh.positions]))), triangles(result.positions));
  const shared = result.scene.children[0].children[0].children[3];
  assert.equal(shared.children[0].calls, 1);
  assert.deepEqual(shared.triangulate(), new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]));
  const data = new DataView(exportBinaryStl(result.positions));
  assert.equal(data.getUint32(80, true), 5, 'Even invisible geometry is exported, exactly once per occurrence');
  for (let triangle = 0; triangle < 5; triangle++) for (let i = 0; i < 9; i++) {
    assert.equal(data.getFloat32(84 + triangle * 50 + 12 + 4 * i, true), result.positions[triangle * 9 + i]);
  }
});

test('solid-owned triangles stay in the parent annotation and nested child geometry gets its own mesh', () => {
  const result = evaluateCode(`
const parent = sketch().add(rectangle({ center, corner2: { x: 1, y: 1 } })).extrude({ length: 2 });
const child = parent.displace({ vector: [0, 0, 4] });
const original = parent.triangulate();
parent.add(child.annotate({ name: 'Child', color: '#0088ff' })); parent.refresh();
scene.add(parent.annotate({ name: 'Parent', color: '#ff8800' }));
`);
  assert.deepEqual(result.meshes.map(mesh => mesh.name), ['Parent', 'Child']);
  assert.equal(result.meshes[0].positions.length, result.meshes[1].positions.length);
  assert.deepEqual(triangles(new Float32Array(result.meshes.flatMap(mesh => [...mesh.positions]))), triangles(result.positions));
});

test('empty annotations are harmless and plain memo scenes keep their existing cache semantics', () => {
  assert.deepEqual(evaluateCode('scene.add(annotatedNode({ name: "Empty" }));').meshes, []);
  const result = evaluateCode(`${triangleClass}
const group = memo().add(new Triangle());
group.triangulate(); group.add(new Triangle(1));
scene.add(group);
`);
  assert.equal(result.meshes.length, 1);
  assert.equal(result.meshes[0].annotated, false);
  assert.equal(result.positions.length, 9);
  assert.deepEqual(result.meshes[0].positions, result.positions);
});

test('replacement cleanup releases every per-mesh geometry, edge geometry, and material', () => {
  const result = evaluateCode(`${triangleClass}
scene.add(annotatedNode({ color: 'red' }).add(new Triangle()), annotatedNode({ color: 'blue', alpha: 0.5 }).add(new Triangle(1)));
`);
  const preview = createPreviewMeshes(result.meshes), disposals = new Map();
  preview.traverse(object => {
    if (!object.geometry) return;
    for (const resource of [object.geometry, object.material]) {
      disposals.set(resource, 0);
      resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1));
    }
  });
  disposePreviewMeshes(preview);
  assert.equal(disposals.size, 8);
  assert.ok([...disposals.values()].every(count => count === 1));
});

test('palette names, constants, and automatic defaults reach actual preview mesh materials', () => {
  const result = evaluateCode(`
const part = sketch().add(rectangle({ center, corner2: { x: 1, y: 1 } })).extrude({ length: 2 });
for (const name of Object.keys(colors)) scene.add(part.annotate({ color: name }));
scene.add(annotate({ node: part }));
scene.add(part.annotate({ color: colors.blue }));
`);
  assert.equal(result.meshes.length, 18);
  const firstNumber = Number(result.meshes[0].name.slice(4));
  assert.deepEqual(result.meshes.map(mesh => mesh.name), Array.from({ length: 18 }, (_, i) => `mesh${firstNumber + i}`));
  assert.ok(result.meshes.every(mesh => mesh.alpha === 1));
  assert.deepEqual(result.meshes.slice(0, 16).map(mesh => mesh.color), Object.values(colors));
  assert.equal(result.meshes[16].color, colors.default);
  assert.equal(result.meshes[17].color, colors.blue);
  const preview = createPreviewMeshes(result.meshes);
  try {
    for (let i = 0; i < result.meshes.length; i++) {
      assert.equal(preview.children[i].name, result.meshes[i].name);
      assert.equal(preview.children[i].material.color.getHex(), new Color(result.meshes[i].color).getHex());
      assert.equal(preview.children[i].material.opacity, 1);
      assert.equal(preview.children[i].material.transparent, false);
    }
  } finally { disposePreviewMeshes(preview); }
  assert.throws(() => evaluateCode('scene.add(annotatedNode({ color: 0xff0000 }));'), /palette name/);
  assert.throws(() => evaluateCode('scene.add(annotatedNode({ color: "rebeccapurple" }));'), /palette name/);
});
