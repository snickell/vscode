# Local Agent Notes

Reload this file on restart. Reload `SPEC.md`, `PLAN.md`, `CHECKLIST.md`, and `NOTES.md` when compacting context or resuming after interruption.

## Task

Implement the canonical descriptor-first refactor for first-class Local Workspace state across the supported workspace file family from `SPEC.md`.

## Working Rules

- keep the implementation clean, correct, minimal, and explicit
- prefer real layers over overlays or ad hoc special cases
- keep `NOTES.md` append-only; never rewrite it, only append
- update `CHECKLIST.md` as implementation progresses
- if the plan becomes wrong, rewrite `PLAN.md` instead of carrying stale intent
- the end of `PLAN.md` must include at least three critique-and-fix passes, and those passes must actually be run
- match existing VS Code code style and naming
- aim for a diff that VS Code maintainers can merge without needing to rediscover the design

## Continuation

On restart:

- read `SPEC.md`
- read `PLAN.md`
- read `CHECKLIST.md`
- read `NOTES.md`
- continue from the first unchecked item in `CHECKLIST.md`
