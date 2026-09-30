import Hls from 'hls.js';
import type { Poi } from './pois.js';

export interface MediaElement extends EventTarget {
  preload: string;
  loop: boolean;
  muted: boolean;
  playsInline?: boolean;
  crossOrigin?: string | null;
  src: string;
  paused: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  canPlayType(type: string): string;
}

export interface HlsSession {
  autoLevelCapping?: number;
  on(name: string, callback: (...args: unknown[]) => void): void;
  attachMedia(element: MediaElement): void;
  loadSource(url: string): void;
  startLoad(): void;
  stopLoad(): void;
  destroy(): void;
}

export type MediaStatus = {
  phase: 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'ended' | 'error';
  poiId?: string;
  kind?: 'video' | 'audio';
  title?: string;
  message: string;
  element?: MediaElement;
};

type Dependencies = {
  createElement(kind: 'video' | 'audio'): MediaElement;
  hlsSupported(): boolean;
  createHls(): HlsSession;
};

const defaults: Dependencies = {
  createElement: kind => document.createElement(kind),
  hlsSupported: () => Hls.isSupported(),
  createHls: () => new Hls({ autoStartLoad: false, maxBufferLength: 10, maxMaxBufferLength: 20, backBufferLength: 5 }) as unknown as HlsSession,
};

export class MediaPlayer {
  status: MediaStatus = { phase: 'idle', message: 'No media playing' };
  private element: MediaElement | null = null;
  private hls: HlsSession | null = null;
  private active: Poi | null = null;
  private generation = 0;
  private usedFallback = false;
  private readonly listeners = new Set<(status: MediaStatus) => void>();
  private elementCleanup: (() => void) | null = null;
  private readonly deps: Dependencies;

  constructor(deps: Partial<Dependencies> = {}) { this.deps = { ...defaults, ...deps }; }

  subscribe(callback: (status: MediaStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.status);
    return () => this.listeners.delete(callback);
  }

  private publish(phase: MediaStatus['phase'], message: string): void {
    this.status = { phase, message, ...(this.active ? { poiId: this.active.id, kind: this.active.kind, title: this.active.title } : {}), ...(this.element ? { element: this.element } : {}) };
    for (const listener of this.listeners) listener(this.status);
  }

  activate(poi: Poi): void {
    if (this.active?.id === poi.id && this.element) return;
    this.stop();
    this.active = poi;
    this.usedFallback = false;
    this.open(poi, false);
  }

  private open(poi: Poi, fallback: boolean): void {
    const generation = ++this.generation;
    const element = this.deps.createElement(poi.kind);
    this.element = element;
    element.preload = 'none';
    element.loop = false;
    element.muted = false;
    if (poi.kind === 'video') { element.playsInline = true; element.crossOrigin = 'anonymous'; }
    const onEnded = () => { if (generation === this.generation) this.finish('ended', `${poi.title} ended`); };
    const onError = () => { if (generation === this.generation) this.fail(poi, fallback); };
    element.addEventListener('ended', onEnded);
    element.addEventListener('error', onError);
    this.elementCleanup = () => { element.removeEventListener('ended', onEnded); element.removeEventListener('error', onError); };
    this.publish('loading', `Loading ${poi.title}…`);

    const directUrl = fallback ? (poi.kind === 'audio' ? poi.fallbackUrl : undefined) : poi.kind === 'audio' && !poi.muxPlaybackId ? poi.fallbackUrl : undefined;
    if (directUrl) {
      element.src = directUrl;
      this.tryPlay(element, generation);
      return;
    }
    const playbackId = poi.muxPlaybackId;
    if (!playbackId) { this.fail(poi, fallback); return; }
    const muxUrl = `https://stream.mux.com/${playbackId}.m3u8${poi.kind === 'video' ? '?max_resolution=720p' : ''}`;
    if (this.deps.hlsSupported()) {
      const hls = this.deps.createHls();
      this.hls = hls;
      hls.on('hlsMediaAttached', () => {
        if (generation !== this.generation) return;
        hls.loadSource(muxUrl);
        hls.startLoad();
        this.tryPlay(element, generation);
      });
      hls.on('hlsError', (_event, data) => {
        if (generation !== this.generation) return;
        if (data && typeof data === 'object' && 'fatal' in data && data.fatal) this.fail(poi, fallback);
      });
      if (poi.kind === 'video') hls.on('hlsManifestParsed', (_event, data) => {
        if (generation !== this.generation || !data || typeof data !== 'object' || !('levels' in data) || !Array.isArray(data.levels)) return;
        const levels = data.levels as Array<{ height?: number }>;
        const cap = levels.reduce((best, level, index) => typeof level.height === 'number' && level.height <= 720 ? index : best, -1);
        hls.autoLevelCapping = Math.max(0, cap);
      });
      hls.attachMedia(element);
    } else if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = muxUrl;
      this.tryPlay(element, generation);
    } else {
      this.fail(poi, fallback);
    }
  }

  private tryPlay(element: MediaElement, generation: number): void {
    void element.play().then(() => {
      if (generation === this.generation) this.publish('playing', `${this.active?.title ?? 'Media'} playing`);
    }, error => {
      if (generation !== this.generation) return;
      if (error instanceof Error && error.name === 'NotAllowedError') this.publish('blocked', `Select to play ${this.active?.title ?? 'media'}`);
      else if (!(error instanceof Error && error.name === 'AbortError')) this.fail(this.active!, this.usedFallback);
    });
  }

  private fail(poi: Poi, fallback: boolean): void {
    if (poi.kind === 'audio' && !fallback && !this.usedFallback && poi.fallbackUrl) {
      this.usedFallback = true;
      this.cleanupSource();
      this.open(poi, true);
      return;
    }
    this.finish('error', `${poi.title} could not play`);
  }

  private cleanupSource(): void {
    ++this.generation;
    this.elementCleanup?.();
    this.elementCleanup = null;
    const hls = this.hls;
    this.hls = null;
    hls?.stopLoad();
    hls?.destroy();
    const element = this.element;
    this.element = null;
    if (element) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
  }

  private finish(phase: 'ended' | 'error', message: string): void {
    this.cleanupSource();
    this.publish(phase, message);
  }

  exit(id: string): void {
    if (this.active?.id === id && this.active.kind === 'video') this.stop();
    else if (this.active?.id === id && this.active.kind === 'audio' && (this.status.phase === 'ended' || this.status.phase === 'error')) this.stop();
  }

  toggleVideoFromGesture(): void {
    if (this.active?.kind !== 'video' || !this.element) return;
    if (this.status.phase === 'blocked') { this.retryFromGesture(); return; }
    if (this.element.paused) this.tryPlay(this.element, this.generation);
    else { this.element.pause(); this.publish('paused', `${this.active.title} paused`); }
  }

  retryFromGesture(): void {
    if (this.status.phase === 'blocked' && this.element) this.tryPlay(this.element, this.generation);
    else if (this.status.phase === 'error' && this.active) {
      this.usedFallback = false;
      this.open(this.active, false);
    }
  }

  stop(): void {
    this.cleanupSource();
    this.active = null;
    this.publish('idle', 'No media playing');
  }

  dispose(): void { this.stop(); this.listeners.clear(); }
}
