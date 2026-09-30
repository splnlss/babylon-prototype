// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { attachDesktopControls, isEditorFieldFocused } from '../src/desktop.js';

describe('desktop editor controls', () => {
  it('walks and turns in editor mode, but ignores keys while an editor field has focus', () => {
    const engine = new NullEngine(); vi.spyOn(engine, 'getDeltaTime').mockReturnValue(100);
    const scene = new Scene(engine); const camera = new UniversalCamera('camera', new Vector3(0, 5, 40), scene);
    camera.rotation.y = Math.PI;
    const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
    const editor = document.createElement('section'); editor.className = 'poi-editor';
    const input = document.createElement('input'); editor.appendChild(input); document.body.appendChild(editor);
    const detach = attachDesktopControls(canvas, camera, scene, { shouldWalk: () => !isEditorFieldFocused(), shouldTurnWithKeys: () => true, shouldCaptureLock: () => false });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(camera.position.z).toBeLessThan(40);
    expect(camera.rotation.y).toBeGreaterThan(Math.PI);
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }));
    input.focus();
    const priorZ = camera.position.z, priorYaw = camera.rotation.y;
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(camera.position.z).toBe(priorZ);
    expect(camera.rotation.y).toBe(priorYaw);
    detach(); scene.dispose(); engine.dispose(); canvas.remove(); editor.remove();
  });

  it('does not acquire pointer lock when a media click is consumed or editor mode is active', () => {
    const engine = new NullEngine(); const scene = new Scene(engine);
    const camera = new UniversalCamera('camera', new Vector3(0, 5, 40), scene);
    const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
    const lock = vi.fn(async () => {}); canvas.requestPointerLock = lock;
    const route = vi.fn(() => true);
    const detach = attachDesktopControls(canvas, camera, scene, { routeCanvasClick: route, shouldCaptureLock: () => true });
    canvas.click(); expect(route).toHaveBeenCalledOnce(); expect(lock).not.toHaveBeenCalled();
    detach();
    const editorDetach = attachDesktopControls(canvas, camera, scene, { routeCanvasClick: () => false, shouldCaptureLock: () => false });
    canvas.click(); expect(lock).not.toHaveBeenCalled();
    editorDetach(); scene.dispose(); engine.dispose(); canvas.remove();
  });
});
