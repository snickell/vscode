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
- [x] Re-run validation for the naming pass.
- [x] Refactor the shared and local workspace-file plumbing so settings, tasks, launch, and extensions can use the same first-class local mechanism.
- [x] Load, watch, cache, and merge `.vscode/tasks.local.json`, `.vscode/launch.local.json`, and `.vscode/extensions.local.json`.
- [x] Parse and merge `tasks`, `launch`, and `extensions` from `*.code-workspace.local`.
- [x] Route local-target writes for `tasks`, `launch`, and `extensions` to the local workspace file family.
- [x] Extend inspect and effective-value behavior for the supported local workspace file family.
- [x] Extend schema, editor-association, and completion registration across the local workspace file family.
- [x] Add or update focused tests for local tasks, launch, and extensions across folder and saved workspaces.
- [x] Re-run validation for the local workspace file family pass.
- [x] Critique pass 1: coherence.
- [x] Critique pass 2: minimalism.
- [x] Critique pass 3: style and mergeability.

## Reviewer Followup

- [x] Fill the remaining schema/completion/editor-association gaps for local workspace and local folder settings files.
- [x] Re-run the focused compile and test set after the local workspace file family changes.
