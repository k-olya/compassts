import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrthographicCamera, PerspectiveCamera, Raycaster, Vector2 } from 'three';
import { createPreviewMeshes, disposePreviewMeshes, pickPreviewMesh, setPreviewMeshHovered } from '../src/preview-meshes.ts';

const part = (name, z, alpha = 1, annotated = true) => ({ name, alpha, annotated, color: '#5599dd', positions: new Float32Array([-1, -1, z, 1, -1, z, 0, 1, z]) });

test('unannotated meshes cannot be picked and occlude annotated geometry behind them', () => {
  const plain = part('', 1, 1, false), annotated = part('', 0);
  const model = createPreviewMeshes([plain, annotated]), raycaster = new Raycaster();
  try {
    for (const camera of [new PerspectiveCamera(45, 1, 0.1, 100), new OrthographicCamera(-2, 2, 2, -2, 0.1, 100)]) {
      camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      raycaster.setFromCamera(new Vector2(0, 0), camera);
      assert.equal(pickPreviewMesh(model, raycaster), undefined);
      model.children[0].visible = false;
      assert.equal(pickPreviewMesh(model, raycaster), model.children[1], 'Empty annotation names remain interactive');
      model.children[0].visible = true;
    }
  } finally { disposePreviewMeshes(model); }
});

test('picking uses the closest visible mesh and skips invisible meshes and edge overlays for both cameras', () => {
  const parts = [part('Back', 0), part('Translucent', 1, 0.3), part('Invisible', 2, 0)];
  const model = createPreviewMeshes(parts), raycaster = new Raycaster();
  try {
    for (const camera of [new PerspectiveCamera(45, 1, 0.1, 100), new OrthographicCamera(-2, 2, 2, -2, 0.1, 100)]) {
      camera.position.set(0, 0, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      raycaster.setFromCamera(new Vector2(0, 0), camera);
      const picked = pickPreviewMesh(model, raycaster);
      assert.equal(picked, model.children[1]);
      assert.equal(picked.userData.part, parts[1]);
      picked.visible = false;
      assert.equal(pickPreviewMesh(model, raycaster), model.children[0]);
      picked.visible = true;
      raycaster.setFromCamera(new Vector2(10, 10), camera);
      assert.equal(pickPreviewMesh(model, raycaster), undefined);
    }
  } finally { disposePreviewMeshes(model); }
});

test('hover changes lighting and outlines while retaining the original color, opacity and export positions', () => {
  const data = part('Part', 0, 0.4), model = createPreviewMeshes([data]), mesh = model.children[0];
  try {
    const color = mesh.material.color.getHex(), bytes = data.positions.slice();
    setPreviewMeshHovered(mesh, true);
    assert.notEqual(mesh.material.emissive.getHex(), 0);
    assert.equal(mesh.children[0].material.color.getHex(), 0xf0c486);
    assert.equal(mesh.material.opacity, 0.4);
    assert.equal(mesh.material.color.getHex(), color);
    assert.deepEqual(mesh.userData.part.positions, bytes);
    assert.equal(mesh.geometry.attributes.position.array, data.positions);
    setPreviewMeshHovered(mesh, false);
    assert.equal(mesh.material.emissive.getHex(), 0);
    assert.equal(mesh.material.emissiveIntensity, 1);
    assert.equal(mesh.children[0].material.color.getHex(), 0x362918);
    assert.equal(mesh.material.opacity, 0.4);
  } finally { disposePreviewMeshes(model); }
});
