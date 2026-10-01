export function createOverlay(root: HTMLElement) {
  root.innerHTML = `
    <button type="button" class="vr-button" data-action="vr" disabled title="Checking immersive VR support">Enter VR</button>
    <div class="error-panel" hidden>
      <div class="error-box" role="alert" hidden></div>
      <button type="button" data-action="retry" hidden>Retry loading</button>
    </div>
  `;
  const errorPanel = root.querySelector<HTMLElement>('.error-panel')!;
  const alert = root.querySelector<HTMLElement>('[role="alert"]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-action="retry"]')!;
  const vr = root.querySelector<HTMLButtonElement>('[data-action="vr"]')!;

  return {
    clearError() {
      errorPanel.hidden = true;
      alert.hidden = true;
      retry.hidden = true;
    },
    setError(message: string, retryable = true) {
      alert.textContent = message;
      alert.hidden = false;
      retry.hidden = !retryable;
      errorPanel.hidden = false;
    },
    setVrAvailable(available: boolean, reason = '') {
      vr.disabled = !available;
      vr.title = available ? 'Enter immersive VR' : reason;
      vr.textContent = 'Enter VR';
    },
    setVrActive(active: boolean) {
      vr.textContent = active ? 'Exit VR' : 'Enter VR';
    },
    onRetry(callback: () => void) { retry.onclick = callback; },
    onEnterVr(callback: () => void) { vr.onclick = callback; },
  };
}
