# Babylon streamed SOG walking demo — design

**Topic:** `001-babylon-sog-walk`  
**Date:** 2026-09-29  
**PR base:** `main` once the remote branch exists  
**Status:** Owner approved on 2026-09-29, with the Netlify deployment requirement below

## Purpose and agreed scope

Build a small browser demo for exploring the Ronda Lobato Gaussian splat as a person walking through it. The owner chose Babylon.js with the supplied streamed SOG and approved desktop WASD/mouse controls plus headset thumbstick movement. The demo is a feasibility prototype, so it should make loading and movement easy to verify without adding scene editing, accounts, physics, or asset conversion. Publish the finished demo as a new, separate Netlify project whose production URL is publicly accessible without a password or team login.

The asset is hosted at:

`https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20260820_RondaLobato/lod-meta.json`

The manifest reports 8,171,666 splats across five LOD levels. From `http://127.0.0.1:5173`, Chrome successfully fetched the manifest, `0_0/meta.json`, and `0_0/means_l.webp`; the responses permitted cross-origin access. The earlier `r2.cloudflarestorage.com` URL is an authenticated API endpoint and is not used.

## Experience

On opening the app, the user sees a full-window first-person view and a compact overlay with loading status, controls, a Reset button, and an Enter VR button when immersive VR is available. The Ronda Lobato asset is the default scene. The camera begins at a fixed scene-specific pose selected during validation so visible splat content appears immediately. Reset returns to that same pose.

On desktop, clicking the canvas captures the pointer. Mouse motion looks around; W/A/S/D moves horizontally relative to the current heading at walking speed. Escape releases pointer capture. The camera maintains a fixed eye height. The overlay explains the controls and shows a recoverable error if the manifest or required chunks fail.

In WebXR, the user looks around with the headset and uses the left controller thumbstick to move horizontally relative to the headset heading. Physical room-scale movement continues to work. A headset without a thumbstick can still use room-scale tracking. Desktop keyboard and pointer-lock movement detach while XR is active and return on exit. The demo uses WebGL2 for its WebXR path. Enter VR is unavailable in browsers without immersive VR support.

The splat has no collision geometry. The viewer does not infer floors, stairs, walls, or walkable surfaces from splat pixels. Horizontal movement stays on a fixed plane, and the user may pass through visible objects. In XR the headset supplies the physical eye height above the fixed floor plane.

## Architecture and data flow

- A Vite and TypeScript single-page app creates one Babylon engine and scene on one canvas.
- A scene module fetches `lod-meta.json`, validates Babylon's `ISOGLODMetadata` shape, constructs Babylon's experimental `GaussianSplattingStream` with a bounded resident memory budget, and resolves relative chunk paths against the manifest directory. Babylon handles per-camera LOD selection and downloads. Initial settings validated in desktop Chrome are `memoryBudgetMb: 128`, `maxDetailLod: 0`, `splatBudget: 600000`, `decodeSh: false`, and `maxConcurrentDownloads: 2`; disabling SH decode uses flatter colour to reduce memory and decode cost. XR starts at a 300,000-splat cap and must be tuned from headset measurements.
- A desktop movement module owns keyboard and pointer-lock input. An XR movement module owns controller thumbstick input and applies horizontal movement to the XR rig. Both use elapsed frame time so speed is independent of frame rate.
- A small DOM overlay owns status, the control legend, Reset, and the VR entry affordance. It stays readable while the asset loads or errors.
- The asset URL and start pose are explicit configuration values in source. The app does not copy the large remote asset into Git.
- A root `netlify.toml` sets `npm run build` and `dist` for a static Netlify deployment. The new site is blank, separate from the existing Ronda Lobato WebXR test site, and unlinked from Git, so merging `main` cannot trigger deployment. A manual Netlify CLI action from the owner's Mac uploads an isolated draft; after it passes checks and receives separate immediate production approval, Netlify's **Publish Deploy** action promotes that exact draft without rebuilding. Site creation and draft upload require approval for the exact team, proposed site, and action.

The stream loader and its memory options follow [Babylon's Gaussian splatting documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/gaussianSplatting). The `lod-meta.json` directory format follows [PlayCanvas's Streamed SOG specification](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/streamed-sog/).

## Error handling and limits

- Manifest fetch or JSON errors show the failed URL and a Retry button. A retry creates a fresh stream rather than stacking duplicate meshes.
- If WebGL2 is unavailable, show a clear unsupported-browser message instead of a blank canvas.
- If immersive VR is unavailable or XR entry fails, desktop walking remains usable and the overlay reports the XR result.
- The asset is served from Cloudflare's public `r2.dev` development domain. Cloudflare rates this endpoint for testing, applies variable request and throughput limits, and recommends a custom domain for sustained production traffic. The full SOG asset is about 160 MB across all LODs, though a typical view downloads less. The owner chose to use `r2.dev` for this limited public prototype; the README will state that access may be throttled, and the app reports network failures rather than silently falling back to another scene.
- Streaming LOD in Babylon is experimental, so the Babylon package version is pinned and a package update requires revalidation.
- The source asset may have scene-specific orientation or alignment that differs from Babylon's default streamed-SOG transform. The start pose and transform must be selected from a legible localhost view before product implementation; a successful manifest fetch alone does not satisfy visual acceptance.
- Netlify team defaults may make a new project private. Before declaring deployment complete, verify the new project's production visibility is Public and an unauthenticated HTTP request reaches the app without a password or Netlify login page.

The implementation targets Node.js 22 and pins `@babylonjs/core` and `@babylonjs/loaders` to exact version `9.28.0`. The WebXR entry path requires a secure browser context (localhost during development or HTTPS when hosted). This is a local Babylon scene without a geospatial anchor, Supabase, globe tiles, or the Three.js/Spark story-viewer stack.

## Acceptance criteria

1. Opening the local app loads the supplied `lod-meta.json` and visibly renders Ronda Lobato without storing the asset in the repository.
2. The user can move with W/A/S/D and look with the mouse in a first-person desktop view; movement remains horizontal, Escape releases pointer capture, and Reset restores the start pose.
3. The app reports loading, streaming, and fetch errors in the overlay; Retry can recover after a transient failure without duplicating the scene. If WebGL2 is unavailable, the overlay explains that the browser is unsupported.
4. On a WebXR-capable headset, Enter VR starts immersive viewing, head tracking works, and the left thumbstick moves horizontally. Desktop input is inactive in XR and restored on exit. On an unsupported browser, the app says VR is unavailable while desktop mode still works. A Quest 2 test records both-eye visibility, control behavior, actual FPS and frame time, and the exact build/asset; the 90 Hz / 11.1 ms frame budget is a measurement target rather than an unverified pass claim.
5. The source and README explain the remote asset requirement, controls, no-collision behavior, run commands, and the limits of desktop-only verification.
6. Automated checks cover movement math and loader error handling; the app builds and a desktop browser smoke test confirms the manifest and at least one chunk payload are fetched.
7. After separate approval for the exact external action, the built app is uploaded manually from the owner's Mac to a new, Git-unlinked Netlify project. An isolated draft is checked for app response, production bundle hash, and SOG manifest/chunk fetch, then that exact deploy is published only after immediate production approval. The production URL loads for an unauthenticated visitor without a password or team login; the limited prototype uses the owner-approved `r2.dev` asset host.

## Validation and review plan

Before product implementation, Codex will validate Babylon 9.28's streamed SOG API and initial camera pose in a disposable spike. Claude Code will independently inspect the design, plan, asset accessibility, and API assumptions in a separate Conductor session. Codex will record both results and findings under `docs/reviews/001-babylon-sog-walk*.md`. The owner will confirm the reviewed pre-build package before implementation, as required by `AGENTS.md`.

After implementation, run `npm run check`, `npm run build`, and a localhost desktop browser smoke test. On the owner's Mac, serve the exact production `dist` build and use USB `adb reverse tcp:<port> tcp:<port>` to test `http://localhost:<port>` in Quest Browser; a synced copy or transferred `dist` is needed because this cloud checkout has no remote branch ref. Keep the headset worn and awake during measurements. Use OVR Metrics for device FPS/GPU time, VrApi logcat stats if its CSV capture fails, and a Chrome `xr.debug` trace if CPU cost needs diagnosis. If GPU-bound, test XR framebuffer scale separately from splat budget. A desktop emulator, including an optional development-only IWER harness, does not replace the headset run. Record the build, asset URL/version, camera pose, Quest OS/Browser version, and results. After approval to create the Git-unlinked site and upload an isolated draft, use the Mac Netlify CLI to deploy the verified `dist` with `--no-build`, then check the draft page, bundle SHA-256, and public SOG manifest/chunk requests in Quest Browser. Repeat the build and draft validation after any merge or change. A real WebXR headset is required to verify immersive movement and performance; without one, that acceptance check is explicitly blocked in this cloud session. Publishing the exact successful draft requires separate immediate owner approval under `AGENTS.md` after the target and action are prepared.
