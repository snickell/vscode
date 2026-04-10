# Plan

## Intent

Extend the first-class local-workspace mechanism from settings-only coverage to the related workspace file family:

- `.vscode/settings.local.json`
- `.vscode/tasks.local.json`
- `.vscode/launch.local.json`
- `.vscode/extensions.local.json`
- `*.code-workspace.local` sections for `settings`, `tasks`, `launch`, and `extensions`

Keep the product story the same:

- shared workspace state remains shared
- local workspace state remains local
- provenance stays explicit
- writes, inspect surfaces, and UI affordances reflect the split where those surfaces exist

## Implemented Base

- adds `WORKSPACE_LOCAL` and `WORKSPACE_FOLDER_LOCAL` to configuration targets and inspect state
- stores workspace-local and folder-local settings layers distinctly in core configuration state
- loads and watches `.vscode/settings.local.json` and `*.code-workspace.local`
- ignores `folders` in local workspace files by continuing to derive workspace folders only from the shared workspace file
- preserves restricted-setting trust filtering for local files
- routes explicit settings writes to local workspace and local folder files
- exposes local settings through preferences services, commands, split-editor resolution, and Settings UI target selection
- wires JSONC language, schema associations, and completion providers for local settings files
- extends ext-host inspect data and `vscode.d.ts`

## Refactor Direction

Do not bolt the new files on one at a time. The implementation should converge on one local-workspace file family mechanism.

The refactor should unify, where it genuinely reduces duplication:

- shared and local workspace file discovery
- load, watch, and cache plumbing
- shared-versus-local file pairing for saved workspaces and folder workspaces
- standalone workspace file handling for `tasks`, `launch`, and `extensions`
- schema, editor-association, and completion registration
- write routing for shared and local workspace file family members

## Planned Work

- completed with a declarative standalone-file map shared by the workspace parser, folder loader, and write-routing paths
- completed for folder-local file discovery, caching, and merge plumbing across `tasks.local.json`, `launch.local.json`, and `extensions.local.json`
- completed for saved-workspace local parsing and consolidation across `tasks`, `launch`, and `extensions` in `*.code-workspace.local`
- completed for local write routing of `tasks`, `launch`, and `extensions`
- completed for inspect and effective-value behavior of `launch`, `tasks`, and `extensions`
- completed for schema associations, editor registration, language selectors, and completions across the local workspace file family
- completed for focused tests across configuration, configuration editing, configuration-editing extension behavior, and extension recommendations

## Validation

Completed:

- `tsc -p extensions/configuration-editing/tsconfig.json --noEmit --pretty false`
- `tsc -p src/tsconfig.json --noEmit --pretty false` with only the pre-existing `src/vs/platform/environment/test/node/argv.test.ts` failures at lines 116 and 146
- configuration-editing integration suite with 18 passing tests
- targeted browser run from `/Users/seth/src/vscode` with 14 passing local-workspace tests
- targeted electron-sandbox run for local extension recommendations with 2 passing tests

## Critique Pass 1: coherence

Completed.

- the branch now reads as one first-class local-workspace file family, not settings support plus side paths
- `extensions.local.json` and `*.code-workspace.local` recommendation handling now uses the same shared/local distinction as the rest of the pass

## Critique Pass 2: minimalism

Completed.

- the refactor stayed on declarative file maps and reused existing standalone-model and JSON-editing paths
- the recommendation service fix preserved its prior `getExtensionsConfigs()` contract instead of leaking placeholder entries

## Critique Pass 3: style and mergeability

Completed.

- naming follows existing VS Code file and settings conventions
- `git diff --check` is clean
- the main checkout used for focused validation remained free of tracked changes
