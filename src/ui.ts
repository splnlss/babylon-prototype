import type { MediaStatus } from './media.js';

export function createOverlay(root: HTMLElement) {
  root.innerHTML = `
    <div class="hud">
      <div class="hud-top">
        <div class="hud-left">
          <button type="button" class="vr-button" data-action="vr" disabled title="Checking immersive VR support">Enter VR</button>
          <div class="brand">
            <span class="brand-mark" aria-hidden="true"></span>
            <div>
              <p class="eyebrow">BABYLON WEBXR STUDY</p>
              <h1>Ronda Lobato</h1>
            </div>
          </div>
        </div>
        <div class="status-pill"><span class="status-light" aria-hidden="true"></span><span role="status">Preparing viewer…</span></div>
      </div>
      <div class="hud-bottom">
        <div class="controls-card">
          <p class="controls-title">Explore the scene</p>
          <p class="controls-copy">Click the view to look around. Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. Press <kbd>Esc</kbd> to release the mouse.</p>
          <p class="controls-copy xr-copy">In VR, look around and move with the left thumbstick.</p>
          <div class="poi-warning" data-poi-warning hidden></div>
          <div class="media-box" data-media-box hidden><span data-media-status></span><button type="button" data-action="media-retry" hidden>Play media</button></div>
          <div class="error-box" role="alert" hidden></div>
          <div class="actions">
            <button type="button" data-action="reset">Reset view</button>
            <button type="button" data-action="retry" hidden>Retry loading</button>
          </div>
        </div>
        <p class="scene-note">Gaussian splat scene · No collision boundaries</p>
      </div>
      <div class="reticle" aria-hidden="true">+</div>
    </div>
  `;
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const alert = root.querySelector<HTMLElement>('[role="alert"]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-action="retry"]')!;
  const reset = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;
  const vr = root.querySelector<HTMLButtonElement>('[data-action="vr"]')!;
  const poiWarning = root.querySelector<HTMLElement>('[data-poi-warning]')!;
  const mediaBox = root.querySelector<HTMLElement>('[data-media-box]')!;
  const mediaText = root.querySelector<HTMLElement>('[data-media-status]')!;
  const mediaRetry = root.querySelector<HTMLButtonElement>('[data-action="media-retry"]')!;

  return {
    setStatus(message: string) {
      status.textContent = message;
      alert.hidden = true;
      retry.hidden = true;
      root.classList.remove('has-error');
    },
    setError(message: string, retryable = true) {
      status.textContent = 'Scene unavailable';
      alert.textContent = message;
      alert.hidden = false;
      retry.hidden = !retryable;
      root.classList.add('has-error');
    },
    setVrAvailable(available: boolean, reason = '') {
      vr.disabled = !available;
      vr.title = available ? 'Enter immersive VR' : reason;
      vr.textContent = available ? 'Enter VR' : 'VR unavailable';
    },
    setVrActive(active: boolean) {
      vr.textContent = active ? 'Exit VR' : 'Enter VR';
    },
    setMediaStatus(media: MediaStatus) {
      mediaBox.hidden = media.phase === 'idle';
      mediaText.textContent = media.message;
      mediaRetry.hidden = media.phase !== 'blocked' && media.phase !== 'error';
      mediaRetry.textContent = media.phase === 'error' ? 'Retry media' : 'Play media';
    },
    setPointerLocked(locked: boolean) { root.classList.toggle('pointer-locked', locked); },
    setPoiWarning(message: string | null) { poiWarning.hidden = !message; poiWarning.textContent = message ?? ''; },
    onMediaRetry(callback: () => void) { mediaRetry.onclick = callback; },
    onRetry(callback: () => void) { retry.onclick = callback; },
    onReset(callback: () => void) { reset.onclick = callback; },
    onEnterVr(callback: () => void) { vr.onclick = callback; },
  };
}
