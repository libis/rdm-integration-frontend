# Coverage Improvement Plan

_Last refreshed:_ 2025-10-07T22:47:10Z

## Mission

- Increase Angular unit test coverage toward 100% across statements, branches, functions, and lines without sacrificing code quality.
- Prioritise high-impact components (DownloadComponent, ConnectComponent, service layer) and critical pilot plugin scenarios.
- Keep tests reliable, maintainable, and free of flakiness.

## Operating Rhythm

- **Checkpoint cadence:** Re-read and update this plan at the start of each work session, after every major code change, and before delivering summaries or status reports.
- **Status notes:** Maintain the "Progress Log" section below—append timestamped bullet notes summarising newly completed work or blockers.
- **TODO hygiene:** Keep the "Active Focus" checklist current; unstarted items live in "Backlog".

## Current Snapshot

- Latest known coverage (2025-10-07): Statements 88.95%, Branches 79.57% (from prior `npm run test -- --watch=false --browsers=ChromeHeadless --code-coverage`).
- Target metrics for this cycle: ≥95% statements/functions/lines, ≥92% branches.

## Active Focus

- [x] Enhance `ConnectComponent` specs to cover pilot plugin repo search error paths and OAuth failure handling.
- [x] Add branch coverage for dataset creation edge cases in `ConnectComponent` (`newDataset`, `setDoiItems`, `restoreFromDatasetPid`).
- [x] Strengthen `DownloadComponent` error-state expectations (HTTP failure branches).
- [ ] Verify service-level tests (`repo.lookup.service`, `data.state.service`) capture retry/error flows.
- [ ] Run full suite with coverage report (`npm run test:ci`) and update metrics here.

## Backlog

- [ ] Evaluate snapshot restore logic (`attemptFullRestore`, `restoreFromSnapshot`) via integration-style specs.
- [ ] Add tests around `ConnectValidationService` edge cases (empty fields, malformed URLs).
- [ ] Cover rare navigation branches (e.g. Globus callback path, dataset deep links).
- [ ] Investigate possibility of shared test utilities to reduce duplication.

## Command Palette

| Purpose                | Command                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| Focused spec run       | `npm run test -- --watch=false --browsers=ChromeHeadless --include=<spec>` |
| Full suite + coverage  | `npm run test:ci`                                                          |
| Lint check             | `npm run lint`                                                             |
| Production build smoke | `npm run build:prod`                                                       |
| Angular CLI generators | `npx ng g component <name>`                                                |

> All commands above are auto-approved in VS Code settings to allow unattended execution.

## Quality Gates

- Only count coverage improvements validated by passing unit tests and lint.
- Avoid fragile assertions (DOM snapshots, timing-dependent expectations).
- Ensure new specs fail meaningfully if implementation regresses.

## Progress Log

- _2025-10-07T22:25Z_ – Plan created; next step is to expand ConnectComponent specs (OAuth/search failure branches).
- _2025-10-07T22:37Z_ – Added repo search error/OAuth scope tests and dataset restoration coverage in `connect.component.behavior.spec.ts`.
- _2025-10-07T22:47Z_ – Hardened `DownloadComponent` specs to assert repo/dataset search error surfaces; targeted ChromeHeadless run green.
