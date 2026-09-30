import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { WebXRDefaultExperience } from '@babylonjs/core/XR/webXRDefaultExperience.js';
import type { Camera } from '@babylonjs/core/Cameras/camera.js';
import type { GaussianSplattingStream } from '@babylonjs/loaders/SPLAT/gaussianSplattingStream.js';
import { WALK_SPEED } from './config.js';
import { horizontalDelta } from './movement.js';

export function readLeftStick(gamepad: Gamepad | null): { forward: number; strafe: number } {
  if (!gamepad || gamepad.connected === false) return { forward: 0, strafe: 0 };
  const axes = gamepad.axes;
  const x = axes.length >= 4 ? axes[2] : axes[0] ?? 0;
  const y = axes.length >= 4 ? axes[3] : axes[1] ?? 0;
  return {
    forward: Math.abs(y) > 0.15 ? -y : 0,
    strafe: Math.abs(x) > 0.15 ? x : 0,
  };
}

/** Babylon sorts one camera at a time; present both XR eyes so an unsorted eye wins priority. */
export function prepareStereoSplatSort(scene: Scene, cameras: Camera[], stream: GaussianSplattingStream): void {
  if (cameras.length < 2) return;
  const previous = scene.activeCameras;
  scene.activeCameras = cameras;
  try {
    stream._postToWorker();
  } finally {
    scene.activeCameras = previous;
  }
}

/** A resized Babylon sort array is initially uploaded as zeros to every eye except the sorted one. */
export function syncStereoSplatIndexBuffers(
  stream: GaussianSplattingStream,
  cameras: Camera[],
  lastIndex: Float32Array | null,
): Float32Array | null {
  const internal = stream as unknown as {
    _splatIndex: Float32Array | null;
    _cameraViewInfos: Map<number, {
      mesh: { thinInstanceBufferUpdated(kind: string): void };
      splatIndexBufferSet: boolean;
    }>;
  };
  const index = internal._splatIndex;
  if (!index || index === lastIndex) return index;
  let allEyesReady = true;
  for (const camera of cameras) {
    const view = internal._cameraViewInfos.get(camera.uniqueId);
    if (!view?.splatIndexBufferSet) {
      allEyesReady = false;
      continue;
    }
    view.mesh.thinInstanceBufferUpdated('splatIndex');
  }
  return allEyesReady ? index : lastIndex;
}

export function attachXrMovement(scene: Scene, xr: WebXRDefaultExperience): () => void {
  const camera = xr.baseExperience.camera;
  camera.inertia = 0;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const left = xr.input.controllers.find(controller => controller.inputSource.handedness === 'left');
    const stick = readLeftStick(left?.inputSource.gamepad ?? null);
    if (!stick.forward && !stick.strafe) return;
    const yaw = camera.rotationQuaternion.toEulerAngles().y;
    const delta = horizontalDelta(stick.forward, stick.strafe, yaw, scene.getEngine().getDeltaTime() / 1000, WALK_SPEED);
    camera.cameraDirection.addInPlace(new Vector3(delta.x, 0, delta.z));
  });
  return () => scene.onBeforeRenderObservable.remove(observer);
}
