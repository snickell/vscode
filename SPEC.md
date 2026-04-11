# VS Code Untracked Local Workspace Overrides Directory

## Summary

Add a parallel personal configuration directory beside `.vscode/` for untracked local workspace overrides:

- shared directory: `.vscode/`
- local overrides directory: `.vscode.local/`

For each supported workspace-folder configuration file, VS Code shall read the shared file first, then read the matching local overrides file, then derive the effective folder result from both without mutating the shared file.

The first supported set is not settings alone. It is at least these four files:

- `.vscode/settings.json` with local overrides in `.vscode.local/settings.json`
- `.vscode/tasks.json` with local overrides in `.vscode.local/tasks.json`
- `.vscode/launch.json` with local overrides in `.vscode.local/launch.json`
- `.vscode/extensions.json` with local overrides in `.vscode.local/extensions.json`
- `.vscode/*.code-snippets` with local overrides in `.vscode.local/*.code-snippets`

The mechanism shall be regular. The rule is "same relative path under `.vscode.local/` overrides the file under `.vscode/`", not four unrelated one-off features.

This is the directory-form generalization of the same untracked local overrides idea already proposed upstream for sibling `*.code-workspace.local` files.

## Problem

The current folder model mixes shared repo state and local machine state in one namespace.

That is tolerable for one person. It is poor for a team.

Examples:

- shared settings: formatter choice, tab size, workspace trust defaults
- local settings: title bar color, minimap, window-specific toggles
- shared tasks: lint, test, build
- local tasks: machine-local wrappers, ad hoc scripts, alternate paths
- shared launch configs: team debug shapes
- local launch configs: personal ports, env, attachments
- shared extension recommendations: project-wide tools
- local extension recommendations: personal adds or local suppressions

The filesystem shape should separate those concerns once, cleanly, and then apply that rule uniformly.

## Scope

This landing introduces folder-level local override semantics for the supported `.vscode/*.json` files named below.

In scope:

- `.vscode.local/settings.json`
- `.vscode.local/tasks.json`
- `.vscode.local/launch.json`
- `.vscode.local/extensions.json`
- `.vscode.local/*.code-snippets`, but only if the implementation adds less than 30 lines of code
- shared-plus-local read precedence for each supported file
- watch, reload, and cache behavior where those systems already exist
- schema or editor registration where needed so the local files behave like their shared counterparts
- direct open/edit support for the local files

Out of scope:

- new configuration targets in the Settings UI
- automatic migration
- workspace-file (`*.code-workspace`) local override support
- arbitrary unknown file types under `.vscode.local/`

The intent is a general mechanism for supported workspace-folder JSON files, not a promise that every possible file under `.vscode/` is now overlaid.

## User-Visible Behavior

If a supported pair exists, VS Code shall resolve the effective folder file from the shared file plus the local overrides file with local precedence.

If `.vscode.local/` does not exist, behavior is unchanged.

If the local overrides file does not exist, behavior is unchanged.

If the shared file does not exist but the local overrides file exists, the effective result shall be derived from the local file alone.

The local overrides directory is local by convention. Git policy is up to the repository, but the intended setup is to ignore `.vscode.local/`.

## Semantics By File

### Settings

- parse both files as JSONC
- merge object content with local values winning
- preserve existing folder-scope filtering, trust behavior, and resource scoping
- do not write the merged result back into either file

### Tasks

- parse both files as tasks JSON
- merge the two JSON objects with local values winning
- object-valued properties merge recursively
- array-valued properties from the local overrides file replace the shared value at that property
- built-in task writes may continue to target `.vscode/tasks.json`

### Launch

- parse both files as launch JSON
- merge the two JSON objects with local values winning
- object-valued properties merge recursively
- array-valued properties from the local overrides file replace the shared value at that property
- built-in launch writes may continue to target `.vscode/launch.json`

### Extensions

- parse both files as extensions recommendation JSON
- merge the two JSON objects with local values winning
- object-valued properties merge recursively
- array-valued properties from the local overrides file replace the shared value at that property
- built-in recommendation toggles may continue to target `.vscode/extensions.json`

### Workspace Snippets

- this is optional for this landing unless it can be implemented in less than 30 lines of code
- discover `*.code-snippets` files from both `.vscode/` and `.vscode.local/`
- if a basename exists only in one directory, use it
- if the same basename exists in both directories, the local file shadows the shared file
- invalid local snippet files are ignored; a valid shared file with the same basename remains effective
- built-in snippet creation may continue to target `.vscode/`

## Universal Mechanism

The code should model local override pairs or local overrides directory sets, not special-case filenames throughout the tree.

A supported folder configuration file is:

1. a shared resource under `.vscode/<name>.json`
2. a local overrides resource under `.vscode.local/<name>.json`
3. a file-specific resolver that knows how to parse and combine the two

The common rule is:

1. read shared content if present
2. read local content if present
3. if both are absent, yield no file
4. if one is present, use it
5. if both are present, combine with local precedence
6. watch both paths and parent folders
7. keep cache semantics aligned with the effective result

The implementation should centralize path derivation and file pairing so adding another supported `.vscode/*.json` file later is small and explicit.

The default combine rule is the existing configuration-model rule:

- merge objects recursively
- when both sides provide a non-object value, local replaces shared
- arrays are treated as values, so local arrays replace shared arrays

For JSON-backed single-file configs, a common helper is appropriate only if it cleanly serves the existing JSON-backed cases already in scope.

That helper should do only this:

1. derive the shared and local resources
2. read both
3. optionally ignore invalid local JSON
4. invoke a caller-supplied merge callback, or the default object merge rule

That means all of:

- `settings.json`
- `tasks.json`
- `launch.json`
- `extensions.json`

If the helper does not actually simplify all four of those cases, do not force it in.

It is not the clean fit for workspace snippets.

`*.code-snippets` is a folder-enumeration case, not a single-file local override pair. The reusable seam there is lower-level:

1. enumerate shared folder entries
2. enumerate local folder entries
3. combine by basename with local shadowing
4. let the snippets service parse and load the chosen files

Because this is a separate mechanism, snippet support is required only if it can be landed in less than 30 lines of implementation code. If it needs more than that, leave it out of this change.

## Error Handling

Invalid local overrides data shall not poison the shared file.

- invalid `.vscode.local/settings.json`: ignore the local overrides file and keep shared settings effective
- invalid `.vscode.local/tasks.json`: ignore the local overrides file and keep shared tasks effective
- invalid `.vscode.local/launch.json`: ignore the local overrides file and keep shared launch configs effective
- invalid `.vscode.local/extensions.json`: ignore the local overrides file and keep shared extension recommendations effective
- invalid `.vscode.local/*.code-snippets`: ignore the local file and keep any shared file with the same basename effective

If both files are invalid or absent, existing error behavior remains.

## Editing Semantics

Read and write targets are not identical concerns.

- shared team-editing flows may continue to write `.vscode/*.json`
- direct editing of `.vscode.local/*.json` must be supported

This landing is primarily about correct read semantics. It does not require re-plumbing every built-in write path to target `.vscode.local/`.

## Probable Touch Points

- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/common/configuration.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/browser/configuration.ts`
- `/Users/seth/src/vscode/src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts`
- `/Users/seth/src/vscode/src/vs/workbench/contrib/tasks/common/taskConfiguration.ts`
- `/Users/seth/src/vscode/src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/extensionRecommendations/common/workspaceExtensionsConfig.ts`
- `/Users/seth/src/vscode/src/vs/workbench/contrib/snippets/browser/snippetsService.ts`
- `/Users/seth/src/vscode/src/vs/workbench/contrib/snippets/browser/snippetsFile.ts`
- `/Users/seth/src/vscode/extensions/configuration-editing/package.json`
- tests in the corresponding configuration, tasks, debug, and extensions areas
- tests in the snippets area

## Tests

Add coverage for:

- no `.vscode.local/`: behavior unchanged
- local-only supported file: effective result comes from local file
- shared-plus-local settings precedence
- shared-plus-local tasks precedence under object-merge and array-replace semantics
- shared-plus-local launch precedence under object-merge and array-replace semantics
- shared-plus-local extensions precedence under property override semantics
- shared and local workspace snippets union when basenames differ
- local workspace snippet shadows shared snippet file with the same basename
- create, write, delete of the local settings and local tasks files trigger reload
- delete of `.vscode.local/` parent folder removes the local override effect
- invalid local files fall back to shared behavior
- multi-root folder isolation is preserved

## Estimate

- Source change: medium to large
- Correctness risk: moderate, because three subsystems outside folder settings need their own resolver hooks
- Clean result: good, if the local override pairing is centralized and the per-file merge rules stay small
