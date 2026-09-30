# Ronda Lobato run log

## Asset and scene

- Manifest: `https://pub-dd92ae5131ec49f1bbd411b51a858249.r2.dev/20260820_RondaLobato/lod-meta.json`
- Manifest ETag on 2026-09-29: `"4c1119ec3c572d9a76e5d203985a19a3"`; content length 89,296 bytes; Last-Modified `Tue, 29 Sep 2026 12:38:58 GMT`.
- Format: PlayCanvas-style streamed SOG metadata, `version: 1`, five LOD levels; source generator is not named in the metadata.
- Start pose: `(0, 5, 40)` looking toward `(0, 5, 0)`. Babylon loader's default `rotation.x = -π/2` is overridden to `0`; its Y-axis scale flip remains. This was chosen by inspecting three forward walking poses on localhost.
- Rendering: Babylon core/loaders `9.28.0`; `memoryBudgetMb: 128`, `maxDetailLod: 0`, `decodeSh: false`, two concurrent downloads, desktop budget 600,000 and provisional XR budget 300,000.

## Build and verification

- Branch: `rabat`; checkout has no HEAD commit or remote branch ref yet. Review state is uncommitted. No deploy ID exists.
- Node and browser: Node 22; headless Google Chrome with SwiftShader WebGL2 on the cloud VM.
- Production bundle: `dist/index.html` SHA-256 `526de2f5e8c69ee976f3d57cf321f2df9f570e4eed75ccd9743d31429d5673d0`; main JS `dist/assets/index-BPIzCdbZ.js` SHA-256 `1d4fb91643bb1f6cf9679461e22885a0f4d6d2b4116361b44194aaf09445ff56` (local build before independent review; rebuild after any change).
- Desktop localhost: manifest and WebP chunks returned 200; scene visible at start and after walking; screenshots in ignored `.context/`. Browser smoke reported pointer lock and Escape release, with no page/request failures. Injected manifest HTTP 403 recovered through Retry.
- XR: headset verification and FPS/GPU measurements are pending a Quest 2 run. No desktop result is presented as an XR pass.
- Netlify: Mac CLI `27.3.0`, team `splnlss` (Ohayo Mountain INC), new Git-unlinked project `ronda-lobato-babylon-sog-walk`, site ID `c36ba72b-98ec-4c0d-9bf9-31d1ec6c8600`. Validated draft deploy ID `6abbe613c767a317895b5f12`; draft URL `https://6abbe613c767a317895b5f12--ronda-lobato-babylon-sog-walk.netlify.app/`. Downloaded draft HTML and bundle hashes matched the local build. Hosted draft browser smoke fetched manifest/WebP chunks, passed pointer lock and Retry, and had no page/request failures.
- Production: after exact-action approval on 2026-09-29, `restoreSiteDeploy` published the same deploy ID at `2026-09-29T19:08:03.489Z`. Live URL: `https://ronda-lobato-babylon-sog-walk.netlify.app/`. Netlify site API reports `published_deploy.id = 6abbe613c767a317895b5f12`, `repo_url: null`, empty `build_settings`, and `password: null`. Unauthenticated cloud GET returned HTTP 200 with SHA-256 identical to `dist/index.html`; downloaded main JavaScript also matched `dist`. Production Chrome smoke reached ready, fetched the public manifest and WebP chunks, passed pointer lock/Escape, and reported no page or request errors. No visibility change was needed for public access.
