# Checklist

- [x] Copy the spec into `SPEC.md`.
- [x] Write `PLAN.md` from repo research.
- [x] Create `AGENTS.md`, `CHECKLIST.md`, and `NOTES.md`.

## Current Origin/Main Port

- [x] Re-read `SPEC.md`.
- [x] Bring the branch itself onto current `origin/main`.
- [x] Inspect the upstream diff from the old base to current `origin/main` in the touched configuration and editor files.
- [x] Rewrite `PLAN.md` for the rebased tree.
- [x] Port the folder loader and cache changes onto the current upstream `mcp.json` and parser/log-service structure.
- [x] Port the editor/schema path onto the current `configuration-editing` metadata layout.
- [x] Port the browser tests onto the current suite layout.
- [x] Keep explicit coverage for parent `.vscode` deletion on the new base.
- [ ] Run focused validation and fix failures.
- [x] Critique and fix, pass 1: quality, correctness, and obviousness.
- [x] Critique and fix, pass 2: beautify, readability, and repo style.
- [x] Critique and fix, pass 3: minimalism and most effective approach, with rewrite if warranted.
- [ ] Commit the rebased result with an intentional message.
- [ ] Push the branch.
- [ ] Wait for CI.
- [ ] Fix CI if it fails.
