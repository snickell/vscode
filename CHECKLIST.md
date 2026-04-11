# Checklist

- [x] Copy the source spec into `SPEC.md`.
- [x] Write `PLAN.md` from codebase research.
- [x] Create `CHECKLIST.md`, `NOTES.md`, and `AGENTS.md`.
- [x] Add `WORKSPACE_LOCAL` and `WORKSPACE_FOLDER_LOCAL` to configuration targets and inspect types.
- [x] Extend the core configuration model to store and merge workspace-local and folder-local layers distinctly.
- [x] Load, watch, and cache `*.code-workspace.local`.
- [x] Load, watch, and cache `.vscode/settings.local.json`.
- [x] Keep `folders` ignored in workspace-local files and preserve trust filtering for local files.
- [x] Route `updateValue(...)` and configuration editing writes to the new local targets.
- [x] Expose the new targets through preferences services and file resolution.
- [x] Add explicit commands and UI affordances for local workspace and local folder settings.
- [x] Register schema/editor/completion support for local settings files.
- [x] Extend ext-host inspect surfaces and `src/vscode-dts/vscode.d.ts`.
- [x] Rewrite `PLAN.md` around Local Workspace settings as the feature story and first-class targets as the implementation strategy.
- [x] Update branch-local docs and notes to tie the feature directly to `.vscode/settings.local.json` and `*.code-workspace.local`.
- [x] Audit user-facing commands, tabs, tooltips, selectors, and setting-scope labels for target-first wording.
- [x] Rename user-facing affordances to say `Local Workspace Settings` or `Local Folder Settings` where appropriate.
- [x] Add or update platform, workbench, editing, ext-host, and configuration-editing tests for the upstream-aligned naming pass.
- [ ] Re-run validation for the naming pass.
- [x] Refactor the shared and local workspace-file plumbing so settings, tasks, launch, and extensions can use the same first-class local mechanism.
- [x] Load, watch, cache, and merge `.vscode/tasks.local.json`, `.vscode/launch.local.json`, and `.vscode/extensions.local.json`.
- [x] Parse and merge `tasks`, `launch`, and `extensions` from `*.code-workspace.local`.
- [x] Route local-target writes for `tasks`, `launch`, and `extensions` to the local workspace file family.
- [x] Extend inspect and effective-value behavior for the supported local workspace file family.
- [x] Extend schema, editor-association, and completion registration across the local workspace file family.
- [x] Add or update focused tests for local tasks, launch, and extensions across folder and saved workspaces.
- [ ] Re-run validation for the local workspace file family pass.
- [x] Rewrite `PLAN.md` around the canonical local workspace file-family descriptor refactor.
- [x] Update `AGENTS.md` so restart context names the descriptor-first pass.
- [x] Introduce one typed canonical descriptor for `settings`, `tasks`, `launch`, and `extensions`.
- [x] Derive shared/local standalone resource metadata from the descriptor in configuration common code.
- [x] Rewire workspace parsing, folder loading, and cache plumbing to use descriptor-backed helpers.
- [x] Rewire configuration editing target validation, resource routing, and standalone-file labeling to use descriptor-backed metadata.
- [x] Rewire workspace extension recommendation shared/local target enumeration to use the descriptor-backed metadata.
- [x] Reuse the descriptor shape in `extensions/configuration-editing` runtime selectors or helper tables where practical.
- [x] Add a regression test for the canonical descriptor and adjust focused tests if the refactor changes assertions.
- [ ] Re-run the focused compile and test set for the descriptor-first pass.
- [ ] Critique pass 1: coherence.
- [ ] Critique pass 2: minimalism.
- [ ] Critique pass 3: style and mergeability.

## Reviewer Followup

- [x] Fill the remaining schema/completion/editor-association gaps for local workspace and local folder settings files.
- [ ] Re-run the focused compile and test set after the local workspace file family changes.

## Descriptor Trim

- [ ] Remove descriptor fields that were not pulling real weight after the descriptor-first refactor.
- [ ] Simplify the extension-side selector mirror without giving up the shared file-family shape.
- [ ] Re-run the focused compile and test set after the trim pass.

## Reopened After Trim

- [ ] Re-run the focused compile and test set for the descriptor-first pass after the trim.
- [ ] Re-run critique pass 1: coherence, after the trim.
- [ ] Re-run critique pass 2: minimalism, after the trim.
- [ ] Re-run critique pass 3: style and mergeability, after the trim.

## Checklist Rerun

- [x] Re-run the focused typecheck set on the current worktree.
- [ ] Re-run the focused browser and integration tests on the current implementation.
- [x] Re-check coherence, minimalism, and mergeability after the rerun.

## Tasteful Polish

- [x] Trim small bits of repetition in the descriptor helper without changing the file-family shape.
- [x] Make the extension recommendation target enumeration read a little cleaner.
- [ ] Make the configuration-editing selector and completion helpers a little plainer.
- [x] Re-run the focused validation slice after the polish pass.

## Upstream Port to Current Main

- [x] Bring the branch onto current `origin/main`.
- [x] Inspect the upstream diff in the relevant configuration, preferences, extensions, and configuration-editing paths.
- [x] Port or rewrite the code on that base.
- [x] Commit the result.
- [x] Push the branch.
- [x] Wait for CI.
- [ ] Fix CI if it fails.

## Current-Main Validation

- [x] Re-run the current-main source typecheck with the current TS 6 toolchain.
- [x] Re-run the direct source-level descriptor regression and Local Workspace ext-host inspect checks.
- [ ] Re-run the browser-bound configuration and recommendation slices on the current-main base.

## Finalization After Pushed Head

- [x] Review the current uncommitted delta against the pushed branch head.
- [x] Finalize the current refactor shape in code.
- [x] Re-run simplification, cleanup, validation, critique, and merge-readiness checks after the final code changes.
- [ ] Commit the remaining code changes.
- [ ] Push the branch.
- [ ] Watch CI on the new pushed head.
- [ ] Fix CI until green.
