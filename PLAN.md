# Plan

## Intent

Bring the branch onto current `origin/main`, inspect what upstream changed in the touched subsystems, and then port the Local Workspace settings patch onto that base with the smallest coherent rewrite. Keep the feature minimal. Do not preserve older branch structure where current upstream now has different APIs, ownership, or wiring.

## Findings

The branch is now based on current `origin/main`.

The upstream diff from the original merge-base to current `origin/main` changed the touched areas materially:

- browser workbench configuration code now uses relative ESM imports and newer constructor signatures
- `ConfigurationModelParser` and related models now require `ILogService`
- `UserConfiguration` now carries parse options directly and also handles `mcp.json`
- folder configuration now already folds `mcp.json` into standalone folder resources
- configuration-editing metadata changed shape, including language activation and current JSON contributions
- test infrastructure changed in the touched suite, including user-data provider construction and disposal patterns

No new upstream primitive supersedes the folder-loader seam for this feature. The correct keep/rewrite decision on the new base is:

- keep the feature in `FileServiceBasedConfiguration`, `CachedFolderConfiguration`, and `FolderConfiguration`
- keep the exact `.vscode/settings.local.json` file model
- rewrite the old patch shape where it conflicted with current upstream `mcp.json`, parser/log-service, and test wiring changes
- keep the editor/schema path exact and narrow
- keep explicit watch coverage for deleting the parent `.vscode` directory

## Phases

Phase 1. Rebase first.

- Re-read `SPEC.md`.
- Bring the branch itself onto current `origin/main`.
- Do not treat documentation-only updates as progress before the base move is done.

Phase 2. Inspect upstream drift in touched areas.

- Review `git diff <old-base>..origin/main -- <touched paths>`.
- Identify upstream API and ownership changes that supersede the original branch assumptions.

Phase 3. Port the loader and cache path.

- Preserve current upstream `UserConfiguration` and `mcp.json` handling.
- Add the optional local settings resource only to the folder configuration path.
- Merge shared settings, local settings, then standalone folder configurations.
- Ignore invalid local JSON while keeping shared settings effective.
- Carry the local payload through the folder cache on the new base.

Phase 4. Port editor/schema support.

- Keep JSONC association and schema hookup exact to `/.vscode/settings.local.json`.
- Keep settings completions restricted to the supported path.

Phase 5. Port and tighten tests.

- Re-add folder tests on the new suite layout for override, create, delete, invalid local fallback, trust, cache, and multiroot behavior.
- Keep the explicit parent `.vscode` deletion regression test.

Phase 6. Focused validation.

- Run the validation available in this worktree.
- If dependency installation is absent, record the blocker precisely rather than pretending the validation ran.

Phase 7. Critique and fix, pass 1.

- Review quality, correctness, and obviousness on the rebased tree.
- Remove anything that still looks like a stale pre-upstream port artifact.

Phase 8. Critique and fix, pass 2.

- Review beautify, readability, and repo style.
- Match the current upstream file style, not the older branch style.

Phase 9. Critique and fix, pass 3.

- Review minimalism and most effective approach.
- Stop only when the rebased branch reads as a landable upstream patch.

Phase 10. Commit and publish.

- Commit the rebased code plus plan/checklist updates with an intentional message.
- Push the rebased branch.

Phase 11. Wait for CI and repair if needed.

- Wait for branch CI to report on the pushed commit.
- If CI fails, fix the branch on the current `origin/main` base and push again until it is green.

## Constraints

- No new public configuration target.
- No write-path changes.
- No globbing or include language.
- Keep the public framing as "Local Workspace settings".
- Keep future saved-workspace references aligned with `*.code-workspace.local`.
