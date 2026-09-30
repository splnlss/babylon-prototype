# Pre-build package: Babylon streamed SOG walking demo

**Date:** 2026-09-29  
**Design:** `docs/superpowers/specs/2026-09-29-babylon-sog-walk-design.md`  
**Plan:** `docs/superpowers/plans/2026-09-29-babylon-sog-walk.md`  
**Review log:** `docs/reviews/001-babylon-sog-walk.md`  
**Gate:** Independent Claude Code review completed and incorporated; owner chose `r2.dev` for a limited prototype; awaiting confirmation of this revised package before product implementation

## Approach and alternatives

Use Vite/TypeScript, Babylon 9.28.0, and `GaussianSplattingStream` from `@babylonjs/loaders/SPLAT/gaussianSplattingStream.js`. Fetch the public `lod-meta.json`, validate `ISOGLODMetadata`, and pass its directory as `rootUrl`; Babylon streams its SOG chunks. Add desktop WASD/mouse walking, a fixed-height XR rig with left-thumbstick movement, loading/error/retry UI, and a scene-specific orientation override and start pose. Keep the large asset remote. Use an exact Babylon version pin in the product package.

Spark.js is a Three.js renderer and would require rebuilding the viewer on Three.js rather than swapping a Babylon viewer component. A monolithic `.sog` or `.rad` download would give up this asset's existing chunked LOD path. The public R2 URL made an edge proxy unnecessary in localhost testing.

## Codex throwaway validation

Disposable files are under `spikes/001-babylon-stream/` and must be removed before a PR. The spike's lockfile resolves `@babylonjs/core` and `@babylonjs/loaders` to `9.28.0`; its package manifest has a caret range, so the product will use exact version strings. The public manifest reports 8,171,666 source splats and five LOD levels. Its generator is `splat-transform v3.7.0`; the manifest's current ETag is `4c1119ec3c572d9a76e5d203985a19a3` (an object version indicator, not a content hash).

On localhost, `node probe.mjs` using Chrome/SwiftShader with the intended desktop settings returned `Ready: 8,171,666 source splats`, `manifestFetched: true`, `chunkFetched: true`, `fetchedCount: 25`, `effectiveSplatBudget: 600000`, `residentSplatBudget: 1597830`, `minimumResidentSplats: 196909`, `failures: []`, and `disposed: true` (exit 0). The ready label names the manifest source count, not the rendered count. An `Origin`-bearing request confirmed `Access-Control-Allow-Origin: *` and exposed range/content headers. The final screenshot is `.context/babylon-stream-spike.png`; screenshots stay gitignored, while values and results are recorded in this report.

The key finding is orientation. Babylon's streamed-SOG constructor rotates the mesh by `-π/2` around X and flips Y by default. This asset's root bound spans about 109.1 × 35.6 × 113.8 world units, with Y as the short axis. Leaving the loader's Y flip and overriding `rotation.x = 0` produced a legible upright scene. The selected start pose is camera `(0, 5, 40)` targeting `(0, 5, 0)`. The revised spike used `memoryBudgetMb: 128`, `maxDetailLod: 0`, `splatBudget: 600000`, `decodeSh: false`, and `maxConcurrentDownloads: 2`. Moving the camera along Y = 5 from Z = 40 to 30 to 20 produced progressively closer views of the cottage; browser requests included actual WebP payloads from levels 0–4 by the second pose. The no-collision design uses this visually selected plane. The spike does not establish a surveyed world-unit-to-metre scale, exact eye height, or safe traversal.

## Acceptance coverage

| Criterion | Planned check | Pre-build evidence/status |
| --- | --- | --- |
| 1. Render the asset | Browser screenshot and network trace | Revised spike shows a legible ground-level scene at intended desktop settings, and manifest/chunk fetches including fine LOD payloads after moving |
| 2. Desktop walk/look/reset | Movement tests and browser input check | Planned for implementation |
| 3. Loading/errors/retry | Loader lifecycle tests and simulated failure | Planned for implementation |
| 4. WebXR/thumbstick | XR input tests and headset trial | Desktop checks planned; Quest 2 local/draft test protocol documented; unverified in this cloud session |
| 5. Source and README | Documentation review | Planned for implementation |
| 6. Checks/build/browser | `npm run check`, `npm run build`, browser smoke | Browser spike passed; product checks await implementation |
| 7. Separate public Netlify site | Git-unlinked site, Mac CLI draft checks, promotion of same deploy after approval, unauthenticated GET | Site/team undecided; owner accepted `r2.dev` limit for this prototype; no external action taken |

## Deployment decision and release sequence

This repository will prepare `dist` and `netlify.toml`, but publishing is manual from the owner's Mac. Create a blank Netlify site unlinked from Git so merging `main` cannot auto-deploy. After the new team/site is chosen and creation/draft upload are approved, build and verify `dist`; use `netlify deploy --site <new-site-id> --dir dist --no-build` for an isolated draft. Check the draft HTML, SHA-256 of the deployed JavaScript bundle against local `dist`, and browser requests for the public SOG manifest and at least one chunk. Test the draft in Quest Browser over HTTPS if a headset is available. Repeat on the exact post-merge build. Only after separate immediate production approval, use Netlify's **Publish Deploy** on the verified draft ID; it publishes that atomic deploy without a new upload. Verify public visibility and an unauthenticated production GET. The other repository's site ID must not be reused.

## Pending review and decisions

1. Claude Code's independent review in session `a21d8b0e-d43d-4e2a-a260-660f0ec0e040` is recorded as findings 6–21 in the review log. Its API, orientation, CORS, and asset-size checks were read-only; it did not run a browser or headset. Codex revised the design, plan, and desktop spike evidence accordingly.
2. The owner chose the rate-limited `r2.dev` endpoint for this limited public prototype. Cloudflare says this endpoint is for development; its full SOG transfer is about 159.8 MB. The README and release report must retain this constraint.
3. The owner must confirm this revised pre-build package before product Tasks 1–4 begin, per `AGENTS.md`.
4. The Netlify team and proposed project name are needed before site creation; they do not block local implementation after the pre-build gate.
5. Headset XR interaction and performance remain unverified until tested on suitable hardware. The owner's Quest 2 can use Mac USB `adb reverse` to a served production `dist` build; a separately approved HTTPS draft tests the hosted route. Keep the headset worn and awake. At the default 90 Hz, record actual FPS and GPU time against the 11.1 ms frame budget. If OVR Metrics CSV fails, collect VrApi logcat stats; if GPU-bound, compare splat budget and XR framebuffer scale separately. An optional development-only IWER harness can test input and session behavior on desktop, but not device performance or comfort.
6. The additional `webxr-testing-strategy.md` attachment is based on a separate Three.js/Spark app. Its build identity, headset telemetry, hosted HTTPS check, and optional IWER ideas transfer here. Its Supabase, Google/Cesium, multi-object RAD, shared Spark budget, and thumbstick-still expectations do not apply to this Babylon walking demo.
