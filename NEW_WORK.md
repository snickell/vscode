# New Work

This branch currently treats Local Workspace settings as first-class, but it still leaves the other workspace file mechanisms outside that model.

That is no longer the target.

Extend the first-class local-workspace model to the other naturally related workspace files:

- `.vscode/tasks.local.json`
- `.vscode/launch.local.json`
- `.vscode/extensions.local.json`
- the corresponding `tasks`, `launch`, and `extensions` sections in `*.code-workspace.local`

Keep the feature story the same:

- shared workspace state remains shared
- local workspace state remains local
- provenance stays explicit
- writes, inspect surfaces, and UI affordances should reflect that distinction where those surfaces exist

## Required process updates

Before implementing:

- update `PLAN.md` to cover this new work
- add new items to `CHECKLIST.md` for the new work
- uncheck existing checklist items for testing, validation, review/critique, simplification, style, merge-readiness, and similar end-pass improvement phases
- keep `NOTES.md` append-only; do not rewrite it

After implementing:

- rerun the reopened validation and critique phases
- update `PLAN.md` again if the refactor changed the best implementation shape

## Implementation direction

Do not bolt this on file by file.

While doing this work, seriously consider a major refactor to share as much code path as possible between:

- shared and local workspace file discovery
- load/watch/cache plumbing
- local-versus-shared file pairing
- saved-workspace versus folder-workspace local file handling
- schema/editor/completion registration
- any inspect or write-routing code that can be unified cleanly

The goal is not abstraction for its own sake. The goal is to avoid ending up with four separate ad hoc implementations for settings, tasks, launch, and extensions.

Prefer a refactor when it removes duplication and makes the first-class-local model more uniform. Do not keep duplicated branches just because they already exist.

## Expected outcome

When this pass is done, this branch should read as one coherent first-class local-workspace mechanism, not a settings-only mechanism plus special cases.

It should be possible to explain the branch in one sentence:

Local workspace state is first-class across the supported workspace file family, with separate files, separate provenance, and shared plumbing where that reduces duplication.

Start implementing now.
