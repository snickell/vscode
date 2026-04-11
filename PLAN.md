# Plan

## Aim

Port `.vscode.local/` local workspace overrides onto current `origin/main`, then carry the rebased branch through validation, critique, commit, push, and CI.

Shipped scope remains:

1. `.vscode/settings.json` plus `.vscode.local/settings.json`
2. `.vscode/tasks.json` plus `.vscode.local/tasks.json`
3. `.vscode/launch.json` plus `.vscode.local/launch.json`
4. `.vscode/extensions.json` plus `.vscode.local/extensions.json`

`*.code-snippets` remains deferred by spec. The correct change is still larger than the allowed budget. The shared JSON helper remains intentionally absent because it still does not cleanly cover all four shipped JSON-backed cases.

## Current Upstream Read

The current upstream tree still supports the same ownership split:

- settings, tasks, and launch belong on the configuration-service path
- extensions belongs in workspace recommendations
- `mcp.json` is now part of the folder configuration family and must remain intact
- the extension recommendations tests now live under `electron-browser`

No cleaner shared upstream seam replaced that split. The right current-upstream work is a port, not a rewrite to a new subsystem boundary.

## Phases

### Phase 1

Confirm the rebased tree and current upstream seams.

- re-read `SPEC.md`
- inspect the upstream diff in the touched paths
- confirm the branch is on current `origin/main`

### Phase 2

Port the code to the current upstream tree.

- preserve current `mcp.json` support
- keep folder settings, tasks, and launch in configuration loading, watching, and caching
- keep extensions in workspace recommendations
- keep schema coverage aligned with the shipped file set

### Phase 3

Rewrite the control files on the rebased tree.

- update `PLAN.md`
- update `CHECKLIST.md`
- reopen rebased validation and critique items
- keep `NOTES.md` append-only

### Phase 4

Validate the rebased branch.

- `corepack yarn compile`
- `node test/unit/browser/index.js --browser chromium --run src/vs/workbench/services/configuration/test/browser/configurationService.test.ts`
- `bash scripts/test.sh --run src/vs/workbench/contrib/extensions/test/electron-browser/extensionRecommendationsService.test.ts`
- `git diff --check`

### Phase 5

Critique the rebased result.

- correctness and boundary shape
- minimalism and style
- merge-worthiness

### Phase 6

Finish the branch.

- commit without opening an editor
- push
- wait for CI
- fix CI if it fails

## Current Read

The rebased port still keeps the same implementation shape:

- settings, tasks, and launch stay on the configuration-service path
- extensions stays in workspace recommendations
- `.vscode.local/` still earns its cost because the port remains small and inside existing owners
- no new write-target plumbing is required for this landing

If validation or CI disproves that read, rewrite again instead of defending stale shape.
