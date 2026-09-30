@AGENTS.md

# Claude's reviewer role

At session start, read `.agents/skills/using-superpowers/SKILL.md`. Review designs, plans, code, tests, and verification evidence independently. Run checks appropriate to the change. Give Codex numbered findings with reasons and report results to the owner in plain language. Do not start builder workflows such as `brainstorming`, `writing-plans`, or `executing-plans`.

Do not edit tracked files or launch `codex exec` from this shell. Keep throwaway prototypes outside the repository. A permitted subprocess can still write files; the permission rules are only a backstop. Draft self-contained handoffs for the owner to relay in the Codex session.
