# Ronda Lobato Babylon WebXR walk

A small first-person viewer for the [public streamed SOG](https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20260820_RondaLobato/lod-meta.json) asset. Babylon 9.28.0 downloads scene chunks as needed. The asset stays on Cloudflare R2 and is not included in this repository or build.

## Run

Use Node.js 22 or later.

```sh
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

Vite prints the localhost URL. `npm run check` runs TypeScript and behavior tests. `npm run build` produces `dist`. For a production-bundle browser smoke test, run `npm run preview -- --host 127.0.0.1 --port 4173`, then `node scripts/smoke.mjs http://127.0.0.1:4173/` and `node scripts/error-smoke.mjs http://127.0.0.1:4173/`. These scripts use the installed Google Chrome at `/usr/bin/google-chrome` and put screenshots in `.context/`.

## Controls

- Desktop: click the scene for pointer-lock mouse look; W/A/S/D or arrow keys to walk; Escape to release the mouse; Reset view to return to the start.
- WebXR: Enter VR on a supported headset; head tracking to look around; left thumbstick to walk; Exit VR or the headset system action to leave. Desktop input is detached while VR is active.

Two floating markers in the Ronda scene trigger media after you stand nearby for about 250 ms. The cyan VIDEO marker starts a fixed video surface using the owner's Bob Mux playback ID; the amber AUDIO marker starts narration that continues after you walk away. Approaching another marker replaces the current media. Click the video surface to pause or resume; with pointer lock, aim the centre reticle and click. In VR, select the surface with a controller ray. If autoplay is blocked or a source fails, use the visible Play/Retry action. Media is requested only after a POI activates. The pill-shaped VR button sits above the scene title and enables only when immersive VR is supported.

Open `?poiEditor=1` for a crude desktop placement view. Walk with W/A/S/D and turn with Q/E while the editor is open; typing in a field pauses movement. Select either POI, edit its source-space coordinates, use **Use current location**, and place or resize the solid video plane. **Download JSON** exports `ronda-pois.json`; review and copy it to [src/pois/ronda.json](src/pois/ronda.json) to use the draft. The editor does not play media, acquire pointer lock, save the draft automatically, or edit media URLs. The positions and floor height are provisional scene-unit placements, not surveyed exhibit coordinates.

Walking stays horizontal at a visually chosen eye height. There is no collision geometry, inferred floor, terrain following, or geospatial anchor. You can pass through visible objects. XR uses the headset's physical eye height over a fixed scene plane; the scene scale is an estimate rather than a surveyed metre scale.

The current camera start is world `(2.5, 1.2, 24)` facing the telephone pole. The provisional interaction floor is Y=`-0.4`; the video and audio markers sit near the pole at world `(-0.7, -0.4, 18.5)` and `(-2.4, -0.4, 18)`. These are desktop-reviewed placements to refine with the JSON editor and headset check.

## Asset and rendering limits

The manifest URL is set in `src/config.ts`. The source reports 8,171,666 splats across five levels; that is a source count, not the number drawn in each frame. The desktop render cap is 600,000 splats. The unverified XR candidate caps rendering at 300,000 to leave room above this asset's roughly 200,000-splat coarse base layer for streamed detail. Resident splat memory is capped at 128 MB. XR requests a half-scale framebuffer, no layer antialiasing, and fixed foveation 1 to reduce GPU work. `decodeSh: false` reduces memory and decoding cost but gives flatter colour. The renderer is Babylon's experimental `GaussianSplattingStream`, pinned to exact 9.28.0. Revalidate streaming and transforms before upgrading.

The `r2.dev` domain is Cloudflare's rate-limited public development endpoint. The owner accepted it for this limited prototype. Public traffic may be throttled. A failed manifest or required chunk shows a Retry action. There is no local asset fallback. The earlier `r2.cloudflarestorage.com` URL is an authenticated API endpoint and cannot serve this browser demo.

## Headset verification

Desktop Chrome validates loading and walking, but cannot establish immersive VR behavior, stereo visibility, controller input, or headset performance. On a Mac with a connected Quest 2, serve the **production** `dist` build using `npm run preview -- --host 0.0.0.0 --port 4173`, run `adb devices` and `adb reverse tcp:4173 tcp:4173`, then open `http://localhost:4173/` in Quest Browser. Keep the headset worn and awake. Check both eyes, head tracking, left-stick movement, exit and reentry, and Retry after a network failure. Record Quest OS/Browser versions, build identity, asset ETag, and OVR Metrics FPS/GPU time after the scene warms up. If OVR CSV capture fails, use VrApi logcat stats; if CPU work dominates, inspect Chrome `xr.debug`. A 90 Hz refresh allows about 11.1 ms per frame, a target to measure rather than a claimed result. A hosted HTTPS draft is another headset test route after its separate approval.

## Netlify release procedure

The separate blank project now exists under team `splnlss` (Ohayo Mountain INC): `ronda-lobato-babylon-sog-walk`, site ID `c36ba72b-98ec-4c0d-9bf9-31d1ec6c8600`. Its site API reports no Git repository or build connection, so merging `main` cannot auto-deploy it. It was created with `netlify sites:create --account-slug splnlss --name ronda-lobato-babylon-sog-walk --disable-linking --json`. `netlify.toml` describes the static build, but publication is manual.

The live site is [ronda-lobato-babylon-sog-walk.netlify.app](https://ronda-lobato-babylon-sog-walk.netlify.app/). Its current published deploy is `6abc33c30e0da3b92620c5be`, promoted from the exact tested draft with Netlify's `restoreSiteDeploy` API after owner approval. The prior deploy `6abbe613c767a317895b5f12` remains available for rollback. The live HTML and main JavaScript SHA-256 hashes match the verified `dist`; an unauthenticated browser fetched the SOG manifest and WebP chunks and reached the ready scene. Quest VR flicker has not yet been retested on this release. Netlify's site API reports no Git connection or password. For future releases, build and validate a new draft, obtain separate immediate approval for its exact ID, then publish that same deploy. If visibility ever changes to Private, [Netlify may only offer Make public after a successful production deploy](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/); verify unauthenticated access after every publication. Do not use a fresh `--prod` upload in place of the checked draft.

Build and asset details are in [the run log](docs/reviews/001-babylon-sog-walk-run-log.md). The approved design and plan are under `docs/superpowers/`.
