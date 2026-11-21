import { EdgesGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, type BufferGeometry, type Raycaster } from "three";
import { createGeometry, type RenderedMesh } from "./cad.ts";

export type PreviewMesh = Mesh<BufferGeometry, MeshStandardMaterial>;
const edgeColor = 0x362918;

/** Build one named material-bearing mesh per annotation, plus unannotated geometry. */
export function createPreviewMeshes(parts: readonly RenderedMesh[]): Group {
  const group = new Group();
  try {
    for (const part of parts) {
      const mesh = new Mesh(createGeometry(part.positions), new MeshStandardMaterial({
        color: part.color, opacity: part.alpha, transparent: part.alpha < 1, depthWrite: part.alpha === 1,
        roughness: 0.4, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      }));
      mesh.name = part.name;
      mesh.userData.part = part;
      group.add(mesh);
      const lines = new LineSegments(new EdgesGeometry(mesh.geometry, 30), new LineBasicMaterial({
        color: edgeColor, transparent: true, opacity: 0.55 * part.alpha, depthWrite: false,
      }));
      mesh.add(lines);
    }
    return group;
  } catch (error) {
    disposePreviewMeshes(group);
    throw error;
  }
}

/** Pick annotated faces; unannotated geometry still occludes meshes behind it. */
export function pickPreviewMesh(model: Group, raycaster: Raycaster): PreviewMesh | undefined {
  model.updateMatrixWorld(true);
  for (const hit of raycaster.intersectObjects(model.children, false)) {
    const mesh = hit.object;
    if (mesh instanceof Mesh && mesh.visible && mesh.material instanceof MeshStandardMaterial && mesh.material.opacity > 0) {
      return mesh.userData.part.annotated ? mesh : undefined;
    }
  }
}

/** Highlight the preview material without changing annotation color, opacity, or positions. */
export function setPreviewMeshHovered(mesh: PreviewMesh, hovered: boolean): void {
  mesh.material.emissive.setHex(hovered ? 0xe7b874 : 0);
  mesh.material.emissiveIntensity = hovered ? 0.2 : 1;
  for (const child of mesh.children) if (child instanceof LineSegments && child.material instanceof LineBasicMaterial) {
    child.material.color.setHex(hovered ? 0xf0c486 : edgeColor);
  }
}

/** Release GPU resources when a render is replaced or the viewer unmounts. */
export function disposePreviewMeshes(group: Group): void {
  group.traverse(object => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    }
  });
}
