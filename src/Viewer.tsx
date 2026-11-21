import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FiDownload } from "react-icons/fi";
import type { RenderedMesh, RenderedScene } from "./cad.ts";
import { createPreviewMeshes, disposePreviewMeshes, pickPreviewMesh, setPreviewMeshHovered, type PreviewMesh } from "./preview-meshes.ts";
import { useCadStore } from "./store.ts";

export default function Viewer({ orthographic }: { orthographic: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const canvasMount = useRef<HTMLDivElement>(null);
  const setProjection = useRef<((orthographic: boolean) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ part: RenderedMesh; x: number; y: number } | null>(null);
  const menuElement = useRef<HTMLDivElement>(null);
  const menuOpen = useRef(false);
  const closeMenu = useCallback(() => {
    if (!menuOpen.current) return;
    menuOpen.current = false;
    setMenu(null);
  }, []);

  useEffect(() => {
    if (!menu) return;
    menuElement.current?.querySelector("button")?.focus({ preventScroll: true });
    const dismissOutside = (event: Event) => {
      if (!menuElement.current?.contains(event.target as Node)) closeMenu();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        container.current?.querySelector("canvas")?.focus({ preventScroll: true });
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        menuElement.current?.querySelector("button")?.focus();
      }
    };
    window.addEventListener("pointerdown", dismissOutside, true);
    window.addEventListener("focusin", dismissOutside);
    window.addEventListener("wheel", closeMenu, true);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("keydown", keyDown);
    return () => {
      window.removeEventListener("pointerdown", dismissOutside, true);
      window.removeEventListener("focusin", dismissOutside);
      window.removeEventListener("wheel", closeMenu, true);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("keydown", keyDown);
    };
  }, [menu, closeMenu]);

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
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "3D model view");
    canvasMount.current!.appendChild(renderer.domElement);

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
    let pointerInside = false;
    let hoverDirty = true;
    let shiftHeld = false;
    let altHeld = false;
    const resetPointer = () => { pointerTracked = false; };
    const resetInput = () => {
      resetPointer();
      pointerInside = false;
      shiftHeld = false;
      altHeld = false;
      closeMenu();
    };
    const leavePointer = () => { resetPointer(); pointerInside = false; };
    const trackModifiers = (event: KeyboardEvent) => {
      shiftHeld = event.shiftKey;
      altHeld = event.altKey;
      hoverDirty = true;
      // Keep Alt from transferring focus to the browser menu while navigating.
      if (event.key === "Alt" && pointerTracked) event.preventDefault();
    };
    const movePointer = (event: MouseEvent) => {
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      const tracked = pointerTracked;
      pointer.set(event.clientX, event.clientY);
      pointerTracked = true;
      pointerInside = true;
      hoverDirty = true;
      if (!tracked || event.buttons !== 0 || !controls.enabled || menuOpen.current) return;
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
    renderer.domElement.addEventListener("mouseleave", leavePointer);
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
      const halfFovRAD = THREE.MathUtils.degToRad(perspective.fov / 2);
      next.position.copy(camera.position);
      next.quaternion.copy(camera.quaternion);
      next.up.copy(camera.up);
      next.near = camera.near;
      next.far = camera.far;
      if (orthographic) {
        // Match the perspective view's scale at the orbit target.
        halfHeight = camera.position.distanceTo(controls.target) * Math.tan(halfFovRAD);
        parallel.zoom = 1;
      } else {
        const distance = halfHeight / parallel.zoom / Math.tan(halfFovRAD);
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
    let model = new THREE.Group();
    scene.add(model);
    const raycaster = new THREE.Raycaster(), rayPointer = new THREE.Vector2();
    let hovered: PreviewMesh | undefined;
    let navigating = false;
    let rightPress: { x: number; y: number; dragged: boolean } | undefined;
    const setHovered = (mesh?: PreviewMesh) => {
      if (hovered === mesh) return;
      if (hovered) setPreviewMeshHovered(hovered, false);
      hovered = mesh;
      if (hovered) setPreviewMeshHovered(hovered, true);
      renderer.domElement.style.cursor = hovered ? "pointer" : "";
    };
    const pick = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
      rayPointer.set((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(rayPointer, camera);
      return pickPreviewMesh(model, raycaster);
    };
    const openMenu = (clientX: number, clientY: number) => {
      const mesh = pick(clientX, clientY);
      setHovered(mesh);
      if (!mesh) { closeMenu(); return; }
      const rect = host.getBoundingClientRect();
      menuOpen.current = true;
      setMenu({ part: mesh.userData.part as RenderedMesh,
        x: Math.max(8, Math.min(clientX - rect.left, rect.width - 232)),
        y: Math.max(8, Math.min(clientY - rect.top, rect.height - 96)),
      });
    };
    const pointerDown = (event: PointerEvent) => {
      pointer.set(event.clientX, event.clientY); pointerInside = true; hoverDirty = true;
      rightPress = event.button === 2 ? { x: event.clientX, y: event.clientY, dragged: false } : undefined;
    };
    const pointerMove = (event: PointerEvent) => {
      if (!event.buttons) rightPress = undefined;
      if (rightPress && Math.hypot(event.clientX - rightPress.x, event.clientY - rightPress.y) > 4) {
        rightPress.dragged = true;
        closeMenu();
      }
    };
    const pointerCancel = () => { rightPress = undefined; };
    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
      // Use the browser's menu request directly, including trackpad and keyboard requests.
      // Retain the drag flag through release: some browsers request the menu afterward.
      if (event.button === 2 && rightPress?.dragged) return;
      guard(() => {
        const rect = renderer.domElement.getBoundingClientRect();
        const keyboard = event.clientX === 0 && event.clientY === 0;
        openMenu(
          keyboard ? (pointerInside ? pointer.x : rect.left + rect.width / 2) : event.clientX,
          keyboard ? (pointerInside ? pointer.y : rect.top + rect.height / 2) : event.clientY,
        );
      });
    };
    const navigationStart = () => { navigating = true; closeMenu(); setHovered(); };
    const navigationEnd = () => { navigating = false; hoverDirty = true; };
    const cameraChanged = () => { hoverDirty = true; };
    controls.addEventListener("start", navigationStart);
    controls.addEventListener("end", navigationEnd);
    controls.addEventListener("change", cameraChanged);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("contextmenu", contextMenu);
    window.addEventListener("pointercancel", pointerCancel);

    const update = (rendered: RenderedScene) => {
      const next = createPreviewMeshes(rendered.meshes);
      closeMenu();
      setHovered();
      hoverDirty = true;
      scene.remove(model);
      disposePreviewMeshes(model);
      model = next;
      scene.add(model);
      if (!rendered.positions.length) return;
      const bounds = new THREE.Box3().setFromArray(rendered.positions);
      const center = bounds.getCenter(new THREE.Vector3()), point = new THREE.Vector3();
      let radiusSquared = 0;
      for (let i = 0; i < rendered.positions.length; i += 3) {
        radiusSquared = Math.max(radiusSquared, point.fromArray(rendered.positions, i).distanceToSquared(center));
      }
      const radius = Math.sqrt(radiusSquared);
      const size = Math.max(radius, 1);
      const halfFovRAD = THREE.MathUtils.degToRad(perspective.fov / 2);
      const distance = size / Math.sin(Math.atan(Math.tan(halfFovRAD) * Math.min(perspective.aspect, 1))) * 1.25;
      camera.near = size / 1000;
      camera.far = Math.max(size * 100, distance * 10);
      halfHeight = distance * Math.tan(halfFovRAD);
      parallel.zoom = 1;
      updateProjection();
      camera.position.copy(center).add(new THREE.Vector3(1.3, -1.7, 1.3).normalize().multiplyScalar(distance));
      controls.target.copy(center);
      controls.update();
      grid.position.set(center.x, center.y, bounds.min.z - size / 500);
      grid.scale.setScalar(size * 4 / 200);
    };

    const resize = () => guard(() => {
      closeMenu();
      hoverDirty = true;
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(Math.max(width, 1), Math.max(height, 1));
      perspective.aspect = Math.max(width, 1) / Math.max(height, 1);
      updateProjection();
    });
    const renderFrame = () => guard(() => {
      controls.update();
      if (!menuOpen.current) {
        if (!pointerInside || navigating || shiftHeld || altHeld) setHovered();
        else if (hoverDirty) { setHovered(pick(pointer.x, pointer.y)); hoverDirty = false; }
      }
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
      renderer.domElement.removeEventListener("mouseleave", leavePointer);
      renderer.domElement.removeEventListener("mousedown", resetPointer);
      renderer.domElement.removeEventListener("mouseup", resetPointer);
      window.removeEventListener("keydown", trackModifiers, true);
      window.removeEventListener("keyup", trackModifiers, true);
      window.removeEventListener("blur", resetInput);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("contextmenu", contextMenu);
      window.removeEventListener("pointercancel", pointerCancel);
      controls.removeEventListener("start", navigationStart);
      controls.removeEventListener("end", navigationEnd);
      controls.removeEventListener("change", cameraChanged);
      controls.dispose();
      disposePreviewMeshes(model);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [closeMenu]);

  useEffect(() => {
    setProjection.current?.(orthographic);
  }, [orthographic]);

  return <div className="viewer-container" ref={container}>
    <div className="viewer-canvas" ref={canvasMount} />
    {error && <p className="viewer-error" role="alert">{error}</p>}
    {menu && <div className="mesh-context-menu" ref={menuElement} role="menu" aria-label="Mesh actions"
      style={{ left: menu.x, top: menu.y }} onContextMenu={event => event.preventDefault()}>
      <div className="mesh-context-name" title={menu.part.name || "Model"}>
        <span className="mesh-context-color" style={{ backgroundColor: menu.part.color }} aria-hidden="true" />
        <span className="mesh-context-label">{menu.part.name || "Model"}</span>
      </div>
      <button type="button" role="menuitem" aria-label="Export mesh as STL" onClick={() => {
        useCadStore.getState().exportStl(menu.part);
        closeMenu();
        container.current?.querySelector("canvas")?.focus({ preventScroll: true });
      }}><FiDownload aria-hidden="true" />Export STL</button>
    </div>}
  </div>;
}
