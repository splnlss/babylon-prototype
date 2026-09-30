# Review log: 001-babylon-sog-walk

**Phase:** Pre-build validation  
**PR base:** `main` when the remote branch exists  
**State:** Owner approved implementation and explicitly waived the full Claude implementation review; exact validated Netlify draft was published after separate approval, with unauthenticated production checks passing

## Numbered findings

1. **Asset orientation needs an explicit override (resolved in product code).** Babylon 9.28.0's `GaussianSplattingStream` constructor sets `rotation.x = -Math.PI / 2` and `scaling.y *= -1` for PlayCanvas SOG. With that default, ground-level camera poses showed the scene from the wrong plane. Setting `rotation.x = 0` while keeping the loader's Y flip produced a legible, upright view at camera `(0, 5, 40)` looking toward `(0, 5, 0)`. Evidence: `.context/ronda-far-pose-1.png`, `.context/ronda-transform-1.png`, `.context/ronda-ground-4.png`, `.context/babylon-stream-spike.png`. Product code applies and documents this scene-specific transform.
2. **The supplied public URL is the usable asset endpoint (validated).** The public `r2.dev` manifest and chunk requests worked from localhost. The earlier `r2.cloudflarestorage.com` endpoint returned an authorization error. The app must use the public URL and show network errors if it becomes unavailable.
3. **Spark.js cannot be substituted as Babylon's native stream renderer (design decision).** Spark.js is built around Three.js. Use Babylon's streamed-SOG implementation for this Babylon/WebXR demo; a Spark-based viewer would be a separate Three.js integration rather than a drop-in replacement.
4. **WebXR headset behavior is unverified (pending).** Headless desktop Chrome verifies neither immersive VR entry nor thumbstick movement or headset performance. Implement the planned XR logic and unit tests, then mark manual headset verification blocked until a headset is available.
5. **Netlify project and visibility are unresolved external actions (pending).** The owner requested a separate, public project and a manual Mac CLI draft-first release. The Mac CLI identified team `splnlss` (Ohayo Mountain INC); `ronda-lobato-babylon-sog-walk` is the proposed project name. No site ID exists, and no Netlify site was created or deployed. Netlify may only allow making a private project public after its first successful production deploy, so production approval must cover both exact-draft publication and an immediate Public visibility change if needed.

## Independent Claude Code review

Claude Code reviewed read-only in the same Conductor workspace on 2026-09-29, session `a21d8b0e-d43d-4e2a-a260-660f0ec0e040`. It independently inspected Babylon 9.28.0 types/source, fetched the public manifest/chunk metadata, and measured the approximate full SOG transfer at 159.8 MB. It did not run a browser or headset. Its findings are recorded below with Codex disposition.

6. **Publish exact tested draft, not a second `--prod` upload (high; addressed in design/plan).** Netlify's Publish Deploy action promotes the already-validated draft. Separate immediate approval still applies.
7. **Prevent Git auto-deploy explicitly (high; addressed in design/plan).** Create the new site blank and unlinked from Git; verify that state before calling criterion 7 complete.
8. **`r2.dev` is a testing host (high; owner decision recorded).** Cloudflare applies variable limits; the full SOG totals about 159.8 MB. The owner chose to accept `r2.dev` for this limited public prototype, with the constraint documented in the design, plan, and future README.
9. **Coarse spike settings did not exercise fine LOD (high; addressed in revised spike, XR open).** Re-ran with `memoryBudgetMb: 128`, `maxDetailLod: 0`, desktop `splatBudget: 600000`, and `decodeSh: false`. Chrome fetched payloads from levels 0–4 after moving toward the cottage, rendered the scene at `(0,5,40)`, `(0,5,30)`, `(0,5,20)`, and disposed cleanly. This validates the desktop starting settings, not Quest performance.
10. **Manifest validation contract mismatched Babylon's type (medium; addressed in plan).** Use `ISOGLODMetadata` and `GaussianSplattingStream.IsLODMetadata`, which checks `lodLevels`, `filenames`, and `tree`; do not require `version`.
11. **Quest 2 path omitted from the plan (medium; addressed).** Include USB `adb reverse` and Quest Browser steps, with HTTPS draft fallback when this cloud checkout is unavailable on the Mac. Headset verification is unverified in this cloud session, rather than inherently blocked for the owner.
12. **XR performance budget unmeasured (medium; addressed as measurement plan).** Start XR at 300,000 splats, record actual FPS/GPU time with OVR Metrics, and inspect CPU trace if needed. The 11.1 ms at 90 Hz is a target; no performance claim is made yet. The reviewer's stereo sort concern remains an unverified inference.
13. **Walking plane was not traversed (medium; addressed in revised spike).** Captured successive fixed-Y views at Z 40, 30, and 20. The cottage grows as expected and terrain stays below the camera. World-unit-to-metre scale and exact terrain height remain visual estimates, not surveyed values.
14. **Screenshots are gitignored (medium; accepted with prose evidence).** The decisive orientation and pose values, settings, and browser results are written here and in the pre-build report. `.context/` screenshots remain local test evidence and are not assumed to appear in a PR.
15. **TypeScript build could emit source-adjacent JavaScript (low; addressed in plan).** Use `noEmit: true` and `tsc --noEmit && vite build`.
16. **Spike package range is not an exact pin (low; addressed in plan).** The spike lockfile resolves 9.28.0, but its `package.json` uses `^9.28.0`. Product dependencies will use exact 9.28.0.
17. **Two behaviors lacked acceptance wording (low; addressed in design).** Criterion 2 now names Escape pointer release; criterion 3 names WebGL2 failure UI.
18. **Desktop input should detach in XR (low; addressed in design/plan).** Restore desktop bindings after XR exit.
19. **Custom XR movement needs a rationale and stable motion channel (low; addressed in plan).** Babylon's built-in movement uses the full head orientation and can move vertically; the custom horizontal path will use the XR camera's `cameraDirection` channel. Verify during implementation on a headset.
20. **Asset/run provenance was thin (low; partially addressed).** README/run log will record URL, generator/ETag, transform, camera pose, versions, and build/deploy IDs. The Colorado-only geospatial convention does not apply unless this local scene is later given a geographic anchor; no site coordinates are asserted here.
21. **Babylon differs from the family's Three.js/Spark stack (low; documented).** This viewer is a separate renderer integration. Logic and asset records may transfer, but Spark's renderer is not a Babylon component.

## Follow-up evidence

The original `.context/ronda-headers.txt` lacked an `Origin` request header. Codex re-fetched it with `Origin: http://127.0.0.1:5173`; the response shows `Access-Control-Allow-Origin: *` and exposes `Content-Length`, `Content-Range`, `Accept-Ranges`, `Content-Type`, and `ETag`. This supports cross-origin use for the manifest. Browser probes separately loaded chunk metadata and WebP payloads. The revised desktop spike reports `effectiveSplatBudget: 600000`, `residentSplatBudget: 1597830`, `minimumResidentSplats: 196909`, no page/request failures, and successful disposal.

Claude's read-only follow-up in the same session confirmed the revised walk screenshots and fine LOD payload requests. It found one remaining typo (`build = tsc && vite build` in Task 1) and four useful Quest-test details from the second attached strategy: time the production build, keep a local Quest route independent of Netlify approval, fall back to VrApi logcat if OVR CSV fails, and keep the headset worn/awake while testing framebuffer scale separately from splat budget. Codex applied these to the design and plan. The owner then chose `r2.dev` for this limited prototype and approved the revised pre-build package for implementation on 2026-09-29.

## Implementation evidence, before full Claude review

- Product code uses `GaussianSplattingStream` with the validated orientation and desktop settings. The `r2.dev` manifest and WebP chunks loaded in production-bundle localhost Chrome. The renderer reached a visible ready state; `.context/local-prototype.png`, `.context/local-prototype-walk.png`, and `.context/local-prototype-reset.png` record the start, forward walk, and Reset views.
- `npm run check` passed 17 tests; `npm run build` passed. Production browser smoke fetched the manifest and chunks, captured pointer lock, released it with Escape, and reported no page/request errors. An injected first-request HTTP 403 showed Retry and recovered to ready. A WebGL-disabled Chrome run displayed a WebGL2 requirement with no misleading Retry action.
- An initial direction bug was found: Babylon's `setTarget` yields yaw π at this start pose. A failing regression test preceded the correction so W now moves toward negative Z. Headless Chrome also kept pointer lock after Escape until the app explicitly called `exitPointerLock`; production smoke passes after that fix.
- The disposable spike was removed. The live product remains uncommitted because this checkout has no HEAD, and `AGENTS.md` reserves commits and PRs for the owner.
- Full-review Claude Code sessions `2fe55892-a1b8-4196-8580-f969705c8b21` (Opus) and `7dbd31bf-8da5-48ea-9d87-d4ffdc6686cf` (Sonnet) both stopped on a Conductor usage limit before inspecting the implementation. No independent implementation review result exists yet; the reported reset is 18:30 UTC.
- The owner then explicitly instructed Codex to skip the Claude review and deploy. This waives the independent full-diff review gate for this release; it does not turn the interrupted sessions into review evidence.

## Netlify draft evidence

- The owner's Mac CLI `27.3.0` created a new blank site `ronda-lobato-babylon-sog-walk`, ID `c36ba72b-98ec-4c0d-9bf9-31d1ec6c8600`, under team `splnlss`. Netlify's site API reported `repo_url: null`, empty `build_settings`, and no password. No existing Ronda Lobato site ID was reused.
- Conductor file sync was off. Codex transferred only a compressed `dist` archive to the Mac through authenticated local commands; archive SHA-256 `e1210c5498385a9b630bcba38ce80a477ae11574249ff8a1cdc9ab94f4674fb0` and extracted HTML/JavaScript hashes matched the cloud build.
- Mac CLI uploaded the exact `dist` with `--no-build` as draft `6abbe613c767a317895b5f12`: `https://6abbe613c767a317895b5f12--ronda-lobato-babylon-sog-walk.netlify.app/`. An unauthenticated GET returned 200. Downloaded HTML and main JavaScript SHA-256 values exactly matched `dist`.
- Hosted Chrome smoke reached ready, fetched the public manifest and WebP chunks, captured/released pointer lock, and reported no request/page errors. An injected first manifest HTTP 403 showed Retry and recovered to ready. Production URL returned 404 before publication, as expected.

## Production evidence

- The owner selected option 1 to approve publishing draft `6abbe613c767a317895b5f12` to `https://ronda-lobato-babylon-sog-walk.netlify.app/` and setting Public visibility if needed. Mac CLI called Netlify's `restoreSiteDeploy` endpoint; it published that same deploy at `2026-09-29T19:08:03.489Z` without a new upload. Netlify's site API reports `published_deploy.id` equal to the draft ID.
- An unauthenticated cloud GET returned HTTP 200 with SHA-256 identical to `dist/index.html`. The live main JavaScript also matched `dist`. Netlify's site API reports `password: null`, `repo_url: null`, and empty build settings. Public access required no visibility mutation.
- Production Chrome fetched the SOG manifest and WebP chunks, reached “Scene ready,” captured and released pointer lock, and reported no page or request failures. Quest headset checks remain unverified.
