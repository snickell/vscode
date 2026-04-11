# Plan

## Intent

Port the branch onto current `origin/main` and keep the feature first-class on the current tree.

The current upstream is not the tree this work started on. The branch now sits on a merged `origin/main` with newer configuration model APIs, newer preferences/editor infrastructure, newer extension recommendation plumbing, an `electron-browser` test layout, and a TS 6 / ES2024 toolchain.

The feature story stays the same:

- explicit `WORKSPACE_LOCAL` and `WORKSPACE_FOLDER_LOCAL` targets
- explicit local files for the supported workspace file family
- explicit provenance in inspect, read, write, and UI flows

The implementation story must be updated to the current seams.

## Upstream Findings

The upstream diff review on the touched paths showed four things that matter here:

- configuration common and workbench configuration code now carry newer parser, inspect, and logging shapes; the port must fit those directly instead of preserving older helper contours
- preferences command and editor registration changed materially; the local-target commands must be rethreaded through the current registration shape, not through older command blocks
- extension recommendation tests and services now live on the `electron-browser` side and use newer test setup utilities
- the current toolchain expects TS 6 semantics and `ES2024`; validation must use a current compiler, not the stale TS 5.2 binary from the old checkout

## Decision

Keep the current target model.

The current upstream still does not provide a cleaner native seam than explicit `WORKSPACE_LOCAL` and `WORKSPACE_FOLDER_LOCAL` targets. The correct port is therefore not a retreat to overlays or disguised merged files. The correct port is to fit the existing first-class target model into the current upstream structure with less drift and fewer bespoke branches.

The descriptor-first file-family refactor also still holds. The remaining work is to make the current upstream port compile, read cleanly, and validate on the new tree.

## Planned Work

1. Complete the current-upstream port cleanup after the merge.
   Fix post-merge syntax and API drift in the current touched files, especially preferences command registration, configuration editing routing, extension recommendation test plumbing, and settings completion registration.

2. Reconcile the local workspace file family with current upstream ownership boundaries.
   Keep the canonical descriptor in workbench configuration common code and keep the extension runtime on a local mirror where a direct import would be a layering mistake.

3. Re-run targeted validation on the current toolchain.
   Use a current TS 6 compiler for source validation, rerun the focused source-level checks that still run cleanly on the merged tree, and use the built main checkout only where the browser harness is still required.

4. Re-run the end passes on the current upstream base.
   Re-do coherence, minimalism, and style/mergeability review after the port is stable, not by inheriting the old-base verdicts.

5. Commit, push, wait for CI, and repair CI if needed.

## Validation

In progress on the current upstream base.

Current signals:

- the merge onto `origin/main` is complete
- the upstream review is complete
- the current-main code port is complete, including the post-merge syntax repairs and the current-tree cleanup that moved workbench configuration constants back onto the canonical descriptor module
- the workbench-only constructor compatibility branch was removed; current callers in sessions and tests now pass explicit empty local models instead
- `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc -p src/tsconfig.json --noEmit --pretty false --skipLibCheck` passes
- `./node_modules/.bin/tsc -p extensions/configuration-editing/tsconfig.json --noEmit --pretty false --skipLibCheck` passes
- direct source-level mocha validation passes for the descriptor regression in `configurationModels.test.ts` and the Local Workspace inspect case in `extHostConfiguration.test.ts`
- the browser-bound suites still require the real browser harness; the built-checkout runner is currently hanging silently here, and direct source-level mocha stops at missing browser globals for the configuration and recommendation suites

## Critique Pass 1: coherence

Reopened.

Reran after the current-main port.

The branch still tells one story across settings, tasks, launch, extensions, and `*.code-workspace.local`: local state is explicit, target-specific, and not collapsed into overlays. The one new upstream wrinkle is `mcp`, which belongs in the canonical descriptor as a user and shared-folder standalone configuration, but not in the local workspace file-family assertions. The regression test now checks both the full descriptor set and the local subset explicitly.

## Critique Pass 2: minimalism

Reopened.

Reran after the current-main port.

The worthwhile trim on the newer tree was to remove the workbench-only constructor compatibility branch and update the remaining older call sites directly. The other worthwhile trim was to stop shadowing descriptor-backed constants in `configuration.ts`. The platform-layer compatibility defaulting remains justified because current upstream still has old-form callers there.

## Critique Pass 3: style and mergeability

Reopened.

Reran after the current-main port.

The final current-tree cleanup keeps the diff on the current ownership lines: descriptor-backed constants live in the descriptor module, workbench call sites pass explicit local models, tests describe the local workspace subset separately from the wider descriptor set, and the merge-repair noise in preferences and completion registration has been reduced to straightforward syntax and import cleanup. The only remaining caveat is environmental: browser-harness validation is not yet reproducible in this shell despite the source-level passes and green typechecks.
