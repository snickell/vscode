# Plan

## Intent

Finish the current `origin/main` port of the first-class Local Workspace targets branch and leave no half-adopted file-family plumbing behind.

The branch already has the right design:

- explicit `WORKSPACE_LOCAL` and `WORKSPACE_FOLDER_LOCAL` targets
- explicit local files for the supported file family
- explicit provenance in inspect, read, write, and UI flows
- one canonical descriptor-first mechanism for the supported workspace file family

This pass is not a redesign. It is a finish pass on top of the current pushed branch head.

## Current Branch State

The branch head is pushed and CI is running on it.

The current worktree delta against that pushed head is not feature code. It is only `NEW_WORK.md`, which is an instruction file and not part of the branch product. That means the remaining implementation work must come from reviewing the branch itself and tightening the current code shape, not from carrying forward a hidden local feature diff.

The current live branch story remains:

- `settings`, `tasks`, `launch`, and `extensions` participate in the local workspace file family
- `*.code-workspace.local` is a real local workspace source for the supported sections
- `.vscode/*.local.json` is a real local folder source for the supported standalone files
- local values remain separate from shared values in inspect, merge, write, and UI flows

## Final Intended Shape

Keep the descriptor-first mechanism and finish it cleanly.

The canonical descriptor in `workspaceFileConfiguration.ts` is the source of truth for the supported workspace file family. The final branch should make the surrounding plumbing read as one intentional mechanism:

- exact typed subsets for sectioned, local, and standalone descriptor slices
- parser and loader call sites consuming those exact slices directly
- configuration editing and extension recommendation code using the descriptor shape consistently
- no remaining casts or optional-field recovery where the descriptor API can express the real invariant directly

Do not broaden the scope beyond the file family already on this branch. Do not retreat from explicit local targets.

## Planned Work

1. Review the branch against the pushed head and fix the remaining shape issues in code.
   Keep the current typed-descriptor cleanup, then remove the last cast and the last descriptor lookup assertions so the shared file-family plumbing ends in one exact typed shape.

2. Re-run the focused validation slice on the current tree.
   Keep using the current TS 6 / `ES2024` toolchain and the source-level mocha checks that are reproducible here. Use the browser harness only where it is actually runnable.

3. Re-run the finish passes after the code settles.
   Re-do coherence, minimalism, and mergeability on the code as it exists after the final cleanup, not on the earlier port.

4. Commit, push, watch CI, and fix branch-caused failures until green.
   External permission or billing failures should be recorded as external. Real compile, test, screenshot, or platform regressions from this branch must be fixed on branch.

## Validation

In progress on the current upstream base.

Current signals:

- the merge onto `origin/main` is complete
- the pushed branch head is `fa1f86c8ecb734855cb207d8682bc2d0d4ee762f`
- the current-main code port is complete, including the post-merge syntax repairs and the current-tree cleanup that moved workbench configuration constants back onto the canonical descriptor module
- the workbench-only constructor compatibility branch was removed; current callers in sessions and tests now pass explicit empty local models instead
- the follow-on cleanup already introduced explicit typed descriptor subsets for section-bearing and local section-bearing entries
- `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc -p src/tsconfig.json --noEmit --pretty false --skipLibCheck` passes on the current tree
- `./node_modules/.bin/tsc -p extensions/configuration-editing/tsconfig.json --noEmit --pretty false --skipLibCheck` passes on the current tree
- direct source-level mocha validation passes for the descriptor regression in `configurationModels.test.ts` and the Local Workspace inspect case in `extHostConfiguration.test.ts`
- the screenshot upload failure on the current pushed head is external to branch code: the job reaches artifact upload and then gets a `403` from the screenshot service
- the `Prevent engineering system changes in PRs` failure on the current pushed head is external to branch code: the workflow token cannot query collaborator permissions on `microsoft/vscode`
- the browser-bound configuration and recommendation slices are still not directly reproducible in this shell

## Critique Pass 1: coherence

Reopened.

The final branch must still read as one mechanism across `settings`, `tasks`, `launch`, `extensions`, and `*.code-workspace.local`. The acceptable cleanup is the one that sharpens the descriptor API so the call sites express those invariants directly. Any cleanup that reintroduces ad hoc per-file branching is wrong.

## Critique Pass 2: minimalism

Reopened.

The right final simplification is to make the descriptor surface exact enough that consumers do less work. The wrong simplification is to hide invariants in casts, fallbacks, or duplicated local tables.

## Critique Pass 3: style and mergeability

Reopened.

The branch should end with straightforward call sites, explicit invariants, and no local-only rescue logic where a typed descriptor subset can state the contract. CI caveats must be separated cleanly into branch-caused failures and fork-environment failures.
