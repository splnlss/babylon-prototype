# Babylon streamed SOG walking demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task in the current Conductor workspace. The owner chose Codex implementation with separate Claude Code review. Do not create another worktree or commit automatically; `AGENTS.md` overrides generic skill instructions on those points. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a basic Babylon walking viewer for the public Ronda Lobato streamed SOG.

**Architecture:** A Vite/TypeScript app uses Babylon 9.28's `GaussianSplattingStream` for LOD loading. Separate movement modules handle desktop and WebXR while a small overlay displays state and controls. A blank, Git-unlinked Netlify project serves the static `dist` output after draft validation and separate production approval.

**Tech Stack:** Node.js 22, Vite, TypeScript, Babylon.js 9.28.0, Vitest, Netlify static hosting.

**Spec:** `docs/superpowers/specs/2026-09-29-babylon-sog-walk-design.md`

## Global Constraints

- Asset: `https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20260820_RondaLobato/lod-meta.json`; keep it remote.
- Pin `@babylonjs/core` and `@babylonjs/loaders` to exact `9.28.0`; revalidate before upgrading. Set `tsconfig.json` to `noEmit: true`; build with `tsc --noEmit && vite build`.
- Initial stream settings: `memoryBudgetMb: 128`, `maxDetailLod: 0`, `splatBudget: 600000` on desktop and `300000` in XR, `decodeSh: false`, `maxConcurrentDownloads: 2`. Desktop settings were tested in the spike; XR settings are provisional until measured on Quest 2. The source contains 8.17M splats; the budget caps rendered splats, and the full 160 MB is not normally fetched at the start pose.
- Use WebGL2 for XR and a secure context (localhost or HTTPS).
- Desktop: W/A/S/D, pointer-lock mouse look, horizontal movement, Reset. XR: head tracking and left-thumbstick horizontal movement. No collision mesh, terrain following, or inferred floor.
- New Netlify project, production visibility Public, no password or team login. Create it blank and unlinked from Git; use the owner's Mac Netlify CLI for a draft, then publish that exact draft from Netlify's Deploys page after separate immediate approval. Merging `main` must not auto-publish. Netlify may only offer **Make public** after a successful production deploy; if so, the separate production approval must explicitly cover publishing the draft and immediately changing production visibility to Public. Do not create the project, upload a draft, or publish without approval for the exact external action.
- Public asset hosting on `r2.dev` is for testing and is rate-limited. The owner chose to accept it for this limited public prototype; document the throttle risk and keep the URL explicit so it can be replaced later.
- No nested worktree, commit, push, PR, or merge without owner direction.

## Review Focus

1. Failed or malformed manifest must leave a readable Retry action. Task 1 tests HTTP failure and invalid JSON shape.
2. A second load attempt must dispose the old stream and avoid duplicate rendering. Task 1 tests the replacement lifecycle with a fake stream.
3. Diagonal or high-frame-time movement must not exceed walking speed or jump unexpectedly. Task 2 tests normalization and delta-time clamping.
4. An absent or disconnected XR gamepad must never move the rig. Task 3 tests zero axes and disconnect behavior.
5. A Netlify project created under a private-by-default team must be made public before completion is claimed. Task 4 checks unauthenticated production access.
6. The asset's actual orientation and a legible walking start pose need visual validation; a network-only spike is insufficient. Move along the fixed plane at more than one position and inspect the view.
7. XR sort/render cost may differ from desktop or even run per stereo eye; record device FPS and GPU time before changing budgets. The target at Quest 2's default 90 Hz is about 11.1 ms per frame, but a headset measurement decides whether the prototype meets it.

## Acceptance coverage

| Criterion | Work | Verification |
| --- | --- | --- |
| 1 | Task 1 stream loader and start pose | Local browser screenshot and network requests |
| 2 | Task 2 desktop walking | Unit tests plus browser keyboard/mouse check |
| 3 | Task 1 state and retry | Unit tests plus simulated network failure |
| 4 | Task 3 XR movement | Unit tests; Quest 2 local or HTTPS-draft run, both-eye and OVR Metrics check |
| 5 | Task 4 README | Review README against actual app |
| 6 | Tasks 1–3 checks | `npm run check`, `npm run build`, browser smoke test |
| 7 | Task 4 manual Mac CLI draft and gated promotion of that draft | Git-unlinked site inspection, draft page, bundle SHA-256, SOG manifest/chunk fetch, unauthenticated production GET and visibility inspection |

## File map

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`: toolchain and HTML shell.
- `src/config.ts`: asset URL, movement speed, validated start pose/transform, desktop and provisional XR stream budgets.
- `src/sog.ts`: manifest fetch/validation and stream lifecycle.
- `src/movement.ts`: pure horizontal movement math shared by desktop and XR.
- `src/desktop.ts`: keyboard and pointer-lock bindings.
- `src/xr.ts`: XR setup and left-thumbstick movement.
- `src/ui.ts`, `src/style.css`: overlay state and controls.
- `src/main.ts`: scene creation, render loop, module orchestration, disposal.
- `tests/sog.test.ts`, `tests/movement.test.ts`, `tests/xr.test.ts`: behavior checks.
- `netlify.toml`, `README.md`: deployment configuration and usage.

## Pre-build validation and gate

- [x] In `spikes/001-babylon-stream/`, verify Babylon 9.28.0 can construct `GaussianSplattingStream` from the real manifest, reach a visible base LOD in Chrome, and dispose it cleanly. Determine whether the loader's default SOG transform matches this asset, and record a legible start pose and exact package/API evidence. Re-test the intended desktop budget and several walking-plane poses. Remove the spike before a PR.
- [x] Claude Code independently verifies asset access, streamed-SOG API assumptions, and design/plan coverage in a separate session without editing tracked files.
- [x] Codex writes `docs/reviews/001-babylon-sog-walk.md` with numbered findings and `docs/reviews/001-babylon-sog-walk-prebuild.md` with both validation results, risks, acceptance coverage, and unresolved decisions.
- [x] Owner confirms that reviewed pre-build package before Tasks 1–4 begin.

### Task 1: Streamed SOG viewer and load state

**Files:** Create toolchain shell, `src/config.ts`, `src/sog.ts`, `src/ui.ts`, `src/main.ts`, `src/style.css`, `tests/sog.test.ts`.

**Interfaces:** `fetchManifest(url: string, fetcher = fetch): Promise<{metadata: ISOGLODMetadata; rootUrl: string}>` validates `lodLevels`, `filenames`, and `tree` with `GaussianSplattingStream.IsLODMetadata` and derives the chunk base URL. `replaceStream(oldStream, createNext): GaussianSplattingStream` disposes the prior stream and calls an injected factory, so lifecycle behavior can be tested without a GPU. `createOverlay(root): Overlay` exposes `setStatus(message)`, `setError(message)`, `onRetry(callback)`, and `onReset(callback)`.

- [x] Create the minimal package/test runner scripts (`test = vitest run`, `check = tsc --noEmit && vitest run`, `build = tsc --noEmit && vite build`, `preview = vite preview`), then write `tests/sog.test.ts`: a valid fixture resolves the manifest root URL; HTTP 403 and malformed JSON reject with the requested URL; a second `replaceStream` disposes the first fake stream exactly once.
- [x] Run `npm run test -- tests/sog.test.ts` and confirm the tests fail for missing behavior.
- [x] Implement the Vite shell, Babylon WebGL2 scene, bounded-memory stream with `rotation.x = 0` while retaining Babylon's Y flip, overlay, Retry, and Reset using the validated start pose. Render while the stream refines; show an error instead of a blank canvas on WebGL2 or load failure. Show loaded/selected splats or a neutral ready state without labeling the full source count as rendered splats.
- [x] Run `npm run test -- tests/sog.test.ts`, `npm run check`, and `npm run build`. Verify a localhost browser receives the manifest and at least one chunk payload, and capture a screenshot under `.context/`.

### Task 2: Desktop walking

**Files:** Create `src/movement.ts`, `src/desktop.ts`, `tests/movement.test.ts`; modify `src/main.ts`, `src/ui.ts`.

**Interfaces:** `horizontalDelta(forward: number, strafe: number, yaw: number, seconds: number, speed: number): {x: number; z: number}` normalizes input and clamps a single frame's elapsed time. `attachDesktopControls(canvas, camera, scene): () => void` installs and removes inputs.

- [x] Write movement tests for forward direction, diagonal normalization, yaw rotation, and a long-frame cap; confirm they fail before implementation.
- [x] Implement W/A/S/D input, mouse pointer lock, fixed eye height, elapsed-time movement, Escape release, and Reset. Dispose input listeners on teardown. Set desktop eye height to world Y = 5 and document that the scene-to-metre scale and terrain level are visually estimated, not surveyed.
- [x] Run the movement tests, `npm run check`, and a desktop browser check for walking from `(0,5,40)` toward `(0,5,20)`, looking, and Reset. Capture two distinct views after movement.

### Task 3: WebXR entry and thumbstick movement

**Files:** Create `src/xr.ts`, `tests/xr.test.ts`; modify `src/main.ts`, `src/ui.ts`, `src/movement.ts` if required.

**Interfaces:** `readLeftStick(gamepad: Gamepad | null): {forward: number; strafe: number}` applies a 0.15 dead zone and returns zero for a missing gamepad; `attachXrMovement(scene, xrExperience): () => void` selects the left controller, moves the XR camera through `cameraDirection` horizontally from headset yaw using shared movement math, and removes listeners on disposal. Babylon's built-in `WebXRControllerMovement` uses the full head orientation and can move vertically, so use the custom fixed-plane path.

- [x] Write tests for missing gamepad, controller disconnect, dead-zone behavior, and forward/strafe mapping; confirm they fail before implementation.
- [x] Implement immersive VR availability/entry, head tracking, left-stick locomotion, graceful XR error state, and listener cleanup. Detach desktop keyboard/pointer controls on XR entry and restore them on exit. Set `stream.splatBudget = 300000` during XR and restore 600000 on exit; treat this as an initial setting subject to Quest 2 measurement.
- [ ] Run the XR tests, `npm run check`, and `npm run build`. For timed Quest tests, serve the exact production `dist` build on the owner's Mac with `npm run preview -- --host 0.0.0.0 --port <port>` or an equivalent static server, then use USB `adb devices`, `adb reverse tcp:<port> tcp:<port>`, and Quest Browser `http://localhost:<port>`; do not time a Vite dev/HMR build. A synced Mac copy or transferred `dist` is needed because this cloud checkout has no remote branch ref. An HTTPS Netlify draft can also test the hosted route after its separate approval, but is not required for the local headset check. Confirm the headset is worn and awake, and inspect both eyes, head tracking, thumbstick movement and exit/reentry. Record OVR Metrics FPS/GPU time at the same pose and asset warm-up, plus Quest OS/Browser version and build identity; if OVR CSV fails, collect VrApi logcat stats, and use Chrome `xr.debug` tracing if CPU cost needs diagnosis. If GPU-bound, compare splat budget and `XRWebGLLayer` `framebufferScaleFactor` separately (Babylon `outputCanvasOptions.canvasOptions`), preserving visual notes. Desktop IWER input replay may be tried as a development-only extra, not as a headset substitute. If this cloud session cannot access a headset, report its result as unverified and give owner steps.

### Task 4: Documentation and deployment readiness

**Files:** Create `netlify.toml`, `README.md`; update `docs/templates/PR_DESCRIPTION.md` only if the template needs project-specific acceptance steps.

- [x] Set `[build] command = "npm run build"` and `publish = "dist"`; add README run commands, controls, no-collision behavior, remote-asset dependency and its `r2.dev` rate-limit caveat, the flat-colour tradeoff of `decodeSh: false`, blank/unlinked Netlify setup, and headset-test steps/limit. Record the asset URL, manifest ETag or checksum, source generator, transform, camera pose, installed library versions, and build/deploy IDs in a short run log. No geospatial anchor is asserted by this local-only demo.
- [x] Run `npm run check`, `npm run build`, and a production-bundle localhost smoke test. Review the full diff against the spec and remove disposable spikes.
- [ ] Have Claude Code independently review the complete diff and run applicable checks. The owner explicitly waived this full implementation review for deployment after both Claude sessions hit a usage limit; the pre-build Claude review remains recorded. PR description prepared without committing or opening a PR.
- [x] Prepare the exact Netlify team, new project name, visibility setting, verified `dist` directory, and Mac CLI commands for owner approval. No external mutation occurs in this step.
- [x] After approval to create the new blank, Git-unlinked site and upload a draft, use `netlify deploy --site <new-site-id> --dir dist --no-build` from the Mac. Check the isolated draft page, bundle SHA-256 against local `dist`, and browser fetches of the SOG manifest and at least one chunk. Record the Netlify deploy ID. Repeat on a new build after any merge.
- [x] After separate immediate production approval covering the exact draft ID and, if needed, the Public visibility change, use Netlify's `restoreSiteDeploy` API equivalent of **Publish Deploy** on that draft. Netlify reports the same deploy ID as published; unauthenticated production GET and browser checks returned the exact app without a password or team login. No visibility change was needed. Do not substitute a fresh `--prod` upload for the validated draft.
