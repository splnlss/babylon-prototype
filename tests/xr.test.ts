import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareStereoSplatSort, readLeftStick, syncStereoSplatIndexBuffers } from '../src/xr.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { GaussianSplattingMesh } from '@babylonjs/core/Meshes/GaussianSplatting/gaussianSplattingMesh.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { GaussianSplattingStream } from '@babylonjs/loaders/SPLAT/gaussianSplattingStream.js';

const pad = (axes: number[], connected = true) => ({ axes, connected }) as unknown as Gamepad;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readLeftStick', () => {
  it('does not move without a gamepad', () => {
    expect(readLeftStick(null)).toEqual({ forward: 0, strafe: 0 });
  });
  it('does not move after disconnect', () => {
    expect(readLeftStick(pad([0, 0, 0.7, -0.7], false))).toEqual({ forward: 0, strafe: 0 });
  });
  it('ignores stick drift inside the dead zone', () => {
    expect(readLeftStick(pad([0, 0, 0.1, -0.12]))).toEqual({ forward: 0, strafe: 0 });
  });
  it('maps Quest thumbstick axes to forward and strafe', () => {
    expect(readLeftStick(pad([0, 0, 0.5, -0.8]))).toEqual({ forward: 0.8, strafe: 0.5 });
  });
});

describe('XR stereo splat sorting', () => {
  it('schedules both eyes with Babylon’s real sorter and restores the camera array', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const left = new FreeCamera('left', new Vector3(-0.03, 0, 0), scene);
    const right = new FreeCamera('right', new Vector3(0.03, 0, 0), scene);
    scene.activeCamera = left;
    const originalActiveCameras = scene.activeCameras;
    const mesh = new GaussianSplattingMesh('test-splats', null, scene);
    const internal = mesh as unknown as {
      _worker: { postMessage(message: { cameraId: number }): void; terminate(): void };
      _depthMix: BigInt64Array;
      _vertexCount: number;
      _canPostToWorker: boolean;
      _cameraViewInfos: Map<number, { sortAppliedId: number; sortRequestId: number; splatIndexBufferSet: boolean }>;
    };
    const posted: number[] = [];
    internal._worker = { postMessage: message => posted.push(message.cameraId), terminate() {} };
    internal._depthMix = new BigInt64Array(16);
    internal._vertexCount = 16;
    internal._canPostToWorker = true;

    for (let frame = 0; frame < 20; frame++) {
      left.position.x += 0.5;
      right.position.x += 0.5;
      left.computeWorldMatrix();
      right.computeWorldMatrix();
      (scene as unknown as { _frameId: number })._frameId++;
      prepareStereoSplatSort(scene, [left, right], mesh as GaussianSplattingStream);
      expect(scene.activeCameras).toBe(originalActiveCameras);
      for (const camera of [left, right]) {
        scene.activeCamera = camera;
        mesh._postToWorker();
      }
      if (posted.length === 0) continue;
      const view = internal._cameraViewInfos.get(posted.at(-1)!);
      expect(view).toBeDefined();
      view!.sortAppliedId = view!.sortRequestId;
      view!.splatIndexBufferSet = true;
      internal._canPostToWorker = true;
    }

    expect(posted.slice(0, 6)).toEqual([
      left.uniqueId, right.uniqueId, left.uniqueId,
      right.uniqueId, left.uniqueId, right.uniqueId,
    ]);
    mesh.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('uploads a resized, filled index array to both eye buffers before rendering', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const left = new FreeCamera('left', Vector3.Zero(), scene);
    const right = new FreeCamera('right', Vector3.Zero(), scene);
    scene.activeCamera = null;
    const mesh = new GaussianSplattingMesh('test-splats', null, scene);
    const gpuData = new Map<object, Float32Array>();
    const createBuffer = engine.createDynamicVertexBuffer.bind(engine);
    const updateBuffer = engine.updateDynamicVertexBuffer.bind(engine);
    vi.spyOn(engine, 'createDynamicVertexBuffer').mockImplementation(data => {
      const buffer = createBuffer(data);
      gpuData.set(buffer, Float32Array.from(data as ArrayLike<number>));
      return buffer;
    });
    vi.spyOn(engine, 'updateDynamicVertexBuffer').mockImplementation((buffer, data, offset, length) => {
      gpuData.set(buffer, Float32Array.from(data as ArrayLike<number>));
      updateBuffer(buffer, data, offset, length);
    });
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    const internal = mesh as unknown as {
      _instantiateWorker(): void;
      _worker: FakeWorker;
      _vertexCount: number;
      _splatPositions: Float32Array;
      _splatIndex: Float32Array;
      _activeRangeVersion: number;
      _cameraViewInfos: Map<number, { mesh: Mesh; splatIndexBufferSet: boolean }>;
    };
    internal._vertexCount = 64;
    internal._splatPositions = new Float32Array(64 * 4);
    internal._instantiateWorker();
    const previous = internal._splatIndex;
    const leftMesh = new Mesh('left-eye-splats', scene);
    const rightMesh = new Mesh('right-eye-splats', scene);
    leftMesh.thinInstanceSetBuffer('splatIndex', previous, 16, false);
    rightMesh.thinInstanceSetBuffer('splatIndex', previous, 16, false);
    internal._cameraViewInfos.set(left.uniqueId, { mesh: leftMesh, splatIndexBufferSet: true });
    internal._cameraViewInfos.set(right.uniqueId, { mesh: rightMesh, splatIndexBufferSet: true });

    mesh.setSplatIndexRanges([{ offset: 0, count: 48 }]);
    const depthMix = new BigInt64Array(48);
    const indices = new Uint32Array(depthMix.buffer);
    for (let index = 0; index < 48; index++) indices[index * 2] = index + 1;
    internal._worker.onmessage!({
      data: {
        depthMix,
        cameraId: left.uniqueId,
        sortRequestId: 1,
        rangeVersion: internal._activeRangeVersion,
      },
    } as MessageEvent);

    const eyeGpuIndex = (eyeMesh: Mesh) => {
      const buffer = (eyeMesh as unknown as { _thinInstanceDataStorage: { matrixBuffer: { getBuffer(): object } } })
        ._thinInstanceDataStorage.matrixBuffer.getBuffer();
      return Array.from(gpuData.get(buffer)!.slice(0, 2));
    };
    expect(eyeGpuIndex(leftMesh)).not.toEqual([0, 0]);
    expect(eyeGpuIndex(rightMesh)).toEqual([0, 0]);
    expect(syncStereoSplatIndexBuffers(mesh as GaussianSplattingStream, [left, right], previous))
      .toBe(internal._splatIndex);
    expect(eyeGpuIndex(rightMesh)).not.toEqual([0, 0]);
    mesh.dispose();
    scene.dispose();
    engine.dispose();
  });
});
