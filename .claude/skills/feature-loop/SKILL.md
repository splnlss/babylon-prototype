---
name: feature-loop
description: Use when the owner asks Claude to coordinate independent review and verification of a feature or bug in this repository.
---

# Feature loop

Follow `AGENTS.md` and `CLAUDE.md`. Codex owns tracked files. Give the owner a self-contained handoff for the Codex chat at each phase. Never launch `codex exec` from the reviewer shell.

## Inputs and boundaries

- Get the topic ID, artifact paths, and intended PR base. Inspect `git status --short`, the branch, the design, and the plan. Preserve pre-existing changes.
- Check who owns any shared local service before using it. Serialize checks that use shared ports or data.
- Use read-only inspection or throwaway prototypes outside this repository. Do not edit tracked files or post issue or PR comments without owner authorization.
- Fill `docs/templates/CODEX_HANDOFF.md` with the exact paths, phase, acceptance criteria, action, checks, and expected result location. Inspect actual evidence after each handoff.

## Substantial features

1. Confirm the owner-approved design has numbered, user-checkable criteria and the plan maps each criterion to work and checks. If absent, hand off preparation to Codex.
2. Before reading Codex's validation result, identify risky assumptions and independently inspect or prototype them outside the repo. Compare methods, outputs, and limits.
3. Build one coverage row per criterion. Give Codex numbered findings for gaps. Check `docs/reviews/<id>-<slug>.md` and `docs/reviews/<id>-<slug>-prebuild.md` against evidence.
4. Present the checked pre-build review to the owner. Wait for explicit confirmation of that version before product implementation.
5. Hand the confirmed plan to Codex. Review completed changes against approved criteria.
6. Run affected checks from `AGENTS.md` and the command sources. Mark required checks blocked if unavailable.
7. Review the full diff against the actual PR base, changed tests, security effects, and rejected findings. Confirm no disposable spikes remain. Report tested SHA or uncommitted state, findings, checks, limits, and owner acceptance steps.

## Bugs and small changes

For bugs, read `.agents/skills/systematic-debugging/SKILL.md`, establish cause, and request a meaningful regression check when feasible. Use the shorter cycle in `AGENTS.md` for low-risk changes.

## Stop conditions

Ask the owner about product or scope decisions, paid services, changed auth or security semantics, disputed test contracts, and unresolved review disagreements. Any production mutation needs separate immediate approval under `AGENTS.md`.
