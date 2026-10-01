import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
import { GaussianSplattingStream } from '@babylonjs/loaders/SPLAT/gaussianSplattingStream.js';
import { MANIFEST_URL, POI_FLOOR_Y, START, STREAM_OPTIONS, TARGET } from './config.js';
import { fetchManifest, replaceStream } from './sog.js';
import { createOverlay } from './ui.js';
import { attachDesktopControls, isEditorFieldFocused } from './desktop.js';
import { WebXRDefaultExperience } from '@babylonjs/core/XR/webXRDefaultExperience.js';
import { WebXRManagedOutputCanvasOptions } from '@babylonjs/core/XR/webXRManagedOutputCanvas.js';
import { WebXRState } from '@babylonjs/core/XR/webXRTypes.js';
import { attachXrMovement, prepareStereoSplatSort, syncStereoSplatIndexBuffers } from './xr.js';
import { XR_FIXED_FOVEATION, XR_FRAMEBUFFER_SCALE, XR_SPLAT_BUDGET } from './config.js';
import poiJson from './pois/ronda.json';
import { loadPoiManifest, tryResolvePois, xrStandingBody, PoiTracker, type Poi, type PoiManifestV1 } from './pois.js';
import { MediaPlayer } from './media.js';
import { PoiScene } from './poiScene.js';
import { selectMediaFromRay } from './poiInput.js';
import { createPoiDraft, createPlacementEditor } from './poiEditor.js';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const overlay = createOverlay(document.querySelector<HTMLElement>('#overlay')!);
let engine: Engine;
try {
  engine = new Engine(canvas, true, { stencil: true });
  if (engine.webGLVersion < 2) throw new Error('WebGL2 is required for this viewer.');
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  overlay.setError(`WebGL2 is required for this viewer. ${detail}`, false);
  throw error;
}

const scene = new Scene(engine);
scene.clearColor = new Color4(0.08, 0.11, 0.1, 1);
const camera = new UniversalCamera('walk-camera', new Vector3(START.x, START.y, START.z), scene);
camera.setTarget(new Vector3(TARGET.x, TARGET.y, TARGET.z));
camera.minZ = 0.05;
camera.maxZ = 500;
scene.activeCamera = camera;
const loadedPois = loadPoiManifest(poiJson, MANIFEST_URL);
const poiManifest: PoiManifestV1 = loadedPois.manifest;
if (loadedPois.warning) console.warn(loadedPois.warning);
const draft = createPoiDraft(poiManifest);
const editorRequested = new URLSearchParams(location.search).get('poiEditor') === '1';
let editorVisible = editorRequested;
let hostMatrix = Matrix.Scaling(1, -1, 1);
let tracker: PoiTracker | null = null;
let livePois: Poi[] = [];
const media = new MediaPlayer();
const poiScene = new PoiScene(scene);
media.subscribe(status => poiScene.setMediaStatus(status));
const editorRoot = document.querySelector<HTMLElement>('#overlay')!;
let editorPanel: HTMLElement | null = null;
if (editorRequested) {
  createPlacementEditor(editorRoot, draft, {
    hostMatrix: () => hostMatrix,
    bodyWorld: () => new Vector3(camera.position.x, POI_FLOOR_Y, camera.position.z),
    headPose: () => ({ position: camera.position.clone(), forward: camera.getForwardRay().direction }),
    onChange: () => {
      if (!editorVisible) return;
      const resolved = tryResolvePois(draft, hostMatrix);
      poiScene.setPois(resolved.pois, true);
    },
  });
  editorPanel = editorRoot.querySelector<HTMLElement>('.poi-editor');
}
function selectFromRay(ray: Ray, retryOnMiss = false): boolean {
  return selectMediaFromRay(scene, ray, poiScene.selectableMeshes, media.status.phase,
    () => media.toggleVideoFromGesture(), () => media.retryFromGesture(), retryOnMiss);
}
const desktopOptions = {
  shouldWalk: () => !isEditorFieldFocused(),
  shouldCaptureLock: () => !editorVisible,
  shouldTurnWithKeys: () => editorVisible,
  routeCanvasClick: (event: MouseEvent) => {
    if (editorVisible || xr?.baseExperience.state === WebXRState.IN_XR) return false;
    const locked = document.pointerLockElement === canvas;
    const rect = canvas.getBoundingClientRect();
    const ray = locked ? camera.getForwardRay(100) : scene.createPickingRay(
      event.clientX - rect.left,
      event.clientY - rect.top,
      Matrix.Identity(), camera,
    );
    return selectFromRay(ray, locked);
  },
};
let detachDesktop: (() => void) | null = attachDesktopControls(canvas, camera, scene, desktopOptions);
let detachXr: (() => void) | null = null;
let xr: WebXRDefaultExperience | null = null;
let detachXrSelect: (() => void) | null = null;

let stream: GaussianSplattingStream | null = null;
let loadGeneration = 0;

async function loadScene() {
  const generation = ++loadGeneration;
  media.stop();
  tracker?.reset();
  tracker = null;
  livePois = [];
  poiScene.dispose();
  overlay.clearError();
  try {
    const { metadata, rootUrl } = await fetchManifest(MANIFEST_URL);
    if (generation !== loadGeneration) return;
    stream = replaceStream(stream, () => new GaussianSplattingStream('Ronda Lobato', metadata, rootUrl, scene, { ...STREAM_OPTIONS }));
    if (xr?.baseExperience.state === WebXRState.IN_XR) stream.splatBudget = XR_SPLAT_BUDGET;
    // This SOG's visual orientation was checked at the start pose. Keep Babylon's Y flip.
    stream.rotation.x = 0;
    hostMatrix = stream.computeWorldMatrix(true).clone();
    const current = stream;
    await current.whenSettledAsync();
    if (generation !== loadGeneration) return;
    if (current.isDisposed()) throw new Error(`Scene chunks failed to load from ${rootUrl}.`);
    const resolved = tryResolvePois(poiManifest, hostMatrix);
    livePois = resolved.pois;
    if (resolved.warning) console.warn(resolved.warning);
    tracker = new PoiTracker(livePois, 0.25);
    poiScene.setPois(editorVisible ? tryResolvePois(draft, hostMatrix).pois : livePois, editorVisible);
  } catch (error) {
    if (generation !== loadGeneration) return;
    overlay.setError(error instanceof Error ? error.message : String(error));
  }
}

function setEditorVisible(visible: boolean): void {
  if (!editorRequested || editorVisible === visible) return;
  editorVisible = visible;
  if (editorPanel) editorPanel.hidden = !visible;
  media.stop();
  tracker?.reset();
  if (stream && tracker) {
    const resolved = visible ? tryResolvePois(draft, hostMatrix) : { pois: livePois, warning: null };
    poiScene.setPois(resolved.pois, visible);
  }
}

scene.onBeforeRenderObservable.add(() => {
  if (!tracker || editorVisible) return;
  const inXr = xr?.baseExperience.state === WebXRState.IN_XR;
  const xrCamera = xr?.baseExperience.camera;
  const body = inXr && xrCamera ? xrStandingBody(xrCamera.position, xrCamera.realWorldHeight) : new Vector3(camera.position.x, POI_FLOOR_Y, camera.position.z);
  for (const event of tracker.update(body, performance.now())) {
    if (event.type === 'exit') media.exit(event.id);
    else if (event.type === 'enter' || event.type === 'replace') {
      const targetId = event.type === 'replace' ? event.newId : event.id;
      const poi = livePois.find(item => item.id === targetId);
      if (poi) media.activate(poi);
    }
  }
  const view = inXr && xrCamera ? xrCamera : camera;
  poiScene.updateStatusPose(view.position, view.getForwardRay().direction);
});

async function setupXr() {
  if (!navigator.xr || !window.isSecureContext) {
    overlay.setVrAvailable(false, 'Immersive VR requires a compatible browser on localhost or HTTPS');
    return;
  }
  try {
    if (!await navigator.xr.isSessionSupported('immersive-vr')) {
      overlay.setVrAvailable(false, 'Immersive VR is unavailable in this browser');
      return;
    }
    const outputCanvasOptions = WebXRManagedOutputCanvasOptions.GetDefaults(engine);
    outputCanvasOptions.canvasOptions = {
      ...outputCanvasOptions.canvasOptions,
      antialias: false,
      framebufferScaleFactor: XR_FRAMEBUFFER_SCALE,
    };
    xr = await WebXRDefaultExperience.CreateAsync(scene, {
      disableDefaultUI: true,
      disablePointerSelection: true,
      disableTeleportation: true,
      disableNearInteraction: true,
      disableHandTracking: true,
      inputOptions: { doNotLoadControllerMeshes: true },
      outputCanvasOptions,
    });
    const experience = xr;
    let lastStereoIndex: Float32Array | null = null;
    scene.onBeforeRenderObservable.add(() => {
      if (experience.baseExperience.state === WebXRState.IN_XR && stream && !stream.isDisposed()) {
        prepareStereoSplatSort(scene, experience.baseExperience.camera.rigCameras, stream);
      }
    });
    scene.onBeforeCameraRenderObservable.add(() => {
      if (experience.baseExperience.state === WebXRState.IN_XR && stream && !stream.isDisposed()) {
        lastStereoIndex = syncStereoSplatIndexBuffers(stream, experience.baseExperience.camera.rigCameras, lastStereoIndex);
      }
    });
    experience.baseExperience.onInitialXRPoseSetObservable.add(xrCamera => {
      xrCamera.position.set(START.x, POI_FLOOR_Y, START.z);
    });
    experience.baseExperience.onStateChangedObservable.add(state => {
      if (state === WebXRState.IN_XR) {
        setEditorVisible(false);
        experience.baseExperience.sessionManager.fixedFoveation = XR_FIXED_FOVEATION;
        detachDesktop?.();
        detachDesktop = null;
        detachXr = attachXrMovement(scene, experience);
        const session = experience.baseExperience.sessionManager.session;
        const onSelect = (event: XRInputSourceEvent) => {
          const controller = experience.input.controllers.find(item => item.inputSource === event.inputSource);
          if (!controller) return;
          const ray = new Ray(Vector3.Zero(), new Vector3(0, 0, -1), 100);
          controller.getWorldPointerRayToRef(ray);
          selectFromRay(ray);
        };
        session.addEventListener('select', onSelect);
        detachXrSelect = () => session.removeEventListener('select', onSelect);
        if (stream) stream.splatBudget = XR_SPLAT_BUDGET;
        overlay.setVrActive(true);
      } else if (state === WebXRState.NOT_IN_XR) {
        lastStereoIndex = null;
        detachXr?.();
        detachXr = null;
        detachXrSelect?.();
        detachXrSelect = null;
        setEditorVisible(editorRequested);
        if (!detachDesktop) detachDesktop = attachDesktopControls(canvas, camera, scene, desktopOptions);
        if (stream) stream.splatBudget = STREAM_OPTIONS.splatBudget;
        overlay.setVrActive(false);
      }
    });
    overlay.setVrAvailable(true);
  } catch (error) {
    overlay.setVrAvailable(false, error instanceof Error ? error.message : String(error));
  }
}

overlay.onRetry(() => { void loadScene(); });
overlay.setVrAvailable(false, 'Checking immersive VR support');
overlay.onEnterVr(() => {
  if (!xr) return;
  const experience = xr.baseExperience;
  const operation = experience.state === WebXRState.IN_XR
    ? experience.exitXRAsync()
    : experience.enterXRAsync('immersive-vr', 'local-floor', xr.renderTarget);
  void operation.catch(error => overlay.setError(`VR entry failed: ${error instanceof Error ? error.message : String(error)}`, false));
});
engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
window.addEventListener('pagehide', () => { detachDesktop?.(); detachXr?.(); detachXrSelect?.(); media.dispose(); poiScene.dispose(); xr?.dispose(); stream?.dispose(); scene.dispose(); engine.dispose(); });
void loadScene();
void setupXr();
