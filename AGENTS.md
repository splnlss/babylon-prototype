# Repository agent contract

## Project and branch policy

- Product work targets PR base `main` (`origin/main` for comparisons once it exists). The remote currently has no branch refs; compare reviews against the PR's actual base branch when available.
- `package.json`, `src/`, and `README.md` are the source of truth for commands and product behavior once the prototype exists.
- Use the current Conductor workspace and branch. Do not create a nested worktree or rename the branch for a skill workflow.
- Do not commit, push, create a PR, or merge automatically. Prepare a reviewable diff; the owner decides when to commit or publish it.

## Roles and skills

- Codex owns tracked code, tests, designs, plans, and documentation. Claude Code independently reviews and verifies in a separate session in this same workspace. Claude does not edit tracked files or launch `codex exec`. The owner relays handoffs between sessions.
- At session start, read `.agents/skills/using-superpowers/SKILL.md` and relevant skills. For a new feature, begin `brainstorming`; for a bug, begin `systematic-debugging`; use `test-driven-development` for behavior changes. A handoff naming an approved design and plan resumes those artifacts.
- Use `docs/templates/CODEX_HANDOFF.md` for owner-relayed handoffs and `docs/templates/PR_DESCRIPTION.md` for a PR description.
- Use `subagent-driven-development` only if a reviewed plan has independent tasks and the owner chooses delegation. Conductor already supplies workspace isolation. This file's branch and commit policy overrides generic skill directions.

## Design and pre-build review

- The owner participates in design. Obtain approval at the `brainstorming` design gates.
- For a substantial feature, write a design at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` with numbered, user-checkable acceptance criteria. Write a plan at `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` mapping each criterion to implementation and verification.
- Validate risky technical assumptions before product implementation. Put Codex throwaway validation code under `spikes/<id>-<slug>/` and remove it before a PR. Claude validates independently with read-only inspection or a prototype outside this repository.
- Codex maintains `docs/reviews/<id>-<slug>.md` for numbered findings and `docs/reviews/<id>-<slug>-prebuild.md` for the approach, alternatives, validation, acceptance coverage, and decisions. Claude checks both against evidence.
- The owner confirms the reviewed pre-build package before substantial-feature implementation. Design approval alone does not clear this gate.

## Implementation and verification

- Run relevant checks and address review findings. Never delete, skip, or weaken an existing test merely to make checks pass. Update tests when approved behavior changes.
- Before a PR is ready, Claude independently reviews the full diff against the actual base and runs applicable checks. Report the exact tested commit SHA or uncommitted state, results, limits, risks, and steps the owner can try. The owner decides whether to merge.
- For small, low-risk changes, use a shorter design and review cycle. For bugs, establish the cause and add a meaningful regression check when feasible.

## Checks and shared services

- Command source of truth: `package.json` once created. Planned checks: `npm run check` and `npm run build`; browser check: run the Vite app, load a sample splat, and try immersive VR on a WebXR-capable headset.
- A desktop browser cannot establish headset performance or XR interaction. Mark that check blocked when no headset is available.
- Each Conductor workspace has isolated processes. Local dev uses `$CONDUCTOR_PORT`; cloud dev uses a specified port. No database or other shared service is planned.

## Stop conditions and external changes

- After design approval, stop for product or scope decisions, a new paid service, changed auth or security semantics, a disputed test contract, and unresolved review disagreements.
- Do not commit, print, or log credentials. Keep secrets in ignored `.env*` files or an approved external store.
- Before any production mutation, obtain separate immediate approval for its exact target and action. The prototype has no production service.
- The owner reviews the final PR summary, tries the acceptance criteria, and decides whether to merge.
