import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { WALK_SPEED, START } from './config.js';
import { horizontalDelta } from './movement.js';

const walkKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const turnKeys = new Set(['KeyQ', 'KeyE']);

export function isEditorFieldFocused(): boolean {
  return document.activeElement instanceof HTMLElement && !!document.activeElement.closest('.poi-editor');
}

export type DesktopControlOptions = {
  shouldWalk?: () => boolean;
  shouldCaptureLock?: () => boolean;
  shouldTurnWithKeys?: () => boolean;
  routeCanvasClick?: (event: MouseEvent) => boolean;
};

export function attachDesktopControls(canvas: HTMLCanvasElement, camera: UniversalCamera, scene: Scene, options: DesktopControlOptions = {}): () => void {
  const pressed = new Set<string>();
  const keyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape' && document.pointerLockElement === canvas) {
      document.exitPointerLock();
      release();
      return;
    }
    if (!walkKeys.has(event.code) && !(turnKeys.has(event.code) && options.shouldTurnWithKeys?.())) return;
    const target = event.target as HTMLElement | null;
    if ((target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) || options.shouldWalk?.() === false) return;
    event.preventDefault();
    pressed.add(event.code);
  };
  const keyUp = (event: KeyboardEvent) => { pressed.delete(event.code); };
  const release = () => { pressed.clear(); };
  const capture = (event: MouseEvent) => {
    if (options.routeCanvasClick?.(event)) return;
    if (options.shouldCaptureLock?.() !== false && document.pointerLockElement !== canvas) void canvas.requestPointerLock();
  };
  const look = (event: MouseEvent) => {
    if (document.pointerLockElement !== canvas) return;
    camera.rotation.y += event.movementX * 0.0025;
    camera.rotation.x = Math.max(-1.45, Math.min(1.45, camera.rotation.x + event.movementY * 0.0025));
  };
  const beforeRender = scene.onBeforeRenderObservable.add(() => {
    if (options.shouldWalk?.() === false) { release(); return; }
    const seconds = scene.getEngine().getDeltaTime() / 1000;
    if (options.shouldTurnWithKeys?.()) camera.rotation.y += (Number(pressed.has('KeyQ')) - Number(pressed.has('KeyE'))) * 1.5 * seconds;
    const forward = Number(pressed.has('KeyW') || pressed.has('ArrowUp')) - Number(pressed.has('KeyS') || pressed.has('ArrowDown'));
    const strafe = Number(pressed.has('KeyD') || pressed.has('ArrowRight')) - Number(pressed.has('KeyA') || pressed.has('ArrowLeft'));
    const delta = horizontalDelta(forward, strafe, camera.rotation.y, seconds, WALK_SPEED);
    camera.position.x += delta.x;
    camera.position.z += delta.z;
    camera.position.y = START.y;
  });
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', release);
  document.addEventListener('mousemove', look);
  canvas.addEventListener('click', capture);
  return () => {
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    window.removeEventListener('blur', release);
    document.removeEventListener('mousemove', look);
    canvas.removeEventListener('click', capture);
    scene.onBeforeRenderObservable.remove(beforeRender);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  };
}
