Issue or topic: 001-babylon-sog-walk
Phase: pre-build validation review
PR base: main when the remote branch exists; current repository has no remote branch refs
Design: docs/superpowers/specs/2026-09-29-babylon-sog-walk-design.md
Plan: docs/superpowers/plans/2026-09-29-babylon-sog-walk.md
Review log: docs/reviews/001-babylon-sog-walk.md
Pre-build review: docs/reviews/001-babylon-sog-walk-prebuild.md
Acceptance criteria: design criteria 1–7
Requested action: Independently and read-only review the approach, Babylon 9.28.0 streamed-SOG API, the scene-specific orientation/start pose, public asset access, acceptance coverage, and manual Netlify draft/production gates. Return numbered findings to the owner; do not edit tracked files or launch Codex.
Applicable checks: Inspect package source under spikes/001-babylon-stream/node_modules and the disposable spike; inspect .context/babylon-stream-spike.png; independently fetch lod-meta.json and one chunk if useful. Do not create a Netlify site or deploy.
Record results in: Return findings for Codex to add to docs/reviews/001-babylon-sog-walk.md and revise the pre-build report.
Owner approval already received for this phase: Design approved 2026-09-29 with a separate public Netlify deployment requirement; owner supplied manual Mac CLI release process.
Outstanding decisions or blocked checks: Owner pre-build confirmation remains required after your review; Netlify team/site undecided; headset XR check unavailable in desktop Chrome.
