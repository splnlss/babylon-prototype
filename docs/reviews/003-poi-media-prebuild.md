# Pre-build review: BabylonJS POI player and placement tool

**Date:** 2026-09-30
**State:** Owner approved this reviewed pre-build package and the separate bounded public-media probe on 2026-09-30. Local media probe completed within the approved limits; headset validation remains pending.
**Base:** `67df15de13c1973e262719a7fe034410bf3172a4` on `w-23/poi-media-player-review`; remote base available today is `origin/rabat` (no `origin/main`).
**Design:** [Approved owner attachment copied verbatim](../superpowers/specs/2026-09-30-poi-media-design.md)
**Plan:** [Narrowed BabylonJS plan](../superpowers/plans/2026-09-30-poi-media.md)
**Review findings:** [003-poi-media.md](003-poi-media.md)

## Approach and alternatives

Implement two scene POIs in the current streamed Ronda SOG viewer. Their checked-in `src/pois/ronda.json` stores source-space POI and video-plane poses. A pure tracker applies dwell and hysteresis, one media controller owns HTML audio/video and HLS, and a Babylon `VideoTexture` displays active video on a fixed plane. `?poiEditor=1` presents a crude desktop placement panel with live placeholder preview and a JSON download; it does not play media, save data, or offer import/add/delete. This slice does not claim the full broad-design editor or Quest acceptance criteria.

DOM/iframe video cannot appear as the required scene-anchored plane inside immersive XR. A WebXR composition layer may reduce video texture cost but needs a separate headset prototype; use it only if the video mesh exceeds the Quest budget. The existing SOG stream stays in place, with the current stereo sort/index helpers unchanged.

## Local evidence gathered in this workspace

1. `npm ci` succeeded with 0 reported vulnerabilities. `npm run check` passed TypeScript and **19/19 tests**. `npm run build` succeeded; Vite reported an existing >500 kB bundle warning. No app code was changed for these checks.
2. Babylon 9.28.0's installed SOG source flips Y (`scaling.y *= -1`) and initially rotates X by `-π/2`; current `src/main.ts` resets X rotation to 0. A local `NullEngine` probe with host scale `(1,-1,1)` mapped source `(2,-3.4,38)` to world `(2,3.4,38)`.
3. Babylon 9.28.0's `VideoTexture` defaults include autoplay and loop. Its `independentVideoSource` branch does not own `play()`, `pause()`, loop, or mute. A local fake-element `NullEngine` probe observed **0 implicit play calls**, **0 implicit pause calls**, `loop=false`, `muted=false`, and independent disposal did not pause the element.
4. A local Chromium/WebGL2 probe generated a 64×64 WebM clip in memory via `MediaRecorder`. With `independentVideoSource: true`, `VideoTexture` made **0 play calls before the explicit start**; the explicit start was the only play call; the clip fired `ended`, remained unmuted/nonlooping, and the page reported no errors in the final run. The direct Babylon imports required `engine.dynamicTexture.js` and `engine.videoTexture.js` extension imports; earlier runs without them produced missing-method errors. The plan now names those imports. This proves local synthetic playback behavior only.
5. Babylon's default `CreatePlane` normal is `(0,0,-1)` in a local `NullEngine` check. A plane ahead of a visitor walking toward decreasing Z must face back toward the POI; the final pose still needs a real scene visibility/picking check before checking in coordinates.

The disposable probe is under `spikes/003-poi-media-feasibility/` and will be removed before a PR. The checks above requested no Mux, R2, or Ronda media URL. No Quest or XR runtime was available in this cloud workspace.

## Proposed placement to review

The approved Three.js design put the video POI at world `(0,0,42)`, audio at `(2,0,38)`, and plane centre `(0,1.65,40.2)`, assuming a different host and spawn. This viewer starts its desktop eye at `(0,5,40)` facing decreasing Z; it has no surveyed floor, collision, or world-units-per-metre scale. The XR initial camera base is assigned Y=3.4, but the precise floor/eye effect of that assignment has not been checked on a headset. At Y=0, a 0.6-unit vertical tolerance would likely prevent POI activation.

For a **temporary authoring proposal**, assume floor Y=3.4 (eye height 1.6 scene units), video POI world `(0,3.4,37)`, audio POI world `(2,3.4,32)`, and a 1.6×0.9 video plane centre at world `(0,5.05,35.2)`, facing the standing video POI at Z=37. With the measured Y reflection and no other host transform, the corresponding source points are `(0,-3.4,37)`, `(2,-3.4,32)`, and `(0,-5.05,35.2)`. This puts both markers ahead of the current spawn and the plane 1.8 units ahead of the video standing point. It **changes** the approved design's visible positions and its literal plane coordinate. The owner must accept or revise the placement after a scene check; these numbers are not a surveyed metre placement or an implemented manifest.

## Bounded external-media probe and observed result

The three public targets from the approved design are:

| Purpose | Exact target |
| --- | --- |
| Mux video | `https://stream.mux.com/rR8P8mSaKDzz02TsftugTUdI00cQPJX00oy.m3u8?max_resolution=720p` ([Mux modifier syntax](https://www.mux.com/docs/guides/control-playback-resolution)) |
| Mux audio candidate | `https://stream.mux.com/BvRHSlj5WGXeIG2HCr5t9w02ZMUXmzLkKNYofkE02JgH00.m3u8` |
| R2 audio fallback | `https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20221110_rondajoseph-storyoutline_v1-AudioOnly.m4a` |

The approved method requested one Mux audio master playlist, one selected variant playlist, one selected segment range `0-262143` with a 512 KiB abort threshold, one R2 M4A range `0-262143` with the same threshold, and one desktop video play stopped at 15 seconds or 5 MiB of completed transfers. No account API, signed URL, upload, proxy, or production mutation was involved.

- Mux audio master: HTTP 200, **460 bytes**, with one variant advertising `CODECS="mp4a.40.2"` and no video codec. The variant was HTTP 200, **36,632 bytes**. Its first selected segment honored Range (HTTP 206), returning **129,720 bytes**. A local MPEG-TS PAT/PMT inspection found one elementary stream, type `0x0f` (AAC) on PID 257, and no video stream. This supports using the supplied Mux ID as the primary **audio-only** source for the checked-in POI. It does not prove complete-track playback or device compatibility.
- R2 M4A: HTTP 206 for bytes `0-262143/19084450`, **262,144 bytes**. The first bytes contain an `M4A`/MP4 `ftyp` box. Public media-element playback and range/CORS behavior beyond this initial request remain unverified.
- Mux video: the capped master was HTTP 200, **1,420 bytes**, advertising up to **1280×720**. One local headless Chromium/WebGL2/HLS.js play reached a 1280×720 decoded frame at media time **0.386 s**, then stopped. CDP observed **5 Mux requests**, **4,272,196 completed transfer bytes** (below 5 MiB), **0 newly initiated Mux requests** in the next five seconds, and **0 page errors**. This is desktop playback evidence only; it does not establish Quest performance, XR selection, audio-with-sound autoplay, or universal teardown behavior.

## Acceptance coverage and limits

| Design criterion | This slice's path | Pre-build status |
| --- | --- | --- |
| 1: Ronda POIs and other asset | JSON keyed to current SOG; visible markers | Coordinate mapping proposed, no scene calibration; other-asset test planned |
| 2: proximity/dwell/overlap | Pure tracker and fixture tests | Not implemented |
| 3: fixed Mux video and desktop/XR selection | Babylon plane, one input router | Real desktop Mux frame at 720p; XR unverified |
| 4: video teardown | One media controller, scene/page disposal | Synthetic texture disposal and one real HLS post-stop quiet interval checked; full lifecycle unimplemented |
| 5: audio-only/walk-away/fallback | Validated Mux audio or R2-only | Mux sample audio-only verified; full audio playback and R2 fallback unverified |
| 6: status/autoplay/XR exit | Desktop and scene-mesh status/retry | Browser gesture and XR session unverified |
| 7: editor | Place two POIs/plane, export JSON | Narrowed crude tool only; no import/add/delete |
| 8: checks and Quest | Unit/type/build and device protocol | Baseline 19/19 + build only; real Quest with video blocked |

The published Quest follow-up recorded best warmed median 12.34 ms and p99 18.31 ms against an 11.1 ms/90 Hz target **before video**, plus unresolved flicker. The current 300k-splat setting was not retested on Quest. A 720p stream cap and HLS buffer cap do not solve this renderer cost. No Quest video visibility, controller selection, frame pacing, or comfort claim will follow from local Chromium/IWER alone.

## Approved decisions and remaining limits

1. The owner approved the pre-build package, including the **provisional** proposed POI/plane positions, floor Y=3.4, 0.25-unit overlap margin, and exact `hls.js@1.7.3` (Apache-2.0 according to npm metadata checked on 2026-09-30). These are scene-unit engineering placements, not a measured metre scale or headset-calibrated exhibit locations. Use a front-facing video plane unless a later product check requests back-side visibility.
2. The owner separately approved the exact bounded Mux/R2 probe; the observations above stayed within its byte/time limits. The sampled Mux audio stream is audio-only, so the implementation may use it as primary with R2 as fatal-source fallback.
3. Real Quest video visibility, selection, frame pacing, and comfort remain blocked without a headset, and the existing SOG-only frame-time baseline already missed a consistent 90 Hz target. Do not present desktop evidence as headset acceptance.
