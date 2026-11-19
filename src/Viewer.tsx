import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createGeometry, type RenderedScene } from "./cad.ts";
import { useCadStore } from "./store.ts";

export default function Viewer({ orthographic }: { orthographic: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const setProjection = useRef<((orthographic: boolean) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = container.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (error) {
      useCadStore.getState().reportRendererError(error);
      setError(error instanceof Error ? error.message : "WebGL is unavailable.");
      return;
    }
    let failed = false;
    const reportError = (error: unknown) => {
      if (failed) return;
      failed = true;
      renderer.setAnimationLoop(null);
      useCadStore.getState().reportRendererError(error);
      setError(error instanceof Error ? error.message || error.name : String(error));
    };
    const guard = (action: () => void) => {
      if (failed) return;
      try { action(); } catch (error) { reportError(error); }
    };
    const contextLost = () => reportError(new Error("WebGL context lost. Reload to restore the 3D preview."));
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#131b24");
    const perspective = new THREE.PerspectiveCamera(42, 1, 0.1, 10000);
    const parallel = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspective;
    let halfHeight = 1;
    camera.up.set(0, 0, 1);
    camera.position.set(150, -200, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const pointer = new THREE.Vector2();
    const offset = new THREE.Vector3();
    const translation = new THREE.Vector3();
    const screenUp = new THREE.Vector3();
    const spherical = new THREE.Spherical();
    const toYUp = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
    const fromYUp = toYUp.clone().invert();
    let pointerTracked = false;
    let shiftHeld = false;
    let altHeld = false;
    const resetPointer = () => { pointerTracked = false; };
    const resetInput = () => {
      resetPointer();
      shiftHeld = false;
      altHeld = false;
    };
    const trackModifiers = (event: KeyboardEvent) => {
      shiftHeld = event.shiftKey;
      altHeld = event.altKey;
      // Keep Alt from transferring focus to the browser menu while navigating.
      if (event.key === "Alt" && pointerTracked) event.preventDefault();
    };
    const movePointer = (event: MouseEvent) => {
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      const tracked = pointerTracked;
      pointer.set(event.clientX, event.clientY);
      pointerTracked = true;
      if (!tracked || event.buttons !== 0 || !controls.enabled) return;
      const height = Math.max(renderer.domElement.clientHeight, 1);
      if ((event.shiftKey || shiftHeld) && controls.enablePan) {
        const scale = camera instanceof THREE.PerspectiveCamera
          ? 2 * camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height
          : (camera.top - camera.bottom) / camera.zoom / height;
        camera.updateMatrix();
        translation.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * scale * controls.panSpeed);
        screenUp.setFromMatrixColumn(camera.matrix, 1);
        translation.addScaledVector(screenUp, dy * scale * controls.panSpeed);
        camera.position.add(translation);
        controls.target.add(translation);
      } else if ((event.altKey || altHeld) && controls.enableRotate) {
        offset.copy(camera.position).sub(controls.target).applyQuaternion(toYUp);
        spherical.setFromVector3(offset);
        spherical.theta -= 2 * Math.PI * dx * controls.rotateSpeed / height;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi - 2 * Math.PI * dy * controls.rotateSpeed / height, controls.minPolarAngle, controls.maxPolarAngle);
        spherical.makeSafe();
        offset.setFromSpherical(spherical).applyQuaternion(fromYUp);
        camera.position.copy(controls.target).add(offset);
      } else {
        return;
      }
      event.preventDefault();
      controls.update();
    };
    renderer.domElement.addEventListener("mousemove", movePointer);
    renderer.domElement.addEventListener("mouseleave", resetPointer);
    renderer.domElement.addEventListener("mousedown", resetPointer);
    renderer.domElement.addEventListener("mouseup", resetPointer);
    window.addEventListener("keydown", trackModifiers, true);
    window.addEventListener("keyup", trackModifiers, true);
    window.addEventListener("blur", resetInput);

    const updateProjection = () => {
      perspective.updateProjectionMatrix();
      parallel.left = -halfHeight * perspective.aspect;
      parallel.right = halfHeight * perspective.aspect;
      parallel.top = halfHeight;
      parallel.bottom = -halfHeight;
      parallel.updateProjectionMatrix();
    };
    setProjection.current = (orthographic) => guard(() => {
      const next = orthographic ? parallel : perspective;
      if (next === camera) return;
      const halfFov = THREE.MathUtils.degToRad(perspective.fov / 2);
      next.position.copy(camera.position);
      next.quaternion.copy(camera.quaternion);
      next.up.copy(camera.up);
      next.near = camera.near;
      next.far = camera.far;
      if (orthographic) {
        // Match the perspective view's scale at the orbit target.
        halfHeight = camera.position.distanceTo(controls.target) * Math.tan(halfFov);
        parallel.zoom = 1;
      } else {
        const distance = halfHeight / parallel.zoom / Math.tan(halfFov);
        next.position.sub(controls.target).setLength(distance).add(controls.target);
      }
      camera = next;
      controls.object = camera;
      updateProjection();
      controls.update();
    });

    scene.add(new THREE.HemisphereLight(0xdbeaff, 0x626058, 2));
    const light = new THREE.DirectionalLight(0xfff1d8, 3);
    light.position.set(60, -80, 150);
    scene.add(light);

    const grid = new THREE.GridHelper(200, 20, 0x495561, 0x2b3743);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);
    const material = new THREE.MeshStandardMaterial({ color: 0xd2a568, roughness: 0.4, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const linesMaterial = new THREE.LineBasicMaterial({ color: 0x362918, transparent: true, opacity: 0.55 });
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(), linesMaterial);
    scene.add(mesh, lines);

    const update = (rendered: RenderedScene) => {
      const geometry = createGeometry(rendered.positions);
      let edges: THREE.EdgesGeometry;
      try { edges = new THREE.EdgesGeometry(geometry, 30); }
      catch (error) { geometry.dispose(); throw error; }
      mesh.geometry.dispose();
      lines.geometry.dispose();
      mesh.geometry = geometry;
      lines.geometry = edges;
      if (!rendered.positions.length) return;
      mesh.geometry.computeBoundingSphere();
      mesh.geometry.computeBoundingBox();
      const { center, radius } = mesh.geometry.boundingSphere!;
      const size = Math.max(radius, 1);
      const halfFov = THREE.MathUtils.degToRad(perspective.fov / 2);
      const distance = size / Math.sin(Math.atan(Math.tan(halfFov) * Math.min(perspective.aspect, 1))) * 1.25;
      camera.near = size / 1000;
      camera.far = Math.max(size * 100, distance * 10);
      halfHeight = distance * Math.tan(halfFov);
      parallel.zoom = 1;
      updateProjection();
      camera.position.copy(center).add(new THREE.Vector3(1.3, -1.7, 1.3).normalize().multiplyScalar(distance));
      controls.target.copy(center);
      controls.update();
      grid.position.set(center.x, center.y, mesh.geometry.boundingBox!.min.z - size / 500);
      grid.scale.setScalar(size * 4 / 200);
    };

    const resize = () => guard(() => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(Math.max(width, 1), Math.max(height, 1));
      perspective.aspect = Math.max(width, 1) / Math.max(height, 1);
      updateProjection();
    });
    const renderFrame = () => guard(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    const updatePreview = (rendered: RenderedScene) => {
      failed = false;
      setError(null);
      guard(() => update(rendered));
      if (!failed) renderer.setAnimationLoop(renderFrame);
    };
    resize();
    if (!failed) updatePreview(useCadStore.getState().rendered);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const unsubscribe = useCadStore.subscribe((state, previous) => {
      if (state.rendered !== previous.rendered) updatePreview(state.rendered);
    });

    return () => {
      setProjection.current = null;
      unsubscribe();
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.domElement.removeEventListener("mousemove", movePointer);
      renderer.domElement.removeEventListener("mouseleave", resetPointer);
      renderer.domElement.removeEventListener("mousedown", resetPointer);
      renderer.domElement.removeEventListener("mouseup", resetPointer);
      window.removeEventListener("keydown", trackModifiers, true);
      window.removeEventListener("keyup", trackModifiers, true);
      window.removeEventListener("blur", resetInput);
      controls.dispose();
      mesh.geometry.dispose();
      lines.geometry.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      material.dispose();
      linesMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    setProjection.current?.(orthographic);
  }, [orthographic]);

  return <div className="viewer-container" ref={container}>{error && <p className="viewer-error" role="alert">{error}</p>}</div>;
}
