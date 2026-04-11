# Checklist

- [x] Copy the supplied spec into `SPEC.md`.
- [x] Research the existing configuration loader, cache, watch path, and schema hooks.
- [x] Write `PLAN.md` from that research.
- [x] Create `CHECKLIST.md`, `NOTES.md`, and `AGENTS.md`.
- [x] Rewrite `SPEC.md` to the broader local-workspace-overrides scope.
- [x] Rewrite `/Users/seth/src/vscode-3-overlay-folder.spec.md` to match `SPEC.md`.
- [x] Extend both spec copies to cover `extensions.json` and `*.code-snippets`.
- [x] Decide whether to implement a reusable JSON local-overrides helper for paired `.vscode/*.json` and `.vscode.local/*.json` files, but only if it cleanly serves all four JSON-backed cases in scope: settings, tasks, launch, and extensions.
- [x] Teach folder configuration loading to read `.vscode/settings.json` and `.vscode.local/settings.json` in precedence order.
- [x] Extend folder watch handling to include `.vscode.local/` and its `settings.json`.
- [x] Extend folder cache serialization/deserialization to include local-overrides content.
- [x] Ignore invalid local-overrides JSONC and keep shared settings effective.
- [x] Bind the folder settings schema to `/.vscode.local/settings.json`.
- [x] Extract shared local-overrides path helpers for supported `.vscode/*.json` files.
- [x] If it does not cleanly serve all four JSON-backed cases, explicitly keep per-subsystem resolution instead of forcing the helper.
- [x] Teach task resolution to honor `.vscode.local/tasks.json` with shared-write semantics preserved.
- [x] Teach launch resolution to honor `.vscode.local/launch.json` with shared-write semantics preserved.
- [x] Teach extension recommendations read/watch flows to honor `.vscode.local/extensions.json` with shared-write semantics preserved.
- [x] Decide whether workspace snippets support fits under the 30-line budget.
- [x] If snippet support exceeds the 30-line budget, explicitly leave it out and keep the docs/checklist consistent with that decision.
- [x] Bind schema/editor support for `/.vscode.local/tasks.json`, `/.vscode.local/launch.json`, and `/.vscode.local/extensions.json`.
- [x] Add folder-workspace tests for settings local-overrides precedence and lifecycle reloads.
- [x] Add a test for settings local-overrides parent-folder deletion.
- [x] Add a test for invalid settings local-overrides fallback.
- [x] Add a test that the settings folder cache payload includes local-overrides content.
- [x] Add a multi-root test proving per-folder isolation with local workspace overrides.
- [x] Add tasks local-overrides tests.
- [x] Add launch local-overrides tests.
- [x] Add extensions local-overrides tests.
- [x] Do not add helper tests because no shared JSON local-overrides helper landed across all four JSON-backed cases.
- [x] Do not add snippets local-overrides tests because snippet support did not land.
- [x] Update `PLAN.md` for upstream alignment and local-overrides framing before further code or test edits.
- [x] Extend `CHECKLIST.md` for the upstream alignment work.
- [x] Align the in-repo and out-of-repo spec copies with the upstream local-overrides framing.
- [x] Rename avoidable branch-owned "overlay" wording in specs, tests, and other reviewer-facing files to "local overrides" or equivalent upstream-aligned language.
- [x] Mention sibling `*.code-workspace.local` files as the saved-workspace equivalent when future work is referenced.
- [x] Re-read `SPEC.md` against the current upstream tree.
- [x] Re-evaluate current upstream ownership for settings, tasks, launch, extensions, caching, watching, and schema binding.
- [x] Decide whether the current patch shape still fits the current upstream tree cleanly or whether parts should be rewritten.
- [x] If current upstream offers a cleaner shared path, rewrite or consolidate onto it instead of preserving older duplication.
- [x] Re-run the relevant tests and fix failures.
- [x] Critique pass 1: correctness and boundary shape.
- [x] Critique pass 2: minimalism and style.
- [x] Critique pass 3: merge-worthiness.

## Reviewer Followup

- [x] Keep the broadened scope coherent across `settings.json`, `tasks.json`, `launch.json`, and `extensions.json`.
- [x] Re-run the relevant tests after the followup changes.

## Rebased Finish

- [x] Bring the branch onto current `origin/main`.
- [x] Inspect the upstream diff in the relevant paths against the old base.
- [x] Port or rewrite the code on that base.
- [x] Re-run rebased validation on the current `origin/main` base.
- [x] Critique the rebased branch for correctness and boundary shape.
- [x] Critique the rebased branch for minimalism and style.
- [x] Critique the rebased branch for merge-worthiness.
- [ ] Commit the rebased result.
- [ ] Push the branch.
- [ ] Wait for CI.
- [ ] Fix CI if it fails.
