# VS Code Local Workspace Settings as First-Class Targets

## Summary

Add explicit local workspace settings targets to VS Code, rather than smuggling a local file in as an untyped overlay.

This project introduces new targets for local workspace settings, new files to back them, new inspect surfaces, and explicit UI affordances.

The effect is straightforward:

- shared workspace settings remain committed and visible as workspace settings
- local workspace settings become a distinct target with higher precedence inside that workspace
- VS Code merges both internally in memory and never rewrites the merged result back into the shared file

This is the fully first-class form of the Local Workspace settings feature and the largest change.

## Problem

The motivating problem is not only file loading. It is provenance.

Users want:

- shared repo settings such as "lint using prettier" and "tabsize 2"
- personal per-workspace settings such as "titlebar color in this workspace" and "minimap off in this workspace"

If the local layer is real, the product should say so. It should be inspectable, writable, and visible as its own target.

## Design

Introduce two new configuration targets:

- `WORKSPACE_LOCAL`
- `WORKSPACE_FOLDER_LOCAL`

Introduce two new backing files:

- saved workspace local file: sibling `*.code-workspace.local`
- folder local file: `.vscode/settings.local.json`

Precedence order shall be:

1. defaults
2. application
3. user local and remote
4. shared workspace
5. local workspace
6. shared workspace folder
7. local workspace folder
8. memory
9. policy

This preserves the existing rule that more specific workspace state beats less specific workspace state, while allowing a personal override at each workspace level.

## Public Surface Changes

### Configuration model and inspect API

Add inspect fields for the new targets:

- `workspaceLocalValue`
- `workspaceFolderLocalValue`
- structured `workspaceLocal`
- structured `workspaceFolderLocal`

Extension-host inspect surfaces shall expose corresponding fields so extensions can reason about origin correctly.

### Settings UI

Add explicit UI entry points:

- "Open Workspace Settings" -> shared target
- "Open Local Workspace Settings" -> local target
- "Open Folder Settings" -> shared folder target
- "Open Local Folder Settings" -> local folder target

The Settings UI shall display local targets as separate tabs or target selectors. It shall not silently fold them into "Workspace".

### Write path

`updateValue(...)` shall accept the new targets and write to the corresponding local file.

Target derivation without an explicit target remains unchanged. A caller must select the local target intentionally.

## File Semantics

### Saved workspaces

- shared file: `name.code-workspace`
- local file: `name.code-workspace.local`

The local file may contain only sections valid for a workspace file. `folders` in the local file are ignored.

### Folder workspaces

- shared file: `.vscode/settings.json`
- local file: `.vscode/settings.local.json`

The local file is parsed with the same folder-settings schema and trust filtering as the shared folder file.

## Merge Semantics

- Local targets override their shared peer target.
- Shared and local layers remain distinct in inspect output and change events.
- Change events shall identify the correct source target rather than masquerading as `WORKSPACE`, `WORKSPACE_FOLDER`, or `MEMORY`.

## Implementation Shape

This is a cross-cutting project.

Expected subsystems:

- platform configuration target enum and inspect model
- workbench configuration assembly and change propagation
- configuration editing and target routing
- settings schemas and settings editor target selection
- extension-host configuration inspect surface
- tests across platform, workbench, and ext host

Probable touch points include:

- `/Users/seth/src/vscode/src/vs/platform/configuration/common/configuration.ts`
- `/Users/seth/src/vscode/src/vs/platform/configuration/common/configurationModels.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/browser/configuration.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/browser/configurationService.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/common/configurationEditing.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/preferences/browser/preferencesService.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/preferences/common/preferencesModels.ts`
- `/Users/seth/src/vscode/src/vs/workbench/api/common/extHostConfiguration.ts`

## Diagnostics and UX

The product shall make origin legible.

Required behaviors:

- settings inspect shows whether a value comes from shared workspace or local workspace
- opening a local settings file gets the correct schema and completions
- settings UI does not imply that editing shared workspace settings edits local settings

## Tests

Required coverage:

- precedence for shared workspace versus local workspace
- precedence for shared folder versus local folder
- inspect surfaces expose the new values correctly
- change events report the correct source target
- write paths update the correct file
- ext host receives correct inspect data
- trust filtering continues to apply
- invalid local files do not corrupt shared settings

## Estimate

- Source change: extra large
- Expected size: roughly 1000 to 2000 or more lines across configuration model, editing, UI, ext host, and tests
- Correctness: highest
- Cleanliness: best; this is a real mechanism, not a disguised overlay
