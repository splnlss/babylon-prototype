import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture.js';
import '@babylonjs/core/Engines/Extensions/engine.videoTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { VideoTexture } from '@babylonjs/core/Materials/Textures/videoTexture.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Poi } from './pois.js';
import type { MediaStatus } from './media.js';

export class PoiScene {
  private markers: Mesh[] = [];
  private markerMaterials: StandardMaterial[] = [];
  private markerLabels: Mesh[] = [];
  private markerLabelMaterials: StandardMaterial[] = [];
  private markerLabelTextures: DynamicTexture[] = [];
  private videoPlane: Mesh | null = null;
  private videoMaterial: StandardMaterial | null = null;
  private videoTexture: VideoTexture | null = null;
  private videoElement: unknown = null;
  private statusPlane: Mesh | null = null;
  private statusMaterial: StandardMaterial | null = null;
  private statusTexture: DynamicTexture | null = null;
  private pois: Poi[] = [];
  private draft = false;

  constructor(private readonly scene: Scene) {}

  setPois(pois: Poi[], draft = false): void {
    this.clearMarkers();
    this.clearVideo();
    this.clearStatus();
    this.pois = pois;
    this.draft = draft;
    for (const poi of pois) {
      const marker = MeshBuilder.CreateSphere(`poi-${poi.id}`, { diameter: 0.3, segments: 12 }, this.scene);
      marker.position.copyFrom(poi.worldPosition);
      marker.position.y += 0.7;
      marker.isPickable = false;
      marker.renderingGroupId = 1;
      const material = new StandardMaterial(`poi-${poi.id}-material`, this.scene);
      material.diffuseColor = poi.kind === 'video' ? new Color3(0.35, 0.8, 1) : new Color3(1, 0.75, 0.3);
      material.emissiveColor = material.diffuseColor;
      material.disableLighting = true;
      marker.material = material;
      this.markers.push(marker);
      this.markerMaterials.push(material);

      const labelTexture = new DynamicTexture(`poi-${poi.id}-label-texture`, { width: 384, height: 112 }, this.scene, false);
      const context = labelTexture.getContext();
      context.fillStyle = '#101b18';
      context.fillRect(0, 0, 384, 112);
      context.strokeStyle = poi.kind === 'video' ? '#59c6ed' : '#ffc04d';
      context.lineWidth = 6;
      context.strokeRect(3, 3, 378, 106);
      labelTexture.drawText(poi.kind.toUpperCase(), null, 73, 'bold 44px Arial', '#ffffff', null, true);
      const labelMaterial = new StandardMaterial(`poi-${poi.id}-label-material`, this.scene);
      labelMaterial.diffuseTexture = labelTexture;
      labelMaterial.emissiveTexture = labelTexture;
      labelMaterial.disableLighting = true;
      labelMaterial.backFaceCulling = false;
      const label = MeshBuilder.CreatePlane(`poi-${poi.id}-label`, { width: 0.78, height: 0.23 }, this.scene);
      label.position.copyFrom(poi.worldPosition);
      label.position.y += 1.08;
      label.billboardMode = Mesh.BILLBOARDMODE_ALL;
      label.isPickable = false;
      label.renderingGroupId = 1;
      label.material = labelMaterial;
      this.markerLabels.push(label);
      this.markerLabelMaterials.push(labelMaterial);
      this.markerLabelTextures.push(labelTexture);
    }
    if (draft) {
      const video = pois.find(poi => poi.kind === 'video');
      if (video?.worldVideo) this.makePlane(video, null);
    }
  }

  setMediaStatus(status: MediaStatus): void {
    if (this.draft) return;
    const poi = this.pois.find(item => item.id === status.poiId);
    const showVideo = poi?.kind === 'video' && !!status.element && ['loading', 'playing', 'paused', 'blocked'].includes(status.phase);
    if (showVideo && poi && this.videoElement !== status.element) {
      this.clearVideo();
      this.makePlane(poi, status.element as HTMLVideoElement);
    } else if (!showVideo) this.clearVideo();
    this.clearStatus();
    if (!poi || status.phase === 'idle') return;
    const message = status.phase === 'blocked' ? `Select to play ${poi.title}` : status.message;
    const texture = new DynamicTexture(`poi-status-${poi.id}`, { width: 512, height: 128 }, this.scene, false);
    texture.hasAlpha = true;
    texture.drawText(message.slice(0, 35), null, 77, 'bold 30px Arial', 'white', '#17231edf', true);
    const material = new StandardMaterial(`poi-status-material-${poi.id}`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const plane = MeshBuilder.CreatePlane(`poi-status-${poi.id}`, { width: 0.8, height: 0.2 }, this.scene);
    plane.position.copyFrom(poi.worldPosition).addInPlace(new Vector3(1, 1, -1.8));
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.material = material;
    plane.isPickable = status.phase === 'blocked' || status.phase === 'error';
    plane.renderingGroupId = 1;
    this.statusPlane = plane;
    this.statusMaterial = material;
    this.statusTexture = texture;
  }

  updateStatusPose(headWorld: Vector3, forwardWorld: Vector3): void {
    if (this.statusPlane) this.statusPlane.position.copyFrom(statusPosition(headWorld, forwardWorld));
  }

  private makePlane(poi: Poi, element: HTMLVideoElement | null): void {
    if (!poi.worldVideo) return;
    const plane = MeshBuilder.CreatePlane(`poi-video-${poi.id}`, { width: poi.worldVideo.width, height: poi.worldVideo.height }, this.scene);
    plane.position.copyFrom(poi.worldVideo.position);
    plane.rotationQuaternion = poi.worldVideo.rotation.clone();
    plane.isPickable = !!element;
    plane.renderingGroupId = 1;
    const material = new StandardMaterial(`poi-video-material-${poi.id}`, this.scene);
    material.disableLighting = true;
    if (element) {
      const texture = new VideoTexture(`poi-video-texture-${poi.id}`, element, this.scene, false, false, undefined, { independentVideoSource: true });
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;
      this.videoTexture = texture;
      this.videoElement = element;
    } else {
      material.diffuseColor = new Color3(0.16, 0.55, 0.65);
      material.emissiveColor = new Color3(0.05, 0.22, 0.26);
    }
    plane.material = material;
    this.videoPlane = plane;
    this.videoMaterial = material;
  }

  get selectableMeshes(): Mesh[] { return [this.videoPlane, this.statusPlane].filter((mesh): mesh is Mesh => !!mesh && mesh.isPickable); }

  private clearMarkers(): void {
    this.markers.forEach(mesh => mesh.dispose());
    this.markerMaterials.forEach(material => material.dispose());
    this.markerLabels.forEach(mesh => mesh.dispose());
    this.markerLabelMaterials.forEach(material => material.dispose());
    this.markerLabelTextures.forEach(texture => texture.dispose());
    this.markers = []; this.markerMaterials = [];
    this.markerLabels = []; this.markerLabelMaterials = []; this.markerLabelTextures = [];
  }
  private clearVideo(): void { this.videoPlane?.dispose(); this.videoMaterial?.dispose(); this.videoTexture?.dispose(); this.videoPlane = null; this.videoMaterial = null; this.videoTexture = null; this.videoElement = null; }
  private clearStatus(): void { this.statusPlane?.dispose(); this.statusMaterial?.dispose(); this.statusTexture?.dispose(); this.statusPlane = null; this.statusMaterial = null; this.statusTexture = null; }
  dispose(): void { this.clearMarkers(); this.clearVideo(); this.clearStatus(); this.pois = []; }
}

export function statusPosition(headWorld: Vector3, forwardWorld: Vector3): Vector3 {
  const horizontal = new Vector3(forwardWorld.x, 0, forwardWorld.z);
  if (horizontal.lengthSquared() < 0.01) horizontal.set(0, 0, -1);
  horizontal.normalize();
  const right = Vector3.Cross(horizontal, Vector3.Up()).normalize();
  return headWorld.add(horizontal.scale(1.8)).add(right.scale(1)).add(new Vector3(0, -0.65, 0));
}
