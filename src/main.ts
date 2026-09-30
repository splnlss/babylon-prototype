import { Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
import { GaussianSplattingStream } from '@babylonjs/loaders/SPLAT/gaussianSplattingStream.js';
import { MANIFEST_URL, START, STREAM_OPTIONS, TARGET } from './config.js';
import { fetchManifest, replaceStream } from './sog.js';
import { createOverlay } from './ui.js';
import { attachDesktopControls } from './desktop.js';
import { WebXRDefaultExperience } from '@babylonjs/core/XR/webXRDefaultExperience.js';
import { WebXRManagedOutputCanvasOptions } from '@babylonjs/core/XR/webXRManagedOutputCanvas.js';
import { WebXRState } from '@babylonjs/core/XR/webXRTypes.js';
import { attachXrMovement, prepareStereoSplatSort, syncStereoSplatIndexBuffers } from './xr.js';
import { XR_FIXED_FOVEATION, XR_FRAMEBUFFER_SCALE, XR_SPLAT_BUDGET } from './config.js';
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
let detachDesktop: (() => void) | null = attachDesktopControls(canvas, camera, scene);
let detachXr: (() => void) | null = null;
let xr: WebXRDefaultExperience | null = null;

let stream: GaussianSplattingStream | null = null;
let loadGeneration = 0;

async function loadScene() {
  const generation = ++loadGeneration;
  overlay.setStatus('Loading scene manifest…');
  try {
    const { metadata, rootUrl } = await fetchManifest(MANIFEST_URL);
    if (generation !== loadGeneration) return;
    stream = replaceStream(stream, () => new GaussianSplattingStream('Ronda Lobato', metadata, rootUrl, scene, { ...STREAM_OPTIONS }));
    if (xr?.baseExperience.state === WebXRState.IN_XR) stream.splatBudget = XR_SPLAT_BUDGET;
    // This SOG's visual orientation was checked at the start pose. Keep Babylon's Y flip.
    stream.rotation.x = 0;
    overlay.setStatus('Streaming scene detail…');
    const current = stream;
    await current.whenSettledAsync();
    if (generation !== loadGeneration) return;
    if (current.isDisposed()) throw new Error(`Scene chunks failed to load from ${rootUrl}.`);
    overlay.setStatus(xr?.baseExperience.state === WebXRState.IN_XR ? 'VR active · move with the left thumbstick' : 'Scene ready · walk to explore');
  } catch (error) {
    if (generation !== loadGeneration) return;
    overlay.setError(error instanceof Error ? error.message : String(error));
  }
}

function resetView() {
  if (xr?.baseExperience.state === WebXRState.IN_XR) {
    const xrCamera = xr.baseExperience.camera;
    xrCamera.position.x = START.x;
    xrCamera.position.z = START.z;
    return;
  }
  camera.position.set(START.x, START.y, START.z);
  camera.setTarget(new Vector3(TARGET.x, TARGET.y, TARGET.z));
}

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
      xrCamera.position.set(START.x, START.y - 1.6, START.z);
    });
    experience.baseExperience.onStateChangedObservable.add(state => {
      if (state === WebXRState.IN_XR) {
        experience.baseExperience.sessionManager.fixedFoveation = XR_FIXED_FOVEATION;
        detachDesktop?.();
        detachDesktop = null;
        detachXr = attachXrMovement(scene, experience);
        if (stream) stream.splatBudget = XR_SPLAT_BUDGET;
        overlay.setVrActive(true);
        overlay.setStatus('VR active · move with the left thumbstick');
      } else if (state === WebXRState.NOT_IN_XR) {
        lastStereoIndex = null;
        detachXr?.();
        detachXr = null;
        if (!detachDesktop) detachDesktop = attachDesktopControls(canvas, camera, scene);
        if (stream) stream.splatBudget = STREAM_OPTIONS.splatBudget;
        overlay.setVrActive(false);
        overlay.setStatus('Scene ready · walk to explore');
      }
    });
    overlay.setVrAvailable(true);
  } catch (error) {
    overlay.setVrAvailable(false, error instanceof Error ? error.message : String(error));
    overlay.setStatus(`VR unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

overlay.onRetry(() => { void loadScene(); });
overlay.onReset(resetView);
overlay.setVrAvailable(false, 'Checking immersive VR support');
overlay.onEnterVr(() => {
  if (!xr) return;
  const experience = xr.baseExperience;
  const operation = experience.state === WebXRState.IN_XR
    ? experience.exitXRAsync()
    : experience.enterXRAsync('immersive-vr', 'local-floor', xr.renderTarget);
  void operation.catch(error => overlay.setStatus(`VR entry failed: ${error instanceof Error ? error.message : String(error)}`));
});
engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
window.addEventListener('pagehide', () => { detachDesktop?.(); detachXr?.(); xr?.dispose(); stream?.dispose(); scene.dispose(); engine.dispose(); });
void loadScene();
void setupXr();
