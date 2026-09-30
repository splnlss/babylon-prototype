## Change

Build a Babylon 9.28 WebXR walking viewer for the public Ronda Lobato streamed SOG. The app loads LOD chunks from R2, begins at a visually checked pose, supports desktop walking and headset thumbstick movement, and reports load failures with Retry. A separate Git-unlinked Netlify project is prepared for manual draft validation and later public release. [Design](../superpowers/specs/2026-09-29-babylon-sog-walk-design.md) · [Plan](../superpowers/plans/2026-09-29-babylon-sog-walk.md)

## Review and decisions

- PR base: `main` once it exists. This checkout currently has no HEAD or remote branch ref.
- Tested state: uncommitted workspace; no SHA exists.
- Independent reviewer: Claude Code pre-build review completed in session `a21d8b0e-d43d-4e2a-a260-660f0ec0e040`. Full implementation review did not occur: Opus and Sonnet sessions reached a usage limit, and the owner explicitly waived this gate for deployment on 2026-09-29.
- Findings: [review log](001-babylon-sog-walk.md). The orientation, manifest API, yaw direction, and pointer-lock issues were addressed. Quest performance and Netlify public access remain unverified.
- Decisions and risks: The owner accepted the rate-limited public `r2.dev` host for this limited prototype. XR starts with a provisional 300,000-splat cap. The SOG is remote, experimental Babylon streaming is pinned to exact 9.28.0, and the scene has no collision surface.

## Verification

| Check | Result | Limit |
| --- | --- | --- |
| `npm run check` | 17 tests passed; TypeScript passed | Desktop and pure logic only |
| `npm run build` | Passed | Vite warns main Babylon/XR chunk exceeds 500 kB |
| `node scripts/smoke.mjs http://127.0.0.1:4173/` | Manifest and WebP chunk fetched; ready scene; pointer capture/release; no browser failures | Headless Chrome with SwiftShader |
| `node scripts/error-smoke.mjs http://127.0.0.1:4173/` | Injected HTTP 403 recovered with Retry | Manifest failure path only |
| Quest 2 production-build run | Pending | No headset access in cloud session |
| New Netlify draft | Passed; hosted HTML/bundle hashes and browser SOG requests matched | Production remains unpublished |
| Netlify production | Passed; exact validated draft published and unauthenticated browser loaded it | XR headset remains untested |

## Owner acceptance

1. Run the local app and confirm the Ronda Lobato scene appears. Walk with W/A/S/D and look with the mouse. Confirm Escape releases the pointer and Reset returns to the start.
2. In Quest Browser, serve the exact production build from the owner's Mac using `npm run preview -- --host 0.0.0.0 --port 4173`, `adb reverse tcp:4173 tcp:4173`, then visit `http://localhost:4173/`. Confirm both eyes, head tracking, left-stick movement, exit/reentry, and record OVR Metrics FPS/GPU time after warm-up.
3. After separately approved Netlify actions, validate the isolated draft bundle and SOG requests. Verify the exact draft was published and production is publicly accessible without a password or team login.

## External actions

The user authorized creation and draft upload, then separately approved publication of exact draft `6abbe613c767a317895b5f12` to site `c36ba72b-98ec-4c0d-9bf9-31d1ec6c8600` and Public visibility if needed. Netlify now reports that same deploy as published; unauthenticated production checks passed. No commit, push, PR creation, or merge was performed.
