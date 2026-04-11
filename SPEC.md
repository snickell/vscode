# VS Code Local Workspace Settings for Folder Workspaces

## Summary

Add support for Local Workspace settings in single-folder workspaces by reading one conventional personal settings file:

- shared file: `.vscode/settings.json`
- personal file: `.vscode/settings.local.json`

VS Code shall load both, merge them internally in memory, and use the merged tree as the effective folder configuration. It shall not rewrite the merged result back into `.vscode/settings.json`.

This is the smallest plausible folder-workspace slice of the broader Local Workspace settings request.

## Problem

The project is to support Local Workspace settings without interfering with the workspace settings that are normally committed to the repo and shared with the whole team.

The motivating split is simple:

- some per-workspace settings are best shared for the git repo, such as "lint using prettier" and "tabsize 2"
- other per-workspace settings are best left personal, such as "titlebar color in this workspace" and "minimap off in this workspace"

Today, single-folder workspaces have one `.vscode/settings.json`. That forces one file to carry both team policy and personal taste.

## Non-Goals

- No arbitrary globbing such as `settings.*.json`.
- No settings inheritance language such as `extends` or `$include`.
- No new configuration target in the public API.
- No write-path changes in v1. Built-in settings writes continue to target `.vscode/settings.json`.

## User-Visible Behavior

If `.vscode/settings.local.json` exists, VS Code shall:

1. read `.vscode/settings.json`
2. read `.vscode/settings.local.json`
3. parse both as JSONC
4. merge the local file on top of the shared file
5. use the merged tree as the effective folder settings model

If the local file does not exist, behavior is unchanged.

If the local file is invalid, the shared file remains effective. The invalid local file shall surface normal JSON diagnostics when opened.

## Merge Semantics

- Precedence: `settings.local.json` wins over `settings.json`.
- Merge mode: the same configuration-model merge behavior already used between configuration layers. Object-valued settings remain object merges at the setting-key level because settings are already represented as keyed configuration entries.
- Scope: folder settings only. This applies to `.vscode/settings.json` in single-folder and multi-root folder contexts.
- Trust and restricted-setting behavior remain unchanged. The local settings file is still a workspace-originated layer and shall obey the same trust filtering.

## Implementation Shape

The natural seam is the folder configuration loader.

At a minimum:

- extend the file-service-based folder configuration loader to resolve a second settings resource at `.vscode/settings.local.json`
- watch that file for create, write, delete, and parent-folder delete
- parse it with the same parser and parse options used for `.vscode/settings.json`
- merge its `ConfigurationModel` after the shared settings model and before the consolidated folder model is published
- include the local file in the folder configuration cache payload

Probable touch points:

- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/browser/configuration.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/common/configuration.ts`
- `/Users/seth/src/vscode/src/vs/workbench/services/configuration/test/browser/configurationService.test.ts`
- schema/completions registration if desired:
  - `/Users/seth/src/vscode/src/vs/workbench/services/configuration/browser/configurationService.ts`
  - `/Users/seth/src/vscode/extensions/configuration-editing/src/extension.ts`

## Editing Semantics

In v1:

- the Settings UI keeps writing shared workspace settings to `.vscode/settings.json`
- opening `.vscode/settings.local.json` manually is supported as a normal JSONC file
- optional but recommended: register the same folder settings schema for `.vscode/settings.local.json`

This deliberately avoids inventing a new settings target before the read path is proven useful.

Future related work, if pursued separately, should align saved-workspace support with sibling `*.code-workspace.local` files rather than introducing a different naming family.

## Tests

Add browser configuration-service coverage for:

- no local file: behavior unchanged
- local file present: local value overrides shared value
- local file present: shared-only keys still apply
- local file create after startup triggers reload
- local file delete after startup removes the local override effect
- invalid local file does not discard valid shared settings
- restricted settings still respect workspace trust
- cache round-trip includes the local override data

## Estimate

- Source change: small to medium
- Expected size: roughly 250 to 500 lines across loader, watcher, cache, schema hookup, and tests
- Correctness: high enough for a practical core feature
- Upstream posture: reasonable; this is additive, conventional, and bounded
