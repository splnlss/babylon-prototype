import { describe, expect, it, vi } from 'vitest';
import { MediaPlayer, type MediaElement, type HlsSession } from '../src/media.js';
import type { Poi } from '../src/pois.js';

const video = { id: 'video', title: 'Video', kind: 'video', muxPlaybackId: 'rR8P8mSaKDzz02TsftugTUdI00cQPJX00oy' } as Poi;
const audio = { id: 'audio', title: 'Audio', kind: 'audio', muxPlaybackId: 'BvRHSlj5WGXeIG2HCr5t9w02ZMUXmzLkKNYofkE02JgH00', fallbackUrl: 'https://example.test/audio.m4a' } as Poi & { fallbackUrl: string };

function fixture(playError?: Error) {
  const events: string[] = [];
  const elements: FakeMedia[] = [];
  const sessions: FakeHls[] = [];
  class FakeMedia extends EventTarget implements MediaElement {
    preload = ''; loop = false; muted = false; playsInline = false; src = ''; paused = true;
    play = vi.fn(async () => { events.push('play'); if (playError) throw playError; this.paused = false; });
    pause = vi.fn(() => { events.push('pause'); this.paused = true; });
    load = vi.fn(() => { events.push('load'); });
    removeAttribute = vi.fn((name: string) => { if (name === 'src') this.src = ''; events.push('clear'); });
    canPlayType = vi.fn(() => '');
  }
  class FakeHls implements HlsSession {
    autoLevelCapping = -1;
    private callbacks = new Map<string, Array<(...args: unknown[]) => void>>();
    attachMedia = vi.fn(() => { events.push('attach'); this.emit('hlsMediaAttached'); });
    loadSource = vi.fn(() => { events.push('source'); });
    startLoad = vi.fn(() => { events.push('startLoad'); });
    stopLoad = vi.fn(() => { events.push('stopLoad'); });
    destroy = vi.fn(() => { events.push('destroy'); });
    on(name: string, callback: (...args: unknown[]) => void) { this.callbacks.set(name, [...this.callbacks.get(name) ?? [], callback]); }
    emit(name: string, data?: unknown) { for (const callback of this.callbacks.get(name) ?? []) callback(name, data); }
  }
  const player = new MediaPlayer({
    createElement: () => { const element = new FakeMedia(); elements.push(element); return element; },
    hlsSupported: () => true,
    createHls: () => { const session = new FakeHls(); sessions.push(session); return session; },
  });
  return { player, elements, sessions, events };
}

describe('MediaPlayer', () => {
  it('starts only on activation, owns one source, and tears the old source down first', async () => {
    const f = fixture();
    expect(f.elements).toHaveLength(0);
    f.player.activate(video);
    await Promise.resolve();
    expect(f.elements[0].preload).toBe('none');
    expect(f.elements[0].loop).toBe(false);
    expect(f.elements[0].muted).toBe(false);
    expect(f.elements[0].play).toHaveBeenCalledTimes(1);
    f.sessions[0].emit('hlsManifestParsed', { levels: [{ height: 360 }, { height: 720 }, { height: 1080 }] });
    expect(f.sessions[0].autoLevelCapping).toBe(1);
    f.player.activate(audio);
    expect(f.events.indexOf('destroy')).toBeLessThan(f.events.lastIndexOf('attach'));
    expect(f.elements[0].pause).toHaveBeenCalledOnce();
    expect(f.elements[0].src).toBe('');
    expect(f.elements).toHaveLength(2);
  });

  it('keeps audio on walk-away and does not restart it on re-entry', () => {
    const f = fixture();
    f.player.activate(audio);
    f.player.exit('audio');
    f.player.activate(audio);
    expect(f.elements).toHaveLength(1);
    expect(f.elements[0].pause).not.toHaveBeenCalled();
  });

  it('lets audio end naturally and restarts only on a later arrival', () => {
    const f = fixture();
    f.player.activate(audio);
    f.player.exit('audio');
    f.elements[0].dispatchEvent(new Event('ended'));
    expect(f.player.status.phase).toBe('ended');
    expect(f.elements[0].pause).toHaveBeenCalledOnce();
    f.player.activate(audio);
    expect(f.elements).toHaveLength(2);
  });

  it('clears terminal audio feedback on exit, preventing a distant retry', () => {
    const f = fixture();
    f.player.activate(audio);
    f.elements[0].dispatchEvent(new Event('error'));
    f.elements[1].dispatchEvent(new Event('error'));
    expect(f.player.status.phase).toBe('error');
    f.player.exit('audio');
    expect(f.player.status.phase).toBe('idle');
    f.player.retryFromGesture();
    expect(f.elements).toHaveLength(2);
  });

  it('stops video on exit and on ended, even after a late source callback', () => {
    const f = fixture();
    f.player.activate(video);
    f.player.exit('video');
    expect(f.player.status.phase).toBe('idle');
    const prior = f.events.length;
    f.sessions[0].emit('hlsMediaAttached');
    expect(f.events).toHaveLength(prior);
    f.player.activate(video);
    f.elements[1].dispatchEvent(new Event('ended'));
    expect(f.player.status.phase).toBe('ended');
    expect(f.elements[1].pause).toHaveBeenCalledOnce();
  });

  it('offers gesture retry for blocked autoplay without changing source', async () => {
    const blocked = new DOMException('blocked', 'NotAllowedError');
    const f = fixture(blocked);
    f.player.activate(video);
    await Promise.resolve(); await Promise.resolve();
    expect(f.player.status.phase).toBe('blocked');
    expect(f.sessions).toHaveLength(1);
    f.player.retryFromGesture();
    expect(f.sessions).toHaveLength(1);
    expect(f.elements[0].play).toHaveBeenCalledTimes(2);
  });

  it('falls back from fatal Mux audio once, and ignores superseded errors', () => {
    const f = fixture();
    f.player.activate(audio);
    f.sessions[0].emit('hlsError', { fatal: true });
    expect(f.sessions[0].destroy).toHaveBeenCalledOnce();
    expect(f.elements[1].src).toBe(audio.fallbackUrl);
    f.sessions[0].emit('hlsError', { fatal: true });
    expect(f.elements).toHaveLength(2);
    f.elements[1].dispatchEvent(new Event('error'));
    expect(f.player.status.phase).toBe('error');
    f.player.retryFromGesture();
    expect(f.elements).toHaveLength(3);
    expect(f.sessions).toHaveLength(2);
  });
});
