# Plan

## Intent

Make the local workspace file family descriptor-first.

The branch already supports:

- `.vscode/settings.local.json`
- `.vscode/tasks.local.json`
- `.vscode/launch.local.json`
- `.vscode/extensions.local.json`
- `*.code-workspace.local` sections for `settings`, `tasks`, `launch`, and `extensions`

The remaining work is not new behavior first. It is shared structure first.

The code should describe the file family once, in one typed internal table, and let the existing readers, writers, and recommendation paths consume that description instead of each carrying partial filename and key knowledge.

## Constraints

- keep shared state shared and local state local
- keep provenance explicit in inspect, read, and write paths
- keep workspace-folder membership derived only from the shared workspace file
- keep `Local Workspace Settings` and `Local Folder Settings` wording unchanged
- keep the extension manifest static; no code generation
- optimize for upstream mergeability, not abstraction theater

## Planned Work

- completed with `src/vs/workbench/services/configuration/common/workspaceFileConfiguration.ts` as the canonical typed descriptor for `settings`, `tasks`, `launch`, and `extensions`
- completed by deriving standalone workspace and folder-local resource knowledge from that descriptor
- completed by rewiring workspace parser, folder loader, cache plumbing, and write routing to consume descriptor-backed helpers
- completed by rewiring extension recommendation shared/local target discovery to consume the same descriptor-backed metadata
- completed by mirroring the descriptor shape in `extensions/configuration-editing` runtime selectors without introducing a workbench-to-extension import edge
- completed by adding a regression test that asserts the supported file family and its shared/local resource mapping

## Validation

Completed:

- `tsc -p extensions/configuration-editing/tsconfig.json --noEmit --pretty false`
- `tsc -p src/tsconfig.json --noEmit --pretty false` with only the pre-existing `src/vs/platform/environment/test/node/argv.test.ts` failures at lines 116 and 146
- focused unit/browser runs covering:
  - descriptor regression tests
  - local configuration editing writes
  - local workspace and local folder configuration service behavior
  - ext-host Local Workspace inspect behavior
  - local extension recommendation prompts
- configuration-editing integration suite with 18 passing tests

## Critique Pass 1: coherence

Completed.

The file family is now described once and consumed in the loader, writer, parser, and recommendation paths. `extensions` no longer carries its own path matrix.
This pass was rerun after the descriptor trim.

## Critique Pass 2: minimalism

Completed.

The refactor removes the loose path maps and the repeated standalone-resource routing logic. A followup trim then removed descriptor fields that were only restating the key and path shape. It does not add a new service layer, code generation, or manifest synthesis.
This pass was rerun after the descriptor trim.

## Critique Pass 3: style and mergeability

Completed.

The extension manifest stayed static, the extension runtime kept a local helper instead of importing workbench internals, the main checkout stayed free of tracked changes after focused validation, and `git diff --check` is clean.
This pass was rerun after the descriptor trim.
